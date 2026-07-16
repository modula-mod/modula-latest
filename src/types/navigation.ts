import type {AppIconName} from '@/components/primitives/AppIcon'

export type DrawerDestination = {
  label: string
  route:
    | '/board'
    | '/messages'
    | '/saved'
    | '/communities'
    | '/teams'
    | '/modules'
    | '/marketplace'
    | '/settings'
    | '/settings/appearance'
    | '/settings/developer'
  icon: AppIconName
  description: string
}
