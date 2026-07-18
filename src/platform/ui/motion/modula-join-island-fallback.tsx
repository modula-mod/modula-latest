import {Image} from 'expo-image'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaJoinIslandProps = {
  name: string
  avatarUri?: string
  avatarColour?: string
  style?: StyleProp<ViewStyle>
  /** Optional caption under the stage. */
  caption?: string
}

/**
 * Reanimated-only fallback when RNSkiaModule is not linked.
 * Keeps the join pop readable without the Skia meta-ball blob.
 */
export function ModulaJoinIslandFallback({
  name,
  avatarUri,
  avatarColour,
  style,
  caption,
}: ModulaJoinIslandProps) {
  const {colours, spacing, radius} = useThemeTokens()
  const progress = useSharedValue(0)

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{scale: 0.55 + progress.value * 0.45}],
    opacity: 0.35 + progress.value * 0.65,
  }))

  const pillStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * 0.85,
    transform: [{scaleX: 1 - progress.value * 0.15}],
  }))

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: colours.surface1,
          borderColor: colours.border,
          borderRadius: radius.large,
          padding: spacing[4],
          gap: spacing[3],
        },
        style,
      ]}>
      <View style={styles.stage}>
        <Animated.View
          style={[
            styles.pill,
            pillStyle,
            {backgroundColor: colours.surface3, borderColor: colours.borderStrong},
          ]}
        />
        <Animated.View style={[styles.avatarWrap, avatarStyle]}>
          {avatarUri ? (
            <Image source={{uri: avatarUri}} style={styles.avatarImage} />
          ) : (
            <Avatar name={name} colour={avatarColour ?? colours.accent} size={90} />
          )}
        </Animated.View>
      </View>
      <AppText variant="headline" style={{textAlign: 'center'}}>
        {name}
      </AppText>
      <AppText variant="caption" colour="textTertiary" style={{textAlign: 'center'}}>
        {caption ??
          'Join island Preview — Skia meta-ball needs a native rebuild with @shopify/react-native-skia.'}
      </AppText>
      <AppPressable
        accessibilityLabel="Simulate join"
        onPress={() => {
          progress.value = withSpring(progress.value > 0.5 ? 0 : 1, {
            damping: 18,
            stiffness: 160,
          })
        }}
        style={[
          styles.button,
          {
            backgroundColor: colours.accentSubtle,
            borderColor: colours.accent,
            borderRadius: radius.round,
          },
        ]}>
        <AppText variant="label" style={{color: colours.accent}}>
          Simulate join
        </AppText>
      </AppPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  avatarImage: {
    borderRadius: 45,
    height: 90,
    width: 90,
  },
  avatarWrap: {
    alignItems: 'center',
    height: 90,
    justifyContent: 'center',
    width: 90,
  },
  button: {
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pill: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 30,
    position: 'absolute',
    top: 8,
    width: 120,
  },
  shell: {
    minHeight: 280,
    overflow: 'hidden',
    width: '100%',
  },
  stage: {
    alignItems: 'center',
    height: 140,
    justifyContent: 'center',
  },
})
