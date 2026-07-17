import {DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, type CursorPage} from '@modula/api-contracts'

export function parseLimit(value: unknown): number {
  const n = Number(value ?? DEFAULT_PAGE_LIMIT)
  if (!Number.isFinite(n) || n < 1) {
    throw Object.assign(new Error('Invalid page size'), {code: 'VALIDATION_FAILED' as const})
  }
  if (n > MAX_PAGE_LIMIT) {
    throw Object.assign(new Error(`Page size must be <= ${MAX_PAGE_LIMIT}`), {
      code: 'VALIDATION_FAILED' as const,
    })
  }
  return Math.floor(n)
}

export function decodeCursor(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string') {
    throw Object.assign(new Error('Invalid cursor'), {code: 'VALIDATION_FAILED' as const})
  }
  if (value.length > 512 || value.includes('\u0000')) {
    throw Object.assign(new Error('Invalid cursor'), {code: 'VALIDATION_FAILED' as const})
  }
  return value
}

export function toCursorPage<T>(items: T[], limit: number, cursorFor: (item: T) => string): CursorPage<T> {
  const hasMore = items.length > limit
  const page = hasMore ? items.slice(0, limit) : items
  const last = page[page.length - 1]
  return {
    items: page,
    nextCursor: hasMore && last ? cursorFor(last) : null,
    hasMore,
  }
}
