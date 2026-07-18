import type {AppIconName} from '@/components/primitives/AppIcon'

export type DrawerSectionId = 'spaces' | 'create' | 'labs' | 'system'

export type DrawerDestination = {
  label: string
  /** App route path (drawer + account-panel registry share the same destinations). */
  route: string
  icon: AppIconName
  /** Short supporting line; omit for dense rows. */
  description?: string
  section: DrawerSectionId
}
