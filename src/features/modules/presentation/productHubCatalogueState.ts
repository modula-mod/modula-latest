import type {ModuleCatalogueItem} from '@/data/repositories/contracts'

export type ProductHubCatalogueKind =
  | 'initial-loading'
  | 'successful-empty'
  | 'ready'
  | 'partial'
  | 'full-failure'

export type ProductHubCataloguePresentation = {
  kind: ProductHubCatalogueKind
  items: ModuleCatalogueItem[]
  error?: unknown
}

/**
 * Frontend presentation adapter for Product Hub.
 * Never treats a refetch or optional enrichment failure as an empty catalogue
 * when items were already loaded.
 */
export function presentProductHubCatalogue(input: {
  data: ModuleCatalogueItem[] | undefined
  isPending: boolean
  isError: boolean
  error: unknown
}): ProductHubCataloguePresentation {
  const items = input.data ?? []
  if (items.length > 0) {
    if (input.isError) {
      return {kind: 'partial', items, error: input.error}
    }
    return {kind: 'ready', items}
  }
  if (input.isPending && input.data === undefined) {
    return {kind: 'initial-loading', items: []}
  }
  if (input.isError) {
    return {kind: 'full-failure', items: [], error: input.error}
  }
  return {kind: 'successful-empty', items: []}
}
