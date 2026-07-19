import {useRouter, type Href} from 'expo-router'

import {
  SettingsCaption,
  SettingsLinkRow,
  SettingsOverflowMenu,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {AppText} from '@/components/primitives/AppText'

export function DeveloperSettingsScreen() {
  const router = useRouter()

  if (runtimeEnvironment.appEnvironment !== 'development') {
    return (
      <SettingsScreen title="Developer">
        <AppText variant="headline">Developer settings are unavailable.</AppText>
        <SettingsCaption>This surface is only available in development builds.</SettingsCaption>
      </SettingsScreen>
    )
  }

  return (
    <SettingsScreen
      title="Developer"
      caption="Labs and builder foreshadow. Modules stay external — never hardcoded into the host."
      right={
        <SettingsOverflowMenu
          title="Developer"
          actions={[
            {id: 'forge', label: 'Forge Builder'},
            {id: 'agents', label: 'Agents studio'},
            {id: 'extensions', label: 'Extension Centre'},
          ]}
          onAction={id => {
            if (id === 'forge') router.push('/product/forge' as Href)
            if (id === 'agents') router.push('/product/agents' as Href)
            if (id === 'extensions') router.push('/settings/extensions' as Href)
          }}
        />
      }>
      <SettingsSection title="Builders">
        <SettingsLinkRow
          row={{
            title: 'Forge Builder',
            description: 'Draft module manifests.',
            icon: 'developer',
            route: '/product/forge',
            preview: true,
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Module standards',
            description: 'Manifest rules and boilerplate.',
            icon: 'developer',
            route: '/product/module-standards',
            preview: true,
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Agents studio',
            description: 'Gaia agent packages with scopes.',
            icon: 'automation',
            route: '/product/agents',
            preview: true,
          }}
          last
        />
      </SettingsSection>

      <SettingsSection title="Host labs">
        <SettingsLinkRow
          row={{
            title: 'Expo UI Lab',
            description: 'Pick Expo UI playground components by product context.',
            icon: 'developer',
            route: '/settings/developer/expo-ui',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Full Expo UI playground',
            description: 'All playground sections in one Form host.',
            icon: 'developer',
            route: '/settings/developer/expo-ui/playground',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Extension Centre',
            description: 'Tools, plugins, and connectors.',
            icon: 'modules',
            route: '/settings/extensions',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Data Runtime Lab',
            description: 'Repository and cache diagnostics.',
            icon: 'storage',
            route: '/settings/developer/data-runtime',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Session Lab',
            description: 'Auth and session diagnostics.',
            icon: 'account',
            route: '/settings/developer/session',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Appearance Lab',
            description: 'Token and material inspection.',
            icon: 'appearance',
            route: '/settings/appearance-lab',
          }}
          last
        />
      </SettingsSection>

      <SettingsCaption>
        Boilerplate path: templates/modula-module · SDK foreshadow in
        docs/architecture/modula-module-sdk.md
      </SettingsCaption>
    </SettingsScreen>
  )
}
