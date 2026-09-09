import {Dialog} from '@base-ui/react/dialog'
import {Drawer} from '@base-ui/react/drawer'
import type {ReactNode} from 'react'

import {KonstaOverlaySurface} from '@/platform/ui/adapters/konsta/overlay-surfaces.web'
import {
  ModulaOverlayLayerScope,
  useModulaOverlayLayer,
} from '@/platform/ui/overlays/modula-overlay-stack'
import {useResponsivePresentation} from '@/platform/ui/responsive'
import {
  detentForPresentation,
  overlayIntentForSheet,
  snapPointsForSemanticDetents,
  webSnapPoints,
  type ModulaSheetDesktopPresentation,
  type ModulaSheetDirection,
  type ModulaSheetProps,
  type ModulaSheetSnapPoint,
} from '@/platform/ui/sheets/modula-sheet.types'
import type {ModulaResolvedPresentation} from '@/platform/ui/responsive'
import {setShellChromeHoldObscure} from '@/platform/ui/navigation/shell-chrome-obscure'
import {useEffect, useRef} from 'react'
import {useReduceMotion} from '@/lib/accessibility'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

export type {ModulaSheetProps} from '@/platform/ui/sheets/modula-sheet.types'

const presentationSize = (presentation: ModulaSheetProps['presentation']): 'small' | 'regular' | 'large' => {
  if (presentation === 'compact' || presentation === 'actions' || presentation === 'picker' || presentation === 'context') return 'small'
  if (presentation === 'interactive' || presentation === 'media') return 'large'
  return 'regular'
}

