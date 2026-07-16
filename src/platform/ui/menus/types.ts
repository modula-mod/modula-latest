export type ModulaActionStyle = 'default' | 'cancel' | 'destructive'

export type ModulaActionItem = {
  id: string
  label: string
  style?: ModulaActionStyle
  /** Accessibility / VoiceOver label override. */
  accessibilityLabel?: string
  disabled?: boolean
}

export type PresentModulaActionsOptions = {
  title?: string
  message?: string
  actions: ModulaActionItem[]
  cancelLabel?: string
}
