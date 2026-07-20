import {useEffect, useState} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import {useEvent} from 'expo'
import {useVideoPlayer, VideoView} from 'expo-video'

import {DraggableVideoControls} from '@/platform/ui/video/draggable-video-controls'

export type ModulaReelPlayerInnerProps = {
  sourceUri: string
  active?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Inner player — only require() this file after ExpoVideo is confirmed linked.
 */
export function ModulaReelPlayerInner({
  sourceUri,
  active = true,
  style,
}: ModulaReelPlayerInnerProps) {
  const player = useVideoPlayer(sourceUri, instance => {
    instance.loop = true
    instance.muted = false
  })
  const {isPlaying} = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  })
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    setPlaying(isPlaying)
  }, [isPlaying])

  useEffect(() => {
    if (active) {
      player.play()
    } else {
      player.pause()
    }
  }, [active, player])

  return (
    <View style={[styles.root, style]}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
      <View style={styles.controls} pointerEvents="box-none">
        <DraggableVideoControls
          playing={playing}
          onTogglePlay={() => {
            if (player.playing) {
              player.pause()
            } else {
              player.play()
            }
          }}
          onSkipBack={() => {
            player.seekBy(-10)
          }}
          onSkipForward={() => {
            player.seekBy(30)
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  controls: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  root: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
})
