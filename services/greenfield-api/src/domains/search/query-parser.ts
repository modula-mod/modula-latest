import type {AppConfig} from '../../config/index.js'
import type {GreenfieldSearchEntityType, GreenfieldSearchSort, ParsedSearchRequest, SearchCursor, SearchLimits} from './contracts.js'

const ENTITY_TYPES = new Set<GreenfieldSearchEntityType>(['post', 'profile', 'module', 'module-release', 'note', 'vault-folder'])
const SORTS = new Set<GreenfieldSearchSort>(['relevance', 'recent', 'oldest'])
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u
const CURSOR_PATTERN = /^[A-Za-z0-9_-]{8,700}$/

export function searchLimitsFromConfig(config: AppConfig): SearchLimits {
  return {
    minQueryLength: 1,
    maxQueryLength: config.searchQueryMaxChars,
    defaultLimit: config.searchDefaultLimit,
    maxLimit: config.searchMaxLimit,
    maxEntityTypes: config.searchMaxEntityTypes,
    maxTags: config.searchMaxTags,
    timeoutMs: config.searchTimeoutMs,
    recentLimit: config.searchRecentLimit,
  }
}

export function parseSearchRequest(raw: Record<string, unknown>, limits: SearchLimits): ParsedSearchRequest {
  const rawQuery = firstString(raw.query) ?? firstString(raw.q) ?? ''
  const query = normalizeSearchQuery(rawQuery, limits)
  const type = firstString(raw.type)
  const entityTypes = normalizeEntityTypes(raw.entityTypes ?? raw.entityType ?? type, limits)
  const tags = normalizeTags(raw.tags ?? raw.tag, limits)
  const sort = normalizeSort(firstString(raw.sort))
  const limit = normalizeLimit(raw.limit, limits)
  const cursor = firstString(raw.cursor)
  if (cursor) decodeSearchCursor(cursor)

  return {
    query,
    normalizedQuery: query.toLowerCase(),
    entityTypes,
    tags,
    ownerId: firstString(raw.ownerId),
    accountId: firstString(raw.accountId),
    createdAfter: validDateString(raw.createdAfter, 'createdAfter'),
    createdBefore: validDateString(raw.createdBefore, 'createdBefore'),
    updatedAfter: validDateString(raw.updatedAfter, 'updatedAfter'),
    updatedBefore: validDateString(raw.updatedBefore, 'updatedBefore'),
    sort,
    limit,
    cursor,
  }
}

export function normalizeSearchQuery(value: string, limits: SearchLimits): string {
  const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim()
  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Search query contains forbidden control characters')
  }
  if (normalized.length < limits.minQueryLength || normalized.length > limits.maxQueryLength) {
    throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', `Search query must be ${limits.minQueryLength}-${limits.maxQueryLength} characters`)
  }
  return normalized
}

export function encodeSearchCursor(cursor: SearchCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeSearchCursor(cursor: string | undefined): SearchCursor | undefined {
  if (!cursor) return undefined
  if (!CURSOR_PATTERN.test(cursor)) throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Invalid search cursor')
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<SearchCursor>
    if (!parsed || typeof parsed !== 'object') throw new Error('bad cursor')
    if (!parsed.sort || !SORTS.has(parsed.sort)) throw new Error('bad sort')
    if (parsed.offset !== undefined) {
      if (!Number.isSafeInteger(parsed.offset) || parsed.offset < 0 || parsed.offset > 1_000_000) throw new Error('bad offset')
      return {sort: parsed.sort, offset: parsed.offset}
    }
    if (typeof parsed.updatedAt !== 'string' || Number.isNaN(Date.parse(parsed.updatedAt))) throw new Error('bad updatedAt')
    if (typeof parsed.documentId !== 'string' || parsed.documentId.length < 1 || parsed.documentId.length > 240) throw new Error('bad documentId')
    if (parsed.score !== undefined && (typeof parsed.score !== 'number' || !Number.isFinite(parsed.score))) throw new Error('bad score')
    return {
      sort: parsed.sort,
      score: parsed.score,
      updatedAt: new Date(parsed.updatedAt).toISOString(),
      documentId: parsed.documentId,
    }
  } catch {
    throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Invalid search cursor')
  }
}

export function filtersForPersistence(input: ParsedSearchRequest): Record<string, unknown> {
  return {
    entityTypes: input.entityTypes,
    tags: input.tags,
    ownerId: input.ownerId,
    accountId: input.accountId,
    createdAfter: input.createdAfter,
    createdBefore: input.createdBefore,
    updatedAfter: input.updatedAfter,
    updatedBefore: input.updatedBefore,
    sort: input.sort,
    limit: input.limit,
  }
}

export function searchValidation(searchCode: string, message: string): Error {
  return Object.assign(new Error(message), {
    code: 'VALIDATION_FAILED',
    searchCode,
  })
}

function normalizeEntityTypes(value: unknown, limits: SearchLimits): GreenfieldSearchEntityType[] {
  const values = valuesFromUnknown(value)
  const mapped = values.flatMap(item => {
    if (item === 'all') return ['post', 'profile', 'module', 'module-release', 'note', 'vault-folder'] satisfies GreenfieldSearchEntityType[]
    if (item === 'posts') return ['post'] satisfies GreenfieldSearchEntityType[]
    if (item === 'profiles') return ['profile'] satisfies GreenfieldSearchEntityType[]
    if (item === 'modules') return ['module', 'module-release'] satisfies GreenfieldSearchEntityType[]
    if (item === 'notes') return ['note', 'vault-folder'] satisfies GreenfieldSearchEntityType[]
    return [item]
  })
  const result = Array.from(new Set(mapped)).filter((item): item is GreenfieldSearchEntityType => ENTITY_TYPES.has(item as GreenfieldSearchEntityType))
  if (result.length === 0) return ['post', 'profile', 'module', 'module-release', 'note', 'vault-folder']
  if (result.length > limits.maxEntityTypes) throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Too many search entity types')
  if (result.length !== mapped.length) throw searchValidation('SEARCH_ENTITY_NOT_SUPPORTED', 'Unsupported search entity type')
  return result
}

function normalizeTags(value: unknown, limits: SearchLimits): string[] {
  const tags = Array.from(new Set(valuesFromUnknown(value).map(tag => tag.normalize('NFKC').replace(/^#/, '').toLowerCase()).filter(Boolean)))
  if (tags.length > limits.maxTags) throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Too many search tags')
  if (tags.some(tag => CONTROL_CHARACTER_PATTERN.test(tag) || tag.length > 80)) {
    throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Invalid search tag')
  }
  return tags
}

function normalizeSort(value: string | undefined): GreenfieldSearchSort {
  if (!value) return 'relevance'
  if (!SORTS.has(value as GreenfieldSearchSort)) throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Unsupported search sort')
  return value as GreenfieldSearchSort
}

function normalizeLimit(value: unknown, limits: SearchLimits): number {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = raw === undefined ? limits.defaultLimit : Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Invalid search limit')
  return Math.min(parsed, limits.maxLimit)
}

function validDateString(value: unknown, field: string): string | undefined {
  const text = firstString(value)
  if (!text) return undefined
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', `Invalid ${field}`)
  return date.toISOString()
}

function valuesFromUnknown(value: unknown): string[] {
  if (value === undefined || value === null) return []
  const raw = Array.isArray(value) ? value : [value]
  return raw
    .flatMap(item => String(item).split(','))
    .map(item => item.trim())
    .filter(Boolean)
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return undefined
}
