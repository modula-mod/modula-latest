import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type DraggableVideoControlsProps = {
  playing: boolean
  onTogglePlay: () => void
  onSkipBack?: () => void
  onSkipForward?: () => void
  style?: StyleProp<ViewStyle>
}

/**
 * Web / reduced fallback — plain icon controls, no filled discs.
 */
export function DraggableVideoControls({
  playing,
  onTogglePlay,
  onSkipBack,
  onSkipForward,
  style,
}: DraggableVideoControlsProps) {
  const {colours} = useThemeTokens()

  return (
    <View style={[styles.row, style]} pointerEvents="box-none">
      <AppPressable
        accessibilityLabel="Skip back 10 seconds"
        onPress={onSkipBack}
        style={styles.side}>
        <AppIcon name="skipBack" colour={colours.mediaOverlayIcon} size={22} />
      </AppPressable>
      <AppPressable
        accessibilityLabel={playing ? 'Pause' : 'Play'}
        onPress={onTogglePlay}
        style={styles.main}>
        <AppIcon
          name={playing ? 'pause' : 'play'}
          colour={colours.mediaOverlayIcon}
          size={28}
        />
      </AppPressable>
      <AppPressable
        accessibilityLabel="Skip forward 30 seconds"
        onPress={onSkipForward}
        style={styles.side}>
        <AppIcon name="skipForward" colour={colours.mediaOverlayIcon} size={22} />
      </AppPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  main: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
  },
  side: {
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
})
