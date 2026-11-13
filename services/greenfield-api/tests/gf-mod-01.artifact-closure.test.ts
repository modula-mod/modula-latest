/**
 * GF-MOD-01 acceptance: read-only artifact/presentation closure report and
 * fail-closed install preview when the package artifact is absent or corrupt.
 *
 * Isolated fixtures only: every module id is test.modula.gf-mod-01-*; the
 * suite never references a production product id.
 */
import {execFileSync} from 'node:child_process'
import {generateKeyPairSync, randomUUID, sign, type KeyObject} from 'node:crypto'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import type {GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {createDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldArtifactClosureService} from '../src/modules/artifact-closure-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldPublisherSigningKeyService, buildPublisherReleaseStatement, statementBytes} from '../src/modules/release-signing.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor, fixtureProduct, registerAccount, sha256, storeFixturePackageArtifact} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const adminDatabaseUrl = process.env.MODULA_TEST_ADMIN_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const itIfAdmin = adminDatabaseUrl ? it : it.skip
const suffix = randomUUID().slice(0, 8)
const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function signRelease(manifest: GreenfieldModuleManifest, artifactSha256: string, productBytes: string, frontendBytes: Buffer, keyId: string, privateKey: KeyObject) {
  const statement = buildPublisherReleaseStatement({
    manifest, sourceSha: manifest.source.commit, artifactSha256,
    productManifestSha256: sha256(productBytes), frontendSha256: sha256(frontendBytes), signingKeyId: keyId,
  })
  return {algorithm: 'Ed25519', keyId, value: sign(null, statementBytes(statement), privateKey).toString('base64url')}
}

describe('GF-MOD-01 package closure states (no database)', () => {
  it('reports a release with no recorded digest as noReleaseDigest without querying bytes', async () => {
    const service = new GreenfieldArtifactClosureService(null as any)
    await expect(service.packageArtifact({releaseId: 'r', releaseSha256: null})).resolves.toMatchObject({state: 'noReleaseDigest', expectedSha256: null})
  })
})

