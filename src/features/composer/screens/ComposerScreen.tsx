import {useState} from 'react'
import * as ImagePicker from 'expo-image-picker'
import {Image} from 'expo-image'
import {useRouter} from 'expo-router'
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
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
import {useDemoSocial} from '@/demo/DemoSocialContext'
import {currentDemoProfile} from '@/demo/demoProfiles'
import {isIOS} from '@/lib/platform'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {DemoMedia, LinkPost} from '@/types/social'

type PollPreview = {
  question: string
  options: string[]
}

const demoLink: LinkPost['link'] = {
  domain: 'modula.local',
  title: 'Local Composer link preview',
  description: 'A Phase 1-only link surface that does not call a backend.',
}

export function ComposerScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const {createPost} = useDemoSocial()
  const {colours, radius, spacing} = useThemeTokens()
  const [text, setText] = useState('')
  const [media, setMedia] = useState<DemoMedia | null>(null)
  const [link, setLink] = useState<LinkPost['link'] | null>(null)
  const [poll, setPoll] = useState<PollPreview | null>(null)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null)

  const canPost = Boolean(text.trim() || media || link || poll)

  const closeComposer = () => {
    Keyboard.dismiss()
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }

  const publish = () => {
    if (!canPost) return
    createPost({
      text,
      media: media ? [media] : undefined,
      link: link ?? undefined,
      poll: poll ?? undefined,
    })
    setText('')
    setMedia(null)
    setLink(null)
    setPoll(null)
    Keyboard.dismiss()
    router.replace('/')
  }

  const handlePickedAsset = (asset: ImagePicker.ImagePickerAsset) => {
    setPermissionMessage(null)
    setMedia({
      id: `local-media-${Date.now()}`,
      kind: 'image',
      title: 'Selected local photo',
      uri: asset.uri,
      colour: colours.accent,
      aspectRatio:
        asset.width && asset.height ? asset.width / asset.height : 4 / 5,
    })
  }

  const pickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        setPermissionMessage(
          'Photo access was not granted. You can still publish text-only posts.',
        )
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      })
      if (!result.canceled) {
        handlePickedAsset(result.assets[0])
      }
    } catch {
      setPermissionMessage('Photo selection is unavailable in this environment.')
    }
  }

  const capturePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        setPermissionMessage(
          'Camera access was not granted. You can still choose a library photo.',
        )
        return
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      })
      if (!result.canceled) {
        handlePickedAsset(result.assets[0])
      }
    } catch {
      setPermissionMessage('Camera capture is unavailable in this environment.')
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={isIOS ? 'padding' : undefined}
      style={[styles.screen, {backgroundColor: colours.canvas}]}>
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
          onPress={closeComposer}
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
          onPress={publish}
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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
        <View style={[styles.composerRow, {gap: spacing[3]}]}>
          <Avatar
            name={currentDemoProfile.displayName}
            colour={currentDemoProfile.avatarColour}
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
              styles.mediaPreview,
              {
                borderColor: colours.border,
                borderRadius: radius.large,
              },
            ]}>
            <Image source={{uri: media.uri}} style={StyleSheet.absoluteFill} contentFit="cover" />
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
            Phase 1 posts are local and reset after a full reload.
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
          },
        ]}>
        <AppPressable
          accessibilityLabel="Open Composer Tools"
          onPress={() => setToolsOpen(true)}
          style={[
            styles.toolButton,
            {backgroundColor: colours.accentSubtle, borderRadius: radius.round},
          ]}>
          <AppIcon name="create" colour={colours.accent} />
        </AppPressable>
        <AppText variant="caption" colour="textSecondary">
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
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
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
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 98,
    justifyContent: 'space-between',
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
  toolButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
})
