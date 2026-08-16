import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {ModuleAction} from '@/features/modules/components/presentation/ModuleAction'
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
  const pack = item.moduleId
  return (
    <AppPressable
      accessibilityLabel={`Open featured ${copy.name}`}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colours.surfaceRaised,
          borderRadius: radius.xlarge,
          gap: spacing[4],
          padding: spacing[4],
        },
      ]}
      testID="module-editorial-hero">
      <View style={styles.art}>
        <ModuleArtwork moduleId={pack} name={copy.name} size={168} variant="hero" />
      </View>
      <View style={{gap: spacing[1]}}>
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
      <View style={[styles.actionRow, {gap: spacing[3]}]}>
        <ModuleArtwork moduleId={pack} name={copy.name} size={44} />
        <View style={styles.flex}>
          <AppText variant="label">{copy.name}</AppText>
          <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
            {copy.short}
          </AppText>
        </View>
        <ModuleAction presentation={presentation} productName={copy.name} onPress={onAction ?? onPress} />
      </View>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  actionRow: {alignItems: 'center', flexDirection: 'row'},
  art: {alignItems: 'center', justifyContent: 'center'},
  card: {overflow: 'hidden', width: '100%'},
  flex: {flex: 1, minWidth: 0},
})