function classNames(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

function WebOverlayContents({
  title,
  subtitle,
  header,
  footer,
  children,
  scrollBody,
  titleNode,
  descriptionNode,
  bodyNode,
}: {
  title?: string
  subtitle?: string
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  scrollBody: boolean
  titleNode: (props: {className: string; children: ReactNode}) => ReactNode
  descriptionNode: (props: {className: string; children: ReactNode}) => ReactNode
  bodyNode: (props: {className: string; children: ReactNode; 'data-scroll': string}) => ReactNode
}) {
  const accessibleTitle = title ?? 'Modula panel'
  const accessibleDescription = subtitle ?? 'Interactive Modula content'
  return (
    <div className="modula-web-overlay-content">
      {header ? (
        <>
          {titleNode({className: 'modula-web-visually-hidden', children: accessibleTitle})}
          {descriptionNode({className: 'modula-web-visually-hidden', children: accessibleDescription})}
          <div className="modula-web-overlay-custom-header">{header}</div>
        </>
      ) : (
        <div className="modula-web-overlay-header">
          {titleNode({className: 'modula-web-overlay-title', children: accessibleTitle})}
          {descriptionNode({
            className: subtitle ? 'modula-web-overlay-description' : 'modula-web-visually-hidden',
            children: accessibleDescription,
          })}
        </div>
      )}
      {bodyNode({
        className: 'modula-web-overlay-body',
        'data-scroll': String(scrollBody),
        children,
      })}
      {footer ? <div className="modula-web-overlay-footer">{footer}</div> : null}
    </div>
  )
}

function defaultDesktopPresentation(
  resolved: ModulaResolvedPresentation,
  override: ModulaSheetDesktopPresentation | undefined,
): 'drawer' | 'sheet' | 'dialog' {
  if (resolved === 'drawer') return resolved
  if (override) return override
  return resolved === 'menu' || resolved === 'popover' ? 'dialog' : resolved
}

/**
 * Modula-owned web adapter. Base UI is private implementation machinery; all
 * screen and product code continues to consume the semantic Modula contract.
 */
export function ModulaSheet({
  isPresented,
  onDismiss,
  children,
  presentation,
  title,
  subtitle,
  header,
  footer,
  detent,
  detents,
  snapPoints,
  activeSnapPoint,
  onActiveSnapPointChange,
  showDragIndicator = true,
  direction = 'bottom',
  desktopPresentation,
  dialogSize: requestedDialogSize,
  dismissOnOutsidePress = true,
  testID,
  scrollBody = true,
  obscureShellChrome = true,
  accessibilityLabel,
}: ModulaSheetProps) {
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const reduceMotion = useReduceMotion()
  const semantic = useResponsivePresentation(overlayIntentForSheet(presentation), {anchored: false})
  const resolved = defaultDesktopPresentation(semantic, desktopPresentation)
  const variables = modulaWebCssVariables(tokens, {reduceTransparency})
  const resolvedDetent = detent ?? detentForPresentation(presentation)
  const semanticPoints = snapPoints ?? snapPointsForSemanticDetents(detents)
  const resolvedPoints = webSnapPoints(semanticPoints)
  const resolvedActivePoint = webSnapPoints(activeSnapPoint ? [activeSnapPoint] : undefined)?.[0] ?? null
  const resolvedDirection: ModulaSheetDirection = direction
  const warnedUnsupportedSnapRef = useRef(false)
  const requestedSnapInteraction = Boolean(
    detents?.length
      || snapPoints?.length
      || activeSnapPoint != null
      || onActiveSnapPointChange,
  )
  // A semantic dialog keeps dialog priority even when compact web presents it
  // as a bottom drawer. This lets confirmations safely replace action sheets.
  const layer = useModulaOverlayLayer(
    desktopPresentation === 'dialog'
      ? 'dialog'
      : resolved === 'dialog'
        ? 'dialog'
        : resolved === 'sheet'
          ? 'sheet'
          : 'drawer',
  )

  useEffect(() => {
    if (!obscureShellChrome) return
    setShellChromeHoldObscure(isPresented)
    return () => setShellChromeHoldObscure(false)
  }, [isPresented, obscureShellChrome])

  useEffect(() => {
    if (
      !__DEV__
      || !isPresented
      || resolved === 'drawer'
      || !requestedSnapInteraction
      || warnedUnsupportedSnapRef.current
    ) return
    warnedUnsupportedSnapRef.current = true
    console.warn(
      'ModulaSheet snap points and detents require the drawer presentation on web; the current edge/dialog presentation keeps content-sized behavior.',
    )
  }, [isPresented, requestedSnapInteraction, resolved])

  if (resolved === 'drawer') {
    const swipeDirection = resolvedDirection === 'bottom' ? 'down' : resolvedDirection
    return (
      <Drawer.Root
        open={isPresented}
        onOpenChange={open => { if (!open) onDismiss() }}
        modal
        disablePointerDismissal={!dismissOnOutsidePress}
        swipeDirection={swipeDirection}
        snapPoints={resolvedPoints}
        snapPoint={resolvedActivePoint}
        onSnapPointChange={point => onActiveSnapPointChange?.(pointToContract(point))}
        snapToSequentialPoints>
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Portal>
            <Drawer.Backdrop
              className="modula-web-ui modula-web-backdrop modula-web-drawer-backdrop"
              data-reduce-motion={String(reduceMotion)}
              style={{...variables, zIndex: layer.backdrop}}
            />
            <Drawer.Viewport
              className="modula-web-ui modula-web-drawer-viewport"
              data-direction={resolvedDirection}
              data-reduce-motion={String(reduceMotion)}
              style={{...variables, zIndex: layer.content}}>
              <Drawer.Popup
                aria-label={accessibilityLabel}
                className="modula-web-drawer-popup modula-web-konsta-overlay-host"
                data-direction={resolvedDirection}
                data-detent={resolvedDetent}
                finalFocus
                initialFocus
                data-testid={testID}
                style={variables}>
                <KonstaOverlaySurface
                  kind={presentation === 'actions' || presentation === 'context' || presentation === 'compact' ? 'actions' : 'sheet'}>
                  <ModulaOverlayLayerScope layer={layer.content}>
                    {showDragIndicator && resolvedDirection === 'bottom' ? (
                      <div aria-hidden="true" className="modula-web-drawer-handle-target">
                        <div className="modula-web-drawer-handle" />
                      </div>
                    ) : null}
                    <WebOverlayContents
                      bodyNode={props => <Drawer.Content {...props} />}
                      descriptionNode={props => <Drawer.Description {...props} />}
                      titleNode={props => <Drawer.Title {...props} />}
                      title={title}
                      subtitle={subtitle}
                      header={header}
                      footer={footer}
                      scrollBody={scrollBody}>
                      {children}
                    </WebOverlayContents>
                  </ModulaOverlayLayerScope>
                </KonstaOverlaySurface>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>
    )
  }

  const dialogSize = requestedDialogSize ?? presentationSize(presentation)
  const edge = resolved === 'sheet'
  return (
    <Dialog.Root
      open={isPresented}
      onOpenChange={open => { if (!open) onDismiss() }}
      modal
      disablePointerDismissal={!dismissOnOutsidePress}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="modula-web-ui modula-web-backdrop"
          data-reduce-motion={String(reduceMotion)}
          style={{...variables, zIndex: layer.backdrop}}
        />
        <Dialog.Viewport
          className="modula-web-ui modula-web-dialog-viewport"
          data-edge={edge ? 'true' : 'false'}
          data-reduce-motion={String(reduceMotion)}
          style={{...variables, zIndex: layer.content}}>
          <Dialog.Popup
            aria-label={accessibilityLabel}
            className={classNames('modula-web-dialog-popup', 'modula-web-konsta-overlay-host', edge && 'modula-web-edge-sheet')}
            data-size={dialogSize}
            data-side={resolvedDirection === 'left' ? 'left' : 'right'}
            finalFocus
            initialFocus
            data-testid={testID}
            style={variables}>
            <KonstaOverlaySurface
              kind={edge ? (resolvedDirection === 'bottom' ? 'sheet' : 'panel') : 'dialog'}
              side={resolvedDirection === 'right' ? 'right' : 'left'}>
              <ModulaOverlayLayerScope layer={layer.content}>
                <WebOverlayContents
                  bodyNode={props => <div {...props} />}
                  descriptionNode={props => <Dialog.Description {...props} />}
                  titleNode={props => <Dialog.Title {...props} />}
                  title={title}
                  subtitle={subtitle}
                  header={header}
                  footer={footer}
                  scrollBody={scrollBody}>
                  {children}
                </WebOverlayContents>
              </ModulaOverlayLayerScope>
            </KonstaOverlaySurface>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function pointToContract(point: number | string | null): ModulaSheetSnapPoint | null {
  if (point == null) return null
  if (typeof point === 'number') {
    if (point >= 0.99) return 'full'
    if (Math.abs(point - 0.56) < 0.01) return 'half'
    return {fraction: point}
  }
  const pixels = Number.parseFloat(point)
  return Number.isFinite(pixels) && point.endsWith('px') ? {height: pixels} : null
}
