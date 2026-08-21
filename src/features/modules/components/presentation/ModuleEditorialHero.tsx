import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {ModuleAction} from '@/features/modules/components/presentation/ModuleAction'
import {ProductCover} from '@/features/modules/components/product-detail/ProductCover'
import {resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleEditorialHero({
  item,
  onPress,
  onAction,
}: {
  item: ModuleCatalogueItem
  onPress: () => void
  onAction?: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const presentation = resolveModuleInstallPresentation(item)
  const copy = productCopyFor(item.moduleId, item.name, item.description)
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colours.surfaceRaised,
          borderRadius: radius.xlarge,
        },
      ]}
      testID="module-editorial-hero">
      <AppPressable accessibilityLabel={`Open featured ${copy.name}`} onPress={onPress}>
        <ProductCover moduleId={item.moduleId} name={copy.name} inset={false} />
        <View style={[styles.copy, {gap: spacing[1], padding: spacing[4]}]}>
          {copy.eyebrow ? (
            <AppText variant="micro" colour="textTertiary">
              {copy.eyebrow.toUpperCase()}
            </AppText>
          ) : null}
          <AppText variant="display">{copy.name}</AppText>
          <AppText variant="body" colour="textSecondary">
            {copy.tagline}
          </AppText>
        </View>
      </AppPressable>
      <View style={[styles.actionRow, {gap: spacing[3], paddingHorizontal: spacing[4], paddingBottom: spacing[4]}]}>
        <AppPressable accessibilityLabel={`Open ${copy.name}`} onPress={onPress} style={styles.identity}>
          <ModuleArtwork moduleId={item.moduleId} name={copy.name} size={44} />
          <View style={styles.flex}>
            <AppText variant="label">{copy.name}</AppText>
            <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
              {copy.short}
            </AppText>
          </View>
        </AppPressable>
        <ModuleAction presentation={presentation} productName={copy.name} onPress={onAction ?? onPress} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  actionRow: {alignItems: 'center', flexDirection: 'row'},
  card: {overflow: 'hidden', width: '100%'},
  copy: {alignItems: 'flex-start'},
  flex: {flex: 1, minWidth: 0},
  identity: {alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minWidth: 0},
})
