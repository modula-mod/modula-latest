import {Popover} from 'konsta/react'
import type {CSSProperties, ReactNode} from 'react'

const staticPopoverStyle: CSSProperties = {
  position: 'relative',
  inset: 'auto',
  width: '100%',
  maxWidth: 'none',
  transform: 'none',
  translate: '0 0',
  scale: '1',
  transition: 'none',
}

/** Visual-only shell. Base UI owns anchoring, dismissal, focus and the portal. */
export function KonstaPopoverSurface({children}: {children: ReactNode}) {
  return (
    <Popover
      angle={false}
      backdrop={false}
      className="modula-konsta-popover-surface"
      data-modula-konsta-popover-surface
      opened
      style={staticPopoverStyle}>
      {children}
    </Popover>
  )
}
