import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {useHydrationSafeWindowDimensions} from '@/lib/useHydrationSafeWindowDimensions'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {ModuleAction} from '@/features/modules/components/presentation/ModuleAction'
import {resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {ModulaProductRow} from '@/platform/ui/identity'

export function ModuleRow({
  item,
  onPress,
  onAction,
  showSeparator = true,
  muted = false,
}: {
  item: ModuleCatalogueItem
  onPress: () => void
  onAction?: () => void
  showSeparator?: boolean
  muted?: boolean
}) {
  const {fontScale} = useHydrationSafeWindowDimensions()
  const presentation = resolveModuleInstallPresentation(item)
  const copy = productCopyFor(item.moduleId, item.name, item.description)
  const stacked = fontScale >= 1.2
  const comingSoon = presentation.primaryAction === 'Soon'
  const quiet = muted || comingSoon

  return (
    <ModulaProductRow
      artwork={<ModuleArtwork moduleId={item.moduleId} name={copy.name} size={48} variant="icon" />}
      last={!showSeparator}
      name={copy.name}
      onPress={onPress}
      publisher={copy.publisher}
      stacked={stacked}
      subtitle={copy.short}
      testID={quiet ? 'coming-soon-row' : 'module-row'}
      trailing={
        <ModuleAction
          presentation={presentation}
          productName={copy.name}
          onPress={onAction ?? onPress}
        />
      }
    />
  )
}
