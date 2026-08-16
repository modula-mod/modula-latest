import {useCallback, useMemo, useState} from 'react'
import {Image} from 'expo-image'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ComposerToolsDrawer} from '@/components/composer/ComposerToolsDrawer'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ChromeCircleButton} from '@/components/primitives/ChromeCircleButton'
import {Avatar} from '@/components/primitives/Avatar'
import {Surface} from '@/components/primitives/Surface'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import {useSession} from '@/auth/runtime'
import type {DraftLinkPreview, PendingMediaAttachment, PostAudience, ReplyPermission} from '@/domain/social'
import {PublicationStatusBanner} from '@/features/atproto/components/PublicationStatusBanner'
import {useAtprotoCapability} from '@/features/atproto/data/useApiMetadataQuery'
import {usePrimaryAtprotoConnection} from '@/features/atproto/data/useAtprotoConnectionsQuery'
import {useAtprotoPreferencesQuery} from '@/features/atproto/data/useAtprotoPreferences'
import {
  destinationToPublishFlag,
  evaluateCrossPostEligibility,
  resolveDefaultDestination,
  type PublishingDestination,
} from '@/features/atproto/publishing/canCrossPost'
import {useCreatePostMutation, usePostQuery, useUpdatePostMutation} from '@/features/feed/data'
import {parsePostId} from '@/api/contracts'
import {selectionHaptic, lightImpactHaptic} from '@/lib/haptics'
import {useAppServices} from '@/runtime/useAppServices'
import {
  KeyboardSafeScreen,
  captureMediaFromSource,
  confirmModulaAction,
  keyboardScrollProps,
} from '@/platform/ui'
import {SelectionSheet} from '@/platform/ui/sheets/selection-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PollPreview = {
  question: string
  options: string[]
}

type ContentWarning = 'none' | 'sensitive' | 'spoiler'

const AUDIENCE_OPTIONS = [
  {
    id: 'public' as const,
    label: 'Everyone',
    description: 'Anyone on Modula can see this post.',
    icon: 'people' as AppIconName,
  },
  {
    id: 'followers' as const,
    label: 'Followers',
    description: 'Only people who follow you.',
    icon: 'profile' as AppIconName,
  },
  {
    id: 'innerCircle' as const,
    label: 'Inner Circle',
    description: 'Close circle audience.',
    icon: 'saved' as AppIconName,
    preview: true,
  },
  {
    id: 'modules' as const,
    label: 'Modules',
    description: 'Module-scoped visibility.',
    icon: 'modules' as AppIconName,
    preview: true,
  },
]

const REPLY_OPTIONS = [
  {
    id: 'everyone' as const,
    label: 'Everyone',
    description: 'Anyone can reply.',
    icon: 'people' as AppIconName,
  },
  {
    id: 'followers' as const,
    label: 'Followers',
    description: 'Only your followers can reply.',
    icon: 'profile' as AppIconName,
  },
  {
    id: 'mentioned' as const,
    label: 'Mentioned only',
    description: 'Only people you mention.',
    icon: 'messages' as AppIconName,
  },
  {
    id: 'innerCircle' as const,
    label: 'Inner Circle',
    description: 'Close circle replies.',
    icon: 'saved' as AppIconName,
    preview: true,
  },
]

const CW_OPTIONS = [
  {
    id: 'none' as const,
    label: 'No warning',
    description: 'Post shows normally.',
    icon: 'check' as AppIconName,
  },
  {
    id: 'sensitive' as const,
    label: 'Sensitive media',
    description: 'Blur media until tapped.',
    icon: 'warning' as AppIconName,
    preview: true,
  },
  {
    id: 'spoiler' as const,
    label: 'Spoiler',
    description: 'Hide text until revealed.',
    icon: 'info' as AppIconName,
    preview: true,
  },
]

const AUDIENCE_LABEL: Record<PostAudience, string> = {
  public: 'Everyone',
  followers: 'Followers',
  innerCircle: 'Inner Circle',
  modules: 'Modules',
}

