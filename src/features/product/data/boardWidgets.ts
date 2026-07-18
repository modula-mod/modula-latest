import type {AppIconName} from '@/components/primitives/AppIcon'

export const BOARD_WIDGET_CATALOG: Array<{
  id: string
  name: string
  icon: AppIconName
  size: string
}> = [
  {id: 'tasks', name: 'Tasks', icon: 'check', size: '1×1'},
  {id: 'calendar', name: 'Calendar', icon: 'event', size: '2×1'},
  {id: 'crm', name: 'CRM pipeline', icon: 'people', size: '2×2'},
  {id: 'notes', name: 'Notes', icon: 'saved', size: '1×1'},
  {id: 'wallet', name: 'Wallet', icon: 'security', size: '1×1'},
  {id: 'ai', name: 'AI summary', icon: 'automation', size: '2×1'},
  {id: 'team', name: 'Team activity', icon: 'teams', size: '2×1'},
  {id: 'files', name: 'Recent files', icon: 'storage', size: '1×1'},
]
