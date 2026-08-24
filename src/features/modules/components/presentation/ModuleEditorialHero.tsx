import {Link, type Href} from 'expo-router'
import {Pressable, StyleSheet, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {ModuleAction} from '@/features/modules/components/presentation/ModuleAction'
import {ProductCover} from '@/features/modules/components/product-detail/ProductCover'
import {resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Direction A — Editorial Story.
 * Artwork owns the frame. Copy lives in the image. Product identity is attached
 * to the same story, not a second card.
 */
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
      style={{
        borderCurve: 'continuous',
        borderRadius: radius.xlarge,
        overflow: 'hidden',
        width: '100%',
      }}>
      <ProductCover moduleId={item.moduleId} name={copy.name} inset={false} size="editorial" />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.72)']}
        locations={[0.42, 0.68, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.story, {padding: spacing[4]}]} pointerEvents="none">
        {copy.eyebrow ? (
          <AppText variant="editorialEyebrow" style={styles.overlayEyebrow}>
            {copy.eyebrow.toUpperCase()}
          </AppText>
        ) : null}
        <AppText variant="editorialTitle" style={styles.overlayTitle}>
          {copy.name}
        </AppText>
        <AppText variant="editorialSubtitle" style={styles.overlaySubtitle}>
          {copy.tagline}
        </AppText>
      </View>
    </View>
  )

  return (
    <View style={styles.feature} testID="module-editorial-hero">
      {href ? (
        <Link href={href as Href} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={`Open featured ${copy.name}`}>
            <Link.AppleZoom>{cover}</Link.AppleZoom>
          </Pressable>
        </Link>
      ) : (
        <AppPressable accessibilityLabel={`Open featured ${copy.name}`} onPress={onPress}>
          {cover}
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
            marginTop: spacing[3],
          },
        ]}>
        <AppPressable accessibilityLabel={`Open ${copy.name}`} onPress={onPress} style={styles.identity}>
          <ModuleArtwork moduleId={item.moduleId} name={copy.name} size={52} variant="icon" />
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
  feature: {width: '100%'},
  flex: {flex: 1, minWidth: 0},
  identity: {alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minWidth: 0},
  overlayEyebrow: {color: 'rgba(255,255,255,0.82)', letterSpacing: 0.8},
  overlaySubtitle: {color: 'rgba(255,255,255,0.86)'},
  overlayTitle: {color: '#FFFFFF'},
  story: {bottom: 0, left: 0, position: 'absolute', right: 0},
})
