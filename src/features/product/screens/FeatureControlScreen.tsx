import {ScrollView, StyleSheet, Switch, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const META: Record<string, {label: string; channel: string}> = {
  reels: {label: 'Reels / short media', channel: 'Experimental'},
  merge: {label: 'Merge Feeds', channel: 'Experimental'},
  focus: {label: 'Focus Mode', channel: 'Stable'},
  gaia: {label: 'Gaia assistants', channel: 'Experimental'},
  dimon: {label: 'DIMON wallet UI', channel: 'Stable'},
  automations: {label: 'Automations runner', channel: 'Experimental'},
}

export function FeatureControlScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Feature Control" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Keep Modula controllable.</AppText>
            <AppText variant="body" colour="textSecondary">
              Enable, hide, or lock versions. Choices persist locally on this device.
            </AppText>
          </View>

          {preferences.featureControl.map((row, index) => {
            const meta = META[row.id] ?? {label: row.id, channel: 'Preview'}
            return (
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
                  <AppText variant="headline">{meta.label}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    Channel · {meta.channel}
                    {row.locked ? ' · Version locked' : ''}
                  </AppText>
                </View>
                <Switch
                  accessibilityLabel={`Toggle ${meta.label}`}
                  disabled={row.id === 'dimon'}
                  value={row.enabled}
                  onValueChange={value => {
                    const next = preferences.featureControl.map((item, i) =>
                      i === index ? {...item, enabled: value} : item,
                    )
                    void update({featureControl: next})
                  }}
                />
              </Surface>
            )
          })}

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
