import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'

export type ModulaActionStyle = 'default' | 'cancel' | 'destructive'

export type ModulaActionPickerOption = {
  id: string
  label: string
}

/** Tab / option picker rendered inside a native ContextMenu or Menu. */
export type ModulaActionPicker = {
  options: ModulaActionPickerOption[]
  selectedId: string
}

export type ModulaActionItem = {
  id: string
  label: string
  style?: ModulaActionStyle
  /** Accessibility / VoiceOver label override. */
  accessibilityLabel?: string
  disabled?: boolean
  /** Full explanation shown when a disabled action should remain visible. */
  disabledReason?: string
  /** Checked menu item. Activation reports the action id so the owner updates state. */
  checked?: boolean
  /**
   * Semantic Modula icon. Native menus map this to an SF Symbol.
   * Product screens must not pass raw SF Symbol names.
   */
  icon?: ModulaIconName
  /** Nested submenu (Telegram-style Mute ›). */
  children?: ModulaActionItem[]
  /** Segmented / menu picker — selection reports the option id via onAction. */
  picker?: ModulaActionPicker
}

export type PresentModulaActionsOptions = {
  title?: string
  message?: string
  actions: ModulaActionItem[]
  cancelLabel?: string
}

/** Host layout for ContextMenu. `fill` is required for full-width list rows. */
export type ModulaMenuFit = 'fill' | 'content'
