import {generateKeyPairSync, randomUUID, sign} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
import {sql} from 'kysely'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {createDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldModuleUpdateService} from '../src/modules/update-service.js'
import {addStateCounts, completedLegacyUpgradeStates} from '../src/modules/legacy-upgrade-progress.js'
import {GreenfieldGithubReleaseSyncService, type VerifiedGithubRelease} from '../src/modules/github-release-sync-service.js'
import {GreenfieldPublisherSigningKeyService, buildPublisherReleaseStatement, statementBytes, statementSha256} from '../src/modules/release-signing.js'
import {adapterManifest, configureRegistryTestEnv, evidenceFor, registerAccount, sha256} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const adminDatabaseUrl = process.env.MODULA_TEST_ADMIN_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)

describeIfDb('retrospective publisher release signatures', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let releases: GreenfieldModuleReleaseService
  let adminToken = ''
  let ordinaryToken = ''
  const adminHandle = `sigadmin${suffix}`
  const keyId = `modula-retro-${suffix}`
  const signer = generateKeyPairSync('ed25519')
  const verifiedPackages = new Map<string, VerifiedGithubRelease>()
  const fetchVerified = vi.spyOn(GreenfieldGithubReleaseSyncService.prototype, 'fetchVerified')
  let serial = 0

  async function tamperPublishedRelease(releaseId: string, releaseSha256: string) {
    const privilegedUrl = new URL(adminDatabaseUrl ?? databaseUrl!)
    privilegedUrl.pathname = new URL(databaseUrl!).pathname
    const privilegedDb = createDb(privilegedUrl.toString())
    try {
      await privilegedDb.transaction().execute(async trx => {
        await sql`SET LOCAL session_replication_role = replica`.execute(trx)
        await trx.updateTable('greenfield_module_releases')
          .set({release_sha256: releaseSha256}).where('release_id', '=', releaseId).execute()
      })
    } finally {
      await privilegedDb.destroy()
    }
  }

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4071')
    fetchVerified.mockImplementation(async input => {
      const verified = verifiedPackages.get(input.releaseTag)
      if (!verified || verified.repository !== input.repository) throw new Error('Verified fixture missing')
      return verified
    })
    process.env.MODULA_ADMIN_HANDLES = adminHandle
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    releases = new GreenfieldModuleReleaseService(db)
    await new GreenfieldPublisherSigningKeyService(db).register('modula', {
      keyId,
      publicKeyPem: signer.publicKey.export({format: 'pem', type: 'spki'}).toString(),
    }, null)
    adminToken = (await registerAccount(app, `sigadmin-${suffix}@example.com`, adminHandle, db)).token
    ordinaryToken = (await registerAccount(app, `siguser-${suffix}@example.com`, `siguser${suffix}`, db)).token
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
    fetchVerified.mockRestore()
  })

  async function unsignedRelease() {
    const moduleId = `digital.modula.retro-${suffix}-${++serial}`
    const manifest = adapterManifest(moduleId, '1.0.0')
    const evidence = evidenceFor(manifest)
    await releases.importPendingReview(manifest, evidence)
    const release = await releases.publishRelease(moduleId, '1.0.0')
    verifiedPackages.set(manifest.source.releaseTag!, {
      productId: moduleId,
      version: '1.0.0',
      repository: evidence.repository,
      releaseTag: evidence.releaseTag,
      releaseCommit: evidence.releaseCommit,
      packageFile: manifest.source.releaseAssetName!,
      packageSha256: evidence.artifactSha256,
      packageBytes: Buffer.from(`artifact:${moduleId}:1.0.0`),
      mpsBytes: Buffer.alloc(0),
      manifest,
      frontend: null,
      schemas: [],
      assets: [],
      evidence,
      checks: ['package.sha256', 'tag.commit', 'provenance.identity'],
    })
    const statement = buildPublisherReleaseStatement({
      manifest,
      sourceSha: manifest.source.commit,
      artifactSha256: evidence.artifactSha256,
      signingKeyId: keyId,
    })
    return {
      moduleId,
      release,
      payload: {
        statementSha256: statementSha256(statement),
        signature: {algorithm: 'Ed25519', keyId, value: sign(null, statementBytes(statement), signer.privateKey).toString('base64url')},
      },
    }
  }

  const endpoint = (releaseId: string) => `/v1/admin/registry/releases/${encodeURIComponent(releaseId)}/signature`
  const auth = (token: string) => ({authorization: `Bearer ${token}`})

  it('attaches a verified signature to an existing published release exactly once', async () => {
    const {moduleId, release, payload} = await unsignedRelease()
    const before = await app.inject({method: 'GET', url: `/v1/registry/modules/${moduleId}`})
    expect(before.json().data.registryTrust).toMatchObject({verified: false, signature: {state: 'unsigned'}})

    const attached = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    expect(attached.statusCode, attached.body).toBe(200)
    expect(attached.json().data).toMatchObject({releaseId: release.releaseId, keyId, verificationState: 'verified', statementSha256: payload.statementSha256})
    const row = await db.selectFrom('greenfield_module_release_signatures').selectAll().where('release_id', '=', release.releaseId).executeTakeFirstOrThrow()
    expect(row.verification_state).toBe('verified')
    expect(row.statement_sha256).toBe(payload.statementSha256)
    const after = await app.inject({method: 'GET', url: `/v1/registry/modules/${moduleId}`})
    expect(after.json().data.registryTrust).toMatchObject({verified: true, signature: {state: 'verified'}})

    const again = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    expect(again.statusCode, again.body).toBe(200)
    expect(again.json().data).toMatchObject({alreadyAttached: true})
    expect(await db.selectFrom('greenfield_module_release_signatures').select('signature_id').where('release_id', '=', release.releaseId).execute()).toHaveLength(1)
  })

  it('handles simultaneous identical submissions with one signature row', async () => {
    const {release, payload} = await unsignedRelease()
    const submit = () => app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    const responses = await Promise.all([submit(), submit()])
    expect(responses.map(response => response.statusCode)).toEqual([200, 200])
    expect(responses.map(response => response.json().data.alreadyAttached ?? false).sort()).toEqual([false, true])
    expect(await db.selectFrom('greenfield_module_release_signatures').select('signature_id').where('release_id', '=', release.releaseId).execute()).toHaveLength(1)
  })

  it('requires an authenticated registry administrator and validates the request shape', async () => {
    const {release, payload} = await unsignedRelease()
    expect((await app.inject({method: 'POST', url: endpoint(release.releaseId), payload})).statusCode).toBe(401)
    expect((await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(ordinaryToken), payload})).statusCode).toBe(403)
    expect((await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload: {...payload, signature: {...payload.signature, value: 'not-ed25519'}}})).statusCode).toBe(400)
    expect(await db.selectFrom('greenfield_module_release_signatures').select('signature_id').where('release_id', '=', release.releaseId).execute()).toHaveLength(0)
  })

  it('refuses wrong statement hash, invalid signature, and unknown signer without changing trust', async () => {
    const {moduleId, release, payload} = await unsignedRelease()
    const cases = [
      {...payload, statementSha256: sha256('wrong statement')},
      {...payload, signature: {...payload.signature, value: sign(null, Buffer.from('wrong statement'), signer.privateKey).toString('base64url')}},
      {...payload, signature: {...payload.signature, keyId: `unknown-${suffix}`}},
    ]
    for (const candidate of cases) {
      const response = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload: candidate})
      expect(response.statusCode, response.body).toBe(400)
    }
    expect(await db.selectFrom('greenfield_module_release_signatures').select('signature_id').where('release_id', '=', release.releaseId).execute()).toHaveLength(0)
    const detail = await app.inject({method: 'GET', url: `/v1/registry/modules/${moduleId}`})
    expect(detail.json().data.registryTrust).toMatchObject({verified: false, signature: {state: 'unsigned'}})
  })

  it('refuses a release whose stored integrity facts no longer match', async () => {
    const {release, payload} = await unsignedRelease()
    await db.updateTable('greenfield_module_release_integrity').set({release_sha256: sha256('different artifact')}).where('release_id', '=', release.releaseId).execute()
    const response = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    expect(response.statusCode, response.body).toBe(400)
    expect(await db.selectFrom('greenfield_module_release_signatures').select('signature_id').where('release_id', '=', release.releaseId).execute()).toHaveLength(0)
  })

  it('refuses a package whose independently verified digest differs from the registry', async () => {
    const {release, payload} = await unsignedRelease()
    const tag = (await releases.getReleaseById(release.releaseId))!.manifest.source.releaseTag!
    const verified = verifiedPackages.get(tag)!
    verifiedPackages.set(tag, {...verified, packageSha256: sha256('different package bytes')})
    const response = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    expect(response.statusCode, response.body).toBe(400)
    expect(await db.selectFrom('greenfield_module_release_signatures').select('signature_id').where('release_id', '=', release.releaseId).execute()).toHaveLength(0)
  })

  it('keeps superseded legacy releases ineligible', async () => {
    const {release, payload} = await unsignedRelease()
    await db.updateTable('greenfield_module_releases').set({release_state: 'superseded'}).where('release_id', '=', release.releaseId).execute()
    const response = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    expect(response.statusCode, response.body).toBe(409)
  })

  it('fails closed when the signer is revoked even if stale signature evidence still says verified', async () => {
    const {moduleId, release, payload} = await unsignedRelease()
    const attached = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    expect(attached.statusCode, attached.body).toBe(200)
    await db.updateTable('greenfield_publisher_signing_keys')
      .set({state: 'REVOKED', revoked_at: new Date()}).where('key_id', '=', keyId).execute()
    try {
      const detail = await app.inject({method: 'GET', url: `/v1/registry/modules/${moduleId}`})
      expect(detail.json().data.registryTrust).toMatchObject({verified: false, signature: {state: 'revokedKey'}})
    } finally {
      await db.updateTable('greenfield_publisher_signing_keys')
        .set({state: 'ACTIVE', revoked_at: null}).where('key_id', '=', keyId).execute()
    }
  })

  it('fails closed when release or projection facts diverge from the signed statement', async () => {
    const {moduleId, release, payload} = await unsignedRelease()
    const attached = await app.inject({method: 'POST', url: endpoint(release.releaseId), headers: auth(adminToken), payload})
    expect(attached.statusCode, attached.body).toBe(200)
    const signatureRow = await db.selectFrom('greenfield_module_release_signatures')
      .select(['signature_id', 'statement']).where('release_id', '=', release.releaseId).executeTakeFirstOrThrow()
    await db.updateTable('greenfield_module_release_signatures')
      .set({statement: {...(signatureRow.statement as object), productManifestSha256: 'c'.repeat(64)}})
      .where('signature_id', '=', signatureRow.signature_id).execute()
    const projectionMismatch = await app.inject({method: 'GET', url: `/v1/registry/modules/${moduleId}`})
    expect(projectionMismatch.json().data.registryTrust).toMatchObject({verified: false, signature: {state: 'invalid'}})
    await db.updateTable('greenfield_module_release_signatures')
      .set({statement: signatureRow.statement}).where('signature_id', '=', signatureRow.signature_id).execute()
    await tamperPublishedRelease(release.releaseId, sha256('different release bytes'))
    const releaseMismatch = await app.inject({method: 'GET', url: `/v1/registry/modules/${moduleId}`})
    expect(releaseMismatch.json().data.registryTrust).toMatchObject({verified: false, signature: {state: 'invalid'}})
  })

  it('lets an exact historical untrusted installation exit only to a signed target without granting new permissions', async () => {
    const moduleId = `digital.modula.legacy-exit-${suffix}`
    const sourceManifest = adapterManifest(moduleId, '0.2.0')
    const targetManifest = adapterManifest(moduleId, '1.8.0', {
      permissions: [{permission: 'records:write', risk: 'high', reason: 'New target capability'}],
    })
    await releases.importPendingReview(sourceManifest, evidenceFor(sourceManifest))
    const source = await releases.publishRelease(moduleId, '0.2.0')
    const olderManifest = adapterManifest(moduleId, '0.1.0')
    await releases.importPendingReview(olderManifest, evidenceFor(olderManifest))
    const older = await releases.publishRelease(moduleId, '0.1.0')
    await releases.importPendingReview(targetManifest, evidenceFor(targetManifest))
    const target = await releases.publishRelease(moduleId, '1.8.0')
    const targetEvidence = evidenceFor(targetManifest)
    const verified: VerifiedGithubRelease = {
      productId: moduleId, version: '1.8.0', repository: targetEvidence.repository,
      releaseTag: targetEvidence.releaseTag, releaseCommit: targetEvidence.releaseCommit,
      packageFile: targetManifest.source.releaseAssetName!, packageSha256: targetEvidence.artifactSha256,
      packageBytes: Buffer.from('test release'), mpsBytes: Buffer.alloc(0), manifest: targetManifest,
      frontend: null, game: null, schemas: [], assets: [], evidence: targetEvidence, checks: ['package.sha256', 'tag.commit'],
    }
    const account = await registerAccount(app, `legacy-exit-${suffix}@example.com`, `legacyexit${suffix}`, db)
    const installationId = `legacy-exit-install-${suffix}`
    await db.insertInto('greenfield_extension_installations').values({
      installation_id: installationId, account_id: account.accountId,
      extension_version_id: source.extensionVersionId, status: 'installedDisabled', config: {},
      created_at: new Date(), updated_at: new Date(),
    }).execute()
    const updates = new GreenfieldModuleUpdateService(db, {
      ...loadConfig(), environment: 'production', moduleAllowUntrustedDevelopmentReleases: false,
    })
    const request = {installationId, version: '1.8.0', idempotencyKey: `api-fix-01c:legacy-exit-${suffix}`}
    await expect(updates.migrateLegacyInstallation(account.accountId, moduleId, request)).rejects.toThrow(/trusted target/)
    await expect(updates.migrateLegacyInstallation(randomUUID(), moduleId, request)).rejects.toThrow(/not found/i)
    expect(await db.selectFrom('greenfield_module_install_plans').select('plan_id').where('installation_id', '=', installationId).execute()).toHaveLength(0)

    const statement = buildPublisherReleaseStatement({manifest: targetManifest, sourceSha: targetManifest.source.commit,
      artifactSha256: targetEvidence.artifactSha256, signingKeyId: keyId})
    await releases.attachPublishedSignature(target.releaseId, {
      statementSha256: statementSha256(statement),
      signature: {algorithm: 'Ed25519', keyId, value: sign(null, statementBytes(statement), signer.privateKey).toString('base64url')},
    }, verified, null)
    const queued = await updates.migrateLegacyInstallation(account.accountId, moduleId, request)
    expect(queued).toMatchObject({installationId, status: 'updating', toVersion: '1.8.0'})
    expect(queued.descriptor.permissions.granted).toEqual([])
    expect(queued.descriptor.permissions.denied).toContain('records:write')
    const review = await db.selectFrom('greenfield_module_permission_reviews').select(['granted_permissions', 'denied_permissions'])
      .where('installation_id', '=', installationId).where('release_id', '=', target.releaseId).executeTakeFirstOrThrow()
    expect(review.granted_permissions).toEqual([])
    expect(review.denied_permissions).toContain('records:write')
    expect((await updates.migrateLegacyInstallation(account.accountId, moduleId, request)).idempotent).toBe(true)

    const duplicateInstallationId = `legacy-exit-duplicate-${suffix}`
    await db.insertInto('greenfield_extension_installations').values({
      installation_id: duplicateInstallationId, account_id: account.accountId,
      extension_version_id: older.extensionVersionId, status: 'enabled', config: {},
      created_at: new Date(), updated_at: new Date(),
    }).execute()
    const duplicate = await updates.migrateLegacyInstallation(account.accountId, moduleId, {
      installationId: duplicateInstallationId, version: '1.8.0', idempotencyKey: `api-fix-01c:legacy-exit-duplicate-${suffix}`,
    })
    expect(duplicate).toMatchObject({installationId: duplicateInstallationId, status: 'updating', toVersion: '1.8.0'})
    const projections = await db.selectFrom('greenfield_extension_runtime_projection')
      .select('installation_id').where('account_id', '=', account.accountId).where('product_id', '=', moduleId).execute()
    expect(projections).toEqual([{installation_id: installationId}])
    await db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_extension_installations')
        .set({extension_version_id: target.extensionVersionId, status: 'installedDisabled'})
        .where('installation_id', '=', installationId).execute()
      await trx.updateTable('greenfield_extension_installations')
        .set({extension_version_id: target.extensionVersionId, status: 'enabled', legacy_duplicate_allowed: true})
        .where('installation_id', '=', duplicateInstallationId).execute()
      await trx.updateTable('greenfield_module_install_plans')
        .set({status: 'completed'}).where('plan_id', '=', queued.planId).execute()
      const completed = await completedLegacyUpgradeStates(trx, {
        moduleId, fromVersion: '0.2.0', toVersion: '1.8.0', targetReleaseId: target.releaseId,
      })
      expect(completed).toEqual({installedDisabled: 1})
      expect(addStateCounts({enabled: 1}, completed)).toEqual({enabled: 1, installedDisabled: 1})
      const migrated = await trx.selectFrom('greenfield_extension_installations')
        .select(['installation_id', 'status']).where('account_id', '=', account.accountId)
        .where('extension_version_id', '=', target.extensionVersionId).execute()
      expect(migrated).toEqual(expect.arrayContaining([
        {installation_id: installationId, status: 'installedDisabled'},
        {installation_id: duplicateInstallationId, status: 'enabled'},
      ]))
      expect(migrated).toHaveLength(2)
      // Do not leave same-version duplicates in the shared disposable test DB;
      // unrelated migration-down tests still need to reverse 067.
      await trx.updateTable('greenfield_extension_installations')
        .set({extension_version_id: source.extensionVersionId, status: 'updating'})
        .where('installation_id', '=', installationId).execute()
      await trx.updateTable('greenfield_extension_installations')
        .set({extension_version_id: older.extensionVersionId, status: 'updating'})
        .where('installation_id', '=', duplicateInstallationId).execute()
      await trx.updateTable('greenfield_module_install_plans')
        .set({status: 'queued'}).where('plan_id', '=', queued.planId).execute()
    })
  })
})
