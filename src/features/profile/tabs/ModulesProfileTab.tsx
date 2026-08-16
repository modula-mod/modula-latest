import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {
  canViewerSeeProfileField,
} from '@/features/profile/contracts/profile'
import type {ProfileTabRendererProps} from '@/features/profile/contracts/profileTabs'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {useModuleCatalogueQuery} from '@/features/modules/hooks'
import {ProfileModuleCard} from '@/features/profile/components/ProfileModuleCard'
import {ProfileTabEmptyState} from '@/features/profile/components/ProfileTabEmptyState'
import type {ProfileModulePreview} from '@/features/profile/contracts/profileModules'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulesProfileTab({profile, viewer}: ProfileTabRendererProps) {
  const router = useRouter()
  const {spacing} = useThemeTokens()
  const catalogue = useModuleCatalogueQuery()
  const modules = profile.featuredModuleIds
    .map(moduleId => moduleFromCatalogue(catalogue.data ?? [], moduleId))
    .filter((module): module is ProfileModulePreview => Boolean(module))
    .filter(module => canViewerSeeProfileField(module.visibility, viewer.relationship))

  if (!modules.length) {
    return (
      <ProfileTabEmptyState
        icon="modules"
        title={
          viewer.relationship === 'owner'
            ? 'No public modules yet.'
            : 'No public modules.'
        }
        description={
          viewer.relationship === 'owner'
            ? 'Choose which installed modules appear on your profile.'
            : 'Public modules from this profile will appear here.'
        }
        actionLabel={viewer.relationship === 'owner' ? 'Customize' : undefined}
        onAction={
          viewer.relationship === 'owner'
            ? () => router.push('/profile/customize' as Href)
            : undefined
        }
      />
    )
  }

  return (
    <View style={[styles.grid, {gap: spacing[3], padding: spacing[4]}]}>
      {modules.map(module => (
        <View key={module.id} style={styles.item}>
          <ProfileModuleCard module={module} />
        </View>
      ))}
    </View>
  )
}

function moduleFromCatalogue(catalogue: ModuleCatalogueItem[], moduleId: string): ProfileModulePreview | null {
  const normalized = normalizeLegacyProfileModuleId(moduleId)
  const module = catalogue.find(item => item.moduleId === moduleId || item.moduleId === normalized)
  if (!module) return null
  return {
    id: module.moduleId,
    name: module.name,
    description: module.description,
    icon: module.kind === 'system' ? 'settings' : 'modules',
    status: module.installationState === 'enabled' || module.installationState === 'installed'
      ? 'featured'
      : module.installable
        ? 'available'
        : 'preview',
    visibility: 'public',
    actionLabel: module.installationState === 'enabled'
      ? 'Open'
      : module.installable
        ? 'Available'
        : 'Preview',
  }
}

function normalizeLegacyProfileModuleId(moduleId: string): string {
  if (moduleId === 'module-vault-notes') return 'digital.modula.vault-notes'
  if (moduleId === 'module-tasks') return 'digital.modula.tasks'
  if (moduleId === 'module-dimon-core') return 'digital.dimon.core'
  return moduleId
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  item: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 220,
  },
})
