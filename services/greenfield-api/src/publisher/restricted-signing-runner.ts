import {createPublicKey, verify} from 'node:crypto'
import {sql, type Transaction} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import type {Database} from '../database/types.js'
import {
  parsePublisherPublicKey,
  statementBytes,
  statementSha256,
  type PublisherReleaseApprovalFacts,
  type PublisherReleaseStatement,
} from '../modules/release-signing.js'
import {
  SigningProviderError,
  type PublisherSigningIdentity,
  type PublisherSigningProvider,
  type PublisherSigningProviderKind,
  type PublisherSigningPurpose,
} from './signing-provider.js'

type SigningClaim = {
  queue_job_id: string
  release_job_id: string
  signing_request_id: string
  publisher_id: string
  module_id: string
  version: string
  release_id: string
  approval_sha256: string
  approved_facts: PublisherReleaseApprovalFacts
  identity_id: string
  signing_key_id: string
  provider: PublisherSigningProviderKind
  provider_key_ref: string
  identity_purpose: PublisherSigningPurpose
  identity_first_party_authorized: boolean
  identity_valid_from: Date
  identity_valid_until: Date
  public_key_pem: string
  public_key_fingerprint: string
  attempt_count: number
  maximum_attempts: number
}

type RunnerFailureCode = 'PROVIDER_UNAVAILABLE' | 'SIGNATURE_INVALID' | 'IDENTITY_UNAVAILABLE'

class RestrictedSigningFailure extends Error {
  constructor(readonly code: RunnerFailureCode, message: string) {
    super(message)
    this.name = 'RestrictedSigningFailure'
  }
}

/**
 * Signing-only consumer. Its database login has no table privileges. Claim,
 * provider signing, local Ed25519 verification and settlement stay inside one
 * explicit transaction; migration 092 refuses a commit with an open claim.
 */
export class RestrictedPublisherSigningRunner {
  constructor(
    private readonly db: ModulaDb,
    private readonly provider: PublisherSigningProvider,
    private readonly options: {workerId: string; leaseMs?: number},
  ) {
    if (options.workerId.length < 3 || options.workerId.length > 240) throw new Error('Signing runner worker ID must contain 3 to 240 characters')
  }

  async runOnce(): Promise<boolean> {
    return this.db.transaction().execute(async trx => {
      const claim = (await sql<SigningClaim>`
        SELECT * FROM greenfield_signing_runner_claim(
          ${this.options.workerId},
          ${this.options.leaseMs ?? 600_000}
        )
      `.execute(trx)).rows[0]
      if (!claim) return false

      try {
        await this.signClaim(trx, claim)
        return true
      } catch (error) {
        const failure = classifyFailure(error)
        if (!failure) throw error
        await sql`SELECT greenfield_signing_runner_fail(${claim.queue_job_id}, ${failure.code})`.execute(trx)
        return true
      }

    })
  }

  private async signClaim(trx: Transaction<Database>, claim: SigningClaim): Promise<void> {
    if (claim.provider !== this.provider.kind) {
      throw new RestrictedSigningFailure('IDENTITY_UNAVAILABLE', 'Claimed signing identity belongs to a different provider')
    }

    const identity: PublisherSigningIdentity = {
      identityId: claim.identity_id,
      publisherId: claim.publisher_id,
      signingKeyId: claim.signing_key_id,
      provider: claim.provider,
      providerKeyRef: claim.provider_key_ref,
      purpose: claim.identity_purpose,
      state: 'ACTIVE',
      firstPartyAuthorized: claim.identity_first_party_authorized,
      validFrom: new Date(claim.identity_valid_from),
      validUntil: new Date(claim.identity_valid_until),
    }
    const providerKey = await this.provider.getPublicKey(identity)
    const registeredKey = parsePublisherPublicKey(claim.public_key_pem)
    if (registeredKey.fingerprint !== claim.public_key_fingerprint
      || providerKey.fingerprint !== claim.public_key_fingerprint
      || providerKey.publicKeyPem !== registeredKey.publicKeyPem) {
      throw new RestrictedSigningFailure('IDENTITY_UNAVAILABLE', 'Provider public key does not match the database-approved key')
    }

    const statement = {...claim.approved_facts, signingKeyId: claim.signing_key_id} as PublisherReleaseStatement
    const canonical = statementBytes(statement)
    const signed = await this.provider.signPublisherRelease(identity, canonical)
    const signatureBytes = Buffer.from(signed.signature, 'base64url')
    const providerVerified = await this.provider.verifyPublisherRelease(identity, canonical, signed.signature)
    const locallyVerified = signed.algorithm === 'Ed25519'
      && signatureBytes.length === 64
      && verify(null, canonical, createPublicKey(registeredKey.publicKeyPem), signatureBytes)
    if (!providerVerified || !locallyVerified) {
      throw new RestrictedSigningFailure('SIGNATURE_INVALID', 'Signing provider result failed independent Ed25519 verification')
    }

    await sql`SELECT greenfield_signing_runner_submit_signature(
      ${claim.queue_job_id},
      ${signed.signature},
      ${statementSha256(statement)},
      ${signed.providerKeyVersion === null ? null : String(signed.providerKeyVersion)}
    )`.execute(trx)
  }
}

function classifyFailure(error: unknown): RestrictedSigningFailure | null {
  if (error instanceof RestrictedSigningFailure) return error
  if (error instanceof SigningProviderError) {
    return new RestrictedSigningFailure(
      error.code === 'PROVIDER_FAILURE' ? 'PROVIDER_UNAVAILABLE' : 'IDENTITY_UNAVAILABLE',
      error.message,
    )
  }
  return null
}
