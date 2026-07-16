import {useState} from 'react'
import {Alert, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {seededCustomFeeds} from '@/features/social/data/seededSurfaces'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Custom feeds / pin feed sheet — Preview. */
export default function DiscoverFeedsRoute() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [feeds, setFeeds] = useState(seededCustomFeeds)

  return (
    <View style={{flex: 1, backgroundColor: colours.canvas}}>
      <ModulaSheet
        isPresented
        onDismiss={() => (router.canGoBack() ? router.back() : router.replace('/discover'))}
        snapPoints={['half', 'full']}
        testID="custom-feeds-sheet">
        <ScrollView contentContainerStyle={{gap: spacing[3], paddingBottom: spacing[6]}}>
          <AppText variant="headline">Custom feeds</AppText>
          <AppText variant="caption" colour="textSecondary">
            Pin feeds for Discover — Preview. Pins are local-only.
          </AppText>
          {feeds.map(feed => (
            <AppPressable
              key={feed.id}
              accessibilityLabel={`${feed.pinned ? 'Unpin' : 'Pin'} ${feed.name}`}
              onPress={() => {
                void selectionHaptic()
                setFeeds(prev =>
                  prev.map(item =>
                    item.id === feed.id ? {...item, pinned: !item.pinned} : item,
                  ),
                )
                Alert.alert(
                  feed.pinned ? 'Unpinned — Preview' : 'Pinned — Preview',
                  `${feed.name} pin state is local-only in Phase 4.5.`,
                )
              }}
              style={[
                styles.row,
                {
                  backgroundColor: colours.surfaceRaised,
                  borderColor: colours.border,
                  borderRadius: radius.md,
                  gap: spacing[3],
                  padding: spacing[3],
                },
              ]}>
              <View style={{flex: 1, gap: 2}}>
                <AppText variant="label">{feed.name}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {feed.description}
                </AppText>
              </View>
              <AppIcon
                name={feed.pinned ? 'bookmark' : 'saved'}
                colour={feed.pinned ? colours.accent : colours.textTertiary}
              />
            </AppPressable>
          ))}
        </ScrollView>
      </ModulaSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 64,
  },
})
