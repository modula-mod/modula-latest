import {generateKeyPairSync, randomUUID, sign} from 'node:crypto'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {DeveloperBuildCoordinator} from '../src/developers/build-coordinator.js'
import {DeveloperService} from '../src/developers/service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Greenfield Backend V1 build and release pipeline', () => {
  let db: ModulaDb
  let developers: DeveloperService
  let coordinator: DeveloperBuildCoordinator
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
  const owner = {accountId: `build-owner-${suffix}`, handle: `buildowner${suffix}`}
  const attacker = {accountId: `build-attacker-${suffix}`, handle: `buildattacker${suffix}`}
  const admin = {accountId: `build-admin-${suffix}`, handle: `buildadmin${suffix}`}
  const publisherId = `build.publisher.${suffix}`
  const namespace = `builds.${suffix}`
  const productId = `${namespace}.module`
  const serviceId = 'service.modula-build'
  const signingKeyId = `build-key-${suffix}`
  const keys = generateKeyPairSync('ed25519')
  const privateKey = keys.privateKey.export({format: 'pem', type: 'pkcs8'}).toString()
  const publicKey = keys.publicKey.export({format: 'pem', type: 'spki'}).toString()
  let sourceConnectionId = ''

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    await Promise.all([seedAccount(db, owner), seedAccount(db, attacker), seedAccount(db, admin)])
    developers = new DeveloperService(db, loadConfig({...process.env, NODE_ENV: 'test', MODULA_ENVIRONMENT: 'development', MODULA_DATABASE_URL: databaseUrl!, MODULA_DATABASE_MIGRATOR_URL: databaseUrl!, MODULA_API_HOST: '127.0.0.1', MODULA_API_PORT: '4091', MODULA_PUBLIC_API_URL: 'https://api.test.modula.digital', MODULA_ALLOWED_ORIGINS: 'https://modula.digital', MODULA_ADMIN_HANDLES: admin.handle}))
    coordinator = new DeveloperBuildCoordinator(db)
    const now = new Date()
    await db.insertInto('greenfield_publishers').values({publisher_id: publisherId, display_name: 'Build Publisher', website: null, status: 'verified', trust_level: 'verifiedPublisher', created_at: now, updated_at: now, verified_at: now, suspended_at: null, revoked_at: null}).execute()
    await db.insertInto('greenfield_publisher_owners').values({publisher_owner_id: randomUUID(), publisher_id: publisherId, owner_type: 'ACCOUNT', account_id: owner.accountId, organisation_id: null, created_at: now}).execute()
    await db.insertInto('greenfield_publisher_namespaces').values({namespace, publisher_id: publisherId, verification_method: 'fixture', verification_evidence: {}, verified_at: now, revoked_at: null, created_at: now}).execute()
    await db.insertInto('greenfield_developer_programme_memberships').values({programme_membership_id: randomUUID(), account_id: owner.accountId, organisation_id: null, state: 'ACTIVE', state_reason: null, started_at: now, ended_at: null, created_at: now, updated_at: now}).execute()
    await developers.createProduct(owner.accountId, {productId, publisherId, kind: 'module', displayName: 'Build Module', visibility: 'PUBLIC'})
    const source = await developers.connectSource(owner.accountId, productId, {provider: 'github', repository: 'https://github.com/example/build-module.git'})
    sourceConnectionId = source.source_connection_id
    await developers.registerBuildService(admin.accountId, {serviceId, displayName: 'Modula Build Service', publicKeyPem: publicKey, signingKeyId, runnerImage: `registry.modula.digital/build-runner@sha256:${'a'.repeat(64)}`})
  })

  afterAll(async () => db?.destroy())

  it('accepts only signed exact-SHA results and quarantines tampered provenance', async () => {
    const build = await developers.requestBuild(owner.accountId, productId, {sourceConnectionId, sourceSha: 'b'.repeat(40), idempotencyKey: `build-${suffix}`})
    const duplicate = await developers.requestBuild(owner.accountId, productId, {sourceConnectionId, sourceSha: 'b'.repeat(40), idempotencyKey: `build-${suffix}`})
    expect(duplicate.build_id).toBe(build.build_id)
    await expect(developers.requestBuild(attacker.accountId, productId, {sourceConnectionId, sourceSha: 'b'.repeat(40), idempotencyKey: 'attacker'})).rejects.toMatchObject({code: 'FORBIDDEN'})

    const claim = {requestId: randomUUID(), maxBuilds: 1, leaseSeconds: 300}
    await coordinator.authenticate(serviceId, signature(claim), claim)
    const [request] = await coordinator.claim(serviceId, claim)
    expect(request).toMatchObject({buildId: build.build_id, sourceSha: 'b'.repeat(40), profile: 'modula-product-v1'})
    expect(await coordinator.claim(serviceId, claim)).toEqual([request])

    const artifact = signedArtifact(request!)
    const result = {requestId: randomUUID(), buildId: request!.buildId, productId, sourceRepository: request!.sourceRepository, sourceSha: request!.sourceSha, builderIdentity: request!.builderIdentity, buildProfile: request!.profile, state: 'SUCCEEDED', artifact}
    await coordinator.authenticate(serviceId, signature(result), result)
    expect(await coordinator.recordResult(serviceId, result)).toMatchObject({state: 'SUCCEEDED', provenanceVerified: true})
    expect((await db.selectFrom('greenfield_build_provenance').selectAll().where('build_id', '=', build.build_id).executeTakeFirstOrThrow()).signature_verified).toBe(true)

    const tampered = await developers.requestBuild(owner.accountId, productId, {sourceConnectionId, sourceSha: 'c'.repeat(40), idempotencyKey: `tampered-${suffix}`})
    const claim2 = {requestId: randomUUID(), maxBuilds: 1, leaseSeconds: 300}
    await coordinator.authenticate(serviceId, signature(claim2), claim2)
    const [request2] = await coordinator.claim(serviceId, claim2)
    const badResult = {requestId: randomUUID(), buildId: request2!.buildId, productId, sourceRepository: request2!.sourceRepository, sourceSha: 'd'.repeat(40), builderIdentity: request2!.builderIdentity, buildProfile: request2!.profile, state: 'SUCCEEDED', artifact: signedArtifact(request2!)}
    await coordinator.authenticate(serviceId, signature(badResult), badResult)
    expect(await coordinator.recordResult(serviceId, badResult)).toMatchObject({buildId: tampered.build_id, state: 'QUARANTINED', provenanceVerified: false})
  })

  it('creates only provenance-backed releases, assigns testers and seeds review checks', async () => {
    const successful = await db.selectFrom('greenfield_developer_builds').selectAll().where('product_id', '=', productId).where('state', '=', 'SUCCEEDED').executeTakeFirstOrThrow()
    const release = await developers.createRelease(owner.accountId, productId, {buildId: successful.build_id, version: '1.0.0-beta.1', channel: 'BETA'})
    expect(release.state).toBe('CANDIDATE')
    const group = await developers.createTestGroup(owner.accountId, productId, {name: 'Beta', kind: 'BETA'})
    expect(await developers.assignReleaseTestGroup(owner.accountId, productId, release.developer_release_id, group.test_group_id)).toMatchObject({developer_release_id: release.developer_release_id, test_group_id: group.test_group_id})
    const review = await developers.submitReview(owner.accountId, productId, {developerReleaseId: release.developer_release_id})
    expect(review.state).toBe('SUBMITTED')
    expect(await db.selectFrom('greenfield_release_review_checks').selectAll().where('review_submission_id', '=', review.review_submission_id).execute()).toHaveLength(11)
    const quarantined = await db.selectFrom('greenfield_developer_builds').select('build_id').where('product_id', '=', productId).where('state', '=', 'QUARANTINED').executeTakeFirstOrThrow()
    await expect(developers.createRelease(owner.accountId, productId, {buildId: quarantined.build_id, version: '1.0.1', channel: 'BETA'})).rejects.toMatchObject({code: 'FORBIDDEN'})
  })

  function signedArtifact(request: {buildId: string; sourceRepository: string; sourceSha: string; builderIdentity: string}) {
    const values = {artifactSha256: '1'.repeat(64), manifestSha256: '2'.repeat(64), sbomSha256: '3'.repeat(64), licenceInventorySha256: '4'.repeat(64)}
    const statement = {schemaVersion: '1.0.0', buildId: request.buildId, productId, sourceRepository: request.sourceRepository, sourceSha: request.sourceSha, builderIdentity: request.builderIdentity, buildProfile: 'modula-product-v1', ...values, signingKeyId}
    return {artifactReference: `build://${request.buildId}/artifact.tar.zst`, sbomReference: `build://${request.buildId}/sbom.spdx.json`, licenceInventoryReference: `build://${request.buildId}/licences.json`, provenanceReference: `build://${request.buildId}/provenance.json`, ...values, signingKeyId, provenanceSignature: sign(null, Buffer.from(canonicalJsonStringify(statement)), privateKey).toString('base64url')}
  }
  function signature(body: unknown) { return sign(null, Buffer.from(canonicalJsonStringify(body)), privateKey).toString('base64url') }
})

async function seedAccount(db: ModulaDb, identity: {accountId: string; handle: string}) {
  const now = new Date()
  await db.insertInto('greenfield_accounts').values({account_id: identity.accountId, primary_handle: identity.handle, status: 'active', created_at: now, updated_at: now}).execute()
}
