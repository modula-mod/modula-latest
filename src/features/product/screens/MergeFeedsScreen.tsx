import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'

import {AppButton} from '@/components/primitives/AppButton'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
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
  const [selected, setSelected] = useState<string[]>(['following', 'team'])

  const count = selected.length
  const valid = count >= 2 && count <= 5
  const preview = useMemo(
    () => FEEDS.filter(feed => selected.includes(feed.id)).map(feed => feed.label),
    [selected],
  )

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(item => item !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Merge Feeds" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Assemble your stream.</AppText>
            <AppText variant="body" colour="textSecondary">
              Combine two to five feeds. Preview only — Greenfield merge recipes are not persisted yet.
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
              {count} selected · need 2–5
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
            Save merge (Preview)
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
