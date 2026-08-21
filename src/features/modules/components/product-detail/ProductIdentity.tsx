import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ProductBadge} from '@/features/modules/components/product-detail/ProductBadge'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProductIdentity({
  name,
  subtitle,
  publisher,
  privateByDesign,
  verified,
}: {
  name: string
  subtitle: string
  publisher: string
  privateByDesign?: boolean
  verified?: boolean
}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.identity, {gap: spacing[1]}]} testID="product-identity">
      {privateByDesign ? <ProductBadge /> : null}
      <AppText variant="moduleTitle" accessibilityRole="header" style={styles.title}>
        {name}
      </AppText>
      <AppText variant="moduleSubtitle" colour="textSecondary">
        {subtitle}
      </AppText>
      <View style={[styles.publisher, {gap: spacing[1]}]}>
        <ModulaIcon name="module" size={15} colour={colours.textTertiary} />
        <AppText variant="publisher" colour="textTertiary">
          {publisher}
        </AppText>
        {verified ? (
          <>
            <AppText variant="publisher" colour="textTertiary">·</AppText>
            <ModulaIcon name="verified" size={15} colour={colours.accent} />
            <AppText variant="publisher" colour="textTertiary">Verified</AppText>
          </>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  identity: {minWidth: 0},
  publisher: {alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap'},
  title: {letterSpacing: -0.7},
})
