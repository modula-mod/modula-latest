import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type QuickAction = {
  id: string
  label: string
  icon: AppIconName
  href: Href
}

const ACTIONS: QuickAction[] = [
  {id: 'compose', label: 'Compose', icon: 'create', href: '/compose' as Href},
  {id: 'reels', label: 'Reels', icon: 'play', href: '/reels' as Href},
  {id: 'discover', label: 'Discover', icon: 'discover', href: '/discover' as Href},
  {id: 'presence', label: 'Presence', icon: 'people', href: '/product/presence' as Href},
  {id: 'board', label: 'Board', icon: 'board', href: '/board' as Href},
  {id: 'customize', label: 'Customize', icon: 'appearance', href: '/product/customize' as Href},
]

/**
 * Horizontal quick-action pills under the home feed header.
 * Inspiration: soft pill rails — adapted to Modula destinations, not product clones.
 */
export function HomeQuickActions() {
  const {spacing} = useThemeTokens()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.row,
        {gap: spacing[2], paddingHorizontal: spacing[4], paddingBottom: spacing[2]},
      ]}>
      {ACTIONS.map((action, index) => (
        <QuickActionPill key={action.id} action={action} index={index} />
      ))}
    </ScrollView>
  )
}

function QuickActionPill({action, index}: {action: QuickAction; index: number}) {
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
            backgroundColor: index === 0 ? colours.accent : colours.surfaceRaised,
            borderColor: index === 0 ? colours.accentBorder : colours.border,
            borderRadius: radius.round,
            gap: spacing[2],
            paddingHorizontal: spacing[3],
          },
        ]}>
        <AppIcon
          name={action.icon}
          colour={index === 0 ? colours.accentForeground : colours.accent}
          size={16}
        />
        <AppText
          variant="label"
          style={{
            color: index === 0 ? colours.accentForeground : colours.text,
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
