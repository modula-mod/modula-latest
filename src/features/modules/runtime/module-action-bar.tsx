import {StyleSheet} from 'react-native'

import type {GreenfieldModuleAction} from '@modula/greenfield-module-ui-contracts'
import {ModulaButton, ModulaIconButton, ModulaToolbar} from '@/platform/ui/product-ui'

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
  const create = actions.find(action => action.kind === 'record.create')
  const extra = actions.filter(action => action.kind !== 'record.create').slice(0, 3)
  if (!create && !extra.length && !onSearch) return null
  return (
    <ModulaToolbar style={styles.bar} testID="module-action-bar" variant="module">
      {create ? (
        <ModulaButton
          label={create.label}
          accessibilityLabel={create.label}
          size="compact"
          onPress={() => onAction(create)}
        />
      ) : null}
      {onSearch ? (
        <ModulaIconButton accessibilityLabel="Search" icon="search" onPress={onSearch} />
      ) : null}
      {extra.map(action => (
        <ModulaButton
          key={action.actionId}
          label={action.label}
          role={action.destructive ? 'destructive' : 'secondary'}
          size="compact"
          onPress={() => onAction(action)}
        />
      ))}
    </ModulaToolbar>
  )
}

const styles = StyleSheet.create({
  bar: {alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap'},
})
