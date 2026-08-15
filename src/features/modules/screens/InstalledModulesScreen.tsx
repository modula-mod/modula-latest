import {View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {
  CANONICAL_VAULT_NOTES_MODULE_ID,
  isVaultNotesModuleId,
  selectCanonicalVaultNotesInstallation,
} from '@modula/greenfield-contracts'

import {AppText} from '@/components/primitives/AppText'
import {
  SettingsLinkRow,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {useInstalledModulesQuery} from '@/features/modules/hooks'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function InstalledModulesScreen() {
  const router = useRouter()
  const installed = useInstalledModulesQuery()
  const {spacing} = useThemeTokens()
  const modules = collapseVaultNotesRows(installed.data ?? [])

  return (
    <SettingsScreen
      title="Modules"
      caption="Installed Greenfield modules, versions, health, configuration and update state. Marketplace discovery lives in Product Hub.">
      <SettingsSection title="Installed modules">
        {installed.isPending ? (
          <View style={{padding: spacing[4]}}>
            <AppText variant="caption" colour="textSecondary">Loading installed modules.</AppText>
          </View>
        ) : modules.length ? (
          modules.map((module, index) => (
            <SettingsLinkRow
              key={module.installationId || module.moduleId}
              last={index === modules.length - 1}
              row={{
                title:
                  module.name ??
                  (isVaultNotesModuleId(module.moduleId) ? 'Vault Notes' : module.moduleId),
                description: `${module.publisherName ?? 'Publisher'} · v${module.version}`,
                icon: 'modules',
                value: label(module.status),
                onPress: () =>
                  router.push(
                    `/settings/modules/${encodeURIComponent(
                      isVaultNotesModuleId(module.moduleId)
                        ? CANONICAL_VAULT_NOTES_MODULE_ID
                        : module.moduleId,
                    )}` as Href,
                  ),
              }}
            />
          ))
        ) : (
          <View style={{padding: spacing[4], gap: spacing[2]}}>
            <AppText variant="label">No modules installed</AppText>
            <AppText variant="caption" colour="textSecondary">
              Install modules from Product Hub. Unavailable catalogue entries stay visible there as non-installable.
            </AppText>
          </View>
        )}
      </SettingsSection>

      <SettingsSection title="Discovery">
        <SettingsLinkRow
          row={{
            title: 'Open Product Hub',
            description: 'Browse modules, tools, functions, plugins, widgets and connectors.',
            icon: 'marketplace',
            route: '/product',
          }}
          last
        />
      </SettingsSection>
    </SettingsScreen>
  )
}

function collapseVaultNotesRows<T extends {moduleId: string; status: string}>(rows: T[]): T[] {
  const others = rows.filter(row => !isVaultNotesModuleId(row.moduleId))
  const selected = selectCanonicalVaultNotesInstallation(rows)
  return selected ? [...others, selected] : others
}

function label(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase())
}
