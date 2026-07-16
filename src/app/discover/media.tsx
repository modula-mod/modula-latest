import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useDiscoverQuery} from '@/features/discover/data'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Video / media discover grid — Preview tiles from local discover media. */
export default function DiscoverMediaGridRoute() {
  const router = useRouter()
  const {width} = useWindowDimensions()
  const {colours, radius, spacing} = useThemeTokens()
  const discoverQuery = useDiscoverQuery()
  const media = discoverQuery.data?.media ?? []
  const columns = width >= 700 ? 3 : 2
  const gap = spacing[2]
  const tile = (width - spacing[4] * 2 - gap * (columns - 1)) / columns

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Media" />
      <ResponsiveContent>
        <ScrollView contentContainerStyle={{gap: spacing[3], padding: spacing[4]}}>
          <AppText variant="caption" colour="textSecondary">
            Media grid — Preview. Opens Reels when available.
          </AppText>
          <View style={[styles.grid, {gap}]}>
            {media.map(item => (
              <AppPressable
                key={item.id}
                accessibilityLabel={item.title ?? 'Open media'}
                onPress={() => router.push('/reels' as Href)}
                style={[
                  styles.tile,
                  {
                    width: tile,
                    height: tile * 1.35,
                    backgroundColor: item.colour ?? colours.accentSubtle,
                    borderRadius: radius.md,
                  },
                ]}>
                <AppText variant="caption" style={{color: colours.accentForeground}}>
                  {item.title ?? 'Media'}
                </AppText>
              </AppPressable>
            ))}
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  screen: {flex: 1},
  tile: {
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 10,
  },
})
