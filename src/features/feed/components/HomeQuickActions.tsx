import {StyleSheet, View} from 'react-native'
import {useMemo, useState} from 'react'

import {selectionHaptic} from '@/lib/haptics'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {ShellChromeObscureView} from '@/platform/ui/navigation/shell-chrome-obscure-view'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Temporary experiment: 10 segments in one native scrollable picker. */
const DEMO_OPTIONS = [
  {value: 'compose', label: 'Compose'},
  {value: 'reels', label: 'Reels'},
  {value: 'discover', label: 'Discover'},
  {value: 'presence', label: 'Presence'},
  {value: 'board', label: 'Board'},
  {value: 'customize', label: 'Customize'},
  {value: 'saved', label: 'Saved'},
  {value: 'teams', label: 'Teams'},
  {value: 'modules', label: 'Modules'},
  {value: 'labs', label: 'Labs'},
] as const

/**
 * Home quick destinations — scrollable native segmented Picker experiment
 * with 10 dummy items to evaluate overflow behaviour.
 */
export function HomeQuickActions() {
  const {spacing} = useThemeTokens()
  const [selected, setSelected] = useState<string>(DEMO_OPTIONS[0].value)

  const options = useMemo(
    () => DEMO_OPTIONS.map(option => ({value: option.value, label: option.label})),
    [],
  )

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
          segmentMinWidth={96}
          options={options}
          value={selected}
          onValueChange={next => {
            setSelected(next)
            void selectionHaptic()
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
