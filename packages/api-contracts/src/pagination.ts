export type CursorPage<T> = {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export const DEFAULT_PAGE_LIMIT = 20
export const MAX_PAGE_LIMIT = 50
