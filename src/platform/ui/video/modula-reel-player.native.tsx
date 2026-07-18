import type {ComponentType} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'

import {AppText} from '@/components/primitives/AppText'
import {DraggableVideoControls} from '@/platform/ui/video/draggable-video-controls'
import {isExpoVideoNativeAvailable} from '@/platform/ui/native-modules/expo-native-availability'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaReelPlayerProps = {
  sourceUri: string
  posterColour?: string
  active?: boolean
  style?: StyleProp<ViewStyle>
}

type InnerProps = {
  sourceUri: string
  active?: boolean
  style?: StyleProp<ViewStyle>
}

function loadInner(): ComponentType<InnerProps> | null {
  if (!isExpoVideoNativeAvailable()) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./modula-reel-player-inner.native') as {
      ModulaReelPlayerInner: ComponentType<InnerProps>
    }
    return mod.ModulaReelPlayerInner
  } catch {
    return null
  }
}

/**
 * Full-bleed reel video + draggable glass controls foundation.
 * Falls back safely when ExpoVideo is not linked in the current binary.
 */
export function ModulaReelPlayer({
  sourceUri,
  posterColour,
  active = true,
  style,
}: ModulaReelPlayerProps) {
  const Inner = loadInner()
  if (Inner) {
    return <Inner sourceUri={sourceUri} active={active} style={style} />
  }

  return <ModulaReelPlayerUnavailable posterColour={posterColour} style={style} />
}

function ModulaReelPlayerUnavailable({
  posterColour,
  style,
}: {
  posterColour?: string
  style?: StyleProp<ViewStyle>
}) {
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
        <DraggableVideoControls playing={false} onTogglePlay={() => undefined} />
        <AppText variant="caption" style={{color: colours.mediaOverlaySecondary}}>
          Video needs a native rebuild with expo-video linked
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
