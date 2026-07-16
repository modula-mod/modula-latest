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
  icon: AppIconName
  description: string
}
