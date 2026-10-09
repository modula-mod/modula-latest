import {createHash, createPrivateKey, createPublicKey, randomUUID, verify, type KeyObject} from 'node:crypto'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {manifestChecksum, type GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import type {ModulaDb} from '../database/client.js'
import {moduleError} from './module-errors.js'

/**
 * Modula publisher release signing protocol, v1.
 *
 * One protocol for first and third parties. The publisher signs, with its own
 * Ed25519 private key (CI secret or KMS; never given to the registry), the
 * canonical JSON (`canonicalJsonStringify`, the same canonicalisation the
 * build-coordinator signed statements use) of the statement below. The
 * signature is the raw 64-byte Ed25519 signature encoded as base64url
 * (86 characters, no padding), matching `integrity.signature` and the
 * `greenfield_module_release_signatures.signature` column.
 *
 * The registry never accepts a statement from the publisher: it rebuilds the
 * statement from facts it verified itself (release row, stored adapter
 * manifest, artifact digest from provenance, product-manifest and frontend
 * digests) and checks the signature over that.
 */
export const PUBLISHER_RELEASE_STATEMENT_TYPE = 'modula.publisher-release.v1'

export type PublisherReleaseStatement = {
  schemaVersion: '1.0.0'
  statementType: typeof PUBLISHER_RELEASE_STATEMENT_TYPE
  productId: string
  version: string
  publisherId: string
  sourceRepository: string
  sourceSha: string
  releaseTag: string | null
  artifactSha256: string
  /** manifestChecksum of the adapter manifest with manifestSha256 blank and the signature fields removed. */
  manifestSha256: string
  /** sha256 of the exact modula.product.json bytes, or null for a release without MPS. */
  productManifestSha256: string | null
  /** sha256 of the exact frontend artifact bytes, or null when there is no frontend artifact. */
  frontendSha256: string | null
  signingKeyId: string
}

export type ReleaseSignatureInput = {algorithm?: string; keyId: string; value: string}

export type SignatureVerificationState = 'verified' | 'invalid' | 'unknownKey' | 'revokedKey'

export type SignatureVerificationResult = {
  state: SignatureVerificationState
  detail: string
  keyId: string
  publicKeyFingerprint: string | null
  statement: PublisherReleaseStatement
  statementSha256: string
}

const KEY_ID = /^[A-Za-z0-9._:-]{3,160}$/
const SIGNATURE = /^[A-Za-z0-9_-]{86}$/
const SHA256 = /^[0-9a-f]{64}$/

/** Adapter manifest digest used by the statement: excludes the checksum and the signature itself (no circularity). */
export function signingManifestDigest(manifest: GreenfieldModuleManifest): string {
  const integrity: Record<string, unknown> = {...manifest.integrity, manifestSha256: ''}
  delete integrity.signature
  delete integrity.signatureKeyId
  return manifestChecksum({...manifest, integrity} as GreenfieldModuleManifest)
}

export function buildPublisherReleaseStatement(input: {
  manifest: GreenfieldModuleManifest
  sourceSha: string
  artifactSha256: string
  productManifestSha256?: string | null
  frontendSha256?: string | null
  signingKeyId: string
}): PublisherReleaseStatement {
  const productManifestSha256 = input.productManifestSha256 ?? null
  const frontendSha256 = input.frontendSha256 ?? null
  for (const [label, value] of [['artifactSha256', input.artifactSha256], ['productManifestSha256', productManifestSha256], ['frontendSha256', frontendSha256]] as const) {
    if (value !== null && !SHA256.test(value)) throw moduleError('VALIDATION_FAILED', `Signed statement ${label} must be a lowercase SHA-256`)
  }
  return {
    schemaVersion: '1.0.0',
    statementType: PUBLISHER_RELEASE_STATEMENT_TYPE,
    productId: input.manifest.moduleId,
    version: input.manifest.version,
    publisherId: input.manifest.publisher.publisherId,
    sourceRepository: input.manifest.source.repository,
    sourceSha: input.sourceSha,
    releaseTag: input.manifest.source.releaseTag ?? null,
    artifactSha256: input.artifactSha256,
    manifestSha256: signingManifestDigest(input.manifest),
    productManifestSha256,
    frontendSha256,
    signingKeyId: input.signingKeyId,
  }
}

export function statementBytes(statement: PublisherReleaseStatement): Buffer {
  return Buffer.from(canonicalJsonStringify(statement), 'utf8')
}

export function statementSha256(statement: PublisherReleaseStatement): string {
  return createHash('sha256').update(statementBytes(statement)).digest('hex')
}

export function normalizeSignatureInput(value: unknown): ReleaseSignatureInput | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) throw moduleError('VALIDATION_FAILED', 'Release signature must be an object')
  const record = value as Record<string, unknown>
  const algorithm = record.algorithm === undefined ? 'Ed25519' : record.algorithm
  if (algorithm !== 'Ed25519') throw moduleError('VALIDATION_FAILED', 'Only Ed25519 release signatures are accepted')
  if (typeof record.keyId !== 'string' || !KEY_ID.test(record.keyId)) throw moduleError('VALIDATION_FAILED', 'Release signature key ID is malformed')
  if (typeof record.value !== 'string' || !SIGNATURE.test(record.value)) throw moduleError('VALIDATION_FAILED', 'Release signature is not a canonical Ed25519 base64url value')
  return {algorithm: 'Ed25519', keyId: record.keyId, value: record.value}
}

