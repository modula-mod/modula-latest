import {useEffect} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {useVideoPlayer, VideoView} from 'expo-video'

import {AppText} from '@/components/primitives/AppText'
import {DraggableVideoControls} from '@/platform/ui/video/draggable-video-controls'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaReelPlayerProps = {
  sourceUri: string
  posterColour?: string
  active?: boolean
  style?: StyleProp<ViewStyle>
}

/** Web player. expo-video uses the browser media element while retaining one API. */
export function ModulaReelPlayer({
  sourceUri,
  posterColour,
  active = true,
  style,
}: ModulaReelPlayerProps) {
  if (sourceUri) {
    return <WebVideoPlayer sourceUri={sourceUri} active={active} style={style} />
  }

  return <WebVideoFallback posterColour={posterColour} style={style} />
}

function WebVideoPlayer({sourceUri, active, style}: ModulaReelPlayerProps) {
  const player = useVideoPlayer(sourceUri, instance => {
    instance.loop = true
  })

  useEffect(() => {
    if (active) player.play()
    else player.pause()
  }, [active, player])

  return (
    <View style={[styles.root, style]}>
      <VideoView
        accessibilityLabel="Post video"
        contentFit="cover"
        nativeControls
        player={player}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}

function WebVideoFallback({posterColour, style}: Pick<ModulaReelPlayerProps, 'posterColour' | 'style'>) {
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
          Video preview unavailable
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
