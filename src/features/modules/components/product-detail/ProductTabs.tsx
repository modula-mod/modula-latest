import {useHydrationSafeWindowDimensions} from '@/lib/useHydrationSafeWindowDimensions'
import {ModulaTabs} from '@/platform/ui/tabs/modula-tabs-control'

export type ProductTabId = 'overview' | 'features' | 'permissions' | 'reviews' | 'related'

export const PRODUCT_TABS: {id: ProductTabId; label: string}[] = [
  {id: 'overview', label: 'Overview'},
  {id: 'features', label: 'Features'},
  {id: 'permissions', label: 'Permissions'},
  {id: 'reviews', label: 'Reviews'},
  {id: 'related', label: 'Related'},
]

/** Longest product tab label — sized so nothing truncates in the scroll rail. */
const PRODUCT_TAB_SEGMENT_MIN_WIDTH = 108

export function ProductTabs({selected, onSelect}: {selected: ProductTabId; onSelect: (tab: ProductTabId) => void}) {
  const {width} = useHydrationSafeWindowDimensions()
  return (
    <ModulaTabs
      accessibilityLabel="Product sections"
      maxWidth={Math.max(280, width - 32)}
      onValueChange={value => onSelect(value as ProductTabId)}
      presentation="scrollable"
      segmentMinWidth={PRODUCT_TAB_SEGMENT_MIN_WIDTH}
      tabs={PRODUCT_TABS}
      testID="product-tabs"
      value={selected}
    />
  )
}
