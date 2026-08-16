import {StyleSheet, View} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'

import {Avatar} from '@/components/primitives/Avatar'
import {AppText} from '@/components/primitives/AppText'
import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {useReduceMotion} from '@/lib/accessibility'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const AVATAR = 26
const CAPSULE_HEIGHT = 40

type ProfileHeaderTitleProps = {
  profile: ModulaProfile
  scrollY?: SharedValue<number>
  /** Measured hero height — the morph is relative to it, not to a constant. */
  heroHeight?: SharedValue<number>
  /** Safe-area top, removed from the hero travel the chrome already covers. */
  insetTop: number
  /** Used until the hero has been measured. */
  fallbackHeight: number
}

/**
 * Identity that morphs into the cover chrome beside the back control once the
 * hero name scrolls away: portrait, display name, and `@handle` subtitle on
 * liquid glass. Decorative — the hero keeps the accessible identity, so this
 * never duplicates it for VoiceOver.
 */
export function ProfileHeaderTitle({
  profile,
  scrollY,
  heroHeight,
  insetTop,
  fallbackHeight,
}: ProfileHeaderTitleProps) {
  const {spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()

  const animatedStyle = useAnimatedStyle(() => {
    const hero = heroHeight?.value || fallbackHeight
    // Settles just before the tabs stick, so the two never cross-fade at once.
    const to = Math.max(1, hero - insetTop - CAPSULE_HEIGHT - 24)
    const from = Math.max(0, to - 88)
    const progress = interpolate(scrollY?.value ?? 0, [from, to], [0, 1], 'clamp')
    return {
      opacity: progress,
      transform: reduceMotion
        ? [{translateY: 0}, {scale: 1}]
        : [
            {translateY: (1 - progress) * 10},
            {scale: 0.94 + progress * 0.06},
          ],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.host, animatedStyle]}>
      <LiquidGlassChrome
        interactive={false}
        fallback="regular"
        contentLayout="flow"
        style={[styles.capsule, {height: CAPSULE_HEIGHT}]}>
        <View style={[styles.row, {gap: spacing[2], paddingHorizontal: spacing[2]}]}>
          <Avatar
            name={profile.displayName}
            uri={profile.avatarUri}
            colour={profile.coverColour}
            size={AVATAR}
          />
          <View style={styles.copy}>
            <AppText variant="label" numberOfLines={1}>
              {profile.displayName}
            </AppText>
            <AppText variant="micro" colour="textSecondary" numberOfLines={1}>
              @{profile.handle}
            </AppText>
          </View>
        </View>
      </LiquidGlassChrome>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  capsule: {
    borderRadius: CAPSULE_HEIGHT / 2,
    justifyContent: 'center',
  },
  copy: {
    flexShrink: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  host: {
    flexShrink: 1,
    minWidth: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    height: CAPSULE_HEIGHT,
    minWidth: 0,
  },
})
