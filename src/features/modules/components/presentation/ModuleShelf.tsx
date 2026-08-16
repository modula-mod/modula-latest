import type {ReactNode} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModuleFeatureCard} from '@/features/modules/components/presentation/ModuleFeatureCard'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleShelf({
  title,
  items,
  onOpen,
  trailing,
}: {
  title: string
  items: ModuleCatalogueItem[]
  onOpen: (moduleId: string) => void
  trailing?: ReactNode
}) {
  const {spacing} = useThemeTokens()
  if (!items.length) return null
  return (
    <View style={{gap: spacing[3]}} testID="module-shelf">
      <View style={styles.header}>
        <AppText variant="headline">{title}</AppText>
        {trailing}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing[3]}}>
        {items.map(item => (
          <ModuleFeatureCard key={`${title}-${item.moduleId}`} item={item} onPress={() => onOpen(item.moduleId)} />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'},
})
