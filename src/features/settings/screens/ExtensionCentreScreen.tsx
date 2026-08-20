import {useEffect, useMemo, useState} from 'react'
import {View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppText} from '@/components/primitives/AppText'
import {useSession} from '@/auth/runtime'
import type {ExtensionCentreItem} from '@/data/repositories/contracts'
import {
  SettingsLinkRow,
  SettingsOverflowMenu,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {PRODUCT_LAB_LINKS} from '@/features/product/data/productLabLinks'
import {useAppServices} from '@/runtime/useAppServices'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const SECTIONS = [
  'Installed',
  'Available',
  'Tools',
  'Functions',
  'Plugins',
  'Connections',
  'Modules',
  'Developer',
] as const

export function ExtensionCentreScreen() {
  const services = useAppServices()
  const session = useSession()
  const router = useRouter()
  const {spacing} = useThemeTokens()
  const [available, setAvailable] = useState<ExtensionCentreItem[]>([])
  const [installed, setInstalled] = useState<ExtensionCentreItem[]>([])

  useEffect(() => {
    let active = true
    void Promise.all([
      services.extensionRepository.listAvailable().catch(() => []),
      session.status === 'signedIn'
        ? services.extensionRepository.listInstalled().catch(() => [])
        : Promise.resolve([]),
    ]).then(([nextAvailable, nextInstalled]) => {
      if (!active) return
      setAvailable(nextAvailable)
      setInstalled(nextInstalled)
    })
    return () => {
      active = false
    }
  }, [services.extensionRepository, session.status])

  const bySection = useMemo(() => {
    const map: Record<(typeof SECTIONS)[number], ExtensionCentreItem[]> = {
      Installed: installed,
      Available: available,
      Tools: available.filter(item => item.kind === 'tool'),
      Functions: available.filter(item => item.kind === 'function'),
      Plugins: available.filter(item => item.kind === 'plugin'),
      Connections: available.filter(item => item.kind === 'connector' || item.kind === 'bridge'),
      Modules: available.filter(item => item.kind === 'module'),
      Developer: available.filter(item => item.publisher !== 'Modula'),
    }
    return map
  }, [available, installed])

  return (
    <SettingsScreen
      title="Extension Centre"
      caption="Install and manage Greenfield tools, functions, plugins, connectors, and modules. Module product code lives in separate repositories — Modula hosts contracts and UI only."
      right={
        <SettingsOverflowMenu
          title="Extension Centre"
          actions={[
            {id: 'forge', label: 'Open Forge Builder'},
            {id: 'standards', label: 'Module standards'},
            {id: 'agents', label: 'Agents studio'},
            {id: 'marketplace', label: 'Browse Product Hub'},
            {id: 'modules', label: 'Manage Modules'},
          ]}
          onAction={id => {
            if (id === 'forge') router.push('/product/forge' as Href)
            if (id === 'standards') router.push('/product/module-standards' as Href)
            if (id === 'agents') router.push('/product/agents' as Href)
            if (id === 'marketplace') router.push('/product' as Href)
            if (id === 'modules') router.push('/settings/modules' as Href)
          }}
        />
      }>
      <SettingsSection title="Build & standards">
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
        />
        <SettingsLinkRow
          row={{
            title: 'Browse Product Hub',
            description: 'Registry-backed catalogue and marketplace sections.',
            icon: 'marketplace',
            route: '/product',
          }}
        />
        <SettingsLinkRow
          last
          row={{
            title: 'Manage Modules',
            description: 'Installed module settings, updates and data.',
            icon: 'modules',
            route: '/settings/modules',
          }}
        />
      </SettingsSection>

      <SettingsSection title="Product labs">
        {PRODUCT_LAB_LINKS.map((link, index) => (
          <SettingsLinkRow
            key={link.id}
            last={index === PRODUCT_LAB_LINKS.length - 1}
            row={{
              title: link.label,
              description: link.description,
              icon: link.icon,
              onPress: () => router.push(link.route as Href),
            }}
          />
        ))}
      </SettingsSection>

      {SECTIONS.map(section => (
        <SettingsSection key={section} title={section}>
          {bySection[section].length ? (
            bySection[section].map((item, index) => (
              <SettingsLinkRow
                key={`${section}-${item.extensionId}`}
                last={index === bySection[section].length - 1}
                row={{
                  title: item.name,
                  description: `${item.publisher} · v${item.version} · ${item.kind}`,
                  icon: 'modules',
                  value: item.status,
                  onPress: () =>
                    router.push(
                      `/settings/extensions/${encodeURIComponent(item.extensionId)}` as Href,
                    ),
                }}
              />
            ))
          ) : (
            <View style={{padding: spacing[4]}}>
              <AppText variant="caption" colour="textSecondary">
                Nothing in {section} yet.
              </AppText>
            </View>
          )}
        </SettingsSection>
      ))}
    </SettingsScreen>
  )
}