/** Parses a public key, refusing private keys and anything that is not Ed25519. Returns the SPKI PEM and fingerprint. */
export function parsePublisherPublicKey(input: unknown): {publicKeyPem: string; fingerprint: string; key: KeyObject} {
  if (typeof input !== 'string' || !input.trim() || input.length > 4096) throw moduleError('VALIDATION_FAILED', 'An Ed25519 SPKI PEM public key is required')
  if (/PRIVATE KEY/.test(input)) throw moduleError('VALIDATION_FAILED', 'Private keys are never accepted; register the public key only')
  let isPrivate = false
  try { createPrivateKey(input); isPrivate = true } catch { /* expected for a public key */ }
  if (isPrivate) throw moduleError('VALIDATION_FAILED', 'Private keys are never accepted; register the public key only')
  let key: KeyObject
  try { key = createPublicKey(input) } catch { throw moduleError('VALIDATION_FAILED', 'Invalid public key') }
  if (key.asymmetricKeyType !== 'ed25519') throw moduleError('VALIDATION_FAILED', 'Publisher signing keys must be Ed25519')
  const der = key.export({format: 'der', type: 'spki'})
  const publicKeyPem = key.export({format: 'pem', type: 'spki'}).toString()
  return {publicKeyPem, fingerprint: `sha256:${createHash('sha256').update(der).digest('hex')}`, key}
}

export class GreenfieldPublisherSigningKeyService {
  constructor(private readonly db: ModulaDb) {}