describeIfDb('GF-MOD-01 artifact closure and fail-closed install preview', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let releases: GreenfieldModuleReleaseService
  let token = ''
  let accountId = ''
  const keys = generateKeyPairSync('ed25519')
  const keyId = `test-modula-gf-mod-01-${suffix}`
  let n = 0
  const nextId = () => `test.modula.gf-mod-01-${suffix}-${++n}`

  /** Imports, signs, publishes and ingests a strictly trusted release (no package bytes yet). */
  async function trustedRelease() {
    const id = nextId()
    const product = fixtureProduct(id, '1.0.0')
    const manifest = adapterManifest(id, '1.0.0')
    const evidence = evidenceFor(manifest)
    const signature = signRelease(manifest, evidence.artifactSha256, product.mpsBytes, product.frontend.bytes, keyId, keys.privateKey)
    await releases.importPendingReview(manifest, {...evidence, productManifestSha256: sha256(product.mpsBytes), frontendSha256: sha256(product.frontend.bytes), signature} as any)
    const published = await releases.publishRelease(id, '1.0.0')
    await new GreenfieldMpsIngestService(db).ingest({filename: 'modula.product.json', bytes: product.mpsBytes, releaseId: published.releaseId, frontend: product.frontend, schemas: product.schemas, assets: product.assets})
    return published
  }

  const preview = (id: string) => app.inject({method: 'POST', url: `/v1/modules/${id}/install-preview`,
    headers: {authorization: `Bearer ${token}`}, payload: {version: '1.0.0', platform: 'web'}})
  const install = (id: string, key: string) => app.inject({method: 'POST', url: `/v1/modules/${id}/install`,
    headers: {authorization: `Bearer ${token}`, 'idempotency-key': key}, payload: {version: '1.0.0', approvedPermissions: []}})
  const installationsFor = async (extensionVersionId: string) => db.selectFrom('greenfield_extension_installations')
    .select('installation_id').where('extension_version_id', '=', extensionVersionId).execute()

  /**
   * Simulates storage corruption of one content-addressed blob. The table's
   * CHECKs make this impossible through normal writes, so the superuser briefly
   * drops them, rewrites only this test's blob, and restores them NOT VALID.
   * Returns a cleanup that removes the corrupt rows and revalidates.
   */
  async function corruptBlob(digest: string, releaseId: string) {
    const admin = createDb(adminDatabaseUrl!)
    const checks = await sql<{conname: string; def: string}>`
      SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'greenfield_release_asset_blobs'::regclass AND contype = 'c'
        AND (pg_get_constraintdef(oid) LIKE '%sha256(bytes)%' OR pg_get_constraintdef(oid) LIKE '%octet_length(bytes)%')`.execute(admin)
    await admin.transaction().execute(async trx => {
      await sql`SET LOCAL session_replication_role = replica`.execute(trx)
      for (const check of checks.rows) await sql.raw(`ALTER TABLE greenfield_release_asset_blobs DROP CONSTRAINT ${check.conname}`).execute(trx)
      await sql`UPDATE greenfield_release_asset_blobs SET bytes = ${Buffer.from(`corrupted:${digest}`)}, byte_size = ${Buffer.byteLength(`corrupted:${digest}`)} WHERE sha256 = ${digest}`.execute(trx)
      for (const check of checks.rows) await sql.raw(`ALTER TABLE greenfield_release_asset_blobs ADD CONSTRAINT ${check.conname} ${check.def} NOT VALID`).execute(trx)
    })
    return async () => {
      try {
        await admin.transaction().execute(async trx => {
          await sql`SET LOCAL session_replication_role = replica`.execute(trx)
          await sql`DELETE FROM greenfield_release_artifacts WHERE release_id = ${releaseId} AND sha256 = ${digest}`.execute(trx)
          await sql`DELETE FROM greenfield_release_asset_blobs WHERE sha256 = ${digest}`.execute(trx)
        })
        for (const check of checks.rows) await sql.raw(`ALTER TABLE greenfield_release_asset_blobs VALIDATE CONSTRAINT ${check.conname}`).execute(admin)
      } finally {
        await admin.destroy()
      }
    }
  }

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4091')
    // Strict production trust policy: no development untrusted-release allowance.
    process.env.GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES = 'false'
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    releases = new GreenfieldModuleReleaseService(db)
    await new GreenfieldPublisherSigningKeyService(db).register('modula', {keyId, publicKeyPem: keys.publicKey.export({format: 'pem', type: 'spki'}).toString()}, null)
    const account = await registerAccount(app, `gf-mod-01-${suffix}@example.com`, `gfmod01${suffix}`.slice(0, 20), db)
    token = account.token
    accountId = account.accountId
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('refuses install preview and install for a trusted release whose package artifact is absent', async () => {
    const release = await trustedRelease()
    const refused = await preview(release.moduleId)
    expect(refused.statusCode, refused.body).toBe(403)
    expect(refused.json().error.code).toBe('UNTRUSTED_RELEASE')
    expect(refused.json().error.message).toMatch(/no stored immutable package artifact/)
    const blocked = await install(release.moduleId, `gf-mod-01-missing-${suffix}`)
    expect(blocked.statusCode, blocked.body).toBe(403)
    expect(blocked.json().error.code).toBe('UNTRUSTED_RELEASE')
    expect(await installationsFor(release.extensionVersionId)).toHaveLength(0)
  })

  it('stays refused on replay and under concurrent previews, and writes no install plan', async () => {
    const release = await trustedRelease()
    const results = await Promise.all(Array.from({length: 6}, () => preview(release.moduleId)))
    expect(results.map(result => result.statusCode)).toEqual(Array(6).fill(403))
    const key = `gf-mod-01-replay-${suffix}`
    for (let attempt = 0; attempt < 2; attempt++) {
      const replay = await install(release.moduleId, key)
      expect(replay.statusCode, replay.body).toBe(403)
    }
    expect(await db.selectFrom('greenfield_module_install_plans').select('plan_id')
      .where('account_id', '=', accountId).where('idempotency_key', '=', key).execute()).toHaveLength(0)
  })

  it('allows install preview once the immutable package artifact is stored and matches the release digest', async () => {
    const release = await trustedRelease()
    await storeFixturePackageArtifact(db, release)
    const allowed = await preview(release.moduleId)
    expect(allowed.statusCode, allowed.body).toBe(200)
    expect(allowed.json().data).toMatchObject({moduleId: release.moduleId, version: '1.0.0'})
  })

  it('refuses a package stored under a different digest than the release records', async () => {
    const release = await trustedRelease()
    await storeFixturePackageArtifact(db, release, Buffer.from(`other-bytes:${release.moduleId}`))
    const refused = await preview(release.moduleId)
    expect(refused.statusCode, refused.body).toBe(403)
    expect(refused.json().error.code).toBe('UNTRUSTED_RELEASE')
  })

  itIfAdmin('returns ARTIFACT_DIGEST_MISMATCH when stored package bytes no longer hash to the digest, and audits it', async () => {
    const release = await trustedRelease()
    const digest = await storeFixturePackageArtifact(db, release)
    const cleanup = await corruptBlob(digest, release.releaseId)
    try {
      const refused = await preview(release.moduleId)
      expect(refused.statusCode, refused.body).toBe(409)
      expect(refused.json().error.code).toBe('ARTIFACT_DIGEST_MISMATCH')
      const blocked = await install(release.moduleId, `gf-mod-01-corrupt-${suffix}`)
      expect(blocked.statusCode, blocked.body).toBe(409)
      expect(blocked.json().error.code).toBe('ARTIFACT_DIGEST_MISMATCH')
      expect(await installationsFor(release.extensionVersionId)).toHaveLength(0)
      // Even the development-only allowance never accepts corrupt bytes.
      await expect(new GreenfieldArtifactClosureService(db).assertPackageInstallable(release, {allowMissingInDevelopment: true}))
        .rejects.toMatchObject({code: 'ARTIFACT_DIGEST_MISMATCH'})
      const audit = await sql<{count: number}>`SELECT COUNT(*)::int AS count FROM audit_events
        WHERE event_type = 'module.artifact.integrity-failed' AND resource_id = ${release.releaseId}`.execute(db)
      expect(audit.rows[0]!.count).toBeGreaterThanOrEqual(1)
      const report = await new GreenfieldArtifactClosureService(db).report({moduleId: release.moduleId})
      expect(report.releases[0]!.packageArtifact).toMatchObject({state: 'digestMismatch', expectedSha256: digest})
      expect(report.totals.packageDigestMismatch).toBe(1)
    } finally {
      await cleanup()
    }
  })

  it('development allowance tolerates a missing package only when explicitly enabled', async () => {
    const release = await trustedRelease()
    const service = new GreenfieldArtifactClosureService(db)
    await expect(service.assertPackageInstallable(release, {allowMissingInDevelopment: false})).rejects.toMatchObject({code: 'UNTRUSTED_RELEASE'})
    await expect(service.assertPackageInstallable(release, {allowMissingInDevelopment: true})).resolves.toMatchObject({state: 'missing'})
  })

  it('report script emits read-only JSON per installable release with package, presentation, digest and signature state', async () => {
    const closed = await trustedRelease()
    await storeFixturePackageArtifact(db, closed)
    const open = await trustedRelease()
    // Presentation metadata whose bytes were never stored (historic G004 shape).
    const template = await db.selectFrom('greenfield_release_presentation_assets').selectAll()
      .where('release_id', '=', open.releaseId).executeTakeFirstOrThrow()
    const ghostDigest = sha256(`gf-mod-01-ghost-${suffix}`)
    await db.insertInto('greenfield_release_presentation_assets').values({
      ...template, asset_id: `gf-mod-01-ghost-${suffix}`, artifact_path: 'assets/ghost.png', sha256: ghostDigest, sort_order: 999,
    } as any).execute()

    const prefix = `test.modula.gf-mod-01-${suffix}-`
    const run = (moduleId: string) => JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', 'scripts/artifact-closure-report.ts', '--module', moduleId], {
      cwd: apiRoot, encoding: 'utf8', env: {PATH: process.env.PATH ?? '', MODULA_DATABASE_URL: databaseUrl!},
    }))
    const closedReport = run(closed.moduleId)
    expect(closedReport).toMatchObject({reportVersion: 'gf-mod-01.v1', mode: 'READ_ONLY', releaseStates: ['published', 'superseded']})
    expect(closedReport.totals).toMatchObject({releases: 1, closed: 1, open: 0, packageMissing: 0})
    const closedEntry = closedReport.releases[0]
    expect(closedEntry).toMatchObject({moduleId: closed.moduleId, version: '1.0.0', closed: true, trustVerified: true, error: null,
      signature: {state: 'verified', keyId},
      packageArtifact: {state: 'present', expectedSha256: closed.releaseSha256, observedSha256: closed.releaseSha256, accessClass: 'installation'}})
    expect(closedEntry.digests).toMatchObject({releaseSha256: closed.releaseSha256, manifestSha256: closed.manifestSha256})
    expect(closedEntry.digests.productManifestSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(closedEntry.presentation.declared).toBeGreaterThan(0)
    expect(closedEntry.presentation.present).toBe(closedEntry.presentation.declared)

    const openReport = run(open.moduleId)
    const openEntry = openReport.releases[0]
    expect(openEntry).toMatchObject({closed: false, packageArtifact: {state: 'missing'}})
    expect(openEntry.presentation.missing).toBe(1)
    expect(openEntry.presentation.assets.find((asset: any) => asset.sha256 === ghostDigest)).toMatchObject({state: 'missingBlob', bytes: null})
    expect(openReport.totals).toMatchObject({open: 1, packageMissing: 1, presentationMissingBlobs: 1})

    // Privacy/size: the report carries digests and sizes, never the stored bytes.
    expect(JSON.stringify(openReport)).not.toContain(Buffer.from(`artifact:${closed.moduleId}:1.0.0`).toString('base64'))
    expect(JSON.stringify(closedReport)).not.toMatch(/"bytes":\s*\{/)
    expect(prefix).not.toContain('vault-notes')
  })

  it('report runs inside a READ ONLY transaction and cannot write', async () => {
    await expect(db.transaction().execute(async trx => {
      await sql`SET TRANSACTION READ ONLY`.execute(trx)
      await new GreenfieldArtifactClosureService(trx as any).report({moduleId: `test.modula.gf-mod-01-${suffix}-1`})
      await sql`INSERT INTO schema_metadata (key, value) VALUES (${`gf-mod-01-${suffix}`}, 'x')`.execute(trx)
    })).rejects.toThrow(/read-only transaction/)
  })
})
