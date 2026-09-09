import {ListInput} from 'konsta/react'
import type {ReactNode} from 'react'

export function KonstaListInputFrame({
  children,
  error,
  label,
}: {
  children: ReactNode
  error?: string
  label?: string
}) {
  return (
    <ListInput
      className="modula-konsta-list-input"
      component="div"
      error={Boolean(error)}
      floatingLabel={Boolean(label)}
      input={children}
      label={label}
      outline
    />
  )
}
