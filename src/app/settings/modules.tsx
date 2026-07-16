import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {SystemListRow, SystemSection} from '@/components/system'
import {useTheme} from '@/theme/runtime/useTheme'

export default function ModulesSettingsScreen() {
  const {spacing} = useTheme()
  return (
    <AppScreen scroll>
      <AppText colour="textSecondary" style={{marginBottom: spacing.lg}}>
        Modules register settings through manifests. None are installed yet — the host
        stays launchable with zero modules.
      </AppText>
      <SystemSection title="Installed">
        <SystemListRow
          title="No modules"
          subtitle="Vault Notes, Tasks, and CRM arrive in Phase 6"
          showDivider={false}
        />
      </SystemSection>
    </AppScreen>
  )
}
