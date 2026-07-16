import type {CursorPage} from '@/api/contracts/CursorPage'
import {asArray, asBoolean, asRecord, asString} from '@/api/decoding/validation'

export function decodeCursorPage<T>(
  value: unknown,
  decodeItem: (item: unknown) => T,
): CursorPage<T> {
  const page = asRecord(value, 'cursor page')
  return {
    items: asArray(page.items, 'cursor page items', item => decodeItem(item)),
    nextCursor: page.nextCursor === null ? null : asString(page.nextCursor, 'next cursor'),
    hasMore: asBoolean(page.hasMore, 'has more'),
  }
}
