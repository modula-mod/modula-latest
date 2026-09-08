import {Menu} from '@base-ui/react/menu'
import {useState, type ElementType, type ReactNode} from 'react'

import {
  ModulaDrawerNavigator,
  type ModulaDrawerScreen,
} from '@/platform/ui/drawers/modula-drawer-navigator'
import {ModulaIcon} from '@/platform/ui/icons'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {useResponsivePresentation} from '@/platform/ui/responsive'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

export type ModulaMenuProps = {
  trigger: ReactNode
  title?: string
  actions: ModulaActionItem[]
  onAction: (actionId: string) => void
  accessibilityLabel?: string
  disabled?: boolean
}

type MenuParts = {
  Group: ElementType
  GroupLabel: ElementType
  CheckboxItem: ElementType
  CheckboxItemIndicator: ElementType
  Item: ElementType
  Portal: ElementType
  Positioner: ElementType
  Popup: ElementType
  RadioGroup: ElementType
  RadioItem: ElementType
  RadioItemIndicator: ElementType
  Separator: ElementType
  SubmenuRoot: ElementType
  SubmenuTrigger: ElementType
}

/** Desktop-native menu semantics with Base UI kept behind the Modula API. */
export function ModulaMenu({
  ...props
}: ModulaMenuProps) {
  const presentation = useResponsivePresentation('actions', {anchored: true})
  return presentation === 'drawer' ? <TouchModulaMenu {...props} /> : <DesktopModulaMenu {...props} />
}

