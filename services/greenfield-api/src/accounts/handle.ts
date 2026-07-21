import type {ModulaDb} from '../database/client.js'

/** 3–30 chars, lowercase, letters/numbers/single separators, no leading/trailing/consecutive separators. */
const HANDLE = /^[a-z0-9](?:[a-z0-9]|[._-](?![._-])){1,28}[a-z0-9]$|^[a-z0-9]{3}$/

export function canonicalHandle(value: string): string {
  return value.trim().toLowerCase()
}

export function validateHandle(value: string): string {
  const handle = canonicalHandle(value)
  if (handle.length < 3 || handle.length > 30 || !HANDLE.test(handle)) {
    throw Object.assign(
      new Error('Handle must be 3–30 lowercase characters with letters, numbers, and single separators'),
      {code: 'VALIDATION_FAILED'},
    )
  }
  if (/[._-]{2,}/.test(handle) || handle.startsWith('.') || handle.startsWith('_') || handle.startsWith('-')) {
    throw Object.assign(new Error('Handle separators are invalid'), {code: 'VALIDATION_FAILED'})
  }
  return handle
}

export async function assertHandleAvailable(db: ModulaDb, value: string): Promise<string> {
  const handle = validateHandle(value)
  const [claimed, reserved] = await Promise.all([
    db
      .selectFrom('greenfield_handles')
      .select('handle')
      .where('handle', '=', handle)
      .where('status', '=', 'active')
      .executeTakeFirst(),
    db.selectFrom('greenfield_reserved_handles').select('handle').where('handle', '=', handle).executeTakeFirst(),
  ])
  if (reserved) throw Object.assign(new Error('Handle is reserved'), {code: 'CONFLICT'})
  if (claimed) throw Object.assign(new Error('Handle is unavailable'), {code: 'CONFLICT'})
  return handle
}
