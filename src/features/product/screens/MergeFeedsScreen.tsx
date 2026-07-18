import {useMemo} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'

import {AppButton} from '@/components/primitives/AppButton'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const FEEDS = [
  {id: 'following', label: 'Following', hint: 'People you follow', weight: 35},
  {id: 'for-you', label: 'For You', hint: 'Discovery blend', weight: 20},
  {id: 'team', label: 'Team updates', hint: 'Shared profiles', weight: 20},
  {id: 'crm', label: 'CRM activity', hint: 'Module events', weight: 10},
  {id: 'creators', label: 'Creators', hint: 'Selected publishers', weight: 10},
  {id: 'tech', label: 'Technology', hint: 'Community topic', weight: 5},
]

export function MergeFeedsScreen() {
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const selected = preferences.mergeFeedIds

  const count = selected.length
  const valid = count >= 2 && count <= 5
  const presetName = preferences.mergeFeedPresetName
  const preview = useMemo(
    () => FEEDS.filter(feed => selected.includes(feed.id)).map(feed => feed.label),
    [selected],
  )
  const weightedPreview = useMemo(
    () => FEEDS.filter(feed => selected.includes(feed.id)),
    [selected],
  )

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter(item => item !== id)
      : selected.length >= 5
        ? selected
        : [...selected, id]
    void update({mergeFeedIds: next})
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Merge Feeds" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Assemble your stream.</AppText>
            <AppText variant="body" colour="textSecondary">
              Combine two to five feeds. Selection persists locally on this device.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.preview,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="label">Merged preview</AppText>
            <AppText variant="caption" colour="textTertiary">
              Preset · {presetName}
            </AppText>
            <AppText variant="headline">
              {preview.length ? preview.join(' + ') : 'Select feeds'}
            </AppText>
            <AppText variant="caption" colour={valid ? 'accent' : 'destructive'}>
              {count} selected · need 2–5 · saved locally
            </AppText>
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.preview,
              {
                padding: spacing[4],
                gap: spacing[3],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <View style={{gap: spacing[1]}}>
              <AppText variant="label">Preset name</AppText>
              <AppText variant="caption" colour="textSecondary">
                Saved locally with your selected feed sources.
              </AppText>
            </View>
            <TextInput
              value={presetName}
              onChangeText={value => {
                void update({mergeFeedPresetName: value})
              }}
              placeholder="Name this preset"
              placeholderTextColor={colours.textTertiary}
              style={[
                styles.input,
                {
                  color: colours.text,
                  borderColor: colours.border,
                  borderRadius: radius.medium,
                  paddingHorizontal: spacing[3],
                },
              ]}
              accessibilityLabel="Merge feed preset name"
            />
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.preview,
              {
                padding: spacing[4],
                gap: spacing[3],
                borderRadius: radius.large,
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
              },
            ]}>
            <View style={{gap: spacing[1]}}>
              <AppText variant="label">Source weighting · Preview</AppText>
              <AppText variant="caption" colour="textSecondary">
                Static weighting hints only; no production ranking algorithm is claimed.
              </AppText>
            </View>
            {(weightedPreview.length ? weightedPreview : FEEDS.slice(0, 3)).map(feed => (
              <View key={feed.id} style={[styles.weightRow, {gap: spacing[3]}]}>
                <View style={{flex: 1, gap: spacing[1]}}>
                  <AppText variant="caption">{feed.label}</AppText>
                  <View
                    style={[
                      styles.weightTrack,
                      {backgroundColor: colours.surfaceMuted, borderRadius: radius.round},
                    ]}>
                    <View
                      style={[
                        styles.weightFill,
                        {
                          backgroundColor: colours.accent,
                          borderRadius: radius.round,
                          width: `${feed.weight}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
                <AppText variant="caption" colour="textTertiary">
                  {feed.weight}%
                </AppText>
              </View>
            ))}
          </Surface>

          <View style={{gap: spacing[3]}}>
            {FEEDS.map(feed => {
              const on = selected.includes(feed.id)
              return (
                <AppPressable
                  key={feed.id}
                  accessibilityLabel={`${on ? 'Remove' : 'Add'} ${feed.label}`}
                  onPress={() => toggle(feed.id)}
                  style={[
                    styles.feed,
                    {
                      padding: spacing[4],
                      borderRadius: radius.medium,
                      backgroundColor: on ? colours.accentSubtle : colours.surface,
                      borderColor: on ? colours.accent : colours.border,
                    },
                  ]}>
                  <View style={{flex: 1, gap: spacing[1]}}>
                    <AppText variant="headline">{feed.label}</AppText>
                    <AppText variant="caption" colour="textSecondary">
                      {feed.hint}
                    </AppText>
                  </View>
                  <AppText variant="caption" colour={on ? 'accent' : 'textTertiary'}>
                    {on ? `${feed.weight}%` : 'Off'}
                  </AppText>
                </AppPressable>
              )
            })}
          </View>

          <AppButton disabled={!valid} onPress={() => undefined}>
            {valid ? `${presetName} saved on device` : 'Select 2–5 feeds'}
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  preview: {borderWidth: StyleSheet.hairlineWidth},
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 44,
  },
  feed: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
  },
  weightFill: {
    height: '100%',
  },
  weightRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  weightTrack: {
    height: 6,
    overflow: 'hidden',
  },
})
