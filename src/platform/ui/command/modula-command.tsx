import {useMemo, useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaSearchField} from '@/platform/ui/controls/modula-search-field'
import {ModulaListRow} from '@/platform/ui/lists'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import type {ModulaCommandProps} from '@/platform/ui/command/modula-command.types'

export type {ModulaCommandAction, ModulaCommandProps} from '@/platform/ui/command/modula-command.types'

/** Native semantic fallback; web provides the keyboard-first adapter. */
export function ModulaCommand({
  isOpen,
  onOpenChange,
  actions,
  title = 'Commands',
  description = 'Search available actions',
  placeholder = 'Search commands',
  emptyLabel = 'No matching commands.',
  testID,
}: ModulaCommandProps) {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return actions
    return actions.filter(action => [action.label, action.description, ...(action.keywords ?? [])]
      .filter(Boolean).join(' ').toLowerCase().includes(needle))
  }, [actions, query])
  return (
    <ModulaSheet
      isPresented={isOpen}
      onDismiss={() => onOpenChange(false)}
      presentation="interactive"
      title={title}
      subtitle={description}
      testID={testID}>
      <View style={styles.body}>
        <ModulaSearchField autoFocus onChangeText={setQuery} placeholder={placeholder} value={query} />
        {visible.length ? visible.map(action => (
          <ModulaListRow
            disabled={action.disabled}
            key={action.id}
            onPress={() => { action.onSelect(); onOpenChange(false) }}
            title={action.label}
            description={action.description}
            variant="action"
          />
        )) : <AppText variant="caption" colour="textSecondary">{emptyLabel}</AppText>}
      </View>
    </ModulaSheet>
  )
}

const styles = StyleSheet.create({body: {gap: 8}})
