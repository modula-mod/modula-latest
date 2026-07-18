import {useState} from 'react'
import {ScrollView, StyleSheet, Switch, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type FeatureRow = {
  id: string
  label: string
  channel: 'Stable' | 'Experimental'
  enabled: boolean
  locked: boolean
}

export function FeatureControlScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [rows, setRows] = useState<FeatureRow[]>([
    {id: 'reels', label: 'Reels / short media', channel: 'Experimental', enabled: false, locked: false},
    {id: 'merge', label: 'Merge Feeds', channel: 'Experimental', enabled: true, locked: false},
    {id: 'focus', label: 'Focus Mode', channel: 'Stable', enabled: true, locked: false},
    {id: 'gaia', label: 'Gaia assistants', channel: 'Experimental', enabled: false, locked: true},
    {id: 'dimon', label: 'DIMON wallet UI', channel: 'Stable', enabled: false, locked: true},
    {id: 'automations', label: 'Automations runner', channel: 'Experimental', enabled: false, locked: false},
  ])

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Feature Control" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Keep Modula controllable.</AppText>
            <AppText variant="body" colour="textSecondary">
              Enable, hide, or lock versions. Local Preview — server feature flags come with Registry.
            </AppText>
          </View>

          {rows.map((row, index) => (
            <Surface
              key={row.id}
              variant="contained"
              style={[
                styles.row,
                {
                  padding: spacing[4],
                  borderRadius: radius.medium,
                  borderColor: colours.border,
                  backgroundColor: colours.surface,
                  gap: spacing[3],
                },
              ]}>
              <View style={{flex: 1, gap: spacing[1]}}>
                <AppText variant="headline">{row.label}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  Channel · {row.channel}
                  {row.locked ? ' · Version locked' : ''}
                </AppText>
              </View>
              <Switch
                accessibilityLabel={`Toggle ${row.label}`}
                disabled={row.locked && row.id === 'dimon'}
                value={row.enabled}
                onValueChange={value => {
                  setRows(prev =>
                    prev.map((item, i) => (i === index ? {...item, enabled: value} : item)),
                  )
                }}
              />
            </Surface>
          ))}

          <AppButton onPress={() => router.push('/settings/extensions' as Href)}>
            Extension Centre
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
