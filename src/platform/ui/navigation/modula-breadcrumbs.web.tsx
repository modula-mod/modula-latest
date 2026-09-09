import {KonstaBreadcrumbs} from '@/platform/ui/adapters/konsta/breadcrumbs.web'
import type {ModulaBreadcrumbsProps} from '@/platform/ui/navigation/modula-breadcrumbs'
import {useHydrationSafeWindowDimensions} from '@/lib/useHydrationSafeWindowDimensions'

export function ModulaBreadcrumbs({items, testID}: ModulaBreadcrumbsProps) {
  const {width} = useHydrationSafeWindowDimensions()
  if (width < 768) return null
  return <KonstaBreadcrumbs items={items} testID={testID} />
}