const DESTINATION_OPTIONS = [
  {
    id: 'modula' as const,
    label: 'Modula',
    description: 'Publish on Modula only. Default destination.',
    icon: 'home' as AppIconName,
  },
  {
    id: 'modula+atproto' as const,
    label: 'Modula + External Network',
    description: 'Optional: also publish a public copy via connected External Networks (AT Protocol).',
    icon: 'integrations' as AppIconName,
  },
]

const DESTINATION_LABEL: Record<PublishingDestination, string> = {
  modula: 'Modula',
  'modula+atproto': 'Modula + External Network',
}

const REPLY_LABEL: Record<ReplyPermission, string> = {
  everyone: 'Everyone can reply',
  followers: 'Followers can reply',
  mentioned: 'Mentioned can reply',
  innerCircle: 'Inner Circle can reply',
}

function apiAudience(audience: PostAudience): 'public' | 'followers' {
  return audience === 'followers' ? 'followers' : 'public'
}

function apiReplyPermission(permission: ReplyPermission): 'everyone' | 'followers' | 'mentioned' {
  if (permission === 'innerCircle') return 'followers'
  return permission
}

/**
 * Shared Composer — Home toolbar, prompt, FAB, and reply mode all open this screen.
 * Premium layout inspired by IMG_0306 with Modula teal accent (not X-blue).
 */
