import {Link, type Href} from 'expo-router'
import {Pressable, StyleSheet, View, useWindowDimensions} from 'react-native'

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
 * Direction C — Editorial Split.
 * Large image with product identity overlapping / anchoring the artwork.
 * Compact descriptive copy sits beside or below, magazine-like.
 */
export function EditorialSplitHero({
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
  const {width} = useWindowDimensions()
  const presentation = resolveModuleInstallPresentation(item)
  const copy = productCopyFor(item.moduleId, item.name, item.description)
  const split = width >= 860
  const cover = (
    <View
      style={{
        borderCurve: 'continuous',
        borderRadius: radius.xlarge,
        overflow: 'hidden',
        width: '100%',
      }}>
      <ProductCover moduleId={item.moduleId} name={copy.name} inset={false} size="split" />
    </View>
  )

  const identity = (
    <View
      style={[
        styles.anchor,
        {
          backgroundColor: colours.canvas,
          borderColor: colours.separator,
          gap: spacing[3],
          padding: spacing[4],
        },
      ]}>
      <ModuleArtwork moduleId={item.moduleId} name={copy.name} size={64} variant="icon" />
      <View style={styles.flex}>
        {copy.eyebrow ? (
          <AppText variant="editorialEyebrow" colour="textTertiary">
            {copy.eyebrow.toUpperCase()}
          </AppText>
        ) : null}
        <AppText variant="editorialTitle">{copy.name}</AppText>
        <AppText variant="editorialSubtitle" colour="textSecondary">
          {copy.tagline}
        </AppText>
      </View>
      <ModuleAction presentation={presentation} productName={copy.name} onPress={onAction ?? onPress} />
    </View>
  )

  return (
    <View style={[styles.feature, split ? styles.split : null]} testID="editorial-split-hero">
      <View style={styles.media}>
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
        <View style={[styles.overlap, split ? styles.overlapSplit : null]}>{identity}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  anchor: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  feature: {width: '100%'},
  flex: {gap: 4, minWidth: 0},
  media: {position: 'relative', width: '100%'},
  overlap: {marginTop: -56, paddingHorizontal: 16},
  overlapSplit: {marginTop: -72, maxWidth: 420},
  split: {alignItems: 'stretch'},
})