  async register(publisherId: string, input: {keyId?: unknown; publicKeyPem?: unknown; validFrom?: unknown; validUntil?: unknown; rotatesKeyId?: unknown}, actorAccountId: string | null) {
    const keyId = typeof input.keyId === 'string' ? input.keyId.trim() : ''
    if (!KEY_ID.test(keyId)) throw moduleError('VALIDATION_FAILED', 'Signing key ID is malformed')
    const publisher = await this.db.selectFrom('greenfield_publishers').select(['publisher_id']).where('publisher_id', '=', publisherId).executeTakeFirst()
    if (!publisher) throw moduleError('NOT_FOUND', 'Publisher not found')
    const parsed = parsePublisherPublicKey(input.publicKeyPem)
    const now = new Date()
    const validFrom = optionalDate(input.validFrom, 'validFrom') ?? now
    const validUntil = optionalDate(input.validUntil, 'validUntil')
    if (validUntil && validUntil <= validFrom) throw moduleError('VALIDATION_FAILED', 'validUntil must be after validFrom')
    const rotatesKeyId = typeof input.rotatesKeyId === 'string' && input.rotatesKeyId ? input.rotatesKeyId : null
    const existing = await this.db.selectFrom('greenfield_publisher_signing_keys').select(['key_id', 'fingerprint', 'publisher_id']).where(eb => eb.or([eb('key_id', '=', keyId), eb('fingerprint', '=', parsed.fingerprint)])).execute()
    if (existing.length) throw moduleError('CONFLICT', 'Signing key ID or public key is already registered')
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_publisher_signing_keys').values({
        key_id: keyId, publisher_id: publisherId, algorithm: 'Ed25519', public_key_pem: parsed.publicKeyPem, fingerprint: parsed.fingerprint,
        state: 'ACTIVE', valid_from: validFrom, valid_until: validUntil, rotated_at: null, rotated_to_key_id: null, revoked_at: null,
        revocation_reason: null, registered_by_account_id: actorAccountId, created_at: now, updated_at: now,
      }).execute()
      await trx.insertInto('greenfield_publisher_signing_key_events').values({event_id: randomUUID(), key_id: keyId, publisher_id: publisherId, event_type: 'registered', related_key_id: rotatesKeyId, reason: null, actor_account_id: actorAccountId, created_at: now}).execute()
      if (rotatesKeyId) {
        const previous = await trx.selectFrom('greenfield_publisher_signing_keys').select(['key_id', 'state', 'publisher_id']).where('key_id', '=', rotatesKeyId).forUpdate().executeTakeFirst()
        if (!previous || previous.publisher_id !== publisherId) throw moduleError('NOT_FOUND', 'Rotated key not found for this publisher')
        if (previous.state !== 'ACTIVE') throw moduleError('CONFLICT', 'Only an active key can be rotated')
        await trx.updateTable('greenfield_publisher_signing_keys').set({state: 'ROTATED', rotated_at: now, rotated_to_key_id: keyId, updated_at: now}).where('key_id', '=', rotatesKeyId).execute()
        await trx.insertInto('greenfield_publisher_signing_key_events').values({event_id: randomUUID(), key_id: rotatesKeyId, publisher_id: publisherId, event_type: 'rotated', related_key_id: keyId, reason: null, actor_account_id: actorAccountId, created_at: now}).execute()
      }
    })
    return this.get(keyId)
  }

  async revoke(publisherId: string, keyId: string, reason: unknown, actorAccountId: string | null) {
    const text = typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : 'publisher key revoked'
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      const key = await trx.selectFrom('greenfield_publisher_signing_keys').select(['key_id', 'state', 'publisher_id']).where('key_id', '=', keyId).forUpdate().executeTakeFirst()
      if (!key || key.publisher_id !== publisherId) throw moduleError('NOT_FOUND', 'Signing key not found')
      if (key.state === 'REVOKED') return
      await trx.updateTable('greenfield_publisher_signing_keys').set({state: 'REVOKED', revoked_at: now, revocation_reason: text, updated_at: now}).where('key_id', '=', keyId).execute()
      await trx.insertInto('greenfield_publisher_signing_key_events').values({event_id: randomUUID(), key_id: keyId, publisher_id: publisherId, event_type: 'revoked', related_key_id: null, reason: text, actor_account_id: actorAccountId, created_at: now}).execute()
      await trx.insertInto('greenfield_module_revocations').values({revocation_id: `revocation:signingKey:${keyId}:${now.getTime()}`, scope: 'signingKey', target_id: keyId, reason: text, created_by: actorAccountId, created_at: now}).execute()
      // Signatures made with this key no longer establish trust. Rows are kept as evidence.
      await trx.updateTable('greenfield_module_release_signatures')
        .set({verification_state: 'revokedKey', revoked_at: now, verification_detail: `Signing key revoked: ${text}`})
        .where('signature_key_id', '=', keyId)
        .where('revoked_at', 'is', null)
        .execute()
    })
    return this.get(keyId)
  }

  async get(keyId: string) {
    const row = await this.db.selectFrom('greenfield_publisher_signing_keys').selectAll().where('key_id', '=', keyId).executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'Signing key not found')
    return publicKeyView(row)
  }

  async listForPublisher(publisherId: string) {
    const [keys, events] = await Promise.all([
      this.db.selectFrom('greenfield_publisher_signing_keys').selectAll().where('publisher_id', '=', publisherId).orderBy('created_at').execute(),
      this.db.selectFrom('greenfield_publisher_signing_key_events').selectAll().where('publisher_id', '=', publisherId).orderBy('created_at').execute(),
    ])
    return {
      publisherId,
      protocol: {statementType: PUBLISHER_RELEASE_STATEMENT_TYPE, algorithm: 'Ed25519', canonicalization: 'modula-canonical-json', signatureEncoding: 'base64url'},
      keys: keys.map(publicKeyView),
      history: events.map(event => ({keyId: event.key_id, eventType: event.event_type, relatedKeyId: event.related_key_id, reason: event.reason, at: event.created_at.toISOString()})),
    }
  }

  /** Verifies a signature over the registry-rebuilt statement at `observedAt` (the time the registry first saw it). */
  async verify(statement: PublisherReleaseStatement, signature: ReleaseSignatureInput, observedAt: Date, lockKey = false): Promise<SignatureVerificationResult> {
    const base = {keyId: signature.keyId, statement, statementSha256: statementSha256(statement)}
    const keyQuery = this.db.selectFrom('greenfield_publisher_signing_keys').selectAll().where('key_id', '=', signature.keyId)
    const key = await (lockKey ? keyQuery.forShare() : keyQuery).executeTakeFirst()
    if (!key) return {...base, state: 'unknownKey', detail: 'No registered public key has this key ID', publicKeyFingerprint: null}
    const fingerprint = key.fingerprint
    if (key.publisher_id !== statement.publisherId) return {...base, state: 'unknownKey', detail: 'The key is registered to a different publisher', publicKeyFingerprint: fingerprint}
    if (key.state === 'REVOKED' || key.revoked_at) return {...base, state: 'revokedKey', detail: `Signing key revoked${key.revocation_reason ? `: ${key.revocation_reason}` : ''}`, publicKeyFingerprint: fingerprint}
    if (observedAt < key.valid_from || (key.valid_until && observedAt > key.valid_until)) return {...base, state: 'invalid', detail: 'Signature observed outside the key validity window', publicKeyFingerprint: fingerprint}
    if (key.state === 'ROTATED' && key.rotated_at && observedAt > key.rotated_at) return {...base, state: 'invalid', detail: 'Signing key was rotated before this signature was observed', publicKeyFingerprint: fingerprint}
    let ok = false
    try { ok = verify(null, statementBytes(statement), createPublicKey(key.public_key_pem), Buffer.from(signature.value, 'base64url')) } catch { ok = false }
    return ok
      ? {...base, state: 'verified', detail: 'Ed25519 signature verified against the registered publisher key', publicKeyFingerprint: fingerprint}
      : {...base, state: 'invalid', detail: 'Ed25519 signature does not match the registry-verified release statement', publicKeyFingerprint: fingerprint}
  }
}

function publicKeyView(row: {key_id: string; publisher_id: string; algorithm: string; public_key_pem: string; fingerprint: string; state: string; valid_from: Date; valid_until: Date | null; rotated_at: Date | null; rotated_to_key_id: string | null; revoked_at: Date | null; revocation_reason: string | null; created_at: Date}) {
  return {
    keyId: row.key_id,
    publisherId: row.publisher_id,
    algorithm: row.algorithm,
    publicKeyPem: row.public_key_pem,
    fingerprint: row.fingerprint,
    state: row.state,
    validFrom: row.valid_from.toISOString(),
    validUntil: row.valid_until?.toISOString() ?? null,
    rotatedAt: row.rotated_at?.toISOString() ?? null,
    rotatedToKeyId: row.rotated_to_key_id,
    revokedAt: row.revoked_at?.toISOString() ?? null,
    revocationReason: row.revocation_reason,
    registeredAt: row.created_at.toISOString(),
  }
}

function optionalDate(value: unknown, label: string): Date | null {
  if (value === undefined || value === null || value === '') return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw moduleError('VALIDATION_FAILED', `${label} must be an ISO timestamp`)
  return date
}
