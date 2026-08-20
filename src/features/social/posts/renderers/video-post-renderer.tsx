import {useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {VideoPostContent} from '@/features/social/posts/types/post'
import {ModulaReelPlayer} from '@/platform/ui/video/modula-reel-player'
import {usePostInteraction} from '@/features/social/posts/interactions/post-interaction-context'
import {postLayerZ} from '@/features/social/posts/tokens/post-layout'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type VideoPostRendererProps = {
  content: VideoPostContent
  active?: boolean
}

export function VideoPostRenderer({content, active = false}: VideoPostRendererProps) {
  const {colours} = useThemeTokens()
  const {mediaExpansionProgress, setMode} = usePostInteraction()
  const [playing, setPlaying] = useState(false)
  const sourceUri = content.source.url?.startsWith('local://')
    ? ''
    : content.source.url

  const expand = () => {
    mediaExpansionProgress.set(1)
    setMode('mediaExpanded')
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <ModulaReelPlayer
        sourceUri={sourceUri}
        posterColour={content.source.colour ?? colours.accent}
        active={active && playing}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.45)']}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <AppPressable
        accessibilityLabel={playing ? 'Pause video' : 'Play video'}
        onPress={() => setPlaying(current => !current)}
        style={styles.centerTap}>
        <View style={styles.playBadge}>
          <AppIcon name={playing ? 'pause' : 'play'} colour={colours.mediaOverlayText} size={28} />
        </View>
      </AppPressable>
      <AppPressable
        accessibilityLabel="Open immersive player"
        onPress={expand}
        style={[styles.expand, {zIndex: postLayerZ('chrome')}]}>
        <AppIcon name="arrowUp" colour={colours.mediaOverlayText} size={18} />
      </AppPressable>
      <View style={styles.timer}>
        <AppText variant="caption" style={{color: colours.mediaOverlaySecondary}}>
          0:24 / 1:24
        </AppText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  centerTap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expand: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 999,
    bottom: 72,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 72,
    width: 36,
  },
  playBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 999,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  timer: {
    bottom: 72,
    left: 16,
    position: 'absolute',
  },
})
