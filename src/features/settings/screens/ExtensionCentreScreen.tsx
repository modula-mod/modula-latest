import {useEffect, useMemo, useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import type {ExtensionCentreItem} from '@/data/repositories/contracts'
import {
  SettingsInfoBlock,
  SettingsLinkRow,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {useAppServices} from '@/runtime/useAppServices'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
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
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
  const [available, setAvailable] = useState<ExtensionCentreItem[]>([])
  const [installed, setInstalled] = useState<ExtensionCentreItem[]>([])

  useEffect(() => {
    let active = true
    void Promise.all([
      services.extensionRepository.listAvailable(),
      services.extensionRepository.listInstalled(),
    ]).then(([nextAvailable, nextInstalled]) => {
      if (!active) return
      setAvailable(nextAvailable)
      setInstalled(nextInstalled)
    })
    return () => {
      active = false
    }
  }, [services.extensionRepository])

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
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Extension Centre" />
      <ResponsiveContent>
        <ScrollView contentContainerStyle={[styles.content, {gap: spacing[5]}]}>
          <SettingsInfoBlock
            title="Extension Centre"
            body="Install and manage Greenfield tools, functions, plugins, connectors, and modules. Module product code lives in separate repositories — Modula hosts contracts and UI only."
          />
          <View style={{gap: spacing[2]}}>
            <AppText variant="caption" colour="textSecondary">
              Build & standards
            </AppText>
            <AppButton onPress={() => router.push('/product/forge' as Href)}>
              Open Forge Builder
            </AppButton>
            <AppButton
              variant="secondary"
              onPress={() => router.push('/product/module-standards' as Href)}>
              Module standards
            </AppButton>
            <AppButton variant="ghost" onPress={() => router.push('/product/agents' as Href)}>
              Agents studio
            </AppButton>
            <AppButton variant="ghost" onPress={() => router.push('/marketplace' as Href)}>
              Browse Marketplace
            </AppButton>
          </View>
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
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {padding: 16, paddingBottom: 40},
  screen: {flex: 1},
})
