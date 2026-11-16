import {createPublicKey, verify} from 'node:crypto'
import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import {parsePublisherPublicKey, statementBytes, statementSha256, type PublisherReleaseStatement} from '../modules/release-signing.js'

type VerificationClaim = {
  job_id: string
  signature_id: string
  statement: PublisherReleaseStatement
  statement_sha256: string
  signature: string
  algorithm: string
  public_key_pem: string
  public_key_fingerprint: string
}

/** Trust-verifier process with no table privileges and no private-key access. */
export class RestrictedPublisherTrustVerifier {
  constructor(private readonly db: ModulaDb) {}

  async runOnce(requestedJobId: string | null = null): Promise<boolean> {
    return this.db.transaction().execute(async trx => {
      const claim = (await sql<VerificationClaim>`
        SELECT * FROM greenfield_trust_verifier_claim(${requestedJobId})
      `.execute(trx)).rows[0]
      if (!claim) return false

      let succeeded = false
      let detail = 'Independent Ed25519 verification failed'
      let fingerprint: string | null = null
      try {
        const key = parsePublisherPublicKey(claim.public_key_pem)
        fingerprint = key.fingerprint
        const canonical = statementBytes(claim.statement)
        succeeded = claim.algorithm === 'Ed25519'
          && fingerprint === claim.public_key_fingerprint
          && statementSha256(claim.statement) === claim.statement_sha256
          && verify(null, canonical, createPublicKey(key.publicKeyPem), Buffer.from(claim.signature, 'base64url'))
        detail = succeeded ? 'Independent Ed25519 verification passed' : detail
      } catch {
        succeeded = false
      }

      await sql`SELECT greenfield_trust_verifier_record(
        ${claim.job_id}, ${claim.signature_id}, ${succeeded}, ${detail}, ${succeeded ? fingerprint : null}
      )`.execute(trx)
      return true
    })
  }
}
