/**
 * Product UI V1 host bridge.
 *
 * Product-owned declarative frontends resolve these semantic component names
 * through the generic MPS adapter. They share the exact renderer used by the
 * shell; products never ship remote executable UI code into the host.
 */
export const MODULA_PRODUCT_UI_V1_COMPONENTS = [
  'button',
  'field',
  'search',
  'recordList',
  'recordRow',
  'section',
  'toolbar',
  'tabs',
  'picker',
  'menu',
  'badge',
  'emptyState',
  'errorState',
  'loadingState',
] as const

export type ModulaProductUiV1Component = typeof MODULA_PRODUCT_UI_V1_COMPONENTS[number]

export {ModulaActionButton} from '@/platform/ui/buttons/modula-action-button'
export {ModulaButton} from '@/platform/ui/buttons/modula-button'
export {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
export {ModulaFieldShell} from '@/platform/ui/controls/modula-field-shell'
export {ModulaSearchField} from '@/platform/ui/controls/modula-search-field'
export {ModulaSelectField} from '@/platform/ui/controls/modula-select-field'
export {ModulaTagInput} from '@/platform/ui/controls/modula-tag-input'
export {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'
export {ModulaSwitch} from '@/platform/ui/controls/modula-switch'
export {ModulaEmptyState, ModulaErrorState, ModulaLoadingSection} from '@/platform/ui/feedback'
export {ModulaBadge, ModulaProductRow, ModulaUserRow} from '@/platform/ui/identity'
export {ModulaList, ModulaListRow, ModulaListSection} from '@/platform/ui/lists'
export {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
export {ModulaTabs} from '@/platform/ui/tabs/modula-tabs-control'
export {ModulaToolbar} from '@/platform/ui/toolbars/modula-toolbar'
