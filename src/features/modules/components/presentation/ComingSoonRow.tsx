import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModuleRow} from '@/features/modules/components/presentation/ModuleRow'

/** Additional coming-soon catalogue row. The lead story uses ComingSoonEditorial. */
export function ComingSoonRow({
  item,
  onPress,
  showSeparator = true,
}: {
  item: ModuleCatalogueItem
  onPress: () => void
  showSeparator?: boolean
}) {
  return <ModuleRow item={item} onPress={onPress} showSeparator={showSeparator} muted />
}
