import {ScrollView, StyleSheet, Switch, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {
  evaluateFocusPolicy,
  FOCUS_POLICY_QUESTIONS,
  FOCUS_PRESET_META,
  FOCUS_SURFACE_ADAPTERS,
  focusPreferencesFromPreset,
  type FocusPreset,
} from '@/features/product/data/focusPolicy'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import type {FocusPreferences} from '@/features/product/storage/productPreferencesStorage'
import {useProfile} from '@/features/profile/runtime/useProfile'
import {useProfileActions} from '@/features/profile/runtime/useProfileActions'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const PRESETS: FocusPreset[] = ['off', 'light', 'deep', 'custom']

const CUSTOM_ROWS: Array<{id: keyof FocusPreferences; label: string; description: string}> = [
  {
    id: 'quietFeed',
    label: 'Quiet the feed',
    description: 'Prefer Following and mute algorithmic noise.',
  },
  {
    id: 'hideNav',
    label: 'Hide secondary navigation',
    description: 'Keep Board, Messages, and active modules.',
  },
  {
    id: 'suppressPings',
    label: 'Suppress social pings',
    description: 'Allow mentions and DMs from Inner Circle only.',
  },
  {
    id: 'priorityWork',
    label: 'Prioritise Tasks + CRM',
    description: 'Surface work modules above Discover.',
  },
  {
    id: 'showHalo',
    label: 'Show Focus Halo',
    description: 'Signal availability on your avatar.',
  },
]

export function FocusModeScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const {preferences, ready, update} = useProductPreferences()
  const focus = preferences.focus
  const preset = focus.preset ?? 'light'
  const policy = evaluateFocusPolicy(preset)
  const meta = FOCUS_PRESET_META[preset]
  const {presentation} = useProfile()
  const {setProfilePresentation} = useProfileActions()

  const applyPreset = (next: FocusPreset) => {
    const mapped = focusPreferencesFromPreset(next)
    void update({focus: mapped})
    setProfilePresentation({
      ...presentation,
      showFocusHalo: mapped.showHalo,
    })
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Focus Mode" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView
          contentContainerStyle={{
            gap: spacing[5],
            padding: spacing[4],
            paddingBottom: tabPadding,
          }}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="headline">Adaptive attention, not a settings dump.</AppText>
            <AppText variant="body" colour="textSecondary">
              Presets drive a FocusPolicyEngine Preview. Home, Board, presence, and GAIA interruption
              rules follow. Preferences persist locally until Greenfield sync lands.
              {!ready ? ' Loading…' : ''}
            </AppText>
          </View>

          <View style={[styles.presetRow, {gap: spacing[2]}]}>
            {PRESETS.map(id => {
              const selected = preset === id
              const item = FOCUS_PRESET_META[id]
              return (
                <AppPressable
                  key={id}
                  accessibilityLabel={`Focus preset ${item.title}`}
                  accessibilityState={{selected}}
                  onPress={() => applyPreset(id)}
                  style={[
                    styles.presetChip,
                    {
                      borderRadius: radius.medium,
                      borderColor: selected ? colours.accent : colours.border,
                      backgroundColor: selected ? colours.accentSubtle : colours.surface,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[3],
                      gap: spacing[1],
                    },
                  ]}>
                  <AppText variant="headline" colour={selected ? 'accent' : 'text'}>
                    {item.title}
                  </AppText>
                </AppPressable>
              )
            })}
          </View>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="caption" colour="accent">
              ACTIVE · {meta.title.toUpperCase()}
              {meta.haloLabel ? ` · ${meta.haloLabel}` : ''}
            </AppText>
            <AppText variant="body" colour="textSecondary">
              {meta.summary}
            </AppText>
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Policy engine Preview</AppText>
            <AppText variant="caption" colour="textTertiary">
              FocusPolicyEngine answers these for every surface adapter.
            </AppText>
            {FOCUS_POLICY_QUESTIONS.map(row => (
              <Surface
                key={row.key}
                variant="contained"
                style={[
                  styles.policyRow,
                  {
                    padding: spacing[3],
                    borderRadius: radius.medium,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                    gap: spacing[2],
                  },
                ]}>
                <AppText variant="body" style={{flex: 1}}>
                  {row.label}
                </AppText>
                <AppText variant="label" colour={policy[row.key] ? 'accent' : 'textTertiary'}>
                  {policy[row.key] ? 'Yes' : 'No'}
                </AppText>
              </Surface>
            ))}
          </View>

          <View style={{gap: spacing[2]}}>
            <AppText variant="headline">Surface adapters</AppText>
            <AppText variant="caption" colour="textTertiary">
              Production wires each adapter. This build maps Home feed + Board to preset flags.
            </AppText>
            <View style={[styles.adapterWrap, {gap: spacing[2]}]}>
              {FOCUS_SURFACE_ADAPTERS.map(name => (
                <Surface
                  key={name}
                  variant="contained"
                  style={[
                    styles.adapterChip,
                    {
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      borderRadius: radius.medium,
                      backgroundColor: colours.surfaceRaised,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppText variant="micro" colour="textSecondary">
                    {name}
                  </AppText>
                </Surface>
              ))}
            </View>
          </View>

          {preset === 'custom' ? (
            <View style={{gap: spacing[3]}}>
              <AppText variant="headline">Custom rules</AppText>
              {CUSTOM_ROWS.map(item => (
                <Surface
                  key={item.id}
                  variant="contained"
                  style={[
                    styles.policyRow,
                    {
                      padding: spacing[4],
                      borderRadius: radius.medium,
                      borderColor: colours.border,
                      backgroundColor: colours.surface,
                      gap: spacing[3],
                    },
                  ]}>
                  <View style={{flex: 1, gap: spacing[1]}}>
                    <AppText variant="headline">{item.label}</AppText>
                    <AppText variant="caption" colour="textSecondary">
                      {item.description}
                    </AppText>
                  </View>
                  <Switch
                    accessibilityLabel={item.label}
                    value={Boolean(focus[item.id])}
                    onValueChange={value => {
                      void update({focus: {...focus, preset: 'custom', [item.id]: value}})
                      if (item.id === 'showHalo') {
                        setProfilePresentation({
                          ...presentation,
                          showFocusHalo: value,
                        })
                      }
                    }}
                  />
                </Surface>
              ))}
            </View>
          ) : null}

          <AppButton onPress={() => router.push('/board' as Href)}>Open Board</AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/intelligence' as Href)}>
            Intelligence Hub
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/profile/customize' as Href)}>
            Focus Halo on profile
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  presetRow: {flexDirection: 'row', flexWrap: 'wrap'},
  presetChip: {
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 1,
    minWidth: 72,
  },
  card: {borderWidth: StyleSheet.hairlineWidth},
  policyRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  adapterWrap: {flexDirection: 'row', flexWrap: 'wrap'},
  adapterChip: {borderWidth: StyleSheet.hairlineWidth},
})
