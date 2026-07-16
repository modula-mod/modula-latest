import type {AppIconName} from '@/components/primitives/AppIcon'
import type {ProfileVisibility} from '@/features/profile/contracts/profile'

export type ProfileModulePreview = {
  id: string
  name: string
  description: string
  icon: AppIconName
  status:
    | 'featured'
    | 'available'
    | 'preview'
  visibility: ProfileVisibility
  actionLabel: string
}

export const demoProfileModules: Record<string, ProfileModulePreview[]> = {
  'profile-andrei': [
    {
      id: 'module-vault-notes',
      name: 'Vault Notes',
      description: 'Private-first note workspace',
      icon: 'saved',
      status: 'preview',
      visibility: 'public',
      actionLabel: 'Preview',
    },
    {
      id: 'module-tasks',
      name: 'Tasks',
      description: 'Personal and collaborative task planning',
      icon: 'check',
      status: 'available',
      visibility: 'public',
      actionLabel: 'Available',
    },
    {
      id: 'module-crm',
      name: 'CRM',
      description: 'Relationships, leads and client workflows',
      icon: 'people',
      status: 'available',
      visibility: 'followers',
      actionLabel: 'Available',
    },
    {
      id: 'module-automations',
      name: 'Automations',
      description: 'Governed workflow previews for repeated actions',
      icon: 'automation',
      status: 'featured',
      visibility: 'public',
      actionLabel: 'Featured',
    },
  ],
  'profile-gaia': [
    {
      id: 'module-runtime-tools',
      name: 'Runtime Tools',
      description: 'Local tool execution previews for governed workflows',
      icon: 'tools',
      status: 'featured',
      visibility: 'public',
      actionLabel: 'Featured',
    },
    {
      id: 'module-automations',
      name: 'Automations',
      description: 'Simulation-first automation cards',
      icon: 'automation',
      status: 'preview',
      visibility: 'public',
      actionLabel: 'Preview',
    },
  ],
  'profile-design': [
    {
      id: 'module-appearance-lab',
      name: 'Appearance Lab',
      description: 'Surface Type and theme testing workspace',
      icon: 'appearance',
      status: 'preview',
      visibility: 'public',
      actionLabel: 'Preview',
    },
    {
      id: 'module-guidelines',
      name: 'Guidelines',
      description: 'Reusable design direction for module authors',
      icon: 'text',
      status: 'featured',
      visibility: 'public',
      actionLabel: 'Featured',
    },
  ],
  'profile-builders': [
    {
      id: 'module-sdk',
      name: 'Module SDK',
      description: 'Manifest-first module surface experiments',
      icon: 'developer',
      status: 'preview',
      visibility: 'public',
      actionLabel: 'Preview',
    },
    {
      id: 'module-marketplace',
      name: 'Marketplace',
      description: 'Discovery previews for future module distribution',
      icon: 'marketplace',
      status: 'available',
      visibility: 'public',
      actionLabel: 'Available',
    },
  ],
  'profile-garden': [
    {
      id: 'module-vault-notes',
      name: 'Vault Notes',
      description: 'Knowledge trails, saved links and working notes',
      icon: 'saved',
      status: 'featured',
      visibility: 'public',
      actionLabel: 'Featured',
    },
    {
      id: 'module-links',
      name: 'Link Library',
      description: 'Curated references attached to a public profile',
      icon: 'link',
      status: 'preview',
      visibility: 'public',
      actionLabel: 'Preview',
    },
  ],
}
