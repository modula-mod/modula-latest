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
    | '/product/design-lab'
    | '/product/atlas'
    | '/product/focus'
    | '/product/forge'
    | '/product/agents'
    | '/product/module-standards'
    | '/product/permissions'
    | '/product/sandbox'
    | '/product/gaia'
    | '/product/automations'
    | '/product/nft'
    | '/product/developer'
    | '/product/search'
    | '/product/integrations'
    | '/settings'
    | '/settings/appearance'
    | '/settings/developer'
  icon: AppIconName
  description: string
}
