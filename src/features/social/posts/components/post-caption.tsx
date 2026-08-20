import {StyleSheet, View} from 'react-native'
import Animated, {useAnimatedStyle, type SharedValue} from 'react-native-reanimated'

import {AppText} from '@/components/primitives/AppText'
import {POST_GEOMETRY} from '@/features/social/posts/tokens/post-geometry'
import {postLayerZ} from '@/features/social/posts/tokens/post-layout'
import {PostCaptionBlur, PostSurface} from '@/features/social/posts/components/post-surface'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PostCaptionProps = {
  text?: string
  opacity?: SharedValue<number>
  overlay?: boolean
}

export function PostCaption({text, opacity, overlay = true}: PostCaptionProps) {
  const {colours, spacing} = useThemeTokens()
  const trimmed = text?.trim()
  if (!trimmed) return null

  const animated = useAnimatedStyle(() => ({
    opacity: opacity ? opacity.get() : 1,
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.root,
        animated,
        {
          paddingHorizontal: spacing[3],
          paddingBottom: spacing[6],
          zIndex: postLayerZ('chrome'),
        },
      ]}>
      <PostCaptionBlur height={POST_GEOMETRY.captionScrimHeight} />
      <PostSurface role="captionScrim" style={StyleSheet.absoluteFill} />
      <AppText
        variant="body"
        numberOfLines={3}
        style={{
          color: overlay ? colours.mediaOverlayText : colours.textMain,
          textShadowColor: overlay ? colours.mediaOverlayShadow : 'transparent',
          textShadowOffset: {width: 0, height: 1},
          textShadowRadius: 4,
        }}>
        {trimmed}
      </AppText>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    bottom: 0,
    justifyContent: 'flex-end',
    left: 0,
    position: 'absolute',
    right: 72,
  },
})
