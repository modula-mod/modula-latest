import {Link, type Href} from 'expo-router'
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
  href,
}: {
  item: ModuleCatalogueItem
  onPress: () => void
  onAction?: () => void
  href?: string
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const presentation = resolveModuleInstallPresentation(item)
  const copy = productCopyFor(item.moduleId, item.name, item.description)
  const cover = (
    <View
      style={[
        styles.media,
        {
          borderRadius: radius.xlarge,
          overflow: 'hidden',
        },
      ]}>
      {/* ProductCover keeps the Vault Notes photo; other modules use ModuleArtwork variant="scene". */}
      <ProductCover moduleId={item.moduleId} name={copy.name} inset={false} />
    </View>
  )
  const story = (
    <View style={[styles.copy, {gap: spacing[1], paddingTop: spacing[4]}]}>
      {copy.eyebrow ? (
        <AppText variant="editorialEyebrow" colour="textTertiary" style={styles.eyebrow}>
          {copy.eyebrow.toUpperCase()}
        </AppText>
      ) : null}
      <AppText variant="editorialTitle">{copy.name}</AppText>
      <AppText variant="editorialSubtitle" colour="textSecondary">
        {copy.tagline}
      </AppText>
    </View>
  )

  return (
    <View style={styles.feature} testID="module-editorial-hero">
      {href ? (
        <Link href={href as Href}>
          <Link.Trigger>
            <AppPressable accessibilityLabel={`Open featured ${copy.name}`}>
              <Link.AppleZoom>{cover}</Link.AppleZoom>
              {story}
            </AppPressable>
          </Link.Trigger>
        </Link>
      ) : (
        <AppPressable accessibilityLabel={`Open featured ${copy.name}`} onPress={onPress}>
          {cover}
          {story}
        </AppPressable>
      )}
      <View
        style={[
          styles.actionRow,
          {
            gap: spacing[3],
            paddingTop: spacing[4],
            borderTopColor: colours.separator,
            borderTopWidth: StyleSheet.hairlineWidth,
            marginTop: spacing[4],
          },
        ]}>
        <AppPressable accessibilityLabel={`Open ${copy.name}`} onPress={onPress} style={styles.identity}>
          <ModuleArtwork moduleId={item.moduleId} name={copy.name} size={44} />
          <View style={styles.flex}>
            <AppText variant="productName">{copy.name}</AppText>
            <AppText variant="productSubtitle" colour="textSecondary" numberOfLines={1}>
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
  copy: {alignItems: 'flex-start'},
  eyebrow: {letterSpacing: 0.8},
  feature: {width: '100%'},
  flex: {flex: 1, minWidth: 0},
  identity: {alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minWidth: 0},
  media: {borderCurve: 'continuous', width: '100%'},
})
