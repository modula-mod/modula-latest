import {Alert, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {useMemo, useState} from 'react'

import {selectionHaptic} from '@/lib/haptics'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {ShellChromeObscureView} from '@/platform/ui/navigation/shell-chrome-obscure-view'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type DemoAction = {
  value: string
  label: string
  href?: Href
  message: string
}

/** Temporary experiment: 10 pressable segments in one scrollable native picker. */
const DEMO_ACTIONS: DemoAction[] = [
  {
    value: 'compose',
    label: 'Compose',
    href: '/compose' as Href,
    message: 'Open compose',
  },
  {
    value: 'reels',
    label: 'Reels',
    href: '/reels' as Href,
    message: 'Open reels',
  },
  {
    value: 'discover',
    label: 'Discover',
    href: '/discover' as Href,
    message: 'Open discover',
  },
  {
    value: 'presence',
    label: 'Presence',
    href: '/product/presence' as Href,
    message: 'Open presence',
  },
  {
    value: 'board',
    label: 'Board',
    href: '/board' as Href,
    message: 'Open board',
  },
  {
    value: 'customize',
    label: 'Customize',
    href: '/product/customize' as Href,
    message: 'Open customize',
  },
  {
    value: 'saved',
    label: 'Saved',
    href: '/saved' as Href,
    message: 'Open saved',
  },
  {
    value: 'teams',
    label: 'Teams',
    href: '/teams' as Href,
    message: 'Open teams',
  },
  {
    value: 'modules',
    label: 'Modules',
    href: '/modules' as Href,
    message: 'Open modules',
  },
  {
    value: 'labs',
    label: 'Labs',
    href: '/settings/developer/expo-ui' as Href,
    message: 'Open Expo UI Lab',
  },
]

/**
 * Home quick destinations — scrollable native segmented Picker experiment.
 * Each segment runs a real action (navigate or alert).
 */
export function HomeQuickActions() {
  const {spacing} = useThemeTokens()
  const router = useRouter()
  const [selected, setSelected] = useState(DEMO_ACTIONS[0].value)

  const options = useMemo(
    () => DEMO_ACTIONS.map(action => ({value: action.value, label: action.label})),
    [],
  )

  const runAction = (id: string) => {
    const action = DEMO_ACTIONS.find(item => item.value === id)
    if (!action) return
    void selectionHaptic()
    setSelected(id)
    if (action.href) {
      router.push(action.href)
      return
    }
    Alert.alert(action.label, action.message)
  }

  return (
    <ShellChromeObscureView direction="up">
      <View
        style={[
          styles.wrap,
          {
            paddingHorizontal: spacing[4],
            paddingBottom: spacing[2],
          },
        ]}>
        <ModulaSegmentedPicker
          accessibilityLabel="Home quick actions"
          scrollable
          maxWidth={340}
          segmentMinWidth={86}
          options={options}
          value={selected}
          onValueChange={runAction}
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
