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
import {Avatar} from '@/components/primitives/Avatar'
import {Surface} from '@/components/primitives/Surface'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import {useSession} from '@/auth/runtime'
import type {DraftLinkPreview, PendingMediaAttachment, PostAudience, ReplyPermission} from '@/domain/social'
import {useCreatePostMutation} from '@/features/feed/data'
import {selectionHaptic, lightImpactHaptic} from '@/lib/haptics'
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

const demoLink: DraftLinkPreview = {
  domain: 'modula.local',
  title: 'Local Composer link preview',
  description: 'A Phase 1-only link surface that does not call a backend.',
}

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
  }>()
  const insets = useSafeAreaInsets()
  const session = useSession()
  const createPostMutation = useCreatePostMutation()
  const {colours, radius, spacing} = useThemeTokens()

  const isReplyMode = params.mode === 'reply' || Boolean(params.replyTo)
  const isThreadPreview = params.thread === '1' || params.mode === 'thread'

  const [text, setText] = useState('')
  const [history, setHistory] = useState<string[]>([''])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [media, setMedia] = useState<PendingMediaAttachment | null>(null)
  const [altText, setAltText] = useState('')
  const [link, setLink] = useState<DraftLinkPreview | null>(null)
  const [poll, setPoll] = useState<PollPreview | null>(null)
  const [audience, setAudience] = useState<PostAudience>('public')
  const [replyPermission, setReplyPermission] = useState<ReplyPermission>('everyone')
  const [contentWarning, setContentWarning] = useState<ContentWarning>('none')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [audienceOpen, setAudienceOpen] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [cwOpen, setCwOpen] = useState(false)
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null)

  const hasDraft = Boolean(text.trim() || media || link || poll)
  const canPost = hasDraft && !createPostMutation.isPending
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const headerTitle = useMemo(() => {
    if (isReplyMode) return 'Reply'
    if (isThreadPreview) return 'Thread — Preview'
    return 'New Post'
  }, [isReplyMode, isThreadPreview])

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
    try {
      await createPostMutation.mutateAsync({
        text,
        audience: apiAudience(audience),
        replyPermission: apiReplyPermission(replyPermission),
        media: media ? [media] : [],
        linkPreview: link ?? undefined,
        poll: poll ?? undefined,
        idempotencyKey: `post-${Date.now()}-${Math.round(Math.random() * 999999)}`,
      })
      setText('')
      setMedia(null)
      setLink(null)
      setPoll(null)
      setAltText('')
      void lightImpactHaptic()
      Keyboard.dismiss()
      if (isReplyMode && params.replyTo) {
        router.replace(`/post/${params.replyTo}` as Href)
      } else {
        router.replace('/index' as Href)
      }
    } catch {
      setPermissionMessage('Post failed. Your draft is still here so you can retry.')
    }
  }

  const handlePickedAsset = (
    localUri: string,
    width?: number,
    height?: number,
    mimeType?: string | null,
  ) => {
    setPermissionMessage(null)
    setMedia({
      localId: `local-media-${Date.now()}`,
      kind: 'image',
      localUri,
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
      )
      return
    }
    if (result.reason !== 'cancelled') {
      setPermissionMessage(result.message)
    }
  }

  const previewTool = (name: string) => {
    Alert.alert(
      `${name} — Preview`,
      'This tool remains a local Preview in Phase 4.5. No backend side effects.',
    )
  }

  const toolbarItems: {label: string; icon: AppIconName; onPress: () => void}[] = [
    {label: 'Photo', icon: 'photo', onPress: () => void pickPhoto()},
    {label: 'Camera', icon: 'camera', onPress: () => void capturePhoto()},
    {label: 'GIF Preview', icon: 'gif', onPress: () => previewTool('GIF')},
    {
      label: 'Poll',
      icon: 'poll',
      onPress: () => {
        setPoll({
          question: 'Which Modula surface should be refined next?',
          options: ['Board', 'Composer', 'Profile'],
        })
      },
    },
    {
      label: 'Link',
      icon: 'link',
      onPress: () => setLink(demoLink),
    },
    {label: 'Module Preview', icon: 'modules', onPress: () => previewTool('Module post')},
    {
      label: 'Location / Circle Preview',
      icon: 'community',
      onPress: () => previewTool('Location / Circle'),
    },
    {
      label: 'Content warning Preview',
      icon: 'warning',
      onPress: () => {
        Keyboard.dismiss()
        setCwOpen(true)
      },
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
        <AppPressable
          accessibilityLabel="Cancel composer"
          onPress={() => void closeComposer()}
          style={styles.headerButton}>
          <AppText variant="label">Cancel</AppText>
        </AppPressable>
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
            {isReplyMode ? 'Reply' : 'Post'}
          </AppText>
        </AppPressable>
      </View>

      <ScrollView
        {...keyboardScrollProps}
        contentContainerStyle={[styles.content, {gap: spacing[3], padding: spacing[4]}]}>
        {isReplyMode && params.replyTo ? (
          <AppText variant="caption" colour="textSecondary">
            Replying to post {params.replyTo}
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
        </View>

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
      </ScrollView>

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
              <AppIcon name={item.icon} colour={colours.accent} />
            </AppPressable>
          ))}
          <View style={[styles.toolbarDivider, {backgroundColor: colours.border}]} />
          <AppPressable
            accessibilityLabel="Add to thread Preview"
            onPress={() => router.setParams({thread: '1', mode: 'thread'})}
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

      <FeatureErrorBoundary label="Composer Tools">
        <ComposerToolsDrawer
          visible={toolsOpen}
          onClose={() => setToolsOpen(false)}
          onPhoto={() => void pickPhoto()}
          onCamera={() => void capturePhoto()}
          onInsertLink={() => {
            setPermissionMessage(null)
            setLink(demoLink)
          }}
          onInsertPoll={() => {
            setPermissionMessage(null)
            setPoll({
              question: 'Which Modula surface should be refined next?',
              options: ['Board', 'Composer', 'Profile'],
            })
          }}
          onBrowseMarketplace={() => router.push('/marketplace' as Href)}
          onPlaceholder={toolName => previewTool(toolName)}
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
          void selectionHaptic()
        }}
        testID="composer-audience-sheet"
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
    minWidth: 64,
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
