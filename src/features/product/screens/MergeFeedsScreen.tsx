import {useMemo} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'

import {AppButton} from '@/components/primitives/AppButton'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const FEEDS = [
  {id: 'following', label: 'Following', hint: 'People you follow'},
  {id: 'for-you', label: 'For You', hint: 'Discovery blend'},
  {id: 'team', label: 'Team updates', hint: 'Shared profiles'},
  {id: 'crm', label: 'CRM activity', hint: 'Module events'},
  {id: 'creators', label: 'Creators', hint: 'Selected publishers'},
  {id: 'tech', label: 'Technology', hint: 'Community topic'},
]

export function MergeFeedsScreen() {
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const selected = preferences.mergeFeedIds

  const count = selected.length
  const valid = count >= 2 && count <= 5
  const preview = useMemo(
    () => FEEDS.filter(feed => selected.includes(feed.id)).map(feed => feed.label),
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
            <AppText variant="headline">
              {preview.length ? preview.join(' + ') : 'Select feeds'}
            </AppText>
            <AppText variant="caption" colour={valid ? 'accent' : 'destructive'}>
              {count} selected · need 2–5 · saved locally
            </AppText>
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
                    {on ? 'On' : 'Off'}
                  </AppText>
                </AppPressable>
              )
            })}
          </View>

          <AppButton disabled={!valid} onPress={() => undefined}>
            {valid ? 'Merge saved on device' : 'Select 2–5 feeds'}
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  preview: {borderWidth: StyleSheet.hairlineWidth},
  feed: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
  },
})
