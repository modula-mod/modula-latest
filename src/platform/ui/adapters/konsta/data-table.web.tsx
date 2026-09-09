import {Table, TableBody, TableCell, TableHead, TableRow} from 'konsta/react'
import type {ReactNode} from 'react'

export type KonstaDataColumn = {id: string; label: string; numeric?: boolean}
export type KonstaDataRow = {id: string; cells: Record<string, ReactNode>}

export function KonstaDataTable({
  accessibilityLabel,
  columns,
  rows,
  testID,
}: {
  accessibilityLabel: string
  columns: readonly KonstaDataColumn[]
  rows: readonly KonstaDataRow[]
  testID?: string
}) {
  return (
    <div className="modula-konsta-data-table-wrap" data-testid={testID}>
      <Table aria-label={accessibilityLabel}>
        <TableHead>
          <TableRow header>
            {columns.map(column => (
              <TableCell data-numeric={column.numeric ? 'true' : 'false'} header key={column.id} scope="col">
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.id}>
              {columns.map(column => (
                <TableCell data-numeric={column.numeric ? 'true' : 'false'} key={column.id}>
                  {row.cells[column.id]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
