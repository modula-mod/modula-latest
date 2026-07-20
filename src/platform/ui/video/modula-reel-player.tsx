import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'

import {AppText} from '@/components/primitives/AppText'
import {DraggableVideoControls} from '@/platform/ui/video/draggable-video-controls'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaReelPlayerProps = {
  sourceUri: string
  posterColour?: string
  active?: boolean
  style?: StyleProp<ViewStyle>
}

/** Web fallback — editorial still + static controls (no expo-video surface). */
export function ModulaReelPlayer({
  posterColour,
  style,
}: ModulaReelPlayerProps) {
  const {colours} = useThemeTokens()
  const fill = posterColour ?? colours.accent

  return (
    <View style={[styles.root, {backgroundColor: colours.surface1}, style]}>
      <LinearGradient
        colors={[colours.surface1, fill, colours.surface3]}
        locations={[0, 0.45, 1]}
        start={{x: 0.15, y: 0}}
        end={{x: 0.9, y: 1}}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center} pointerEvents="box-none">
        <DraggableVideoControls
          playing={false}
          onTogglePlay={() => undefined}
        />
        <AppText variant="caption" style={{color: colours.mediaOverlaySecondary}}>
          Video playback Preview requires a native build
        </AppText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  root: {
    overflow: 'hidden',
  },
})
