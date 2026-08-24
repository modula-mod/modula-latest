import {ScrollView, StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {HubSectionHeader} from '@/features/modules/components/presentation/HubSectionHeader'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Icon-led discovery shelf. Artwork is the product icon, not a rounded scene tile.
 */
export function ModuleIconShelf({
  title,
  subtitle,
  items,
  onOpen,
}: {
  title: string
  subtitle?: string
  items: ModuleCatalogueItem[]
  onOpen: (moduleId: string) => void
}) {
  const {spacing} = useThemeTokens()
  if (!items.length) return null
  return (
    <View style={{gap: spacing[3]}} testID="module-icon-shelf">
      <HubSectionHeader title={title} subtitle={subtitle} trailing="See All" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{gap: spacing[4]}}>
        {items.map(item => {
          const copy = productCopyFor(item.moduleId, item.name, item.description)
          return (
            <AppPressable
              key={`${title}-${item.moduleId}`}
              accessibilityLabel={`Open ${copy.name}`}
              onPress={() => onOpen(item.moduleId)}
              style={styles.item}>
              <ModuleArtwork moduleId={item.moduleId} name={copy.name} size={72} variant="icon" />
              <AppText variant="productName" numberOfLines={2} style={styles.name}>
                {copy.name}
              </AppText>
              <AppText variant="productSubtitle" colour="textSecondary" numberOfLines={2}>
                {copy.short}
              </AppText>
            </AppPressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  item: {gap: 8, width: 108},
  name: {minHeight: 40},
})
