import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import type {ModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {ModuleAction} from '@/features/modules/components/presentation/ModuleAction'

export function ProductActionGroup({
  presentation,
  productName,
  loading,
  onPrimary,
  secondary,
}: {
  presentation: ModuleInstallPresentation
  productName: string
  loading?: boolean
  onPrimary: () => void
  secondary?: ReactNode
}) {
  return (
    <View style={styles.actions} testID="product-action-group">
      <ModuleAction
        presentation={presentation}
        productName={productName}
        loading={loading}
        compact={false}
        tone="product"
        onPress={onPrimary}
        testID="product-primary-action"
      />
      {secondary}
    </View>
  )
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
})
