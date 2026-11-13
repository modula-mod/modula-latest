import {randomUUID} from 'node:crypto'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {moduleError} from '../modules/module-errors.js'
import {GreenfieldPublisherSigningKeyService} from '../modules/release-signing.js'
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
    const identity: PublisherSigningIdentity = {
      identityId: `psi_${randomUUID()}`,
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
    const publicKey = await this.provider.getPublicKey(identity)
    await this.signingKeys.register(input.publisherId, {
      keyId: input.signingKeyId,
      publicKeyPem: publicKey.publicKeyPem,
      validFrom: validFrom.toISOString(),
      validUntil: input.validUntil.toISOString(),
    }, input.actorAccountId)
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_publisher_online_signing_identities').values({
        identity_id: identity.identityId,
        publisher_id: input.publisherId,
        signing_key_id: input.signingKeyId,
        provider: this.provider.kind,
        provider_key_ref: input.providerKeyRef,
        purpose: input.purpose,
        state: 'ACTIVE',
        first_party_authorized: input.firstPartyAuthorized,
        valid_from: validFrom,
        valid_until: input.validUntil,
        suspended_at: null,
        suspension_reason: null,
        revoked_at: null,
        revocation_reason: null,
        created_by_account_id: input.actorAccountId,
        created_at: now,
        updated_at: now,
      }).execute()
      await appendSigningAudit(trx, {
        eventType: 'identity_registered', identityId: identity.identityId, publisherId: input.publisherId,
        actorAccountId: input.actorAccountId, details: {
          signingKeyId: input.signingKeyId, provider: this.provider.kind, purpose: input.purpose,
          publicKeyFingerprint: publicKey.fingerprint, providerKeyVersion: publicKey.providerKeyVersion,
        },
      })
    })
    return identity
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
    const rotated = await this.provider.rotateKey(identity)
    // Provider rotation happens first. Until the public registry binding below
    // succeeds, the old binding mismatches and signing therefore fails closed.
    await this.signingKeys.register(identity.publisherId, {
      keyId: newSigningKeyId,
      publicKeyPem: rotated.publicKeyPem,
      validFrom: now.toISOString(),
      validUntil: validUntil.toISOString(),
      rotatesKeyId: identity.signingKeyId,
    }, actorAccountId)
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_publisher_online_signing_identities').set({
        signing_key_id: newSigningKeyId,
        provider_key_ref: rotated.providerKeyRef,
        valid_from: now,
        valid_until: validUntil,
        updated_at: now,
      }).where('identity_id', '=', identityId).where('state', '=', 'ACTIVE').executeTakeFirstOrThrow()
      await appendSigningAudit(trx, {eventType: 'identity_rotated', identityId, publisherId: identity.publisherId,
        actorAccountId, details: {
          previousSigningKeyId: identity.signingKeyId, signingKeyId: newSigningKeyId,
          publicKeyFingerprint: rotated.fingerprint, providerKeyVersion: rotated.providerKeyVersion,
        }})
    })
    return {...identity, signingKeyId: newSigningKeyId, providerKeyRef: rotated.providerKeyRef, validFrom: now, validUntil}
  }

  async revoke(actorAccountId: string, identityId: string, reason: string) {
    await this.requireOperator(actorAccountId)
    const identity = await this.load(identityId)
    if (identity.state === 'REVOKED') return {state: 'REVOKED' as const, externalActionRequired: false, detail: 'Identity was already revoked'}
    const text = cleanReason(reason)
    // Public registry revocation is authoritative and happens before the
    // provider control. A provider outage cannot leave releases authorized.
    await this.signingKeys.revoke(identity.publisherId, identity.signingKeyId, text, actorAccountId)
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_publisher_online_signing_identities').set({
        state: 'REVOKED', suspended_at: null, suspension_reason: null,
        revoked_at: now, revocation_reason: text, updated_at: now,
      }).where('identity_id', '=', identityId).where('state', '!=', 'REVOKED').executeTakeFirstOrThrow()
      await appendSigningAudit(trx, {eventType: 'identity_revoked', identityId, publisherId: identity.publisherId,
        actorAccountId, details: {reason: text, signingKeyId: identity.signingKeyId}})
    })
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
    if (purpose === 'PUBLISHER' && !firstPartyAuthorized) return
    const publisher = await this.db.selectFrom('greenfield_publishers').select(['status', 'trust_level', 'revoked_at'])
      .where('publisher_id', '=', publisherId).executeTakeFirst()
    if (purpose !== 'MODULA_FIRST_PARTY' || !firstPartyAuthorized || publisher?.status !== 'verified'
      || publisher.trust_level !== 'firstParty' || publisher.revoked_at) {
      throw moduleError('FORBIDDEN', 'First-party online signing identity enrollment requires explicit authoritative first-party policy')
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
