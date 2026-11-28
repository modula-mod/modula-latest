import {sql} from 'kysely'
import type {AppConfig} from '../config/index.js'
import {createDb, type ModulaDb} from '../database/client.js'
import {moduleError} from '../modules/module-errors.js'
import {GreenfieldPublisherSigningKeyService, parsePublisherPublicKey} from '../modules/release-signing.js'
import {appendSigningAudit} from './release-job-core.js'
import type {PublisherSigningIdentity, PublisherSigningProvider, PublisherSigningPurpose} from './signing-provider.js'

const MAX_IDENTITY_LIFETIME_MS = 397 * 24 * 60 * 60_000

/**
 * Operator-only lifecycle boundary for online identities. It is intentionally
 * not exposed through publisher routes: builders can list permitted public
 * identities, but cannot enroll, select, rotate or revoke provider keys.
 */
export class PublisherOnlineSigningIdentityService {
  private readonly signingKeys: GreenfieldPublisherSigningKeyService

  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
    private readonly provider: PublisherSigningProvider,
  ) {
    this.signingKeys = new GreenfieldPublisherSigningKeyService(db)
    if (provider.kind === 'DISPOSABLE_TEST' && config.nodeEnv !== 'test') {
      throw moduleError('FORBIDDEN', 'Disposable online signing identities are restricted to isolated test environments')
    }
  }

  async register(input: {
    actorAccountId: string
    publisherId: string
    signingKeyId: string
    providerKeyRef: string
    purpose: PublisherSigningPurpose
    firstPartyAuthorized: boolean
    validFrom?: Date
    validUntil: Date
  }): Promise<PublisherSigningIdentity> {
    await this.requireOperator(input.actorAccountId)
    const now = new Date()
    const validFrom = input.validFrom ?? now
    this.assertValidity(validFrom, input.validUntil)
    await this.assertPurpose(input.publisherId, input.purpose, input.firstPartyAuthorized)
    const authorityUrl = this.requireDedicatedAuthorityUrl()
    const pendingIdentity: PublisherSigningIdentity = {
      identityId: 'psi_00000000-0000-0000-0000-000000000000',
      publisherId: input.publisherId,
      signingKeyId: input.signingKeyId,
      provider: this.provider.kind,
      providerKeyRef: input.providerKeyRef,
      purpose: input.purpose,
      state: 'ACTIVE',
      firstPartyAuthorized: input.firstPartyAuthorized,
      validFrom,
      validUntil: input.validUntil,
    }
    const providerPublicKey = await this.provider.getPublicKey(pendingIdentity)
    let publicKey: ReturnType<typeof parsePublisherPublicKey>
    try {
      publicKey = parsePublisherPublicKey(providerPublicKey.publicKeyPem)
    } catch {
      throw moduleError('CAPABILITY_UNAVAILABLE', 'Signing provider returned an invalid public key')
    }
    if (publicKey.fingerprint !== providerPublicKey.fingerprint) {
      throw moduleError('CAPABILITY_UNAVAILABLE', 'Signing provider public key metadata is inconsistent')
    }

    const identityId = await this.registerThroughAuthority(authorityUrl, {
      ...input,
      validFrom,
      publicKeyPem: publicKey.publicKeyPem,
      fingerprint: publicKey.fingerprint,
      providerKeyVersion: providerPublicKey.providerKeyVersion,
    })
    return {...pendingIdentity, identityId}
  }

  async suspend(actorAccountId: string, identityId: string, reason: string): Promise<void> {
    await this.requireOperator(actorAccountId)
    const identity = await this.load(identityId)
    if (identity.state !== 'ACTIVE') throw moduleError('CONFLICT', 'Only an active online signing identity can be suspended')
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_publisher_online_signing_identities').set({
        state: 'SUSPENDED', suspended_at: now, suspension_reason: cleanReason(reason), updated_at: now,
      }).where('identity_id', '=', identityId).where('state', '=', 'ACTIVE').executeTakeFirstOrThrow()
      await appendSigningAudit(trx, {eventType: 'identity_suspended', identityId, publisherId: identity.publisherId,
        actorAccountId, details: {reason: cleanReason(reason), signingKeyId: identity.signingKeyId}})
    })
  }

  async resume(actorAccountId: string, identityId: string): Promise<void> {
    await this.requireOperator(actorAccountId)
    const identity = await this.load(identityId)
    if (identity.state !== 'SUSPENDED' || identity.validUntil <= new Date()) throw moduleError('CONFLICT', 'Only a non-expired suspended identity can be resumed')
    const key = await this.signingKeys.get(identity.signingKeyId)
    if (key.state !== 'ACTIVE' || (await this.provider.getKeyState(identity)).state !== 'ACTIVE') {
      throw moduleError('CONFLICT', 'The registry and provider key must both be active before resuming')
    }
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_publisher_online_signing_identities').set({
        state: 'ACTIVE', suspended_at: null, suspension_reason: null, updated_at: now,
      }).where('identity_id', '=', identityId).where('state', '=', 'SUSPENDED').executeTakeFirstOrThrow()
      await appendSigningAudit(trx, {eventType: 'identity_resumed', identityId, publisherId: identity.publisherId,
        actorAccountId, details: {signingKeyId: identity.signingKeyId}})
    })
  }

  async rotate(actorAccountId: string, identityId: string, newSigningKeyId: string, validUntil: Date): Promise<PublisherSigningIdentity> {
    await this.requireOperator(actorAccountId)
    const identity = await this.load(identityId)
    if (identity.state !== 'ACTIVE') throw moduleError('CONFLICT', 'Only an active online signing identity can be rotated')
    const now = new Date()
    this.assertValidity(now, validUntil)
    const authorityUrl = this.requireDedicatedAuthorityUrl()
    const rotated = await this.provider.rotateKey(identity)
    // Provider rotation happens first. Until the public registry binding below
    // succeeds, the old binding mismatches and signing therefore fails closed.
    let publicKey: ReturnType<typeof parsePublisherPublicKey>
    try {
      publicKey = parsePublisherPublicKey(rotated.publicKeyPem)
    } catch {
      throw moduleError('CAPABILITY_UNAVAILABLE', 'Signing provider returned an invalid rotated public key')
    }
    if (publicKey.fingerprint !== rotated.fingerprint) {
      throw moduleError('CAPABILITY_UNAVAILABLE', 'Signing provider rotated public key metadata is inconsistent')
    }
    const newIdentityId = await this.rotateThroughAuthority(authorityUrl, {
      identityId,
      signingKeyId: newSigningKeyId,
      publicKeyPem: publicKey.publicKeyPem,
      fingerprint: publicKey.fingerprint,
      providerKeyRef: rotated.providerKeyRef,
      validFrom: now,
      validUntil,
      providerKeyVersion: rotated.providerKeyVersion,
    })
    return {
      ...identity,
      identityId: newIdentityId,
      signingKeyId: newSigningKeyId,
      providerKeyRef: rotated.providerKeyRef,
      validFrom: now,
      validUntil,
    }
  }

  async revoke(actorAccountId: string, identityId: string, reason: string) {
    await this.requireOperator(actorAccountId)
    const identity = await this.load(identityId)
    const text = cleanReason(reason)
    const authorityUrl = this.requireDedicatedAuthorityUrl()
    // Public registry revocation is authoritative and happens before the
    // provider control. A provider outage cannot leave releases authorized.
    await this.revokeThroughAuthority(authorityUrl, identityId, text)
    return this.provider.revokeKey(identity, text)
  }

  private async load(identityId: string): Promise<PublisherSigningIdentity> {
    const row = await this.db.selectFrom('greenfield_publisher_online_signing_identities').selectAll()
      .where('identity_id', '=', identityId).executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'Online signing identity not found')
    if (row.provider !== this.provider.kind) throw moduleError('CONFLICT', 'Online signing identity belongs to a different provider')
    return {
      identityId: row.identity_id, publisherId: row.publisher_id, signingKeyId: row.signing_key_id,
      provider: row.provider, providerKeyRef: row.provider_key_ref, purpose: row.purpose, state: row.state,
      firstPartyAuthorized: row.first_party_authorized, validFrom: row.valid_from, validUntil: row.valid_until,
    }
  }

  private async requireOperator(accountId: string): Promise<void> {
    const account = await this.db.selectFrom('greenfield_accounts').select('primary_handle').where('account_id', '=', accountId).executeTakeFirst()
    if (!account || !this.config.adminHandles.includes(account.primary_handle.toLowerCase())) {
      throw moduleError('FORBIDDEN', 'Online signing identity administration requires registry operator authority')
    }
  }

  private async assertPurpose(publisherId: string, purpose: PublisherSigningPurpose, firstPartyAuthorized: boolean): Promise<void> {
    const publisher = await this.db.selectFrom('greenfield_publishers').select(['status', 'trust_level', 'revoked_at'])
      .where('publisher_id', '=', publisherId).executeTakeFirst()
    if (!publisher) throw moduleError('NOT_FOUND', 'Publisher not found')
    if (publisher.status !== 'verified' || publisher.revoked_at) {
      throw moduleError('FORBIDDEN', 'Online signing identity enrollment requires an active verified publisher')
    }
    if (purpose === 'PUBLISHER' && !firstPartyAuthorized) return
    const namespace = await this.db.selectFrom('greenfield_publisher_namespaces').select('namespace')
      .where('publisher_id', '=', publisherId).where('verified_at', 'is not', null).where('revoked_at', 'is', null)
      .executeTakeFirst()
    if (purpose !== 'MODULA_FIRST_PARTY' || !firstPartyAuthorized
      || publisher.trust_level !== 'firstParty' || !namespace) {
      throw moduleError('FORBIDDEN', 'First-party online signing identity enrollment requires explicit authoritative first-party policy')
    }
  }

  private requireDedicatedAuthorityUrl(): string {
    const authorityUrl = this.config.signingIdentityAuthorityDatabaseUrl?.trim()
    if (!authorityUrl) {
      throw moduleError('CAPABILITY_UNAVAILABLE', 'Signing identity authority is not configured')
    }
    if (sameDatabasePrincipal(authorityUrl, this.config.databaseUrl)) {
      throw moduleError('CAPABILITY_UNAVAILABLE', 'Signing identity authority requires dedicated database credentials')
    }
    return authorityUrl
  }

  private async registerThroughAuthority(authorityUrl: string, input: {
    publisherId: string
    signingKeyId: string
    providerKeyRef: string
    purpose: PublisherSigningPurpose
    firstPartyAuthorized: boolean
    validFrom: Date
    validUntil: Date
    publicKeyPem: string
    fingerprint: string
    providerKeyVersion: number | null
  }): Promise<string> {
    return this.withAuthority(authorityUrl, async authorityDb => {
      const result = await sql<{identity_id: string}>`
        SELECT greenfield_signing_identity_authority_register(
          ${input.publisherId}, ${input.signingKeyId}, ${input.publicKeyPem}, ${input.fingerprint},
          ${this.provider.kind}, ${input.providerKeyRef}, ${input.purpose}, ${input.firstPartyAuthorized},
          ${input.validFrom}, ${input.validUntil}, ${input.providerKeyVersion === null ? null : String(input.providerKeyVersion)}
        ) AS identity_id
      `.execute(authorityDb)
      const identityId = result.rows[0]?.identity_id
      if (!identityId?.startsWith('psi_')) throw new Error('Signing identity authority returned no identity')
      return identityId
    })
  }

  private async rotateThroughAuthority(authorityUrl: string, input: {
    identityId: string
    signingKeyId: string
    publicKeyPem: string
    fingerprint: string
    providerKeyRef: string
    validFrom: Date
    validUntil: Date
    providerKeyVersion: number | null
  }): Promise<string> {
    return this.withAuthority(authorityUrl, async authorityDb => {
      const result = await sql<{identity_id: string}>`
        SELECT greenfield_signing_identity_authority_rotate(
          ${input.identityId}, ${input.signingKeyId}, ${input.publicKeyPem}, ${input.fingerprint},
          ${input.providerKeyRef}, ${input.validFrom}, ${input.validUntil},
          ${input.providerKeyVersion === null ? null : String(input.providerKeyVersion)}
        ) AS identity_id
      `.execute(authorityDb)
      const identityId = result.rows[0]?.identity_id
      if (!identityId?.startsWith('psi_')) throw new Error('Signing identity authority returned no rotated identity')
      return identityId
    })
  }

  private async revokeThroughAuthority(authorityUrl: string, identityId: string, reason: string): Promise<void> {
    await this.withAuthority(authorityUrl, async authorityDb => {
      const result = await sql<{identity_id: string}>`
        SELECT greenfield_signing_identity_authority_revoke(${identityId}, ${reason}) AS identity_id
      `.execute(authorityDb)
      if (result.rows[0]?.identity_id !== identityId) throw new Error('Signing identity authority returned an inconsistent identity')
    })
  }

  private async withAuthority<T>(authorityUrl: string, operation: (authorityDb: ModulaDb) => Promise<T>): Promise<T> {
    let authorityDb: ModulaDb | null = null
    let failed = false
    try {
      authorityDb = createDb(authorityUrl, undefined, {max: 1, applicationName: 'modula-signing-identity-authority'})
      return await operation(authorityDb)
    } catch (error) {
      failed = true
      throw signingIdentityAuthorityError(error)
    } finally {
      if (authorityDb) {
        try {
          await authorityDb.destroy()
        } catch {
          if (!failed) throw moduleError('CAPABILITY_UNAVAILABLE', 'Signing identity authority connection could not be released')
        }
      }
    }
  }

  private assertValidity(validFrom: Date, validUntil: Date): void {
    if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime()) || validUntil <= validFrom
      || validUntil.getTime() - validFrom.getTime() > MAX_IDENTITY_LIFETIME_MS) {
      throw moduleError('VALIDATION_FAILED', 'Online signing identity validity must be positive and no longer than 397 days')
    }
  }
}

