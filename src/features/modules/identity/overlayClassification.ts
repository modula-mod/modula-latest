/**
 * Overlay presentation kinds. Do not call every overlay a “drawer”.
 *
 * Reference: Phase 7M-B6 drawer/sheet architecture audit.
 */
export type OverlayKind =
  | 'DRAWER'
  | 'SHEET'
  | 'FULL_SCREEN_MODAL'
  | 'POPOVER'
  | 'CONTEXT_MENU'
  | 'ROUTE'

export const OVERLAY_CLASSIFICATION = {
  mainShellDrawer: 'DRAWER',
  composerTools: 'SHEET',
  comments: 'SHEET',
  reactions: 'POPOVER',
  moduleInstall: 'SHEET',
  moduleSettings: 'ROUTE',
  appearanceControls: 'ROUTE',
  profileCustomization: 'ROUTE',
  installProgress: 'SHEET',
  previewLightbox: 'FULL_SCREEN_MODAL',
} as const satisfies Record<string, OverlayKind>