function DesktopModulaMenu({
  trigger,
  title,
  actions,
  onAction,
  accessibilityLabel = 'Open menu',
  disabled,
}: ModulaMenuProps) {
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const variables = modulaWebCssVariables(tokens, {reduceTransparency})
  return (
    <Menu.Root disabled={disabled}>
      <Menu.Trigger
        aria-label={accessibilityLabel}
        className="modula-web-ui modula-web-menu-trigger"
        disabled={disabled}
        style={variables}>
        {trigger}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" className="modula-web-menu-positioner" sideOffset={6}>
          <Menu.Popup className="modula-web-ui modula-web-menu-popup" style={variables}>
            {title ? <div className="modula-web-menu-group-label" role="presentation">{title}</div> : null}
            <ModulaMenuItems actions={actions} onAction={onAction} parts={Menu} />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function TouchModulaMenu({
  trigger,
  title = 'Actions',
  actions,
  onAction,
  accessibilityLabel = 'Open menu',
  disabled,
}: ModulaMenuProps) {
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const variables = modulaWebCssVariables(tokens, {reduceTransparency})
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={accessibilityLabel}
        className="modula-web-ui modula-web-menu-trigger"
        disabled={disabled}
        onClick={() => setOpen(true)}
        style={variables}
        type="button">
        {trigger}
      </button>
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

export function ModulaTouchActionDrawer({
  open,
  onOpenChange,
  onDismiss,
  title = 'Actions',
  message,
  actions,
  onAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDismiss?: () => void
  title?: string
  message?: string
  actions: ModulaActionItem[]
  onAction: (actionId: string) => void
}) {
  const dismiss = () => {
    onOpenChange(false)
    onDismiss?.()
  }
  const select = (id: string) => {
    onOpenChange(false)
    // Release the outgoing modal's focus and scroll lock before an action
    // navigates or presents the next semantic overlay.
    requestAnimationFrame(() => requestAnimationFrame(() => onAction(id)))
  }
  const screens = touchActionScreens(title, actions, select, message)
  return (
    <ModulaDrawerNavigator
      initialRoute="root"
      isPresented={open}
      onDismiss={dismiss}
      presentation="actions"
      screens={screens}
    />
  )
}

function touchActionScreens(
  title: string,
  actions: ModulaActionItem[],
  onAction: (actionId: string) => void,
  message?: string,
): readonly ModulaDrawerScreen<string>[] {
  const screens: ModulaDrawerScreen<string>[] = []
  const add = (route: string, screenTitle: string, parentLabel: string | undefined, items: ModulaActionItem[]) => {
    const childRoutes = new Map<string, string>()
    items.forEach((action, index) => {
      if (!action.children?.length) return
      const childRoute = `${route}/${index}-${action.id}`
      childRoutes.set(action.id, childRoute)
      add(childRoute, action.label, screenTitle, action.children)
    })
    screens.push({
      id: route,
      title: screenTitle,
      subtitle: route === 'root' ? message : undefined,
      parentLabel,
      render: navigation => (
        <TouchMenuItems
          actions={items}
          onAction={onAction}
          onSubmenu={action => {
            const child = childRoutes.get(action.id)
            if (child) navigation.push(child)
          }}
        />
      ),
    })
  }
  add('root', title, undefined, actions)
  return screens
}

function TouchMenuItems({
  actions,
  onAction,
  onSubmenu,
}: {
  actions: ModulaActionItem[]
  onAction: (actionId: string) => void
  onSubmenu: (action: ModulaActionItem) => void
}) {
  const {colours} = useThemeTokens()
  return (
    <div className="modula-web-touch-actions">
      {actions.map(action => action.picker ? (
        <div className="modula-web-touch-action-group" key={action.id}>
          <span className="modula-web-menu-group-label">{action.label}</span>
          {action.picker.options.map(option => (
            <button
              aria-checked={option.id === action.picker?.selectedId}
              className="modula-web-menu-item"
              disabled={action.disabled}
              key={option.id}
              onClick={() => onAction(option.id)}
              role="radio"
              type="button">
              <span className="modula-web-menu-indicator">{option.id === action.picker?.selectedId ? '✓' : ''}</span>
              <span className="modula-web-menu-label">{option.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <button
          aria-label={action.accessibilityLabel}
          aria-pressed={action.checked}
          className="modula-web-menu-item"
          data-destructive={action.style === 'destructive' ? 'true' : 'false'}
          disabled={action.disabled}
          key={action.id}
          onClick={() => action.children?.length ? onSubmenu(action) : onAction(action.id)}
          title={action.disabledReason}
          type="button">
          {action.icon ? <ModulaIcon name={action.icon} size={16} colour={colours.text} /> : <span aria-hidden="true" />}
          <span className="modula-web-menu-label">{action.label}</span>
          <span aria-hidden="true" className="modula-web-menu-trailing">{action.children?.length ? '›' : action.checked ? '✓' : ''}</span>
        </button>
      ))}
    </div>
  )
}

export function ModulaMenuItems({
  actions,
  onAction,
  parts,
}: {
  actions: ModulaActionItem[]
  onAction: (actionId: string) => void
  parts: MenuParts
}) {
  return actions.map((action, index) => (
    <MenuAction
      action={action}
      key={action.id}
      onAction={onAction}
      parts={parts}
      separator={index > 0 && action.style === 'destructive'}
    />
  ))
}

function MenuAction({
  action,
  onAction,
  parts,
  separator,
}: {
  action: ModulaActionItem
  onAction: (actionId: string) => void
  parts: MenuParts
  separator: boolean
}) {
  const P = parts
  const {colours} = useThemeTokens()
  const leading = action.icon ? <ModulaIcon name={action.icon} size={16} colour={colours.text} /> : <span aria-hidden="true" />
  if (action.children?.length) {
    return (
      <>
        {separator ? <P.Separator className="modula-web-menu-separator" /> : null}
        <P.SubmenuRoot disabled={action.disabled}>
          <P.SubmenuTrigger className="modula-web-menu-item" disabled={action.disabled}>
            {leading}
            <span className="modula-web-menu-label">{action.label}</span>
            <span aria-hidden="true" className="modula-web-menu-trailing">›</span>
          </P.SubmenuTrigger>
          <P.Portal>
            <P.Positioner align="start" className="modula-web-menu-positioner" sideOffset={4}>
              <P.Popup className="modula-web-ui modula-web-menu-popup">
                <ModulaMenuItems actions={action.children} onAction={onAction} parts={parts} />
              </P.Popup>
            </P.Positioner>
          </P.Portal>
        </P.SubmenuRoot>
      </>
    )
  }
  if (action.picker) {
    return (
      <>
        {separator ? <P.Separator className="modula-web-menu-separator" /> : null}
        <P.Group>
          <P.GroupLabel className="modula-web-menu-group-label">{action.label}</P.GroupLabel>
          <P.RadioGroup value={action.picker.selectedId} onValueChange={(value: unknown) => onAction(String(value))}>
            {action.picker.options.map(option => (
              <P.RadioItem
                className="modula-web-menu-item"
                disabled={action.disabled}
                key={option.id}
                value={option.id}>
                <P.RadioItemIndicator className="modula-web-menu-indicator">✓</P.RadioItemIndicator>
                <span className="modula-web-menu-label">{option.label}</span>
              </P.RadioItem>
            ))}
          </P.RadioGroup>
        </P.Group>
      </>
    )
  }
  if (action.checked !== undefined) {
    return (
      <>
        {separator ? <P.Separator className="modula-web-menu-separator" /> : null}
        <P.CheckboxItem
          aria-label={action.accessibilityLabel}
          checked={action.checked}
          className="modula-web-menu-item"
          disabled={action.disabled}
          onCheckedChange={() => onAction(action.id)}>
          <P.CheckboxItemIndicator className="modula-web-menu-indicator">✓</P.CheckboxItemIndicator>
          <span className="modula-web-menu-label">{action.label}</span>
        </P.CheckboxItem>
      </>
    )
  }
  return (
    <>
      {separator ? <P.Separator className="modula-web-menu-separator" /> : null}
      <P.Item
        aria-label={action.accessibilityLabel}
        className="modula-web-menu-item"
        data-destructive={action.style === 'destructive' ? 'true' : 'false'}
        disabled={action.disabled}
        label={action.label}
        onClick={() => onAction(action.id)}
        title={action.disabledReason}>
        {leading}
        <span className="modula-web-menu-label">{action.label}</span>
      </P.Item>
    </>
  )
}
