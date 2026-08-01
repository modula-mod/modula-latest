import type {AppIconName} from '@/components/primitives/AppIcon'
import type {ProfileVisibility} from '@/features/profile/contracts/profile'

export type ProfileModulePreview = {
  id: string
  name: string
  description: string
  icon: AppIconName
  status: 'featured' | 'available' | 'preview'
  visibility: ProfileVisibility
  actionLabel: string
}
