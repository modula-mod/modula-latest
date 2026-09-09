import {KonstaDataTable} from '@/platform/ui/adapters/konsta/data-table.web'
import {
  ModulaDataTableCards,
  type ModulaDataTableProps,
} from '@/platform/ui/data/modula-data-table.shared'
import {useHydrationSafeWindowDimensions} from '@/lib/useHydrationSafeWindowDimensions'

export function ModulaDataTable(props: ModulaDataTableProps) {
  const {width} = useHydrationSafeWindowDimensions()
  if (width < 768) return <ModulaDataTableCards {...props} />
  if (!props.rows.length) return <ModulaDataTableCards {...props} />
  return (
    <KonstaDataTable
      accessibilityLabel={props.accessibilityLabel}
      columns={props.columns}
      rows={props.rows}
      testID={props.testID}
    />
  )
}

export type {
  ModulaDataTableColumn,
  ModulaDataTableProps,
  ModulaDataTableRow,
} from '@/platform/ui/data/modula-data-table.shared'
