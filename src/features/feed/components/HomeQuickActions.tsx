import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {useMemo, useState} from 'react'

import {isFeatureEnabled} from '@/features/product/data/featureControl'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {ChromeIconMenu} from '@/platform/ui/menus/chrome-icon-menu'
import {ShellChromeObscureView} from '@/platform/ui/navigation/shell-chrome-obscure-view'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type QuickAction = {
  id: string
  label: string
  href: Href
  featureId?: string
}

/** Kept to 3 so the native segmented control stays readable. */
const PRIMARY_ACTIONS: QuickAction[] = [
  {id: 'compose', label: 'Compose', href: '/compose' as Href},
  {
    id: 'reels',
    label: 'Reels',
    href: '/reels' as Href,
    featureId: 'reels',
  },
  {id: 'discover', label: 'Discover', href: '/discover' as Href},
]

/** Overflow destinations — opened from the More menu, not jammed into segments. */
const MORE_ACTIONS: QuickAction[] = [
  {id: 'presence', label: 'Presence', href: '/product/presence' as Href},
  {id: 'board', label: 'Board', href: '/board' as Href},
  {
    id: 'customize',
    label: 'Customize',
    href: '/product/customize' as Href,
  },
]

/**
 * Home quick destinations: compact native segmented Picker + More menu.
 * Avoids overcrowding UISegmentedControl (which was wrapping / looking broken).
 */
export function HomeQuickActions() {
  const {spacing} = useThemeTokens()
  const router = useRouter()
  const {preferences} = useProductPreferences()

  const primary = useMemo(
    () =>
      PRIMARY_ACTIONS.filter(
        action =>
          !action.featureId || isFeatureEnabled(preferences, action.featureId),
      ),
    [preferences],
  )
  const more = useMemo(
    () =>
      MORE_ACTIONS.filter(
        action =>
          !action.featureId || isFeatureEnabled(preferences, action.featureId),
      ),
    [preferences],
  )

  const [selected, setSelected] = useState(primary[0]?.id ?? 'compose')

  const options = useMemo(
    () => primary.map(action => ({value: action.id, label: action.label})),
    [primary],
  )

  if (options.length === 0) return null

  const value = options.some(option => option.value === selected)
    ? selected
    : options[0].value

  const go = (href: Href) => {
    void selectionHaptic()
    router.push(href)
  }

  return (
    <ShellChromeObscureView direction="up">
      <View
        style={[
          styles.wrap,
          {
            gap: spacing[2],
            paddingHorizontal: spacing[4],
            paddingBottom: spacing[2],
          },
        ]}>
        <View style={styles.row}>
          <View style={styles.picker}>
            <ModulaSegmentedPicker
              accessibilityLabel="Home quick actions"
              options={options}
              value={value}
              onValueChange={next => {
                setSelected(next)
                const action = primary.find(item => item.id === next)
                if (action) go(action.href)
              }}
            />
          </View>
          {more.length > 0 ? (
            <ChromeIconMenu
              systemImage="ellipsis.circle"
              icon="more"
              accessibilityLabel="More quick actions"
              title="More"
              actions={more.map(action => ({
                id: action.id,
                label: action.label,
              }))}
              onAction={id => {
                const action = more.find(item => item.id === id)
                if (action) go(action.href)
              }}
            />
          ) : null}
        </View>
      </View>
    </ShellChromeObscureView>
  )
}

const styles = StyleSheet.create({
  picker: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  wrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
})
