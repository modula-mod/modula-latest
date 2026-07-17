import {ATPROTO_INGEST_COLLECTIONS} from '@modula/atproto-lexicons'

export function validateImportedRecord(record: unknown): {ok: true} | {ok: false; code: string; message: string} {
  if (!record || typeof record !== 'object') {
    return {ok: false, code: 'VALIDATION_FAILED', message: 'Record must be an object'}
  }
  const typed = record as Record<string, unknown>
  const type = typed.$type
  if (typeof type !== 'string') {
    return {ok: false, code: 'VALIDATION_FAILED', message: 'Missing $type'}
  }
  if (!(ATPROTO_INGEST_COLLECTIONS as readonly string[]).includes(type)) {
    return {ok: false, code: 'UNSUPPORTED_RECORD_TYPE', message: `Unsupported collection ${type}`}
  }
  if (type.startsWith('digital.modula.temp') && typeof typed.createdAt !== 'string') {
    return {ok: false, code: 'INVALID_LEXICON_RECORD', message: 'createdAt required'}
  }
  return {ok: true}
}
