import type {ReactNode} from 'react'
import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaList, ModulaListRow} from '@/platform/ui/lists'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaDataTableColumn = {id: string; label: string; numeric?: boolean}
export type ModulaDataTableRow = {id: string; cells: Record<string, ReactNode>}

export type ModulaDataTableProps = {
  accessibilityLabel: string
  columns: readonly ModulaDataTableColumn[]
  rows: readonly ModulaDataTableRow[]
  emptyLabel?: string
  testID?: string
}

function renderCell(value: ReactNode) {
  return typeof value === 'string' || typeof value === 'number'
    ? <AppText variant="body">{value}</AppText>
    : value
}

/** Compact/native representation for the same semantic rows. */
export function ModulaDataTableCards({
  accessibilityLabel,
  columns,
  rows,
  emptyLabel = 'No data available.',
  testID,
}: ModulaDataTableProps) {
  const {spacing} = useThemeTokens()
  if (!rows.length) return <AppText colour="textSecondary">{emptyLabel}</AppText>
  return (
    <ModulaList testID={testID}>
      {rows.map((row, rowIndex) => (
        <ModulaListRow
          accessibilityLabel={`${accessibilityLabel}, row ${rowIndex + 1}`}
          key={row.id}
          last={rowIndex === rows.length - 1}
          stacked>
          <View style={{alignSelf: 'stretch', flex: 1, gap: spacing[2]}}>
            {columns.map(column => (
              <View key={column.id} style={{flexDirection: 'row', gap: spacing[3], justifyContent: 'space-between'}}>
                <AppText colour="textSecondary" variant="caption">{column.label}</AppText>
                <View>{renderCell(row.cells[column.id])}</View>
              </View>
            ))}
          </View>
        </ModulaListRow>
      ))}
    </ModulaList>
  )
}
