import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import type {ProfileTabRendererProps} from '@/features/profile/contracts/profileTabs'
import {useModuleCatalogueQuery} from '@/features/modules/hooks'
import {ProfileModuleCard} from '@/features/profile/components/ProfileModuleCard'
import {ProfileTabEmptyState} from '@/features/profile/components/ProfileTabEmptyState'
import {resolvePublicProfileModules} from '@/features/profile/data/resolveProfilePublicContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulesProfileTab({profile, viewer}: ProfileTabRendererProps) {
  const router = useRouter()
  const {spacing} = useThemeTokens()
  const catalogue = useModuleCatalogueQuery()
  const modules = resolvePublicProfileModules(
    profile,
    viewer.relationship,
    catalogue.data ?? [],
  )

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
