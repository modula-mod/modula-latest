import {StyleSheet} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ProductHubCategory} from '@/data/repositories/contracts'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const TILE_WASH: Partial<Record<ProductHubCategory, string>> = {
  Productivity: '#E8E2D6',
  Social: '#D9E2E0',
  Creator: '#E4D8D2',
  Media: '#D7DEE6',
  Automation: '#DDE3D6',
  AI: '#D8D6E4',
  Developer: '#D6D6D4',
}

export function ModuleCategoryTile({
  category,
  onPress,
}: {
  category: ProductHubCategory
  onPress: () => void
}) {
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const wash = TILE_WASH[category]
  const background = scheme === 'dark' ? colours.surfaceRaised : wash ?? colours.surfaceRaised
  return (
    <AppPressable
      accessibilityLabel={`Browse ${category}`}
      onPress={onPress}
      style={[
        styles.tile,
        {
          backgroundColor: background,
          borderRadius: radius.large,
          padding: spacing[4],
        },
      ]}>
      <AppText variant="label">{category}</AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 88,
    justifyContent: 'flex-end',
  },
})

export const PRODUCT_HUB_BROWSE_CATEGORIES: ProductHubCategory[] = [
  'Productivity',
  'Social',
  'Creator',
  'Media',
  'Automation',
  'AI',
  'Developer',
]
