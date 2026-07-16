import type {DemoModule} from '@/types/modules'

export const demoModules: DemoModule[] = [
  {
    id: 'module-vault-notes',
    name: 'Vault Notes',
    description: 'Private notes that can attach to posts, Boards, and profile surfaces.',
    status: 'Preview',
    icon: 'saved',
    category: 'productivity',
  },
  {
    id: 'module-tasks',
    name: 'Tasks',
    description: 'Plan work from social context without leaving your profile OS.',
    status: 'Local',
    icon: 'check',
    category: 'productivity',
  },
  {
    id: 'module-crm',
    name: 'CRM',
    description: 'Relationship memory for teams, builders, clients, and communities.',
    status: 'Preview',
    icon: 'people',
    category: 'commerce',
  },
  {
    id: 'module-health-agent',
    name: 'Health Agent',
    description: 'A gated wellbeing module preview with human-controlled activation.',
    status: 'Gated',
    icon: 'activity',
    category: 'wellbeing',
  },
  {
    id: 'module-automations',
    name: 'Automations',
    description: 'Local workflow cards that can later become governed actions.',
    status: 'Simulated',
    icon: 'automation',
    category: 'intelligence',
  },
  {
    id: 'module-marketplace',
    name: 'Marketplace',
    description: 'Discover capabilities that can become part of your environment.',
    status: 'Preview',
    icon: 'marketplace',
    category: 'commerce',
  },
]
