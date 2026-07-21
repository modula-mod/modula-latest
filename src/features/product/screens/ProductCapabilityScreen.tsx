import {View, StyleSheet} from 'react-native'
import {useLocalSearchParams} from 'expo-router'

import {EmptyState} from '@/components/primitives/EmptyState'
import {ProductPreScreen} from '@/features/product/components/ProductPreScreen'
import {getProductCapability} from '@/features/product/data/productCatalogue'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProductCapabilityScreen() {
  const {slug} = useLocalSearchParams<{slug: string}>()
  const {colours} = useThemeTokens()
  const capability = getProductCapability(String(slug ?? ''))

  if (!capability) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Capability" />
        <EmptyState
          icon="info"
          title="Unknown capability"
          description="This product surface is not in the Modula catalogue."
        />
      </View>
    )
  }

  return <ProductPreScreen capability={capability} />
}

const styles = StyleSheet.create({
  screen: {flex: 1},
})
