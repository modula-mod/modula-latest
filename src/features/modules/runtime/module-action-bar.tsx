import {StyleSheet, View} from 'react-native'

import type {GreenfieldModuleAction} from '@modula/greenfield-module-ui-contracts'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaIcon} from '@/platform/ui/icons'
import {AppPressable} from '@/components/primitives/AppPressable'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Generic host action bar. Actions come from the view manifest — never hardcoded Notes verbs.
 */
export function ModuleActionBar({
  actions,
  onAction,
  onSearch,
}: {
  actions: GreenfieldModuleAction[]
  onAction: (action: GreenfieldModuleAction) => void
  onSearch?: () => void
}) {
  const {colours, spacing} = useThemeTokens()
  const create = actions.find(action => action.kind === 'record.create')
  const extra = actions.filter(action => action.kind !== 'record.create').slice(0, 3)
  if (!create && !extra.length && !onSearch) return null
  return (
    <View style={[styles.bar, {gap: spacing[2]}]} testID="module-action-bar">
      {create ? (
        <ModulaButton
          label={create.label}
          accessibilityLabel={create.label}
          onPress={() => onAction(create)}
        />
      ) : null}
      {onSearch ? (
        <AppPressable accessibilityLabel="Search" onPress={onSearch} style={styles.icon}>
          <ModulaIcon name="search" size={20} colour={colours.text} />
        </AppPressable>
      ) : null}
      {extra.map(action => (
        <ModulaButton
          key={action.actionId}
          label={action.label}
          role={action.destructive ? 'destructive' : 'secondary'}
          onPress={() => onAction(action)}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap'},
  icon: {alignItems: 'center', height: 44, justifyContent: 'center', width: 44},
})
