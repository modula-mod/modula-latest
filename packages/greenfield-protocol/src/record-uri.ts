/**
 * Greenfield record URI — not an AT URI.
 * Format: modula://<accountId>/<collection>/<recordId>
 */

const URI_PREFIX = 'modula://'

export type ParsedGreenfieldRecordUri = {
  accountId: string
  collection: string
  recordId: string
}

export function formatGreenfieldRecordUri(
  accountId: string,
  collection: string,
  recordId: string,
): string {
  if (!accountId || !collection || !recordId) {
    throw new Error('Greenfield record URI requires accountId, collection, and recordId')
  }
  if (accountId.includes('/') || collection.includes('/') || recordId.includes('/')) {
    throw new Error('Greenfield record URI segments must not contain "/"')
  }
  return `${URI_PREFIX}${accountId}/${collection}/${recordId}`
}

export function parseGreenfieldRecordUri(uri: string): ParsedGreenfieldRecordUri {
  if (!uri.startsWith(URI_PREFIX)) {
    throw new Error('Greenfield record URI must start with modula://')
  }
  const rest = uri.slice(URI_PREFIX.length)
  const parts = rest.split('/')
  if (parts.length !== 3 || parts.some(part => !part)) {
    throw new Error('Greenfield record URI must be modula://<accountId>/<collection>/<recordId>')
  }
  const [accountId, collection, recordId] = parts
  return {accountId, collection, recordId}
}

export function isGreenfieldRecordUri(value: string): boolean {
  try {
    parseGreenfieldRecordUri(value)
    return true
  } catch {
    return false
  }
}
