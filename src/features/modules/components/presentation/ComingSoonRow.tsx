import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModuleRow} from '@/features/modules/components/presentation/ModuleRow'

/** Intentionally muted marketplace row for planned modules. */
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
