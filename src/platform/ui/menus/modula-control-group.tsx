import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaControlGroupAction = ModulaActionItem & {
  systemImage?: string
}

type ModulaControlGroupProps = {
  label: string
  systemImage?: string
  actions: ModulaControlGroupAction[]
  onAction: (actionId: string) => void
  overflowActions?: ModulaActionItem[]
}

/** Web / Android fallback: horizontal action cluster. */
export function ModulaControlGroup({
  label,
  actions,
  onAction,
  overflowActions = [],
}: ModulaControlGroupProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const all = [...actions, ...overflowActions]

  return (
    <View
      accessibilityLabel={label}
      style={[
        styles.row,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colours.border,
          borderRadius: radius.md,
          gap: spacing[2],
          padding: spacing[2],
        },
      ]}>
      {all.map(action => (
        <AppPressable
          key={action.id}
          accessibilityLabel={action.label}
          onPress={() => onAction(action.id)}
          style={[
            styles.chip,
            {
              backgroundColor:
                action.style === 'destructive' ? colours.destructiveSubtle : colours.surfaceMuted,
              borderRadius: radius.round,
            },
          ]}>
          <AppText
            variant="label"
            style={{
              color: action.style === 'destructive' ? colours.destructive : colours.text,
            }}>
            {action.label}
          </AppText>
        </AppPressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
