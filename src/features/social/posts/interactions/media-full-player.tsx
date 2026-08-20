import {Modal, StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaReelPlayer} from '@/platform/ui/video/modula-reel-player'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type MediaFullPlayerProps = {
  visible: boolean
  sourceUri: string
  posterColour?: string
  onClose: () => void
}

export function MediaFullPlayer({visible, sourceUri, posterColour, onClose}: MediaFullPlayerProps) {
  const {colours, spacing} = useThemeTokens()

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent
      visible={visible}>
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        style={[styles.root, {backgroundColor: colours.backdrop}]}>
        <ModulaReelPlayer
          active={visible}
          posterColour={posterColour}
          sourceUri={sourceUri}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.topChrome, {padding: spacing[4]}]}>
          <AppPressable
            accessibilityLabel="Close full player"
            onPress={onClose}
            style={[styles.close, {backgroundColor: colours.mediaOverlayControlBackground}]}>
            <AppIcon name="close" colour={colours.mediaOverlayIcon} size={22} />
          </AppPressable>
          <AppText variant="label" style={{color: colours.mediaOverlayText}}>Video</AppText>
          <View style={styles.spacer} />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  close: {alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44},
  root: {flex: 1},
  spacer: {height: 44, width: 44},
  topChrome: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'},
})
