import {describe, expect, it} from 'vitest'
import type {WorkerConfig} from '../src/config.js'
import {assertPermissionReviewPresent} from '../src/modules/permission-review-guard.js'
import {assertTrustedModuleRelease} from '../src/modules/release-trust-guard.js'

const release = {
  release_id: 'release:test',
  module_id: 'module:test',
  version: '1.0.0',
  publisher_id: 'publisher:test',
  release_state: 'published',
  manifest_sha256: 'a'.repeat(64),
  release_sha256: 'b'.repeat(64),
  source_repository: 'modula-mod/test',
  source_commit: '1'.repeat(40),
}

const strictConfig = {environment: 'production', moduleAllowUntrustedDevelopmentReleases: false} as WorkerConfig

function database(rows: Record<string, unknown>) {
  return {
    selectFrom(table: string) {
      const query = {
        select: () => query,
        where: () => query,
        executeTakeFirst: async () => table === 'greenfield_module_release_signatures' && rows[table]
          ? {statement: {
            schemaVersion: '1.0.0', statementType: 'modula.publisher-release.v1',
            productId: release.module_id, version: release.version, publisherId: release.publisher_id,
            sourceRepository: release.source_repository, sourceSha: release.source_commit, releaseTag: null,
            artifactSha256: release.release_sha256, manifestSha256: release.manifest_sha256,
            signingKeyId: 'key:test', productManifestSha256: null, frontendSha256: null,
          }, ...(rows[table] as object)}
          : table === 'greenfield_module_sources' ? (rows[table] ?? {release_tag: null}) : rows[table],
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

  it('rejects a stale worker job when projected product bytes no longer match the signed statement', async () => {
    const db = database({
      greenfield_publishers: {status: 'verified'},
      greenfield_module_release_signatures: {signature_id: 'signature:test', signature_key_id: 'key:test'},
      greenfield_publisher_signing_keys: {publisher_id: 'publisher:test', state: 'ACTIVE', revoked_at: null},
      greenfield_module_release_integrity: {mismatch_at: null},
      greenfield_mps_ingestions: {manifest_sha256: 'c'.repeat(64)},
    })
    await expect(assertTrustedModuleRelease(db, strictConfig, release)).rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})
  })

  it('rejects a stale worker job when release bytes no longer match the signed statement', async () => {
    const db = database({
      greenfield_publishers: {status: 'verified'},
      greenfield_module_release_signatures: {
        signature_id: 'signature:test', signature_key_id: 'key:test',
        statement: {
          schemaVersion: '1.0.0', statementType: 'modula.publisher-release.v1',
          productId: release.module_id, version: release.version, publisherId: release.publisher_id,
          sourceRepository: release.source_repository, sourceSha: release.source_commit, releaseTag: null,
          artifactSha256: 'f'.repeat(64), manifestSha256: release.manifest_sha256,
          signingKeyId: 'key:test', productManifestSha256: null, frontendSha256: null,
        },
      },
      greenfield_publisher_signing_keys: {publisher_id: 'publisher:test', state: 'ACTIVE', revoked_at: null},
      greenfield_module_release_integrity: {mismatch_at: null},
    })
    await expect(assertTrustedModuleRelease(db, strictConfig, release)).rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})
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
