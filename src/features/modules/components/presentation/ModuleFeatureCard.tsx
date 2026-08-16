import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleFeatureCard({
  item,
  onPress,
  width = 168,
}: {
  item: ModuleCatalogueItem
  onPress: () => void
  width?: number
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const copy = productCopyFor(item.moduleId, item.name, item.description)
  return (
    <AppPressable
      accessibilityLabel={`Open ${copy.name}`}
      onPress={onPress}
      style={[styles.card, {width, gap: spacing[2]}]}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colours.surfaceRaised,
          borderRadius: radius.large,
          height: width,
          justifyContent: 'center',
          width,
        }}>
        <ModuleArtwork moduleId={item.moduleId} name={copy.name} size={88} variant="hero" />
      </View>
      <AppText variant="label" numberOfLines={1}>
        {copy.name}
      </AppText>
      <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
        {copy.short}
      </AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  card: {flexShrink: 0},
})