function cleanReason(reason: string): string {
  const text = String(reason ?? '').trim().replace(/[\r\n\t]+/g, ' ').slice(0, 500)
  if (!text) throw moduleError('VALIDATION_FAILED', 'A signing identity lifecycle reason is required')
  return text
}

function sameDatabasePrincipal(left: string, right: string): boolean {
  const leftPrincipal = databasePrincipal(left)
  const rightPrincipal = databasePrincipal(right)
  // A non-URL connection string cannot be compared safely. Registration is a
  // rare control-plane operation, so ambiguous credential separation fails closed.
  return !leftPrincipal || !rightPrincipal || leftPrincipal === rightPrincipal
}

function databasePrincipal(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return null
    return [
      url.hostname.toLowerCase(),
      effectivePort(url),
      url.pathname,
      decodeURIComponent(url.username),
    ].join('\n')
  } catch {
    return null
  }
}

function effectivePort(url: URL): string {
  return url.port || (url.protocol === 'postgres:' || url.protocol === 'postgresql:' ? '5432' : '')
}

function signingIdentityAuthorityError(error: unknown): Error {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as {code?: unknown}).code ?? '')
    : ''
  if (code === '23505') return moduleError('CONFLICT', 'Signing key ID, public key, provider key, or active identity conflicts with an existing identity')
  if (code === '23503' || code === 'P0002') return moduleError('NOT_FOUND', 'Signing identity lifecycle target was not found')
  if (code === '22023' || code === '23514' || code === '22P02') {
    return moduleError('VALIDATION_FAILED', 'Signing identity lifecycle facts are invalid')
  }
  if (code === '42501') return moduleError('FORBIDDEN', 'Signing identity lifecycle operation was rejected by authoritative publisher policy')
  return moduleError('CAPABILITY_UNAVAILABLE', 'Signing identity authority is unavailable')
}
