import {createHash, randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {DeveloperService} from '../src/developers/service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Greenfield Backend V1 developer domain', () => {
  let db: ModulaDb
  let service: DeveloperService
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
  const owner = {accountId: `dev-owner-${suffix}`, handle: `devowner${suffix}`}
  const attacker = {accountId: `dev-attacker-${suffix}`, handle: `devattacker${suffix}`}
  const admin = {accountId: `dev-admin-${suffix}`, handle: `devadmin${suffix}`}
  const publisherId = `publisher.${suffix}`
  const namespace = `example.${suffix}`
  const privateProductId = `${namespace}.private-product`
  let organisationId = ''

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    await seedAccount(db, owner)
    await seedAccount(db, attacker)
    await seedAccount(db, admin)
    service = new DeveloperService(db, loadConfig({
      ...process.env,
      NODE_ENV: 'test',
      MODULA_ENVIRONMENT: 'development',
      MODULA_DATABASE_URL: databaseUrl!,
      MODULA_DATABASE_MIGRATOR_URL: databaseUrl!,
      MODULA_API_HOST: '127.0.0.1',
      MODULA_API_PORT: '4091',
      MODULA_PUBLIC_API_URL: 'https://api.test.modula.digital',
      MODULA_ALLOWED_ORIGINS: 'https://modula.digital',
      MODULA_ADMIN_HANDLES: admin.handle,
    }))
  })

  afterAll(async () => db?.destroy())

  it('creates developer identity, organisations and account-owned publisher claims', async () => {
    const profile = await service.upsertProfile(owner.accountId, {displayName: 'Developer Owner', biography: 'Builds modules'})
    expect(profile.status).toBe('ACTIVE')
    const organisation = await service.createOrganisation(owner.accountId, {slug: `team-${suffix}`, displayName: 'Developer Team'})
    organisationId = organisation.organisationId
    expect(organisation.role).toBe('OWNER')
    expect((await service.inviteOrganisationMember(owner.accountId, organisationId, {accountId: attacker.accountId, role: 'VIEWER'})).state).toBe('INVITED')
    expect((await service.acceptOrganisationInvitation(attacker.accountId, organisationId)).state).toBe('ACTIVE')
    await service.createPublisher(owner.accountId, {publisherId, displayName: 'Example Publisher'})
    expect(await service.claimNamespace(owner.accountId, publisherId, namespace)).toMatchObject({verified: false})
    expect((await service.verifyNamespace(admin.accountId, namespace)).verified_at).toBeInstanceOf(Date)
    await expect(service.claimNamespace(owner.accountId, publisherId, 'digital.modula.evil')).rejects.toMatchObject({code: 'FORBIDDEN'})
    await expect(service.claimNamespace(attacker.accountId, publisherId, `attacker.${suffix}`)).rejects.toMatchObject({code: 'FORBIDDEN'})
  })

  it('records exact agreement hashes and explicit programme transitions without legal text', async () => {
    const hash = createHash('sha256').update('developer-agreement-fixture-v1').digest('hex')
    await db.insertInto('greenfield_developer_agreements').values({agreement_id: 'developer-programme-fixture', version: '1.0.0', document_hash: hash, effective_at: new Date(Date.now() - 1_000), superseded_at: null, created_at: new Date()}).execute()
    const accepted = await service.acceptAgreement(owner.accountId, 'developer-programme-fixture', '1.0.0', hash)
    expect(accepted.document_hash).toBe(hash)
    await expect(service.acceptAgreement(attacker.accountId, 'developer-programme-fixture', '1.0.0', '0'.repeat(64))).rejects.toMatchObject({code: 'CONFLICT'})
    expect((await service.enrol(owner.accountId)).state).toBe('PENDING')
    expect((await service.setProgrammeState(admin.accountId, owner.accountId, 'ACTIVE', 'Fixture operator approval')).state).toBe('ACTIVE')
    await expect(service.setProgrammeState(attacker.accountId, owner.accountId, 'SUSPENDED')).rejects.toMatchObject({code: 'FORBIDDEN'})
  })

  it('allows private development before publisher verification and gates public review', async () => {
    const privateProduct = await service.createProduct(owner.accountId, {productId: privateProductId, publisherId, kind: 'module', displayName: 'Private Product'})
    expect(privateProduct.visibility).toBe('PRIVATE')
    await expect(service.productDetail(attacker.accountId, privateProductId)).rejects.toMatchObject({code: 'FORBIDDEN'})
    await expect(service.connectSource(owner.accountId, privateProductId, {provider: 'github', repository: 'example/private', credentialRef: 'plaintext-token'})).rejects.toMatchObject({code: 'FORBIDDEN'})
    const source = await service.connectSource(owner.accountId, privateProductId, {provider: 'github', repository: 'example/private', credentialRef: `secret://developer.${suffix}/github`})
    expect(source.credential_ref).toMatch(/^secret:\/\/developer\./)

    await db.updateTable('greenfield_publishers').set({status: 'verified', trust_level: 'verifiedPublisher', verified_at: new Date(), updated_at: new Date()}).where('publisher_id', '=', publisherId).execute()
    const publicProductId = `${namespace}.public-product`
    expect((await service.createProduct(owner.accountId, {productId: publicProductId, publisherId, kind: 'backend-service', displayName: 'Public Product', visibility: 'PUBLIC'})).visibility).toBe('PUBLIC')
    await service.createTestGroup(owner.accountId, publicProductId, {name: 'Beta testers', kind: 'BETA'})

    const now = new Date()
    const buildId = `build-${suffix}`
    const releaseId = `release-${suffix}`
    await db.insertInto('greenfield_developer_builds').values({build_id: buildId, product_id: publicProductId, source_connection_id: null, source_sha: 'a'.repeat(40), state: 'SUCCEEDED', builder_identity: 'test.builder', artifact_ref: 'artifact://fixture', artifact_sha256: 'b'.repeat(64), sbom_ref: 'sbom://fixture', provenance_ref: 'provenance://fixture', created_by_account_id: owner.accountId, created_at: now, started_at: now, finished_at: now}).execute()
    await db.insertInto('greenfield_developer_releases').values({developer_release_id: releaseId, product_id: publicProductId, build_id: buildId, module_release_id: null, version: '1.0.0', channel: 'BETA', state: 'CANDIDATE', released_at: null, created_at: now, updated_at: now}).execute()
    expect((await service.submitReview(owner.accountId, publicProductId, {developerReleaseId: releaseId, checks: {manifest: 'PASS', provenance: 'PASS'}})).state).toBe('SUBMITTED')
    const board = await service.board(owner.accountId)
    expect(board.counts).toMatchObject({products: 2, builds: 1, releases: 1, pendingReviews: 1})
    expect(JSON.stringify(board)).not.toContain('secret://')
  })
})

async function seedAccount(db: ModulaDb, identity: {accountId: string; handle: string}) {
  const now = new Date()
  await db.insertInto('greenfield_accounts').values({account_id: identity.accountId, primary_handle: identity.handle, status: 'active', created_at: now, updated_at: now}).execute()
}
