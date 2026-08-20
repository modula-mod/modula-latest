import {StyleSheet, View} from 'react-native'
import Animated, {useAnimatedStyle, type SharedValue} from 'react-native-reanimated'

import {POST_GEOMETRY} from '@/features/social/posts/tokens/post-geometry'
import {postLayerZ} from '@/features/social/posts/tokens/post-layout'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PostBottomHandleProps = {
  progress?: SharedValue<number>
}

export function PostBottomHandle({progress}: PostBottomHandleProps) {
  const {colours} = useThemeTokens()
  const animated = useAnimatedStyle(() => ({
    opacity: progress ? 0.45 + progress.get() * 0.35 : 0.75,
    transform: [{scaleX: progress ? 0.92 + progress.get() * 0.08 : 1}],
  }))

  return (
    <View pointerEvents="none" style={styles.root}>
      <Animated.View
        style={[
          styles.bar,
          animated,
          {
            backgroundColor: colours.mediaOverlaySecondary,
            borderRadius: POST_GEOMETRY.bottomHandleHeight,
            height: POST_GEOMETRY.bottomHandleHeight,
            width: POST_GEOMETRY.bottomHandleWidth,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    alignSelf: 'center',
  },
  root: {
    alignItems: 'center',
    bottom: 10,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: postLayerZ('interaction'),
  },
})
