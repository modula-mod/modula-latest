import {Platform} from 'react-native'
import {router} from 'expo-router'

import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {SystemListRow, SystemSection} from '@/components/system'
import {useTheme} from '@/theme/runtime/useTheme'

export default function DeveloperSettingsScreen() {
  const {scheme, material, spacing} = useTheme()

  return (
    <AppScreen scroll>
      <AppText colour="textSecondary" style={{marginBottom: spacing.lg}}>
        Diagnostics for the Phase 0/1 foundation.
      </AppText>
      <SystemSection title="Status">
        <SystemListRow title="Foundation" subtitle="Running" />
        <SystemListRow title="Platform" subtitle={Platform.OS} />
        <SystemListRow title="Colour scheme" subtitle={scheme} />
        <SystemListRow title="Material engine" subtitle={material.engine} showDivider={false} />
      </SystemSection>
      <SystemSection title="Tools">
        {__DEV__ ? (
          <SystemListRow
            title="Component gallery"
            subtitle="Primitives and system adapters"
            onPress={() => router.push('/dev/components')}
            showDivider={false}
          />
        ) : (
          <SystemListRow
            title="Component gallery"
            subtitle="Available in development builds only"
            showDivider={false}
          />
        )}
      </SystemSection>
    </AppScreen>
  )
}
