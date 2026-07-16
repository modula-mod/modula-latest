import {View} from 'react-native'

import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {SystemListRow, SystemSection, SystemSwitch} from '@/components/system'
import type {ColourModePreference} from '@/theme/tokens/dimensions'
import {useTheme} from '@/theme/runtime/useTheme'

const MODES: {id: ColourModePreference; label: string; note?: string}[] = [
  {id: 'system', label: 'System'},
  {id: 'light', label: 'Light'},
  {id: 'dim', label: 'Dim', note: 'Stub palette → dark'},
  {id: 'dark', label: 'Dark'},
  {id: 'oled', label: 'OLED', note: 'Stub canvas → black'},
]

export default function AppearanceSettingsScreen() {
  const {preferences, setColourMode, setPreferences, colours, material, spacing} =
    useTheme()

  return (
    <AppScreen scroll>
      <AppText colour="textSecondary" style={{marginBottom: spacing.lg}}>
        Theme Architecture v5 dimensions. Colour mode is interactive; families and
        materials remain contracts until Phase 2.
      </AppText>

      <SystemSection title="Colour mode">
        {MODES.map((mode, index) => (
          <SystemListRow
            key={mode.id}
            title={mode.label}
            subtitle={mode.note}
            showDivider={index < MODES.length - 1}
            right={
              <AppText colour={preferences.colourMode === mode.id ? 'accent' : 'textSecondary'}>
                {preferences.colourMode === mode.id ? 'On' : ''}
              </AppText>
            }
            onPress={() => setColourMode(mode.id)}
          />
        ))}
      </SystemSection>

      <SystemSection title="Surface Type (stub)">
        <SystemListRow title="Solid (active)" subtitle={`Engine: ${material.engine}`} />
        <SystemListRow
          title="Glass / Liquid Glass"
          subtitle="Deferred — see theme-architecture-v5.md"
          showDivider={false}
        />
      </SystemSection>

      <SystemSection title="Accent">
        <View style={{padding: spacing.lg, gap: spacing.sm}}>
          <View style={{height: 28, borderRadius: 8, backgroundColor: colours.accent}} />
          <AppText variant="caption" colour="textSecondary">
            Modula Teal #369CAA
          </AppText>
          <SystemSwitch
            label="Follow system when mode is System"
            value={preferences.colourMode === 'system'}
            onValueChange={value => setColourMode(value ? 'system' : 'light')}
          />
        </View>
      </SystemSection>

      <SystemSection title="Theme family (reserved)">
        <SystemListRow
          title={preferences.family}
          subtitle="Standard only — Ocean, Forest, etc. deferred"
          showDivider={false}
          onPress={() => setPreferences({family: 'standard'})}
        />
      </SystemSection>
    </AppScreen>
  )
}
