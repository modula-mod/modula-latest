import {View} from 'react-native'

import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {HubSectionHeader} from '@/features/modules/components/presentation/HubSectionHeader'
import {ModuleRow} from '@/features/modules/components/presentation/ModuleRow'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModuleCollectionDefinition = {
  id: string
  title: string
  subtitle?: string
  moduleIds: string[]
}

export function ModuleCollection({
  title,
  subtitle,
  items,
  onOpen,
  onAction,
}: {
  title: string
  subtitle?: string
  items: ModuleCatalogueItem[]
  onOpen: (moduleId: string) => void
  onAction?: (item: ModuleCatalogueItem) => void
}) {
  const {spacing} = useThemeTokens()
  if (!items.length) return null
  return (
    <View style={{gap: spacing[2]}} testID="module-collection">
      <HubSectionHeader title={title} subtitle={subtitle} icon="folder" />
      {items.map((item, index) => (
        <ModuleRow
          key={`${title}-${item.moduleId}`}
          item={item}
          onPress={() => onOpen(item.moduleId)}
          onAction={onAction ? () => onAction(item) : undefined}
          showSeparator={index < items.length - 1}
        />
      ))}
    </View>
  )
}

export const PRODUCT_HUB_COLLECTIONS: ModuleCollectionDefinition[] = [
  {
    id: 'workspace',
    title: 'Build your workspace',
    subtitle: 'Private tools that stay on your account.',
    moduleIds: ['digital.modula.vault-notes', 'digital.modula.tasks'],
  },
  {
    id: 'create',
    title: 'Create & publish',
    subtitle: 'Surfaces for making and sharing.',
    moduleIds: ['digital.modula.avatar-studio'],
  },
  {
    id: 'build',
    title: 'Build with Modula',
    subtitle: 'Developer essentials when they ship.',
    moduleIds: ['digital.modula.gaia-atlas'],
  },
]
