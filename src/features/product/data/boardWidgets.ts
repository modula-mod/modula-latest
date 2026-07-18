import type {AppIconName} from '@/components/primitives/AppIcon'

export const BOARD_WIDGET_CATALOG: Array<{
  id: string
  name: string
  icon: AppIconName
  size: string
  status: 'Active' | 'Preview' | 'Inactive' | 'Planned'
  description: string
}> = [
  {
    id: 'tasks',
    name: 'Tasks',
    icon: 'check',
    size: '1×1',
    status: 'Preview',
    description: 'Local task queue from modules and social context.',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: 'event',
    size: '2×1',
    status: 'Preview',
    description: 'Upcoming events and schedule holds. No remote calendar sync.',
  },
  {
    id: 'crm',
    name: 'CRM pipeline',
    icon: 'people',
    size: '2×2',
    status: 'Preview',
    description: 'Seeded relationships, deals, and follow-up prompts.',
  },
  {
    id: 'notes',
    name: 'Notes',
    icon: 'saved',
    size: '1×1',
    status: 'Preview',
    description: 'Private notes attached to Board, posts, and profiles.',
  },
  {
    id: 'wallet',
    name: 'Wallet',
    icon: 'security',
    size: '1×1',
    status: 'Inactive',
    description: 'DIMON inactive — no balances, transfers, or wallet operations.',
  },
  {
    id: 'ai',
    name: 'AI summary',
    icon: 'automation',
    size: '2×1',
    status: 'Preview',
    description: 'Local briefing shell; model execution remains governed.',
  },
  {
    id: 'team',
    name: 'Team activity',
    icon: 'teams',
    size: '2×1',
    status: 'Preview',
    description: 'Shared Profile-OS events, approvals, and availability.',
  },
  {
    id: 'files',
    name: 'Recent files',
    icon: 'storage',
    size: '1×1',
    status: 'Preview',
    description: 'Recent file cards from local/demo module state.',
  },
  {
    id: 'gaia-briefing',
    name: 'GAIA briefing',
    icon: 'automation',
    size: '2×1',
    status: 'Preview',
    description: 'GAIA executes · AKI verifies · Governor controls. Briefing is seeded Preview.',
  },
  {
    id: 'dimon-activity',
    name: 'DIMON activity',
    icon: 'security',
    size: '1×1',
    status: 'Inactive',
    description: 'DIMON inactive — reserved ledger activity only; no fake token UI.',
  },
  {
    id: 'nft-entitlements',
    name: 'NFT entitlements',
    icon: 'bookmark',
    size: '1×1',
    status: 'Preview',
    description: 'Entitlement preview for ownership claims. NFT attach remains blocked.',
  },
  {
    id: 'newsletter',
    name: 'Newsletter desk',
    icon: 'messages',
    size: '2×1',
    status: 'Planned',
    description: 'Draft newsletter blocks without email delivery.',
  },
  {
    id: 'analytics',
    name: 'Analytics pulse',
    icon: 'poll',
    size: '2×1',
    status: 'Preview',
    description: 'Seeded creator, team, and Board metrics.',
  },
  {
    id: 'approvals',
    name: 'Approvals',
    icon: 'check',
    size: '1×1',
    status: 'Preview',
    description: 'Team workflow approvals with local-only state.',
  },
  {
    id: 'automations',
    name: 'Automation queue',
    icon: 'automation',
    size: '2×1',
    status: 'Preview',
    description: 'Workflow cards; no unattended actions run.',
  },
  {
    id: 'health',
    name: 'Wellbeing check-in',
    icon: 'activity',
    size: '1×1',
    status: 'Planned',
    description: 'Human-controlled wellbeing preview, not a health backend.',
  },
]
