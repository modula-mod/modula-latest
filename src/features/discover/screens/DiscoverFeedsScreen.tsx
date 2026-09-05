import {useState} from 'react'
import {Alert, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {EmptyState} from '@/components/primitives/EmptyState'
import {useDiscoverQuery} from '@/features/discover/data'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaIcon} from '@/platform/ui/icons'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Custom feeds / pin feed sheet — Preview. */
export function DiscoverFeedsScreen() {
  const router = useRouter()
  const {colours, controls, radius, spacing} = useThemeTokens()
  const discover = useDiscoverQuery()
  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  const feeds = (discover.data?.trendingTopics ?? []).map(topic => ({
    id: topic.id,
    name: topic.label,
    description: `${topic.postCount.toLocaleString()} indexed posts`,
    pinned: pinnedIds.includes(topic.id),
  }))

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
            Pin indexed topics from the Discover service.
          </AppText>
          {feeds.length ? (
            feeds.map(feed => (
              <AppPressable
                key={feed.id}
                accessibilityLabel={`${feed.pinned ? 'Unpin' : 'Pin'} ${feed.name}`}
                onPress={() => {
                  void selectionHaptic()
                  setPinnedIds(prev =>
                    prev.includes(feed.id)
                      ? prev.filter(id => id !== feed.id)
                      : [...prev, feed.id],
                  )
                  Alert.alert(
                    feed.pinned ? 'Unpinned' : 'Pinned',
                    `${feed.name} pin state is held locally until custom feed persistence is enabled.`,
                  )
                }}
                style={[
                  styles.row,
                  {
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                    borderRadius: radius.md,
                    gap: spacing[3],
                    minHeight: controls.listRow.minimum,
                    padding: spacing[3],
                  },
                ]}>
                <View style={{flex: 1, gap: 2}}>
                  <AppText variant="label">{feed.name}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {feed.description}
                  </AppText>
                </View>
                <ModulaIcon
                  name={feed.pinned ? 'bookmark' : 'saved'}
                  colour={feed.pinned ? colours.accent : colours.textTertiary}
                />
              </AppPressable>
            ))
          ) : (
            <EmptyState
              icon="discover"
              title="No indexed feeds"
              description="The Discover service has not returned any topics to pin."
            />
          )}
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
  },
})
