import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {useMemo, useState} from 'react'

import {isFeatureEnabled} from '@/features/product/data/featureControl'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {ShellChromeObscureView} from '@/platform/ui/navigation/shell-chrome-obscure-view'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type QuickAction = {
  id: string
  label: string
  href: Href
  /** Feature Control gate — omit when always available. */
  featureId?: string
}

const ACTIONS: QuickAction[] = [
  {id: 'compose', label: 'Compose', href: '/compose' as Href},
  {
    id: 'reels',
    label: 'Reels',
    href: '/reels' as Href,
    featureId: 'reels',
  },
  {id: 'discover', label: 'Discover', href: '/discover' as Href},
  {id: 'presence', label: 'Presence', href: '/product/presence' as Href},
  {id: 'board', label: 'Board', href: '/board' as Href},
  {
    id: 'customize',
    label: 'Customize',
    href: '/product/customize' as Href,
  },
]

/**
 * Home quick destinations — Expo UI segmented picker
 * (Lab → Lists & empty states feed-filter menu).
 */
export function HomeQuickActions() {
  const {spacing} = useThemeTokens()
  const router = useRouter()
  const {preferences} = useProductPreferences()
  const actions = useMemo(
    () =>
      ACTIONS.filter(
        action =>
          !action.featureId || isFeatureEnabled(preferences, action.featureId),
      ),
    [preferences],
  )
  const [selected, setSelected] = useState(actions[0]?.id ?? 'compose')

  const options = useMemo(
    () => actions.map(action => ({value: action.id, label: action.label})),
    [actions],
  )

  if (options.length === 0) return null

  const value = options.some(option => option.value === selected)
    ? selected
    : options[0].value

  return (
    <ShellChromeObscureView direction="up">
      <View style={[styles.wrap, {paddingHorizontal: spacing[4], paddingBottom: spacing[2]}]}>
        <ModulaSegmentedPicker
          accessibilityLabel="Home quick actions"
          options={options}
          value={value}
          onValueChange={next => {
            setSelected(next)
            const action = actions.find(item => item.id === next)
            if (!action) return
            void selectionHaptic()
            router.push(action.href)
          }}
        />
      </View>
    </ShellChromeObscureView>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
})
