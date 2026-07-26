import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {ModuleInstallationState, ModulePriceState} from '@/data/repositories/contracts'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleStatusPill({state}: {state: ModuleInstallationState | ModulePriceState | string}) {
  const {colours, radius, spacing} = useThemeTokens()
  const destructive = ['quarantined', 'notAvailable', 'Not available'].includes(state)
  const warning = ['configurationRequired', 'updateAvailable', 'comingSoon', 'Coming soon'].includes(state)
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: destructive ? colours.destructiveSubtle : warning ? colours.surfaceRaised : colours.accentSubtle,
          borderColor: destructive ? colours.destructive : warning ? colours.warning : colours.accentBorder,
          borderRadius: radius.round,
          paddingHorizontal: spacing[2],
          paddingVertical: spacing[1],
        },
      ]}>
      <AppText
        variant="micro"
        style={{color: destructive ? colours.destructive : warning ? colours.warning : colours.accent}}>
        {labelForState(state)}
      </AppText>
    </View>
  )
}

function labelForState(state: string): string {
  if (state === 'available') return 'Available'
  if (state === 'installed') return 'Installed'
  if (state === 'enabled') return 'Enabled'
  if (state === 'disabled') return 'Disabled'
  if (state === 'updateAvailable') return 'Update available'
  if (state === 'configurationRequired') return 'Configuration required'
  if (state === 'comingSoon') return 'Coming soon'
  if (state === 'notAvailable') return 'Not available'
  return state
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
})
