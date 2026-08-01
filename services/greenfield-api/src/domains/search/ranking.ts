import type {GreenfieldSearchEntityType, SearchDocumentRow} from './contracts.js'

export function entityRankingWeight(entityType: GreenfieldSearchEntityType): number {
  if (entityType === 'profile') return 9
  if (entityType === 'module') return 7
  if (entityType === 'module-release') return 5
  return 3
}

export function matchedFieldsFor(row: SearchDocumentRow, normalizedQuery: string, tags: string[]): string[] {
  const fields = new Set<string>()
  const query = normalizedQuery.toLowerCase()
  if (contains(row.title, query)) fields.add('title')
  if (contains(row.summary, query)) fields.add('summary')
  if (contains(row.body, query)) fields.add('body')
  if (row.keywords.some(keyword => keyword.toLowerCase().includes(query))) fields.add('keywords')
  if (row.tags.some(tag => tag.toLowerCase().includes(query) || tags.includes(tag.toLowerCase()))) fields.add('tags')
  const handle = typeof row.metadata.handle === 'string' ? row.metadata.handle.toLowerCase() : ''
  if (row.entityType === 'profile' && handle && (handle === query.replace(/^@/, '') || handle.startsWith(query.replace(/^@/, '')))) {
    fields.add('handle')
  }
  return Array.from(fields)
}

export function excerptFor(row: SearchDocumentRow, normalizedQuery: string): string | undefined {
  const source = row.summary || row.body || row.title || ''
  if (!source) return undefined
  const lower = source.toLowerCase()
  const query = normalizedQuery.toLowerCase().replace(/^@/, '')
  const index = query ? lower.indexOf(query) : -1
  if (index < 0) return truncate(source, 180)
  const start = Math.max(0, index - 60)
  const end = Math.min(source.length, index + query.length + 90)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < source.length ? '...' : ''
  return `${prefix}${source.slice(start, end).trim()}${suffix}`
}

function contains(value: string | null | undefined, query: string): boolean {
  return Boolean(value && value.toLowerCase().includes(query))
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 3).trim()}...`
}
