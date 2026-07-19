/**
 * Modula platform UI adapters.
 *
 * Product screens import these wrappers — never `@expo/ui/swift-ui`.
 * Keyboard / camera / imperative menus land here alongside shell chrome.
 */
export * from '@/platform/ui/buttons/button-role'
export {ModulaButton} from '@/platform/ui/buttons/modula-button'
export {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
export {ModulaTitleIconButton} from '@/platform/ui/buttons/modula-title-icon-button'
// Camera / video adapters stay out of this startup barrel — they must not
// pull expo-camera / expo-video into `_layout` before a native rebuild.
// Import from `@/platform/ui/camera/*` or `@/platform/ui/video` at call sites.
export {
  captureMediaFromSource,
  presentMediaSourceMenu,
} from '@/platform/ui/camera'
export type {
  PresentMediaSourceMenuOptions,
  MediaSourceMenuResult,
  MediaCaptureOptions,
  MediaCaptureResult,
  MediaCaptureSource,
  MediaCaptureTarget,
} from '@/platform/ui/camera'
export * from '@/platform/ui/keyboard'
export * from '@/platform/ui/menus'
export {AccountPanelProvider, useAccountPanel} from '@/platform/ui/navigation/AccountPanelContext'
export {AdaptiveAccountPanel} from '@/platform/ui/navigation/adaptive-account-panel'
export {
  getAccountPanelDestinations,
  registerAccountPanelDestination,
  type AccountPanelDestination,
} from '@/platform/ui/navigation/account-panel-destinations'
export {
  MODULA_TABS,
  getModulaTab,
  type ModulaTabDefinition,
  type ModulaTabId,
} from '@/platform/ui/navigation/modula-tabs'
export {nativeScreenHeaderOptions} from '@/platform/ui/navigation/native-screen-header'
export {PlatformTabs} from '@/platform/ui/navigation/platform-tabs'
export {
  accountPanelReducer,
  initialPanelState,
  isAccountPanelVisible,
  type PanelAction,
  type PanelCloseReason,
  type PanelState,
} from '@/platform/ui/navigation/account-panel-state'
export {ModulaSheet, type ModulaSheetProps} from '@/platform/ui/sheets/modula-sheet'
export {
  SelectionSheet,
  type SelectionSheetOption,
} from '@/platform/ui/sheets/selection-sheet'
export {
  initialSheetState,
  isSheetVisible,
  sheetReducer,
  type SheetAction,
  type SheetCloseReason,
  type SheetState,
} from '@/platform/ui/sheets/sheet-state-machine'
export {
  MODULA_MIN_TOUCH_TARGET,
  meetsTouchTarget,
} from '@/platform/ui/touch/touch-target'
export * from '@/platform/ui/avatars'
export * from '@/platform/ui/skeletons'
export * from '@/platform/ui/tabs'
export {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
export {hideExpoDevToolsButton} from '@/platform/ui/dev/hide-expo-dev-tools-button'
