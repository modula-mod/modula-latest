import type {ModulaIconName} from '@/platform/ui/icons'

export type ModulaCommandAction = {
  id: string
  label: string
  description?: string
  keywords?: string[]
  icon?: ModulaIconName
  disabled?: boolean
  onSelect: () => void
}

export type ModulaCommandProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  actions: ModulaCommandAction[]
  title?: string
  description?: string
  placeholder?: string
  emptyLabel?: string
  testID?: string
}
