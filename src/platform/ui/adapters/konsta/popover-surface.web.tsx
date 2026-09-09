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

/** Passive visual shell. Base UI owns anchoring, dismissal, focus and the portal. */
export function KonstaPopoverSurface({children}: {children: ReactNode}) {
  return (
    <div
      className="modula-konsta-popover-surface"
      data-modula-konsta-popover-surface
      style={staticPopoverStyle}>
      {children}
    </div>
  )
}
