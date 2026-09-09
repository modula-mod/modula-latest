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
 * Passive presentation surface. The owning Modula/Base UI overlay is the only
 * interactive runtime: it owns focus, dismissal, portal placement, scroll
 * lock, gesture state, positioning, and animation. Konsta's theme classes and
 * generated tokens still style this surface, but no Konsta overlay primitive
 * is mounted here because those primitives retain their own open lifecycle.
 */
export function KonstaOverlaySurface({
  children,
  floating = false,
  kind,
  side = 'left',
}: KonstaOverlaySurfaceProps) {
  return (
    <div
      className={`modula-konsta-overlay-surface modula-konsta-${kind}-surface`}
      data-floating={floating ? 'true' : undefined}
      data-modula-konsta-overlay-surface={kind}
      data-side={kind === 'panel' ? side : undefined}
      style={staticSurfaceStyle}>
      {children}
    </div>
  )
}
