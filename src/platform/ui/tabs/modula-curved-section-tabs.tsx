import {ScrollView, StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaCurvedSectionTab = {
  id: string
  label: string
}

type ModulaCurvedSectionTabsProps = {
  tabs: ModulaCurvedSectionTab[]
  selectedId: string
  onSelect: (id: string) => void
}

/**
 * Secondary nested section chrome (Marketplace categories / similar).
 *
 * Aesthetic nod to rit3zh/expo-curved-bottom-tabs (curved pill cluster) without
 * installing that demo (Skia + Reanimated + fights primary liquid-glass tabs).
 * Never mount as the global app tab bar.
 */
export function ModulaCurvedSectionTabs({
  tabs,
  selectedId,
  onSelect,
}: ModulaCurvedSectionTabsProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const compact = tabs.length <= 4

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colours.border,
          borderRadius: radius.xlarge,
          padding: spacing[1],
        },
      ]}
      accessibilityRole="tablist">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.row,
          compact ? styles.rowFill : undefined,
          {gap: spacing[1]},
        ]}>
        {tabs.map(tab => {
          const selected = tab.id === selectedId
          return (
            <AppPressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{selected}}
              accessibilityLabel={tab.label}
              onPress={() => {
                void selectionHaptic()
                onSelect(tab.id)
              }}
              style={[
                styles.hit,
                compact ? styles.hitFlex : styles.hitGrow,
                {
                  backgroundColor: selected ? colours.accentSubtle : 'transparent',
                  borderRadius: radius.round,
                },
              ]}>
              <AppText
                variant="label"
                style={{color: selected ? colours.accent : colours.textSecondary}}
                numberOfLines={1}>
                {tab.label}
              </AppText>
            </AppPressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  hitFlex: {
    flex: 1,
  },
  hitGrow: {
    flexGrow: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  rowFill: {
    flexGrow: 1,
    width: '100%',
  },
})
