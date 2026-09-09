import {Actions, Dialog, Panel, Sheet} from 'konsta/react'
import type {CSSProperties, PropsWithChildren} from 'react'

type KonstaOverlaySurfaceProps = PropsWithChildren<{
  kind: 'actions' | 'dialog' | 'panel' | 'sheet'
  side?: 'left' | 'right'
  floating?: boolean
}>

const staticSurfaceStyle: CSSProperties = {
  display: 'flex',
  position: 'relative',
  inset: 'auto',
  width: '100%',
  height: 'auto',
  minHeight: 0,
  flex: '1 1 auto',
  flexDirection: 'column',
  maxWidth: 'none',
  maxHeight: '100%',
  transform: 'none',
  translate: '0 0',
  scale: '1',
  transition: 'none',
}

/**
 * Presentation-only Konsta surfaces. The owning Modula/Base UI overlay is
 * responsible for focus, dismissal, portal placement, scroll lock, gesture
 * state, positioning, and animation. These components render no backdrop and
 * remain permanently "opened" inside that owner.
 */
export function KonstaOverlaySurface({
  children,
  floating = false,
  kind,
  side = 'left',
}: KonstaOverlaySurfaceProps) {
  if (kind === 'actions') {
    return (
      <Actions
        backdrop={false}
        className="modula-konsta-overlay-surface modula-konsta-actions-surface"
        data-modula-konsta-overlay-surface="actions"
        style={staticSurfaceStyle}
        opened>
        {children}
      </Actions>
    )
  }
  if (kind === 'dialog') {
    return (
      <Dialog
        backdrop={false}
        className="modula-konsta-overlay-surface modula-konsta-dialog-surface"
        data-modula-konsta-overlay-surface="dialog"
        style={staticSurfaceStyle}
        opened>
        {children}
      </Dialog>
    )
  }
  if (kind === 'panel') {
    return (
      <Panel
        backdrop={false}
        className="modula-konsta-overlay-surface modula-konsta-panel-surface"
        data-modula-konsta-overlay-surface="panel"
        floating={floating}
        opened
        side={side}
        style={staticSurfaceStyle}>
        {children}
      </Panel>
    )
  }
  return (
    <Sheet
      backdrop={false}
      className="modula-konsta-overlay-surface modula-konsta-sheet-surface"
      data-modula-konsta-overlay-surface="sheet"
      opened
      style={staticSurfaceStyle}>
      {children}
    </Sheet>
  )
}
