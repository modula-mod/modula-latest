import {Popover} from '@base-ui/react/popover'
import type {ReactNode} from 'react'

import {KonstaPopoverSurface} from '@/platform/ui/adapters/konsta/popover-surface.web'
import {ModulaDrawer} from '@/platform/ui/drawers/modula-drawer'
import {ModulaOverlayLayerScope, useModulaOverlayLayer} from '@/platform/ui/overlays/modula-overlay-stack'
import {useResponsivePresentation} from '@/platform/ui/responsive'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

export type ModulaPopoverProps = {
  isOpen: boolean
  onOpen?: () => void
  onDismiss: () => void
  /** Non-interactive trigger content. The adapter owns button semantics. */
  trigger: ReactNode
  children: ReactNode
  width?: number
  accessibilityLabel?: string
  triggerTestID?: string
  testID?: string
}

/** Anchored lightweight interaction for pointer/keyboard web contexts. */
export function ModulaPopover({
  isOpen,
  onOpen,
  onDismiss,
  trigger,
  children,
  width = 280,
  accessibilityLabel = 'Open popover',
  triggerTestID,
  testID,
}: ModulaPopoverProps) {
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const variables = modulaWebCssVariables(tokens, {reduceTransparency})
  const presentation = useResponsivePresentation('picker', {anchored: true})
  const layer = useModulaOverlayLayer('popover')
  if (presentation === 'drawer') {
    return (
      <>
        <button
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={accessibilityLabel}
          className="modula-web-ui modula-web-popover-trigger"
          data-testid={triggerTestID}
          onClick={onOpen}
          style={variables}
          type="button">
          {trigger}
        </button>
        <ModulaDrawer
          accessibilityLabel={accessibilityLabel}
          isPresented={isOpen}
          onDismiss={onDismiss}
          presentation="picker"
          testID={testID}
          title={accessibilityLabel}>
          {children}
        </ModulaDrawer>
      </>
    )
  }
  return (
    <Popover.Root
      open={isOpen}
      onOpenChange={open => {
        if (open) onOpen?.()
        else onDismiss()
      }}>
      <Popover.Trigger
        aria-label={accessibilityLabel}
        className="modula-web-ui modula-web-popover-trigger"
        data-testid={triggerTestID}
        style={variables}>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          align="start"
          className="modula-web-popover-positioner"
          sideOffset={6}
          style={{zIndex: layer.content}}>
          <Popover.Popup
            aria-label={accessibilityLabel}
            className="modula-web-ui modula-web-popover-popup"
            data-testid={testID}
            finalFocus
            initialFocus
            style={{...variables, width, zIndex: layer.content}}>
            <KonstaPopoverSurface>
              <ModulaOverlayLayerScope layer={layer.content}>{children}</ModulaOverlayLayerScope>
            </KonstaPopoverSurface>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
