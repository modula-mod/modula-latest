import type {ReactNode} from 'react'
import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'

import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {HubSectionHeader} from '@/features/modules/components/presentation/HubSectionHeader'
import {ModuleFeatureCard} from '@/features/modules/components/presentation/ModuleFeatureCard'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {ModulaIconName} from '@/platform/ui/icons'

export function ModuleShelf({
  title,
  items,
  onOpen,
  trailing,
  icon = 'modules',
}: {
  title: string
  items: ModuleCatalogueItem[]
  onOpen: (moduleId: string) => void
  trailing?: ReactNode
  icon?: ModulaIconName
}) {
  const {spacing} = useThemeTokens()
  const {width} = useWindowDimensions()
  const cardWidth = width >= 1100 ? 220 : width >= 768 ? 196 : 168
  if (!items.length) return null
  return (
    <View style={{gap: spacing[3]}} testID="module-shelf">
      <View style={styles.header}>
        <View style={styles.flex}>
          <HubSectionHeader title={title} icon={icon} trailing={typeof trailing === 'string' ? trailing : undefined} />
        </View>
        {typeof trailing === 'string' ? null : trailing}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing[3]}}>
        {items.map(item => (
          <ModuleFeatureCard
            key={`${title}-${item.moduleId}`}
            item={item}
            width={cardWidth}
            onPress={() => onOpen(item.moduleId)}
          />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: {flex: 1, minWidth: 0},
  header: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'},
})
