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
    | '/product'
    | '/product/focus'
    | '/product/forge'
    | '/product/gaia'
    | '/product/automations'
    | '/product/search'
    | '/product/integrations'
    | '/settings'
    | '/settings/appearance'
    | '/settings/developer'
  icon: AppIconName
  description: string
}
