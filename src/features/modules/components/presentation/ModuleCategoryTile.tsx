import {StyleSheet} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ProductHubCategory} from '@/data/repositories/contracts'
import {ModulaIcon, type ModulaIconName} from '@/platform/ui/icons'
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

const TILE_ICON: Partial<Record<ProductHubCategory, ModulaIconName>> = {
  Productivity: 'note',
  Social: 'profile',
  Creator: 'sparkles',
  Media: 'photo',
  Automation: 'automation',
  AI: 'sparkles',
  Developer: 'developer',
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
  const icon = TILE_ICON[category] ?? 'modules'
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
          gap: spacing[3],
        },
      ]}>
      <ModulaIcon name={icon} size={22} colour={colours.text} />
      <AppText variant="label">{category}</AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    justifyContent: 'space-between',
    minHeight: 96,
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
