import {View} from 'react-native'

import {ModuleHost} from '@/features/modules/runtime/module-host'
import type {ProfileTabRendererProps} from '@/features/profile/contracts/profileTabs'
import {ProfileTabEmptyState} from '@/features/profile/components/ProfileTabEmptyState'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleProfileRuntimeTab({tab, viewer}: ProfileTabRendererProps) {
  const {spacing} = useThemeTokens()
  if (!tab.moduleId) {
    return (
      <ProfileTabEmptyState
        icon="modules"
        title="Module tab unavailable"
        description="This profile tab does not declare a module host."
      />
    )
  }
  if (viewer.relationship !== 'owner' && tab.visibility === 'owner') {
    return (
      <ProfileTabEmptyState
        icon="privacy"
        title="Owner-only module"
        description="This module tab is private to the profile owner."
      />
    )
  }
  return (
    <View style={{gap: spacing[3], padding: spacing[4]}}>
      <ModuleHost moduleId={tab.moduleId} path={['profile']} />
    </View>
  )
}
