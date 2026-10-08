import {describe, expect, it} from 'vitest'
import type {WorkerConfig} from '../src/config.js'
import {assertPermissionReviewPresent} from '../src/modules/permission-review-guard.js'
import {assertTrustedModuleRelease} from '../src/modules/release-trust-guard.js'

const release = {
  release_id: 'release:test',
  module_id: 'module:test',
  publisher_id: 'publisher:test',
  release_state: 'published',
  manifest_sha256: 'a'.repeat(64),
  release_sha256: 'b'.repeat(64),
}

const strictConfig = {environment: 'production', moduleAllowUntrustedDevelopmentReleases: false} as WorkerConfig

function database(rows: Record<string, unknown>) {
  return {
    selectFrom(table: string) {
      const query = {
        select: () => query,
        where: () => query,
        executeTakeFirst: async () => rows[table],
      }
      return query
    },
  } as any
}

describe('module worker trust boundary', () => {
  it('accepts only a verified, unrevoked signature from a verified publisher', async () => {
    const db = database({
      greenfield_publishers: {status: 'verified'},
      greenfield_module_release_signatures: {signature_id: 'signature:test', signature_key_id: 'key:test'},
      greenfield_publisher_signing_keys: {publisher_id: 'publisher:test', state: 'ACTIVE', revoked_at: null},
      greenfield_module_release_integrity: {mismatch_at: null},
    })
    await expect(assertTrustedModuleRelease(db, strictConfig, release)).resolves.toBeUndefined()
  })

  it('permanently rejects unsigned and digest-mismatched executable transitions', async () => {
    const unsigned = database({
      greenfield_publishers: {status: 'verified'},
      greenfield_module_release_signatures: undefined,
      greenfield_module_release_integrity: {mismatch_at: null},
    })
    await expect(assertTrustedModuleRelease(unsigned, strictConfig, release)).rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})

    const mismatched = database({
      greenfield_publishers: {status: 'verified'},
      greenfield_module_release_signatures: {signature_id: 'signature:test', signature_key_id: 'key:test'},
      greenfield_publisher_signing_keys: {publisher_id: 'publisher:test', state: 'ACTIVE', revoked_at: null},
      greenfield_module_release_integrity: {mismatch_at: new Date()},
    })
    await expect(assertTrustedModuleRelease(mismatched, strictConfig, release)).rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})

    const missingIntegrity = database({
      greenfield_publishers: {status: 'verified'},
      greenfield_module_release_signatures: {signature_id: 'signature:test', signature_key_id: 'key:test'},
      greenfield_publisher_signing_keys: {publisher_id: 'publisher:test', state: 'ACTIVE', revoked_at: null},
      greenfield_module_release_integrity: undefined,
    })
    await expect(assertTrustedModuleRelease(missingIntegrity, strictConfig, release)).rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})
  })

  it('rejects a queued executable transition after release, module or publisher revocation, or quarantine', async () => {
    const trusted = {
      greenfield_publishers: {status: 'verified'},
      greenfield_module_release_signatures: {signature_id: 'signature:test', signature_key_id: 'key:test'},
      greenfield_publisher_signing_keys: {publisher_id: 'publisher:test', state: 'ACTIVE', revoked_at: null},
      greenfield_module_release_integrity: {mismatch_at: null},
    }
    for (const revocation of ['release', 'module', 'publisher']) {
      const revoked = database({...trusted, greenfield_module_revocations: {revocation_id: `revoked:${revocation}`}})
      await expect(assertTrustedModuleRelease(revoked, strictConfig, release)).rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})
    }
    const quarantined = database({...trusted, greenfield_module_quarantines: {quarantine_id: 'quarantine:test'}})
    await expect(assertTrustedModuleRelease(quarantined, strictConfig, release)).rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})
    await expect(assertTrustedModuleRelease(database(trusted), strictConfig, {...release, release_state: 'revoked'}))
      .rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})
    await expect(assertTrustedModuleRelease(database({...trusted, greenfield_publisher_signing_keys: {publisher_id: 'publisher:test', state: 'REVOKED', revoked_at: new Date()}}), strictConfig, release))
      .rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})
  })

  it('allows unsigned fixtures only behind the explicit development switch', async () => {
    const db = {selectFrom: () => { throw new Error('trust database must not be queried for explicit local fixtures') }} as any
    const config = {environment: 'development', moduleAllowUntrustedDevelopmentReleases: true} as WorkerConfig
    await expect(assertTrustedModuleRelease(db, config, release)).resolves.toBeUndefined()
  })

  it('requires a recorded permission review before enable', () => {
    try {
      assertPermissionReviewPresent(undefined)
      throw new Error('Expected permission review denial')
    } catch (error) {
      expect(error).toMatchObject({code: 'PERMISSION_REVIEW_REQUIRED'})
    }
    expect(() => assertPermissionReviewPresent({review_id: 'review:test'})).not.toThrow()
  })
})
