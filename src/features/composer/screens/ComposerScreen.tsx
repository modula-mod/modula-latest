import {useState} from 'react'
import {Image} from 'expo-image'
import {useRouter} from 'expo-router'
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
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {Surface} from '@/components/primitives/Surface'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import {useSession} from '@/auth/runtime'
import {useCreatePostMutation} from '@/features/feed/data'
import {selectionHaptic} from '@/lib/haptics'
import {
  KeyboardSafeScreen,
  captureMediaFromSource,
  confirmModulaAction,
  keyboardScrollProps,
} from '@/platform/ui'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {DraftLinkPreview, PendingMediaAttachment} from '@/domain/social'

type PollPreview = {
  question: string
  options: string[]
}

const demoLink: DraftLinkPreview = {
  domain: 'modula.local',
  title: 'Local Composer link preview',
  description: 'A Phase 1-only link surface that does not call a backend.',
}

export function ComposerScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const session = useSession()
  const createPostMutation = useCreatePostMutation()
  const {colours, radius, spacing} = useThemeTokens()
  const [text, setText] = useState('')
  const [media, setMedia] = useState<PendingMediaAttachment | null>(null)
  const [link, setLink] = useState<DraftLinkPreview | null>(null)
  const [poll, setPoll] = useState<PollPreview | null>(null)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null)

  const hasDraft = Boolean(text.trim() || media || link || poll)
  const canPost = hasDraft && !createPostMutation.isPending

  const leaveComposer = () => {
    Keyboard.dismiss()
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
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
        audience: 'public',
        replyPermission: 'everyone',
        media: media ? [media] : [],
        linkPreview: link ?? undefined,
        poll: poll ?? undefined,
        idempotencyKey: `post-${Date.now()}-${Math.round(Math.random() * 999999)}`,
      })
      setText('')
      setMedia(null)
      setLink(null)
      setPoll(null)
      void selectionHaptic()
      Keyboard.dismiss()
      router.replace('/')
    } catch {
      setPermissionMessage('Post failed. Your draft is still here so you can retry.')
    }
  }

  const handlePickedAsset = (localUri: string, width?: number, height?: number, mimeType?: string | null) => {
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
        <AppPressable
          accessibilityLabel="Select audience"
          style={[
            styles.audience,
            {
              backgroundColor: colours.surfaceRaised,
              borderRadius: radius.round,
            },
          ]}>
          <AppText variant="label">Everyone</AppText>
        </AppPressable>
        <AppPressable
          accessibilityLabel="Publish post"
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
            Post
          </AppText>
        </AppPressable>
      </View>
      <ScrollView
        {...keyboardScrollProps}
        contentContainerStyle={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
        <View style={[styles.composerRow, {gap: spacing[3]}]}>
          <Avatar
            name={session.status === 'signedIn' ? session.profile.displayName : 'Modula'}
            uri={session.status === 'signedIn' ? session.profile.avatarUri : undefined}
            colour={session.status === 'signedIn' ? session.profile.coverColour : undefined}
            size={42}
          />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="What's happening in your world?"
            placeholderTextColor={colours.textTertiary}
            multiline
            autoFocus
            style={[
              styles.input,
              {
                color: colours.text,
                fontSize: 18,
                lineHeight: 25,
              },
            ]}
          />
        </View>
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
            <AppText variant="caption" colour="textSecondary" style={styles.attachmentHint}>
              Attachment stays above the keyboard. Local session only — not uploaded.
            </AppText>
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
        <View style={{gap: spacing[2]}}>
          <AppText variant="caption" colour="textSecondary">
            Replies: everyone can reply
          </AppText>
          <AppText variant="caption" colour="textSecondary">
            Local API posts reset after a JavaScript runtime reload.
          </AppText>
        </View>
      </ScrollView>
      <View
        style={[
          styles.toolbar,
          {
            borderTopColor: colours.border,
            paddingBottom: Math.max(insets.bottom, spacing[2]),
            paddingHorizontal: spacing[4],
            backgroundColor: colours.canvas,
          },
        ]}>
        <AppPressable
          accessibilityLabel="Open Composer Tools"
          onPress={() => {
            Keyboard.dismiss()
            setToolsOpen(true)
          }}
          style={[
            styles.toolButton,
            {backgroundColor: colours.accentSubtle, borderRadius: radius.round},
          ]}>
          <AppIcon name="create" colour={colours.accent} />
        </AppPressable>
        <AppText variant="caption" colour="textSecondary" style={styles.toolbarHint}>
          Add media, links, polls, and future Modula tools
        </AppText>
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
          onPlaceholder={toolName =>
            Alert.alert(
              toolName,
              'This tool will be delivered through the Modula tool system.',
            )
          }
        />
      </FeatureErrorBoundary>
    </KeyboardSafeScreen>
  )
}

const styles = StyleSheet.create({
  attachmentHint: {
    paddingHorizontal: 4,
  },
  attachmentStrip: {
    gap: 10,
    padding: 10,
  },
  audience: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
  },
  composerRow: {
    flexDirection: 'row',
  },
  content: {
    flexGrow: 1,
    paddingBottom: 24,
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
  input: {
    flex: 1,
    minHeight: 180,
    paddingTop: 6,
    textAlignVertical: 'top',
  },
  mediaPreview: {
    aspectRatio: 4 / 5,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 280,
    overflow: 'hidden',
  },
  permission: {},
  pollOption: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 38,
    justifyContent: 'center',
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
  screen: {
    flex: 1,
  },
  toolbar: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 60,
    paddingTop: 8,
  },
  toolbarHint: {
    flex: 1,
  },
  toolButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
})
