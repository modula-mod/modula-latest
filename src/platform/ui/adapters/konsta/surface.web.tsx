import {Glass} from 'konsta/react'
import type {CSSProperties, ReactNode} from 'react'

export function KonstaSurface({
  children,
  highlight,
  style,
  variant,
}: {
  children: ReactNode
  highlight: boolean
  style?: CSSProperties
  variant: 'glass' | 'platform'
}) {
  return (
    <Glass
      className="modula-konsta-surface"
      data-variant={variant}
      highlight={highlight}
      style={style}>
      {children}
    </Glass>
  )
}
