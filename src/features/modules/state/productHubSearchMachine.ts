export type ProductHubSearchState =
  | 'IDLE_LARGE_HEADER'
  | 'COMPACT_HEADER'
  | 'SEARCH_TRIGGER'
  | 'SEARCH_EXPANDING'
  | 'SEARCH_ACTIVE'
  | 'SEARCH_RESULTS'
  | 'SEARCH_EMPTY'
  | 'SEARCH_ERROR'
  | 'SEARCH_COLLAPSING'

export type ProductHubSearchEvent =
  | {type: 'SCROLL'; compact: boolean}
  | {type: 'TAP_SEARCH'}
  | {type: 'GEOMETRY_SETTLED'}
  | {type: 'TYPE'; query: string}
  | {type: 'RESULTS_CHANGED'; count: number; error: boolean}
  | {type: 'CANCEL'}
  | {type: 'COLLAPSE_COMPLETE'}

export type ProductHubSearchModel = {
  state: ProductHubSearchState
  query: string
  compact: boolean
}

export const initialProductHubSearch: ProductHubSearchModel = {
  state: 'IDLE_LARGE_HEADER',
  query: '',
  compact: false,
}

export function isProductHubSearchActive(state: ProductHubSearchState): boolean {
  return (
    state === 'SEARCH_TRIGGER' ||
    state === 'SEARCH_EXPANDING' ||
    state === 'SEARCH_ACTIVE' ||
    state === 'SEARCH_RESULTS' ||
    state === 'SEARCH_EMPTY' ||
    state === 'SEARCH_ERROR'
  )
}

export function reduceProductHubSearch(
  model: ProductHubSearchModel,
  event: ProductHubSearchEvent,
): ProductHubSearchModel {
  switch (event.type) {
    case 'SCROLL': {
      if (isProductHubSearchActive(model.state) || model.state === 'SEARCH_COLLAPSING') {
        if (model.compact === event.compact) return model
        return {...model, compact: event.compact}
      }
      const nextState = event.compact ? 'COMPACT_HEADER' : 'IDLE_LARGE_HEADER'
      if (model.compact === event.compact && model.state === nextState) return model
      return {
        ...model,
        compact: event.compact,
        state: nextState,
      }
    }
    case 'TAP_SEARCH': {
      if (isProductHubSearchActive(model.state)) return model
      return {...model, state: 'SEARCH_EXPANDING'}
    }
    case 'GEOMETRY_SETTLED': {
      if (model.state !== 'SEARCH_EXPANDING' && model.state !== 'SEARCH_TRIGGER') return model
      return {...model, state: model.query.trim() ? 'SEARCH_RESULTS' : 'SEARCH_ACTIVE'}
    }
    case 'TYPE': {
      if (!isProductHubSearchActive(model.state) && model.state !== 'SEARCH_COLLAPSING') {
        return model
      }
      const query = event.query
      const nextState = query.trim() ? 'SEARCH_RESULTS' : 'SEARCH_ACTIVE'
      if (model.query === query && model.state === nextState) return model
      return {
        ...model,
        query,
        state: nextState,
      }
    }
    case 'RESULTS_CHANGED': {
      if (!model.query.trim() || !isProductHubSearchActive(model.state)) return model
      const state = event.error ? 'SEARCH_ERROR' : event.count ? 'SEARCH_RESULTS' : 'SEARCH_EMPTY'
      return model.state === state ? model : {...model, state}
    }
    case 'CANCEL': {
      if (!isProductHubSearchActive(model.state)) return model
      return {
        ...model,
        query: '',
        state: 'SEARCH_COLLAPSING',
      }
    }
    case 'COLLAPSE_COMPLETE': {
      if (model.state !== 'SEARCH_COLLAPSING') return model
      return {
        ...model,
        query: '',
        state: model.compact ? 'COMPACT_HEADER' : 'IDLE_LARGE_HEADER',
      }
    }
    default:
      return model
  }
}

export type ProductHubResultKind =
  | 'module'
  | 'tool'
  | 'function'
  | 'plugin'
  | 'connection'
  | 'widget'
  | 'collection'
  | 'publisher'

export const LIVE_PRODUCT_HUB_RESULT_KINDS: ProductHubResultKind[] = ['module', 'tool']
