export type ModulaToggleGroupItem = {
  id: string
  label: string
  accessibilityLabel?: string
  disabled?: boolean
}

export type ModulaToggleGroupProps = {
  items: ModulaToggleGroupItem[]
  value: string[]
  onValueChange: (value: string[]) => void
  selectionMode?: 'single' | 'multiple'
  accessibilityLabel?: string
  disabled?: boolean
  testID?: string
}