export function ComposerScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    mode?: string
    replyTo?: string
    thread?: string
    quotePostId?: string
    editPostId?: string
    expectedVersion?: string
  }>()
  const insets = useSafeAreaInsets()
  const session = useSession()
  const {apiClient} = useAppServices()
  const createPostMutation = useCreatePostMutation()
  const updatePostMutation = useUpdatePostMutation()
  const {colours, radius, spacing} = useThemeTokens()
  const atprotoPublishing = useAtprotoCapability('atprotoPublishing')
  const {connection} = usePrimaryAtprotoConnection()
  const preferencesQuery = useAtprotoPreferencesQuery()

  const isReplyMode = params.mode === 'reply' || Boolean(params.replyTo)
  const isQuoteMode = Boolean(params.quotePostId)
  const isEditMode = Boolean(params.editPostId)
  const isThreadPreview = params.thread === '1' || params.mode === 'thread'
  const editPostId = (() => {
    if (!params.editPostId) return null
    try {
      return parsePostId(params.editPostId)
    } catch {
      return null
    }
  })()
  const editPostQuery = usePostQuery(editPostId)
  const editExpectedVersion = (() => {
    const raw = params.expectedVersion
    if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw)
    if (typeof editPostQuery.data?.version === 'number') return editPostQuery.data.version
    return null
  })()

  const [text, setText] = useState('')
  const [history, setHistory] = useState<string[]>([''])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [hydratedEditPostId, setHydratedEditPostId] = useState<string | null>(null)
  const [media, setMedia] = useState<PendingMediaAttachment | null>(null)
  const [altText, setAltText] = useState('')
  const [link, setLink] = useState<DraftLinkPreview | null>(null)
  const [poll, setPoll] = useState<PollPreview | null>(null)
  const [audience, setAudience] = useState<PostAudience>('public')
  const [destination, setDestination] = useState<PublishingDestination>('modula')
  const [replyPermission, setReplyPermission] = useState<ReplyPermission>('everyone')
  const [contentWarning, setContentWarning] = useState<ContentWarning>('none')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [audienceOpen, setAudienceOpen] = useState(false)
  const [destinationOpen, setDestinationOpen] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [cwOpen, setCwOpen] = useState(false)
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null)
  const [publicationBanner, setPublicationBanner] = useState<
    'publishedOnModula' | 'publishingToAtproto' | 'needsAttention' | null
  >(null)

  if (
    isEditMode &&
    editPostId &&
    editPostQuery.data &&
    hydratedEditPostId !== editPostId
  ) {
    const next = editPostQuery.data.text?.trim() ?? ''
    setHydratedEditPostId(editPostId)
    setText(next)
    setHistory([next])
    setHistoryIndex(0)
    // Edit mode is text-only against Greenfield UpdatePostInput.
    setMedia(null)
    setLink(null)
    setPoll(null)
  }

  const crossPostEligibility = evaluateCrossPostEligibility({
    atprotoPublishingCapability: atprotoPublishing,
    connection,
    preferences: preferencesQuery.data,
    audience,
    media: media ? [media] : [],
    poll,
    isDraft: false,
    textLength: text.trim().length,
    sensitiveInternal: contentWarning !== 'none',
  })

  const showDestinationSelector = crossPostEligibility.allowed
  const effectiveDestination: PublishingDestination = showDestinationSelector
    ? destination
    : 'modula'

  const hasDraft = Boolean(text.trim() || media || link || poll)
  const isPublishing = createPostMutation.isPending || updatePostMutation.isPending
  const canPost =
    Boolean(text.trim()) &&
    !isPublishing &&
    (!isEditMode || (editPostId !== null && editExpectedVersion !== null))
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const headerTitle = useMemo(() => {
    if (isEditMode) return 'Edit post'
    if (isReplyMode) return 'Reply'
    if (isThreadPreview) return 'Thread — Preview'
    return 'New Post'
  }, [isEditMode, isReplyMode, isThreadPreview])

  const pushHistory = useCallback(
    (next: string) => {
      setHistory(prev => {
        const trimmed = prev.slice(0, historyIndex + 1)
        if (trimmed[trimmed.length - 1] === next) return trimmed
        const stack = [...trimmed, next]
        return stack.length > 40 ? stack.slice(stack.length - 40) : stack
      })
      setHistoryIndex(prev => Math.min(prev + 1, 39))
    },
    [historyIndex],
  )

  const onChangeText = (next: string) => {
    setText(next)
    pushHistory(next)
  }

  const undo = () => {
    if (!canUndo) return
    const nextIndex = historyIndex - 1
    setHistoryIndex(nextIndex)
    setText(history[nextIndex] ?? '')
    void selectionHaptic()
  }

  const redo = () => {
    if (!canRedo) return
    const nextIndex = historyIndex + 1
    setHistoryIndex(nextIndex)
    setText(history[nextIndex] ?? '')
    void selectionHaptic()
  }

  const leaveComposer = () => {
    Keyboard.dismiss()
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/index' as Href)
    }
  }

  const closeComposer = async () => {
    if (!hasDraft) {
      leaveComposer()
      return
    }

    const discarded = await confirmModulaAction({
      title: 'Discard draft?',
      message: 'Your local draft will be lost. This does not affect published posts.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      destructive: true,
    })
    if (discarded) {
      leaveComposer()
    }
  }

  const publish = async () => {
    if (!canPost || session.status !== 'signedIn') return
    if (isEditMode) {
      if (!editPostId || editExpectedVersion === null) {
        setPermissionMessage('This post cannot be edited (missing version).')
        return
      }
      try {
        const updated = await updatePostMutation.mutateAsync({
          postId: editPostId,
          expectedVersion: editExpectedVersion,
          text: text.trim(),
        })
        void lightImpactHaptic()
        Keyboard.dismiss()
        router.replace(`/post/${updated.id}` as Href)
      } catch (error) {
        setPublicationBanner('needsAttention')
        setPermissionMessage(
          error instanceof Error ? error.message : 'Edit failed. Your draft is still here so you can retry.',
        )
      }
      return
    }
    if (media && !media.base64) {
      setPermissionMessage('Photo data was not available. Remove the photo and select it again before posting.')
      return
    }
    const postMedia = media
      ? [
          {
            ...media,
            altText: altText.trim() || undefined,
          },
        ]
      : []

    // Never silently change audience to Public for AT cross-posting.
    const publishToAtproto =
      showDestinationSelector && destinationToPublishFlag(effectiveDestination)
    if (publishToAtproto && !crossPostEligibility.allowed) {
      setPermissionMessage('This post cannot be cross-posted to AT Protocol.')
      return
    }

    try {
      if (isQuoteMode && params.quotePostId) {
        await apiClient.post(
          {
            path: `/v1/posts/${params.quotePostId}/quote`,
            body: {
              commentary: text,
              idempotencyKey: `quote-${Date.now()}-${Math.round(Math.random() * 999999)}`,
            },
            authenticated: true,
          },
          value => value,
        )
      } else {
        await createPostMutation.mutateAsync({
          text,
          audience: apiAudience(audience),
          replyPermission: apiReplyPermission(replyPermission),
          media: postMedia,
          linkPreview: link ?? undefined,
          poll: poll ?? undefined,
          idempotencyKey: `post-${Date.now()}-${Math.round(Math.random() * 999999)}`,
          publishToAtproto,
        })
      }
      setPublicationBanner(publishToAtproto ? 'publishingToAtproto' : 'publishedOnModula')
      setText('')
      setMedia(null)
      setLink(null)
      setPoll(null)
      setAltText('')
      setDestination(
        resolveDefaultDestination(preferencesQuery.data, crossPostEligibility.allowed),
      )
      void lightImpactHaptic()
      Keyboard.dismiss()
      if (isReplyMode && params.replyTo) {
        router.replace(`/post/${params.replyTo}` as Href)
      } else if (isQuoteMode && params.quotePostId) {
        router.replace(`/post/${params.quotePostId}` as Href)
      } else {
        router.replace('/index' as Href)
      }
    } catch {
      setPublicationBanner('needsAttention')
      setPermissionMessage('Post failed. Your draft is still here so you can retry.')
    }
  }

  const handlePickedAsset = (
    localUri: string,
    width?: number,
    height?: number,
    mimeType?: string | null,
    base64?: string | null,
  ) => {
    setPermissionMessage(null)
    setMedia({
      localId: `local-media-${Date.now()}`,
      kind: 'image',
      localUri,
      base64: base64 ?? undefined,
      width,
      height,
      mimeType: mimeType ?? undefined,
    })
  }

  const pickPhoto = async () => {
    const result = await captureMediaFromSource('library', {target: 'composer'})
    if (result.ok) {
      handlePickedAsset(
        result.asset.uri,
        result.asset.width,
        result.asset.height,
        result.asset.mimeType,
        result.asset.base64,
      )
      return
    }
    if (result.reason !== 'cancelled') {
      setPermissionMessage(result.message)
    }
  }

  const capturePhoto = async () => {
    const result = await captureMediaFromSource('camera', {target: 'composer'})
    if (result.ok) {
      handlePickedAsset(
        result.asset.uri,
        result.asset.width,
        result.asset.height,
        result.asset.mimeType,
        result.asset.base64,
      )
      return
    }
    if (result.reason !== 'cancelled') {
      setPermissionMessage(result.message)
    }
  }

  const comingSoonTool = (name: string, detail: string) => {
    Alert.alert('Coming Soon', detail)
  }

  const toolbarItems: {label: string; icon: AppIconName; onPress: () => void}[] = [
    {label: 'Photo', icon: 'photo', onPress: () => void pickPhoto()},
    {label: 'Camera', icon: 'camera', onPress: () => void capturePhoto()},
    {
      label: 'GIF — Coming Soon',
      icon: 'gif',
      onPress: () =>
        comingSoonTool(
          'GIF',
          'GIF search is not part of beta Composer. No picker is opened and nothing is attached.',
        ),
    },
    {
      label: 'Poll — Coming Soon',
      icon: 'poll',
      onPress: () =>
        comingSoonTool(
          'Poll',
          'Polls are not part of beta Composer. No poll is added to this draft.',
        ),
    },
    {
      label: 'Link — Coming Soon',
      icon: 'link',
      onPress: () =>
        comingSoonTool(
          'Link',
          'Link cards are not part of beta Composer. Paste a URL in the post text instead.',
        ),
    },
    {
      label: 'Module post — Coming Soon',
      icon: 'modules',
      onPress: () =>
        comingSoonTool('Module post', 'Module posts are not part of this beta.'),
    },
    {
      label: 'Location / Circle — Coming Soon',
      icon: 'community',
      onPress: () =>
        comingSoonTool('Location / Circle', 'Location and Circle attach are not part of this beta.'),
    },
    {
      label: 'Content warning — Coming Soon',
      icon: 'warning',
      onPress: () =>
        comingSoonTool(
          'Content warning',
          'Content warnings are not part of beta Composer. Nothing is attached to this draft.',
        ),
    },
  ]

  return (
    <KeyboardSafeScreen
      style={[styles.screen, {backgroundColor: colours.canvas}]}
      headerOffset={0}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            borderBottomColor: colours.border,
            paddingHorizontal: spacing[4],
          },
        ]}>
        <ChromeCircleButton
          icon="close"
          accessibilityLabel="Cancel composer"
          onPress={() => void closeComposer()}
        />
        <View style={styles.headerCenter}>
          <AppText variant="headline">{headerTitle}</AppText>
          <AppPressable
            accessibilityLabel="Open drafts"
            onPress={() => router.push('/drafts' as Href)}
            style={styles.draftsLink}>
            <AppText variant="label" style={{color: colours.accent}}>
              Drafts
            </AppText>
          </AppPressable>
        </View>
        <AppPressable
          accessibilityLabel={isReplyMode ? 'Publish reply' : 'Publish post'}
          accessibilityState={{disabled: !canPost}}
          disabled={!canPost}
          onPress={() => void publish()}
          style={[
            styles.postButton,
            {
              backgroundColor: canPost ? colours.accent : colours.surfaceMuted,
              borderRadius: radius.round,
            },
          ]}>
          <AppText
            variant="label"
            style={{
              color: canPost ? colours.accentForeground : colours.textTertiary,
            }}>
            {isEditMode ? 'Save' : isReplyMode ? 'Reply' : 'Post'}
          </AppText>
        </AppPressable>
      </View>

      <ScrollView
        {...keyboardScrollProps}
        contentContainerStyle={[styles.content, {gap: spacing[3], padding: spacing[4]}]}>
        {isEditMode ? (
          <Surface variant="muted" style={{padding: spacing[3], borderRadius: radius.md}}>
            <AppText variant="caption" colour="textSecondary">
              Editing post text. Media and audience cannot be changed here.
            </AppText>
            {editPostQuery.isError ? (
              <AppText variant="caption" colour="textSecondary">
                Could not load the post for editing.
              </AppText>
            ) : null}
          </Surface>
        ) : null}
        {isReplyMode && params.replyTo ? (
          <AppText variant="caption" colour="textSecondary">
            Replying to post {params.replyTo}
          </AppText>
        ) : null}
        {isQuoteMode && params.quotePostId ? (
          <AppText variant="caption" colour="textSecondary">
            Quoting a post — add your commentary below.
          </AppText>
        ) : null}
        {isThreadPreview ? (
          <Surface variant="muted" style={{padding: spacing[3], borderRadius: radius.md}}>
            <AppText variant="caption" colour="textSecondary">
              Thread composer — Preview. Extra posts in a thread are local-only for now.
            </AppText>
          </Surface>
        ) : null}

        <View style={[styles.authorRow, {gap: spacing[3]}]}>
          <Avatar
            name={session.status === 'signedIn' ? session.profile.displayName : 'Modula'}
            uri={session.status === 'signedIn' ? session.profile.avatarUri : undefined}
            colour={session.status === 'signedIn' ? session.profile.coverColour : undefined}
            size={42}
          />
          {!isEditMode ? (
            <AppPressable
              accessibilityLabel={`Audience ${AUDIENCE_LABEL[audience]}`}
              onPress={() => {
                Keyboard.dismiss()
                setAudienceOpen(true)
              }}
              style={[
                styles.audience,
                {
                  backgroundColor: colours.accentSubtle,
                  borderColor: colours.accent,
                  borderRadius: radius.round,
                },
              ]}>
              <AppIcon name="people" colour={colours.accent} size={14} />
              <AppText variant="label" style={{color: colours.accent}}>
                {AUDIENCE_LABEL[audience]}
              </AppText>
              <AppIcon name="arrowDown" colour={colours.accent} size={12} />
            </AppPressable>
          ) : (
            <AppText variant="label" colour="textSecondary">
              Text edit
            </AppText>
          )}
          {!isEditMode && showDestinationSelector ? (
            <AppPressable
              accessibilityLabel={`Publish to ${DESTINATION_LABEL[effectiveDestination]}`}
              onPress={() => {
                Keyboard.dismiss()
                setDestinationOpen(true)
              }}
              style={[
                styles.audience,
                {
                  backgroundColor: colours.surfaceMuted,
                  borderColor: colours.border,
                  borderRadius: radius.round,
                },
              ]}>
              <AppIcon name="integrations" colour={colours.accent} size={14} />
              <AppText variant="label" style={{color: colours.accent}}>
                {DESTINATION_LABEL[effectiveDestination]}
              </AppText>
              <AppIcon name="arrowDown" colour={colours.accent} size={12} />
            </AppPressable>
          ) : null}
        </View>

        {publicationBanner ? (
          <PublicationStatusBanner
            status={publicationBanner}
            onKeepModulaOnly={() => {
              setDestination('modula')
              setPublicationBanner('publishedOnModula')
            }}
          />
        ) : null}

        <TextInput
          value={text}
          onChangeText={onChangeText}
          placeholder="What are you building?"
          placeholderTextColor={colours.textTertiary}
          multiline
          autoFocus
          accessibilityLabel="Post text"
          style={[
            styles.input,
            {
              color: colours.text,
              fontSize: 18,
              lineHeight: 25,
            },
          ]}
        />

        {media ? (
          <View
            style={[
              styles.attachmentStrip,
              {
                borderColor: colours.border,
                borderRadius: radius.large,
                backgroundColor: colours.surfaceRaised,
              },
            ]}>
            <View
              style={[
                styles.mediaPreview,
                {
                  borderColor: colours.border,
                  borderRadius: radius.large,
                },
              ]}>
              <Image source={{uri: media.localUri}} style={StyleSheet.absoluteFill} contentFit="cover" />
              {contentWarning !== 'none' ? (
                <View style={[styles.cwBadge, {backgroundColor: colours.backdrop}]}>
                  <AppText variant="caption" style={{color: colours.surface}}>
                    {contentWarning === 'spoiler' ? 'Spoiler — Preview' : 'Sensitive — Preview'}
                  </AppText>
                </View>
              ) : null}
              <AppPressable
                accessibilityLabel="Remove selected photo"
                onPress={() => setMedia(null)}
                style={[
                  styles.removeMedia,
                  {backgroundColor: colours.backdrop, borderRadius: radius.round},
                ]}>
                <AppIcon name="trash" colour={colours.surface} />
              </AppPressable>
            </View>
            <TextInput
              value={altText}
              onChangeText={setAltText}
              placeholder="Add alt text — Preview"
              placeholderTextColor={colours.textTertiary}
              accessibilityLabel="Alt text Preview"
              style={[styles.altInput, {color: colours.text, borderColor: colours.border}]}
            />
          </View>
        ) : null}

        {link ? (
          <Surface
            variant="contained"
            style={[styles.previewCard, {gap: spacing[1], padding: spacing[3]}]}>
            <AppText variant="caption" colour="textSecondary">
              {link.domain}
            </AppText>
            <AppText variant="headline">{link.title}</AppText>
            <AppText variant="caption" colour="textSecondary">
              {link.description}
            </AppText>
            <AppPressable accessibilityLabel="Remove link preview" onPress={() => setLink(null)}>
              <AppText variant="label" style={{color: colours.accent}}>
                Remove
              </AppText>
            </AppPressable>
          </Surface>
        ) : null}

        {poll ? (
          <Surface
            variant="contained"
            style={[styles.previewCard, {gap: spacing[2], padding: spacing[3]}]}>
            <AppText variant="headline">{poll.question}</AppText>
            {poll.options.map(option => (
              <View
                key={option}
                style={[
                  styles.pollOption,
                  {borderColor: colours.border, borderRadius: radius.round},
                ]}>
                <AppText variant="label">{option}</AppText>
              </View>
            ))}
            <AppPressable accessibilityLabel="Remove poll" onPress={() => setPoll(null)}>
              <AppText variant="label" style={{color: colours.accent}}>
                Remove poll
              </AppText>
            </AppPressable>
          </Surface>
        ) : null}

        {permissionMessage ? (
          <Surface
            variant="muted"
            style={[styles.permission, {padding: spacing[3], borderRadius: radius.medium}]}>
            <AppText variant="caption" colour="textSecondary">
              {permissionMessage}
            </AppText>
          </Surface>
        ) : null}

        {!isEditMode ? (
          <View style={[styles.replyRow, {gap: spacing[2]}]}>
            <AppPressable
              accessibilityLabel={REPLY_LABEL[replyPermission]}
              onPress={() => {
                Keyboard.dismiss()
                setReplyOpen(true)
              }}
              style={[styles.replyPill, {gap: spacing[2]}]}>
              <AppIcon name="messages" colour={colours.accent} size={16} />
              <AppText variant="label" style={{color: colours.accent}}>
                {REPLY_LABEL[replyPermission]}
              </AppText>
            </AppPressable>
            <View style={[styles.undoRedo, {gap: spacing[1]}]}>
              <AppPressable
                accessibilityLabel="Undo"
                accessibilityState={{disabled: !canUndo}}
                disabled={!canUndo}
                onPress={undo}
                style={styles.iconHit}>
                <AppIcon
                  name="back"
                  colour={canUndo ? colours.textSecondary : colours.textTertiary}
                  size={18}
                />
              </AppPressable>
              <AppPressable
                accessibilityLabel="Redo"
                accessibilityState={{disabled: !canRedo}}
                disabled={!canRedo}
                onPress={redo}
                style={styles.iconHit}>
                <AppIcon
                  name="chevronRight"
                  colour={canRedo ? colours.textSecondary : colours.textTertiary}
                  size={18}
                />
              </AppPressable>
            </View>
          </View>
        ) : (
          <View style={[styles.undoRedo, {gap: spacing[1], alignSelf: 'flex-end'}]}>
            <AppPressable
              accessibilityLabel="Undo"
              accessibilityState={{disabled: !canUndo}}
              disabled={!canUndo}
              onPress={undo}
              style={styles.iconHit}>
              <AppIcon
                name="back"
                colour={canUndo ? colours.textSecondary : colours.textTertiary}
                size={18}
              />
            </AppPressable>
            <AppPressable
              accessibilityLabel="Redo"
              accessibilityState={{disabled: !canRedo}}
              disabled={!canRedo}
              onPress={redo}
              style={styles.iconHit}>
              <AppIcon
                name="chevronRight"
                colour={canRedo ? colours.textSecondary : colours.textTertiary}
                size={18}
              />
            </AppPressable>
          </View>
        )}
      </ScrollView>

      {!isEditMode ? (
      <View
        style={[
          styles.toolbar,
          {
            borderTopColor: colours.border,
            paddingBottom: Math.max(insets.bottom, spacing[2]),
            backgroundColor: colours.canvas,
          },
        ]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.toolbarScroll, {gap: spacing[1], paddingHorizontal: spacing[2]}]}>
          {toolbarItems.map(item => (
            <AppPressable
              key={item.label}
              accessibilityLabel={item.label}
              onPress={item.onPress}
              style={styles.toolIcon}>
              <AppIcon name={item.icon} colour={colours.textSecondary} />
            </AppPressable>
          ))}
          <View style={[styles.toolbarDivider, {backgroundColor: colours.border}]} />
          <AppPressable
            accessibilityLabel="Add to thread — Coming Soon"
            onPress={() =>
              comingSoonTool('Thread', 'Thread composer is not part of this beta.')
            }
            style={styles.toolIcon}>
            <AppIcon name="create" colour={colours.accent} />
          </AppPressable>
          <AppPressable
            accessibilityLabel="Open Composer Tools"
            onPress={() => {
              Keyboard.dismiss()
              setToolsOpen(true)
            }}
            style={[
              styles.toolIcon,
              {backgroundColor: colours.accentSubtle, borderRadius: radius.round},
            ]}>
            <AppIcon name="tools" colour={colours.accent} />
          </AppPressable>
        </ScrollView>
      </View>
      ) : (
        <View style={{paddingBottom: Math.max(insets.bottom, spacing[2])}} />
      )}

      <FeatureErrorBoundary label="Composer Tools">
        <ComposerToolsDrawer
          visible={toolsOpen}
          onClose={() => setToolsOpen(false)}
          onPhoto={() => void pickPhoto()}
          onCamera={() => void capturePhoto()}
          onInsertLink={() => {
            comingSoonTool(
              'Link',
              'Link cards are not part of beta Composer. Paste a URL in the post text instead.',
            )
          }}
          onInsertPoll={() => {
            comingSoonTool(
              'Poll',
              'Polls are not part of beta Composer. No poll is added to this draft.',
            )
          }}
          onBrowseMarketplace={() => router.push('/product' as Href)}
        />
      </FeatureErrorBoundary>

      <SelectionSheet
        isPresented={audienceOpen}
        onDismiss={() => setAudienceOpen(false)}
        title="Audience"
        subtitle="Who can see this post"
        options={AUDIENCE_OPTIONS}
        selectedId={audience}
        onSelect={id => {
          setAudience(id)
          // Private / non-public audiences can never cross-post; never auto-force Public.
          if (id !== 'public') {
            setDestination('modula')
          }
          void selectionHaptic()
        }}
        testID="composer-audience-sheet"
      />
      <SelectionSheet
        isPresented={destinationOpen}
        onDismiss={() => setDestinationOpen(false)}
        title="Publish to"
        subtitle="Default destination is Modula only"
        options={DESTINATION_OPTIONS}
        selectedId={effectiveDestination}
        onSelect={id => {
          if (id === 'modula+atproto' && !crossPostEligibility.allowed) {
            setPermissionMessage('AT Protocol cross-post is unavailable for this post.')
            setDestination('modula')
            return
          }
          setDestination(id)
          void selectionHaptic()
        }}
        testID="composer-destination-sheet"
      />
      <SelectionSheet
        isPresented={replyOpen}
        onDismiss={() => setReplyOpen(false)}
        title="Who can reply"
        subtitle="Reply permissions for this post"
        options={REPLY_OPTIONS}
        selectedId={replyPermission}
        onSelect={id => {
          setReplyPermission(id)
          void selectionHaptic()
        }}
        testID="composer-reply-permissions-sheet"
      />
      <SelectionSheet
        isPresented={cwOpen}
        onDismiss={() => setCwOpen(false)}
        title="Content warning"
        subtitle="Local Preview — not enforced by a backend yet"
        options={CW_OPTIONS}
        selectedId={contentWarning}
        onSelect={id => {
          setContentWarning(id)
          if (id !== 'none') {
            setDestination('modula')
          }
          void selectionHaptic()
        }}
        testID="composer-content-warning-sheet"
      />
    </KeyboardSafeScreen>
  )
}

const styles = StyleSheet.create({
  altInput: {
    borderTopWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  attachmentStrip: {
    overflow: 'hidden',
  },
  audience: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
  },
  authorRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  content: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  cwBadge: {
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    top: 10,
  },
  draftsLink: {
    minHeight: 32,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingBottom: 8,
  },
  headerButton: {
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  iconHit: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 36,
  },
  input: {
    flex: 1,
    minHeight: 160,
    paddingTop: 4,
    textAlignVertical: 'top',
  },
  mediaPreview: {
    aspectRatio: 4 / 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    maxHeight: 260,
    overflow: 'hidden',
  },
  permission: {},
  pollOption: {
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  postButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: 14,
  },
  previewCard: {},
  removeMedia: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 10,
    width: 44,
  },
  replyPill: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    minHeight: 44,
  },
  replyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  screen: {
    flex: 1,
  },
  toolIcon: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  toolbar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
    paddingTop: 4,
  },
  toolbarDivider: {
    alignSelf: 'center',
    height: 24,
    marginHorizontal: 4,
    width: StyleSheet.hairlineWidth,
  },
  toolbarScroll: {
    alignItems: 'center',
  },
  undoRedo: {
    alignItems: 'center',
    flexDirection: 'row',
  },
})
