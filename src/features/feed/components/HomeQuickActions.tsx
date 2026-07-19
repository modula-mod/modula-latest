import {ScrollView, StyleSheet} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {isFeatureEnabled} from '@/features/product/data/featureControl'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaTitleIconButton} from '@/platform/ui/buttons/modula-title-icon-button'
import {ShellChromeObscureView} from '@/platform/ui/navigation/shell-chrome-obscure-view'
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
 * Icon + label via Expo UI titleAndIcon — Compose stretches as primary.
 */
export function HomeQuickActions() {
  const {spacing} = useThemeTokens()
  const router = useRouter()
  const {preferences} = useProductPreferences()
  const actions = ACTIONS.filter(
    action => !action.featureId || isFeatureEnabled(preferences, action.featureId),
  )

  return (
    <ShellChromeObscureView direction="up">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.row,
          {
            gap: spacing[2],
            paddingHorizontal: spacing[4],
            paddingBottom: spacing[2],
          },
        ]}>
        {actions.map((action, index) => {
          const primary = index === 0
          return (
            <ModulaTitleIconButton
              key={action.id}
              icon={action.icon}
              label={action.label}
              chrome={primary ? 'prominent' : 'plain'}
              stretch={primary}
              onPress={() => {
                void selectionHaptic()
                router.push(action.href)
              }}
            />
          )
        })}
      </ScrollView>
    </ShellChromeObscureView>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
})
