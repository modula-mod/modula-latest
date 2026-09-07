import {ContextMenu} from '@base-ui/react/context-menu'
import {useState, type ReactNode} from 'react'

import {ModulaMenuItems, ModulaTouchActionDrawer} from '@/platform/ui/menus/modula-menu.web'
import type {ModulaActionItem, ModulaMenuFit} from '@/platform/ui/menus/types'
import {useResponsivePresentation} from '@/platform/ui/responsive'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

export type ModulaContextMenuProps = {
  children: ReactNode
  title?: string
  actions: ModulaActionItem[]
  onAction: (actionId: string) => void
  accessibilityLabel?: string
  disabled?: boolean
  fit?: ModulaMenuFit
}

/** Right-click/keyboard context menu; touch routes should prefer action drawers. */
export function ModulaContextMenu({
  children,
  title,
  actions,
  onAction,
  accessibilityLabel,
  disabled,
  fit = 'fill',
}: ModulaContextMenuProps) {
  const presentation = useResponsivePresentation('context', {anchored: true})
  if (disabled) return <>{children}</>
  return presentation === 'drawer' ? (
    <TouchContextMenu {...{children, title, actions, onAction, accessibilityLabel, fit}} />
  ) : (
    <DesktopContextMenu {...{children, title, actions, onAction, accessibilityLabel, fit}} />
  )
}

function TouchContextMenu({
  children,
  title = 'Actions',
  actions,
  onAction,
  accessibilityLabel,
  fit = 'fill',
}: Omit<ModulaContextMenuProps, 'disabled'>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <ContextMenu.Root open={false} onOpenChange={next => next && setOpen(true)}>
        <ContextMenu.Trigger
          aria-label={accessibilityLabel}
          className={fit === 'fill' ? 'modula-web-context-trigger modula-web-context-trigger-fill' : 'modula-web-context-trigger'}>
          {children}
        </ContextMenu.Trigger>
      </ContextMenu.Root>
      <ModulaTouchActionDrawer
        actions={actions}
        onAction={onAction}
        onOpenChange={setOpen}
        open={open}
        title={title}
      />
    </>
  )
}

function DesktopContextMenu({
  children,
  title,
  actions,
  onAction,
  accessibilityLabel,
  fit = 'fill',
}: Omit<ModulaContextMenuProps, 'disabled'>) {
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const variables = modulaWebCssVariables(tokens, {reduceTransparency})
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        aria-label={accessibilityLabel}
        className={fit === 'fill' ? 'modula-web-context-trigger modula-web-context-trigger-fill' : 'modula-web-context-trigger'}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="modula-web-menu-positioner">
          <ContextMenu.Popup className="modula-web-ui modula-web-menu-popup" style={variables}>
            {title ? <div className="modula-web-menu-group-label" role="presentation">{title}</div> : null}
            <ModulaMenuItems actions={actions} onAction={onAction} parts={ContextMenu} />
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
