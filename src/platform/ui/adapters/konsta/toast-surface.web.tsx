import {Toast as KonstaToast} from 'konsta/react'
import type {CSSProperties, ReactNode} from 'react'

const staticToastStyle: CSSProperties = {
  position: 'relative',
  inset: 'auto',
  width: '100%',
  maxWidth: 'none',
  transform: 'none',
  transition: 'none',
}

/** Presentation only. Base UI owns announcement timing, queueing and gestures. */
export function KonstaToastSurface({children}: {children: ReactNode}) {
  return (
    <KonstaToast
      className="modula-konsta-toast-surface"
      data-modula-konsta-toast-surface
      opened
      position="left"
      style={staticToastStyle}>
      {children}
    </KonstaToast>
  )
}
