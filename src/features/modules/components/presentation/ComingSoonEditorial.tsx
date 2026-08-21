import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Coming Soon as an intentional editorial story — not a disabled row.
 */
export function ComingSoonEditorial({
  item,
  onPress,
}: {
  item: ModuleCatalogueItem
  onPress: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const copy = productCopyFor(item.moduleId, item.name, item.description)
  return (
    <AppPressable
      accessibilityLabel={`${copy.name} coming soon`}
      onPress={onPress}
      style={styles.block}
      testID="coming-soon-editorial">
      <View
        style={[
          styles.art,
          {
            backgroundColor: colours.surfaceMuted,
            borderRadius: radius.xlarge,
            overflow: 'hidden',
          },
        ]}>
        <ModuleArtwork moduleId={item.moduleId} name={copy.name} variant="scene" sceneHeight={188} />
      </View>
      <View style={{gap: spacing[1], paddingTop: spacing[3]}}>
        <AppText variant="editorialEyebrow" colour="textTertiary" style={styles.eyebrow}>
          {(copy.eyebrow ?? 'Coming to Modula').toUpperCase()}
        </AppText>
        <AppText variant="editorialTitle">{copy.name}</AppText>
        <AppText variant="editorialSubtitle" colour="textSecondary">
          {copy.tagline}
        </AppText>
        <AppText variant="label" colour="textSecondary">
          Coming Soon
        </AppText>
      </View>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  art: {width: '100%'},
  block: {width: '100%'},
  eyebrow: {letterSpacing: 0.8},
})
