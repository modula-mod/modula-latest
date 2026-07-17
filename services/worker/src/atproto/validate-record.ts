import {findForbiddenFields, isIngestableCollection, isModulaLexiconNsid} from '@modula/atproto-lexicons'
import {PermanentJobError} from '../jobs/errors.js'

/**
 * Validates a record Modula is about to publish to a user's PDS. Runs before
 * any network call — an invalid record is a permanent error (never retried),
 * since retrying won't make the shape valid.
 */
export function validateOutgoingRecord(collection: string, record: unknown): void {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new PermanentJobError('VALIDATION_FAILED', `Record for ${collection} must be a JSON object`)
  }

  if (collection.startsWith('digital.modula.temp.') && !isModulaLexiconNsid(collection)) {
    throw new PermanentJobError('INVALID_LEXICON', `Unknown Modula lexicon collection: ${collection}`)
  }

  const forbiddenHits = findForbiddenFields(record)
  if (forbiddenHits.length > 0) {
    throw new PermanentJobError(
      'INVALID_LEXICON',
      `Record for ${collection} contains forbidden private field(s): ${forbiddenHits.join(', ')}`,
    )
  }
}

/**
 * Validates a record Modula is about to ingest (read) from a connected
 * actor's own PDS. Ingestion is selective by design — only known,
 * allow-listed collections are ever written into atproto_records.
 */
export function validateIngestedRecord(
  collection: string,
  record: unknown,
): {ok: true} | {ok: false; code: string; message: string} {
  if (!isIngestableCollection(collection)) {
    return {ok: false, code: 'UNSUPPORTED_RECORD_TYPE', message: `Collection not allow-listed for ingest: ${collection}`}
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return {ok: false, code: 'VALIDATION_FAILED', message: 'Ingested record must be a JSON object'}
  }
  const forbiddenHits = findForbiddenFields(record)
  if (forbiddenHits.length > 0) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: `Ingested record contains forbidden private field(s): ${forbiddenHits.join(', ')}`,
    }
  }
  return {ok: true}
}
