import {ScrollView, StyleSheet} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {isFeatureEnabled} from '@/features/product/data/featureControl'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type QuickAction = {
  id: string
  label: string
  icon: AppIconName
  href: Href
  /** Feature Control gate — omit when always available. */
  featureId?: string
}

const ACTIONS: QuickAction[] = [
  {id: 'compose', label: 'Compose', icon: 'create', href: '/compose' as Href},
  {
    id: 'reels',
    label: 'Reels',
    icon: 'play',
    href: '/reels' as Href,
    featureId: 'reels',
  },
  {id: 'discover', label: 'Discover', icon: 'discover', href: '/discover' as Href},
  {id: 'presence', label: 'Presence', icon: 'people', href: '/product/presence' as Href},
  {id: 'board', label: 'Board', icon: 'board', href: '/board' as Href},
  {
    id: 'customize',
    label: 'Customize',
    icon: 'appearance',
    href: '/product/customize' as Href,
  },
]

/**
 * Horizontal quick-action pills under the home feed header.
 * Respects Feature Control channels (e.g. Reels off → pill hidden).
 */
export function HomeQuickActions() {
  const {spacing} = useThemeTokens()
  const {preferences} = useProductPreferences()
  const actions = ACTIONS.filter(
    action => !action.featureId || isFeatureEnabled(preferences, action.featureId),
  )

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.row,
        {gap: spacing[2], paddingHorizontal: spacing[4], paddingBottom: spacing[2]},
      ]}>
      {actions.map((action, index) => (
        <QuickActionPill key={action.id} action={action} primary={index === 0} />
      ))}
    </ScrollView>
  )
}

function QuickActionPill({
  action,
  primary,
}: {
  action: QuickAction
  primary: boolean
}) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }))

  return (
    <Animated.View style={animatedStyle}>
      <AppPressable
        accessibilityLabel={action.label}
        onPressIn={() => {
          if (!reduceMotion) {
            scale.value = withSpring(0.94, {damping: 16, stiffness: 320})
          }
        }}
        onPressOut={() => {
          if (!reduceMotion) {
            scale.value = withSpring(1, {damping: 14, stiffness: 240})
          }
        }}
        onPress={() => {
          void selectionHaptic()
          router.push(action.href)
        }}
        style={[
          styles.pill,
          {
            backgroundColor: primary ? colours.accent : colours.surfaceRaised,
            borderColor: primary ? colours.accentBorder : colours.border,
            borderRadius: radius.round,
            gap: spacing[2],
            paddingHorizontal: spacing[3],
          },
        ]}>
        <AppIcon
          name={action.icon}
          colour={primary ? colours.accentForeground : colours.accent}
          size={16}
        />
        <AppText
          variant="label"
          style={{
            color: primary ? colours.accentForeground : colours.text,
          }}>
          {action.label}
        </AppText>
      </AppPressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 40,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
})
