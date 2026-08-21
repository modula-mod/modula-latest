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
import {moduleArtworkPack} from '@/features/modules/identity/moduleArtwork'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Direction B — Full-Bleed Feature.
 * Image dominates. A soft image-derived wash carries identity and the CTA.
 */
export function EditorialBleedHero({
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
  const {colours, spacing} = useThemeTokens()
  const presentation = resolveModuleInstallPresentation(item)
  const copy = productCopyFor(item.moduleId, item.name, item.description)
  const pack = moduleArtworkPack(item.moduleId, copy.name)
  const wash = pack.palette.night ?? pack.palette.ink
  const cover = (
    <View style={styles.bleed}>
      <ProductCover moduleId={item.moduleId} name={copy.name} inset={false} size="bleed" />
      <LinearGradient
        colors={['rgba(0,0,0,0)', wash]}
        locations={[0.45, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
    </View>
  )

  return (
    <View style={[styles.feature, {backgroundColor: wash}]} testID="editorial-bleed-hero">
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
      <View style={[styles.identity, {gap: spacing[3], padding: spacing[4]}]}>
        <ModuleArtwork moduleId={item.moduleId} name={copy.name} size={56} variant="icon" />
        <View style={styles.flex}>
          <AppText variant="editorialTitle" style={{color: pack.palette.paper}}>
            {copy.name}
          </AppText>
          <AppText variant="editorialSubtitle" style={{color: 'rgba(255,255,255,0.78)'}}>
            {copy.tagline}
          </AppText>
        </View>
        <ModuleAction
          presentation={presentation}
          productName={copy.name}
          onPress={onAction ?? onPress}
          tone="product"
        />
      </View>
      <View style={{height: StyleSheet.hairlineWidth, backgroundColor: colours.separator}} />
    </View>
  )
}

const styles = StyleSheet.create({
  bleed: {overflow: 'hidden', width: '100%'},
  feature: {marginHorizontal: -16, width: 'auto'},
  flex: {flex: 1, minWidth: 0},
  identity: {alignItems: 'center', flexDirection: 'row'},
})
