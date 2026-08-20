import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'
import {useRef} from 'react'
import {StyleSheet} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import type {ImagePostContent} from '@/features/social/posts/types/post'
import {usePostInteraction} from '@/features/social/posts/interactions/post-interaction-context'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ImagePostRendererProps = {
  content: ImagePostContent
  onDoubleTapLike: () => void
}

export function ImagePostRenderer({content, onDoubleTapLike}: ImagePostRendererProps) {
  const {colours} = useThemeTokens()
  const {mediaExpansionProgress, reduceMotion} = usePostInteraction()
  const lastTap = useRef(0)
  const heartScale = useSharedValue(0)
  const heartOpacity = useSharedValue(0)

  const mediaStyle = useAnimatedStyle(() => ({
    transform: [{scale: 1 - mediaExpansionProgress.get() * 0.015}],
  }))

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{scale: heartScale.value}],
  }))

  const onPress = () => {
    const now = Date.now()
    if (now - lastTap.current < 280) {
      onDoubleTapLike()
      if (!reduceMotion) {
        // Reanimated shared values, not React state.
        // eslint-disable-next-line react-hooks/immutability
        heartScale.value = 0.4
        // eslint-disable-next-line react-hooks/immutability
        heartOpacity.value = 1
        heartScale.value = withSpring(1.12, {damping: 10, stiffness: 200})
        heartOpacity.value = withTiming(0, {duration: 520})
      }
      lastTap.current = 0
      return
    }
    lastTap.current = now
  }

  const source = content.source
  const hasRemote = source.url && !source.url.startsWith('local://')

  return (
    <Animated.View style={[StyleSheet.absoluteFill, mediaStyle]}>
      <AppPressable
        accessibilityLabel={content.altText ?? 'Post image. Double tap to like.'}
        onPress={onPress}
        style={[StyleSheet.absoluteFill, {backgroundColor: source.colour ?? colours.surfaceMuted}]}>
        {hasRemote ? (
          <Image source={{uri: source.url}} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient
            colors={[source.colour ?? colours.accent, colours.surface3, colours.canvas]}
            start={{x: 0.1, y: 0}}
            end={{x: 0.9, y: 1}}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.42)', 'transparent', 'rgba(0,0,0,0.35)']}
          locations={[0, 0.45, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <Animated.View pointerEvents="none" style={[styles.heartBurst, heartStyle]}>
          <AppIcon name="like" colour={colours.destructive} size={72} />
        </Animated.View>
      </AppPressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  heartBurst: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
})
