import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import type {ModulaIconName} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaPageTab = {
  id: string
  title: string
  icon?: ModulaIconName
  content: ReactNode
}

export type ModulaPageTabViewProps = {
  tabs: ModulaPageTab[]
  selectedId: string
  onSelect: (id: string) => void
  accessibilityLabel?: string
  height?: number
}

/**
 * In-screen pager. Native uses SwiftUI TabView page style; web/Android
 * use a segmented control plus one visible page. Not for shell tab routing.
 */
export function ModulaPageTabView({
  tabs,
  selectedId,
  onSelect,
  accessibilityLabel = 'Pages',
  height = 280,
}: ModulaPageTabViewProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const selected = tabs.find(tab => tab.id === selectedId) ?? tabs[0]
  if (!selected) return null

  return (
    <View style={{gap: spacing[3]}}>
      <ModulaSegmentedPicker
        appearance="segmented"
        accessibilityLabel={accessibilityLabel}
        options={tabs.map(tab => ({value: tab.id, label: tab.title}))}
        value={selected.id}
        onValueChange={onSelect}
      />
      <View
        style={[
          styles.page,
          {
            minHeight: height,
            backgroundColor: colours.surface,
            borderColor: colours.separator,
            borderRadius: radius.large,
            padding: spacing[4],
          },
        ]}>
        {selected.content}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
})
