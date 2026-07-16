import {StyleSheet, View} from 'react-native'

import {
  canViewerSeeProfileField,
} from '@/features/profile/contracts/profile'
import type {ProfileTabRendererProps} from '@/features/profile/contracts/profileTabs'
import {demoProfileModules} from '@/features/profile/data/demoProfileModules'
import {ProfileModuleCard} from '@/features/profile/components/ProfileModuleCard'
import {ProfileTabEmptyState} from '@/features/profile/components/ProfileTabEmptyState'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulesProfileTab({profile, viewer}: ProfileTabRendererProps) {
  const {spacing} = useThemeTokens()
  const modules = (demoProfileModules[profile.id] ?? []).filter(module =>
    canViewerSeeProfileField(module.visibility, viewer.relationship),
  )

  if (!modules.length) {
    return (
      <ProfileTabEmptyState
        icon="modules"
        title={
          viewer.relationship === 'owner'
            ? 'Featured modules will appear here.'
            : 'No public modules are featured.'
        }
        description="Module cards are previews of profile-attached capabilities."
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
