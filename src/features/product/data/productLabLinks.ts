import type {AppIconName} from '@/components/primitives/AppIcon'

export type ProductLabLink = {
  id: 'design-lab' | 'feature-atlas' | 'nft-studio' | 'developer-tools'
  label: string
  route: '/product/design-lab' | '/product/atlas' | '/product/nft' | '/product/developer'
  icon: AppIconName
  description: string
}

export const PRODUCT_LAB_LINKS: readonly ProductLabLink[] = [
  {
    id: 'design-lab',
    label: 'Design Lab',
    route: '/product/design-lab',
    icon: 'appearance',
    description: 'Theme, layout, and Profile-OS design previews',
  },
  {
    id: 'feature-atlas',
    label: 'Feature Atlas',
    route: '/product/atlas',
    icon: 'search',
    description: 'Map of Modula capabilities and maturity labels',
  },
  {
    id: 'nft-studio',
    label: 'NFT Studio',
    route: '/product/nft',
    icon: 'security',
    description: 'Digital ownership proofs; DIMON remains inactive',
  },
  {
    id: 'developer-tools',
    label: 'Developer Tools',
    route: '/product/developer',
    icon: 'tools',
    description: 'Greenfield MCP, Modula CLI, contracts, and docs',
  },
]
