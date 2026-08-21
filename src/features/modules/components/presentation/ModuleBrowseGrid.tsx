import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ProductHubCategory} from '@/data/repositories/contracts'
import {PRODUCT_HUB_BROWSE_CATEGORIES} from '@/features/modules/components/presentation/ModuleCategoryTile'
import {ModulaIcon, type ModulaIconName} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const TILE: Partial<
  Record<ProductHubCategory, {light: string; dark: string; icon: ModulaIconName}>
> = {
  All: {light: '#E8E2D6', dark: '#2A241C', icon: 'modules'},
  Productivity: {light: '#E8E2D6', dark: '#3A3228', icon: 'note'},
  Social: {light: '#D9E2E0', dark: '#1C2A28', icon: 'profile'},
  Creator: {light: '#E4D8D2', dark: '#32241F', icon: 'sparkles'},
  Media: {light: '#D7DEE6', dark: '#1B2430', icon: 'photo'},
  Automation: {light: '#DDE3D6', dark: '#22281C', icon: 'automation'},
  AI: {light: '#D8D6E4', dark: '#242038', icon: 'sparkles'},
  Developer: {light: '#D6D6D4', dark: '#222220', icon: 'developer'},
}

/**
 * Visual browse grid. Category colour is identity wash, not a random gradient.
 */
export function ModuleBrowseGrid({
  categories = PRODUCT_HUB_BROWSE_CATEGORIES,
  onBrowse,
}: {
  categories?: ProductHubCategory[]
  onBrowse: (category: ProductHubCategory) => void
}) {
  const {colours, radius, spacing, resolvedColourMode} = useThemeTokens()
  const dark = resolvedColourMode === 'dark' || resolvedColourMode === 'oled'
  return (
    <View style={[styles.grid, {gap: spacing[3]}]} testID="module-browse-grid">
      {categories.map(category => {
        const tile = TILE[category] ?? TILE.All ?? {
          light: '#E8E2D6',
          dark: '#2A241C',
          icon: 'modules' as const,
        }
        return (
          <AppPressable
            key={category}
            accessibilityLabel={`Browse ${category}`}
            onPress={() => onBrowse(category)}
            style={[
              styles.tile,
              {
                backgroundColor: dark ? tile.dark : tile.light,
                borderRadius: radius.xlarge,
                padding: spacing[4],
              },
            ]}>
            <View style={styles.icon}>
              <ModulaIcon name={tile.icon} size={28} colour={dark ? '#F4F7F8' : colours.text} />
            </View>
            <AppText variant="headline" style={{color: dark ? '#FFFFFF' : colours.text}}>
              {category}
            </AppText>
          </AppPressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  icon: {alignSelf: 'flex-end'},
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    justifyContent: 'space-between',
    minHeight: 112,
  },
})
