import {FeaturePreviewScreen} from '@/components/system/FeaturePreviewScreen'
import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {useCapability} from '@/auth/runtime'

export function MessagesScreen() {
  const canAccessMessages = useCapability('messages:access')
  if (!canAccessMessages) {
    return (
      <ProtectedActionPrompt
        visible
        description="Messages will use the same session and repository architecture. Sign in to continue."
      />
    )
  }
  return (
    <FeaturePreviewScreen
      title="Messages"
      description="A private social inbox preview for people, teams, and future governed agents."
      cards={[
        {
          title: 'Priority conversations',
          description: 'Pinned local previews for collaborators and Modula surfaces.',
          icon: 'messages',
          actionLabel: 'Preview inbox',
        },
        {
          title: 'Agent handoff',
          description: 'Future GAIA-assisted replies remain human-controlled and auditable.',
          icon: 'automation',
          actionLabel: 'View concept',
        },
      ]}
    />
  )
}

export function SavedScreen() {
  return (
    <FeaturePreviewScreen
      title="Saved"
      description="A profile-owned library for posts, media, links, and module context."
      cards={[
        {
          title: 'Saved posts',
          description: 'Locally saved demonstration posts are available from feed actions.',
          icon: 'bookmark',
          actionLabel: 'Review saves',
        },
        {
          title: 'Knowledge trails',
          description: 'Saved links can later attach to Boards, Vault Notes, and workflows.',
          icon: 'link',
          actionLabel: 'Open trail',
        },
      ]}
    />
  )
}

export function CommunitiesScreen() {
  return (
    <FeaturePreviewScreen
      title="Communities"
      description="Groups that become part of your Modula environment without taking over the profile."
      cards={[
        {
          title: 'Builders',
          description: 'A local preview community for module makers and workflow designers.',
          icon: 'community',
          actionLabel: 'Preview',
        },
        {
          title: 'Design Systems',
          description: 'Shared surface and token discussions for Modula modules.',
          icon: 'people',
          actionLabel: 'Open',
        },
      ]}
    />
  )
}

export function TeamsScreen() {
  return (
    <FeaturePreviewScreen
      title="Teams"
      description="Shared workspaces for collaborators, modules, Boards, and governed workflows."
      cards={[
        {
          title: 'Modula Team',
          description: 'A local team preview with board, modules, and activity surfaces.',
          icon: 'teams',
          actionLabel: 'Preview team',
        },
        {
          title: 'Invitations',
          description: 'Team invitations will remain explicit and user-controlled.',
          icon: 'messages',
          actionLabel: 'Review',
        },
      ]}
    />
  )
}

export function ModulesScreen() {
  const moduleCards = [
    {
      title: 'Vault Notes',
      description: 'Private notes that can attach to posts, Boards, and profile surfaces.',
      icon: 'saved' as const,
      actionLabel: 'Preview',
    },
    {
      title: 'Tasks',
      description: 'Plan work from social context without leaving your profile OS.',
      icon: 'check' as const,
      actionLabel: 'Local',
    },
    {
      title: 'CRM',
      description: 'Relationship memory for teams, builders, clients, and communities.',
      icon: 'people' as const,
      actionLabel: 'Preview',
    },
    {
      title: 'Automations',
      description: 'Local workflow cards that can later become governed actions.',
      icon: 'automation' as const,
      actionLabel: 'Simulated',
    },
  ]
  return (
    <FeaturePreviewScreen
      title="Modules"
      description="Install capabilities that become part of your Modula environment."
      cards={moduleCards}
    />
  )
}

export function MarketplaceScreen() {
  return (
    <FeaturePreviewScreen
      title="Marketplace"
      description="Discover tools, modules, prompts, themes, and future governed capabilities."
      cards={[
        {
          title: 'Featured modules',
          description: 'Vault Notes, Tasks, CRM, Health Agent, and Automations previews.',
          icon: 'marketplace',
          actionLabel: 'Browse',
        },
        {
          title: 'Module trust',
          description: 'Future marketplace items will include evidence, policy, and provenance.',
          icon: 'check',
          actionLabel: 'View trust model',
        },
      ]}
    />
  )
}

export function SettingsScreen() {
  return (
    <FeaturePreviewScreen
      title="Settings"
      description="A local preview for appearance, accessibility, privacy, and module preferences."
      cards={[
        {
          title: 'Appearance',
          description: 'Phase 1 follows system light and dark mode through semantic tokens.',
          icon: 'settings',
          actionLabel: 'Preview',
        },
        {
          title: 'Privacy controls',
          description: 'No backend or account exists in Phase 1, so there is no remote state.',
          icon: 'profile',
          actionLabel: 'Review',
        },
      ]}
    />
  )
}
