import {Toolbar, ToolbarPane} from 'konsta/react'
import type {ReactNode} from 'react'

export function KonstaFloatingControlGroup({children}: {children: ReactNode}) {
  return (
    <Toolbar
      aria-label="Floating controls"
      className="modula-konsta-floating-toolbar"
      role="toolbar"
      top>
      <ToolbarPane className="modula-konsta-toolbar-pane">{children}</ToolbarPane>
    </Toolbar>
  )
}
