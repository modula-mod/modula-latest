import {useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'
import Animated, {useAnimatedStyle, withSpring} from 'react-native-reanimated'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {MusicPostContent} from '@/features/social/posts/types/post'
import {PostSurface} from '@/features/social/posts/components/post-surface'
import {
  postSpringConfig,
  usePostInteraction,
} from '@/features/social/posts/interactions/post-interaction-context'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function MusicPostRenderer({content}: {content: MusicPostContent}) {
  const {colours, spacing} = useThemeTokens()
  const {mediaExpansionProgress, setMode} = usePostInteraction()
  const [playing, setPlaying] = useState(false)

  const expandedStyle = useAnimatedStyle(() => ({
    transform: [{scale: 1 + mediaExpansionProgress.get() * 0.04}],
  }))

  const openPlayer = () => {
    mediaExpansionProgress.set(withSpring(1, postSpringConfig('player')))
    setMode('mediaExpanded')
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {content.artwork.url && !content.artwork.url.startsWith('local://') ? (
        <Image source={{uri: content.artwork.url}} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient
          colors={[content.artwork.colour ?? '#7B5CFF', '#141418', colours.canvas]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.65)']}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.center, expandedStyle]}>
        <AppText variant="caption" style={{color: colours.mediaOverlaySecondary}}>
          Now Playing
        </AppText>
        <AppText variant="headline" style={{color: colours.mediaOverlayText, marginTop: spacing[1]}}>
          {content.title}
        </AppText>
        <AppText variant="label" style={{color: colours.mediaOverlaySecondary}}>
          {content.artist}
        </AppText>
      </Animated.View>
      <AppPressable
        accessibilityLabel="Open full music player"
        onPress={openPlayer}
        style={[styles.stripWrap, {paddingHorizontal: spacing[3], bottom: spacing[8]}]}>
        <PostSurface
          role="rail"
          style={[
            styles.strip,
            {
              borderColor: colours.borderStrong,
              gap: spacing[2],
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
            },
          ]}>
          <AppPressable
            accessibilityLabel={playing ? 'Pause track' : 'Play track'}
            onPress={() => setPlaying(current => !current)}
            style={styles.play}>
            <AppIcon name={playing ? 'pause' : 'play'} colour={colours.mediaOverlayText} size={18} />
          </AppPressable>
          <View style={{flex: 1}}>
            <AppText variant="label" style={{color: colours.mediaOverlayText}} numberOfLines={1}>
              {content.title}
            </AppText>
            <AppText variant="caption" style={{color: colours.mediaOverlaySecondary}} numberOfLines={1}>
              {content.artist}
            </AppText>
          </View>
          <AppText variant="caption" style={{color: colours.mediaOverlaySecondary}}>
            1:24
          </AppText>
        </PostSurface>
      </AppPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    ...StyleSheet.absoluteFill,
    paddingHorizontal: 24,
  },
  play: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  strip: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  stripWrap: {
    left: 0,
    position: 'absolute',
    right: 72,
  },
})
