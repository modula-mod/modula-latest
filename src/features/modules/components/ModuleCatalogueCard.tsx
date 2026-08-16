import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModuleEditorialHero} from '@/features/modules/components/presentation/ModuleEditorialHero'
import {ModuleRow} from '@/features/modules/components/presentation/ModuleRow'

/** Compatibility wrapper — Product Hub rows and heroes are the canonical primitives. */
export function ModuleCatalogueCard({
  item,
  onPress,
  onAction,
  featured = false,
}: {
  item: ModuleCatalogueItem
  onPress: () => void
  onAction?: () => void
  featured?: boolean
}) {
  if (featured) {
    return <ModuleEditorialHero item={item} onPress={onPress} onAction={onAction} />
  }
  return <ModuleRow item={item} onPress={onPress} onAction={onAction} />
}
