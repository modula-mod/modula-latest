/**
 * Modula platform UI adapters.
 *
 * Product screens import these wrappers — never `@expo/ui/swift-ui`.
 * Keyboard / camera / imperative menus land here alongside shell chrome.
 */
export * from '@/platform/ui/buttons/button-role'
export * from '@/platform/ui/icons'
export {ModulaButton, type ModulaButtonProps} from '@/platform/ui/buttons/modula-button'
export {
  ModulaActionButton,
  type ModulaActionButtonEmphasis,
  type ModulaActionButtonProps,
  type ModulaActionButtonSize,
} from '@/platform/ui/buttons/modula-action-button'
export {ModulaIconButton, type ModulaIconButtonProps} from '@/platform/ui/buttons/modula-icon-button'
export {ModulaButtonGroup} from '@/platform/ui/buttons/modula-button-group'
export {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
export {ModulaTitleIconButton} from '@/platform/ui/buttons/modula-title-icon-button'
export {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
export type {
  ModulaSegmentedAppearance,
  ModulaSegmentedOption,
  ModulaSegmentedPickerProps,
} from '@/platform/ui/controls/modula-segmented-picker.types'
export {ModulaSwitch} from '@/platform/ui/controls/modula-switch'
export type {ModulaSwitchProps} from '@/platform/ui/controls/modula-switch'
export {ModulaCheckbox} from '@/platform/ui/controls/modula-checkbox'
export type {ModulaCheckboxProps} from '@/platform/ui/controls/modula-checkbox'
export {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'
export type {ModulaTextInputProps} from '@/platform/ui/controls/modula-text-input'
export {ModulaCombobox, type ModulaComboboxOption, type ModulaComboboxProps} from '@/platform/ui/controls/modula-combobox'
export {
  ModulaToggleGroup,
  type ModulaToggleGroupItem,
  type ModulaToggleGroupProps,
} from '@/platform/ui/controls/modula-toggle-group'
export {ModulaSecureInput} from '@/platform/ui/controls/modula-secure-input'
export {ModulaSecureField} from '@/platform/ui/controls/modula-secure-field'
export {ModulaFieldShell} from '@/platform/ui/controls/modula-field-shell'
export type {ModulaFieldShellProps} from '@/platform/ui/controls/modula-field-shell'
export {ModulaOTPField} from '@/platform/ui/controls/modula-otp-field'
export type {ModulaOTPFieldProps} from '@/platform/ui/controls/modula-otp-field'
export {ModulaSearchField} from '@/platform/ui/controls/modula-search-field'
export type {ModulaSearchFieldProps} from '@/platform/ui/controls/modula-search-field'
export {
  ModulaList,
  ModulaListItem,
  ModulaFieldGroup,
  ModulaFieldSection,
} from '@/platform/ui/controls/modula-list'
export type {
  ModulaListProps,
  ModulaListItemProps,
  ModulaFieldGroupProps,
  ModulaFieldSectionProps,
} from '@/platform/ui/controls/modula-list'
export {ModulaProgress} from '@/platform/ui/controls/modula-progress'
export type {ModulaProgressProps} from '@/platform/ui/controls/modula-progress'
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
export {
  ModulaNavigationHeader,
  type ModulaNavigationHeaderPresentation,
  type ModulaNavigationHeaderProps,
} from '@/platform/ui/navigation/modula-navigation-header'
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
export type {
  ModulaSheetDetent,
  ModulaSheetDesktopPresentation,
  ModulaSheetDirection,
  ModulaSheetPresentation,
  ModulaSheetSemanticDetent,
  ModulaSheetSnapPoint,
} from '@/platform/ui/sheets/modula-sheet.types'
export * from '@/platform/ui/responsive'
export {
  ModulaActionSheet,
  ModulaToolDrawer,
  type ModulaActionSheetProps,
  type ModulaToolDrawerItem,
  type ModulaToolDrawerSection,
} from '@/platform/ui/sheets/modula-sheet-compositions'
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
export {
  ModulaActivityRow,
  ModulaNotificationRow,
  ModulaIconTile,
  ModulaInsetSeparator,
  ModulaListAccessoryView,
  ModulaListAvatar,
  ModulaListMetadata,
  ModulaListRow,
  ModulaListSection,
  ModulaSectionSeparator,
  ModulaSeparator,
  ModulaList as ModulaListSurface,
} from '@/platform/ui/lists'
export type {
  ModulaListAccessory,
  ModulaListRowProps,
  ModulaListRowVariant,
  ModulaListSectionProps,
  ModulaListProps as ModulaListSurfaceProps,
} from '@/platform/ui/lists'
export * from '@/platform/ui/forms'
export * from '@/platform/ui/feedback'
export * from '@/platform/ui/identity'
export * from '@/platform/ui/drawers'
export * from '@/platform/ui/dialogs'
export * from '@/platform/ui/command'
export * from '@/platform/ui/scroll'
export * from '@/platform/ui/composer'
export * from '@/platform/ui/floating'
export {
  MODULA_PRODUCT_UI_V1_COMPONENTS,
  type ModulaProductUiV1Component,
} from '@/platform/ui/product-ui'
export * from '@/platform/ui/skeletons'
export * from '@/platform/ui/tabs'
export * from '@/platform/ui/toolbars'
export * from '@/platform/ui/motion'
export {Surface, type SurfaceVariant} from '@/components/primitives/Surface'
export {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
export {hideExpoDevToolsButton} from '@/platform/ui/dev/hide-expo-dev-tools-button'
export {PageIntro} from '@/platform/ui/chrome/page-intro'
export {SectionHeader} from '@/platform/ui/chrome/section-header'
export {ProductStatsRow} from '@/platform/ui/chrome/product-stats-row'
export type {ProductStatItem} from '@/platform/ui/chrome/product-stats-row'
export {shareModulaText} from '@/platform/ui/share/share-modula-text'
export {CoverAtmosphere} from '@/platform/ui/atmosphere/cover-atmosphere'
export {HubAtmosphere} from '@/platform/ui/atmosphere/hub-atmosphere'
export {
  InvertedSelectedSurface,
  InvertedSurfaceTransition,
} from '@/platform/ui/geometry'
