import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/index.js'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldEventBus} from '../src/events/index.js'
import {GreenfieldSearchService} from '../src/domains/search/index.js'
import {PostWriteService} from '../src/domains/posts/writes.js'
import {ProfileWriteService} from '../src/domains/profiles/writes.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {createDb as createWorkerDb, type ModulaWorkerDb} from '../../greenfield-worker/src/database.js'
import {processOneEventDelivery} from '../../greenfield-worker/src/events/runner.js'
import type {WorkerConfig} from '../../greenfield-worker/src/config.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Phase 7E unified search platform', () => {
  let db: ModulaDb
  let workerDb: ModulaWorkerDb
  let search: GreenfieldSearchService
  let posts: PostWriteService
  let profiles: ProfileWriteService
  let modules: GreenfieldModuleReleaseService
  const suffix = randomUUID().slice(0, 8)
  const ownerAccountId = `search-owner-${suffix}`
  const ownerActorId = `search-owner-actor-${suffix}`
  const otherAccountId = `search-other-${suffix}`
  const otherActorId = `search-other-actor-${suffix}`

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    workerDb = createWorkerDb(databaseUrl!)
    const config = loadConfig()
    search = new GreenfieldSearchService(db, config)
    posts = new PostWriteService(db, config)
    profiles = new ProfileWriteService(db)
    modules = new GreenfieldModuleReleaseService(db)
    await seedProfileAccount(db, ownerAccountId, ownerActorId, `srchowner${suffix}`.slice(0, 24), 'Search Owner')
    await seedProfileAccount(db, otherAccountId, otherActorId, `srchother${suffix}`.slice(0, 24), 'Search Other')
  })

  afterAll(async () => {
    await workerDb?.destroy()
    await db?.destroy()
  })

  it('projects posts through real events, enforces visibility, rejects stale events, tombstones deletes and paginates', async () => {
    const publicPost = await posts.create(ownerActorId, {
      text: `Phase7E searchable comet ${suffix} #phase7e`,
      audience: 'public',
      idempotencyKey: `public-${suffix}`,
    }, {requestId: `req-search-public-${suffix}`})
    await drainSearchDeliveries()

    const publicResult = await search.search({query: `comet ${suffix}`, entityTypes: ['post']}, actorContext(null, null, `req-search-query-public-${suffix}`))
    expect(publicResult.results.some(result => result.entityType === 'post' && result.entityId === publicPost.id)).toBe(true)
    expect(JSON.stringify(publicResult.results)).not.toContain('search_vector')

    const privatePost = await posts.create(ownerActorId, {
      text: `Phase7E private nebula ${suffix}`,
      audience: 'private',
      idempotencyKey: `private-${suffix}`,
    }, {requestId: `req-search-private-${suffix}`})
    await drainSearchDeliveries()

    const otherResult = await search.search({query: `private nebula ${suffix}`, entityTypes: ['post']}, actorContext(otherActorId, otherAccountId, `req-search-query-other-${suffix}`))
    expect(otherResult.results.some(result => result.entityId === privatePost.id)).toBe(false)

    const ownerResult = await search.search({query: `private nebula ${suffix}`, entityTypes: ['post']}, actorContext(ownerActorId, ownerAccountId, `req-search-query-owner-${suffix}`))
    expect(ownerResult.results.some(result => result.entityId === privatePost.id)).toBe(true)

    await posts.update(ownerActorId, publicPost.id, {
      expectedVersion: 1,
      text: `Phase7E updated meteor ${suffix} #phase7e`,
    }, {requestId: `req-search-update-${suffix}`})
    await drainSearchDeliveries()

    const updated = await search.search({query: `updated meteor ${suffix}`, entityTypes: ['post']}, actorContext(null, null, `req-search-query-updated-${suffix}`))
    expect(updated.results.some(result => result.entityId === publicPost.id)).toBe(true)
    const versionAfterUpdate = await documentVersion('post', publicPost.id)
    expect(versionAfterUpdate).toBe(2)

    await new GreenfieldEventBus(db).publish({
      eventType: 'post.updated',
      aggregateType: 'post',
      aggregateId: publicPost.id,
      aggregateVersion: 1,
      actorId: ownerActorId,
      accountId: ownerAccountId,
      requestId: `req-search-stale-${suffix}`,
      correlationId: `req-search-stale-${suffix}`,
      visibility: 'public',
      classification: 'internal',
      payload: {postId: publicPost.id, sourceVersion: 1},
      metadata: {test: 'stale-version'},
    })
    await drainSearchDeliveries()
    expect(await documentVersion('post', publicPost.id)).toBe(2)

    await posts.delete(ownerActorId, publicPost.id, {requestId: `req-search-delete-${suffix}`})
    await drainSearchDeliveries()
    const deleted = await search.search({query: `updated meteor ${suffix}`, entityTypes: ['post']}, actorContext(null, null, `req-search-query-deleted-${suffix}`))
    expect(deleted.results.some(result => result.entityId === publicPost.id)).toBe(false)
    const tombstone = await db.selectFrom('search_documents').select(['status', 'body']).where('entity_type', '=', 'post').where('entity_id', '=', publicPost.id).executeTakeFirstOrThrow()
    expect(tombstone.status).toBe('deleted')
    expect(tombstone.body).toBeNull()

    for (let index = 0; index < 3; index += 1) {
      await posts.create(ownerActorId, {
        text: `Phase7E pageable atlas ${suffix} ${index}`,
        audience: 'public',
        idempotencyKey: `pageable-${suffix}-${index}`,
      }, {requestId: `req-search-pageable-${suffix}-${index}`})
    }
    await drainSearchDeliveries(10)
    const firstPage = await search.search({query: `pageable atlas ${suffix}`, entityTypes: ['post'], limit: 2}, actorContext(null, null, `req-search-page-1-${suffix}`))
    expect(firstPage.results).toHaveLength(2)
    expect(firstPage.nextCursor).toBeTruthy()
    const secondPage = await search.search({query: `pageable atlas ${suffix}`, entityTypes: ['post'], limit: 2, cursor: firstPage.nextCursor}, actorContext(null, null, `req-search-page-2-${suffix}`))
    expect(secondPage.results.length).toBeGreaterThanOrEqual(1)
    expect(secondPage.results.map(result => result.entityId)).not.toContain(firstPage.results[0]!.entityId)
  })

  it('projects profile updates and keeps recent searches account-scoped', async () => {
    await profiles.updateMe(ownerActorId, {
      expectedVersion: 1,
      displayName: `Searchable Founder ${suffix}`,
      bio: `Profile search boundary ${suffix}`,
      visibility: 'public',
    }, {requestId: `req-search-profile-${suffix}`})
    await drainSearchDeliveries()

    const result = await search.search({query: `Founder ${suffix}`, entityTypes: ['profile']}, actorContext(otherActorId, otherAccountId, `req-search-profile-query-${suffix}`))
    expect(result.results.some(item => item.entityType === 'profile' && item.metadata.handle === `srchowner${suffix}`.slice(0, 24))).toBe(true)
    expect(JSON.stringify(result.results)).not.toContain('email')

    await expect(
      search.search({query: `Founder ${suffix}`, entityTypes: ['profile'], cursor: 'not-a-valid-cursor'}, actorContext(ownerActorId, ownerAccountId, `req-search-bad-cursor-${suffix}`)),
    ).rejects.toMatchObject({code: 'VALIDATION_FAILED'})

    await search.search({query: `owner-only recent ${suffix}`, entityTypes: ['profile']}, actorContext(ownerActorId, ownerAccountId, `req-search-recent-owner-${suffix}`))
    const recentOwner = await search.listRecent(actorContext(ownerActorId, ownerAccountId, `req-search-recent-list-owner-${suffix}`), {})
    const recentOther = await search.listRecent(actorContext(otherActorId, otherAccountId, `req-search-recent-list-other-${suffix}`), {})
    expect(recentOwner.items.some(item => item.query === `owner-only recent ${suffix}`)).toBe(true)
    expect(recentOther.items.some(item => item.query === `owner-only recent ${suffix}`)).toBe(false)
  })

  it('projects module and release metadata and hides quarantined modules from normal search', async () => {
    const moduleId = `digital.modula.search-${suffix}`
    await modules.importPendingReview(testManifest(moduleId, suffix))
    await modules.publishRelease(moduleId, '1.0.0')
    await drainSearchDeliveries(12)

    const moduleResult = await search.search({query: `Search Module ${suffix}`, entityTypes: ['module']}, actorContext(null, null, `req-search-module-${suffix}`))
    expect(moduleResult.results.some(result => result.entityType === 'module' && result.entityId === moduleId)).toBe(true)
    const releaseResult = await search.search({query: '1.0.0', entityTypes: ['module-release']}, actorContext(null, null, `req-search-release-${suffix}`))
    expect(releaseResult.results.some(result => result.entityType === 'module-release' && result.metadata.moduleId === moduleId)).toBe(true)

    await modules.quarantineRelease(`module-release:${moduleId}:1.0.0`, 'search verifier quarantine')
    await drainSearchDeliveries(10)
    const quarantined = await search.search({query: `Search Module ${suffix}`, entityTypes: ['module']}, actorContext(null, null, `req-search-module-quarantine-${suffix}`))
    expect(quarantined.results.some(result => result.entityId === moduleId)).toBe(false)
  })

  it('exposes diagnostics and queues audited reindex work', async () => {
    const diagnostics = await search.diagnostics()
    expect(diagnostics.documentsByEntityType.post).toBeGreaterThan(0)
    expect(diagnostics.projectionLag.some(item => item.projectorId === 'search.post-projector')).toBe(true)

    const reindex = await search.requestReindex(
      {...actorContext(ownerActorId, ownerAccountId, `req-search-reindex-${suffix}`), capabilities: ['admin:ops']},
      {mode: 'single-entity', entityType: 'profile', entityId: `profile-${ownerActorId}`, dryRun: true, reason: 'search verifier dry run'},
    )
    expect(reindex.state).toBe('queued')
    const audit = await db.selectFrom('audit_events').select('event_type').where('event_type', '=', 'search.reindex.requested').where('request_id', '=', `req-search-reindex-${suffix}`).executeTakeFirst()
    expect(audit?.event_type).toBe('search.reindex.requested')
  })

  async function drainSearchDeliveries(max = 8): Promise<void> {
    for (let i = 0; i < max; i += 1) {
      const worked = await processOneEventDelivery(workerDb, workerConfig())
      if (!worked) return
    }
  }

  async function documentVersion(entityType: string, entityId: string): Promise<number> {
    const row = await db.selectFrom('search_documents').select('source_version').where('entity_type', '=', entityType as any).where('entity_id', '=', entityId).executeTakeFirstOrThrow()
    return Number(row.source_version)
  }
})

function configureTestEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4022'
  process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4022'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
}

function actorContext(actorId: string | null, accountId: string | null, requestId: string) {
  return {actorId, accountId, capabilities: [], requestId, correlationId: requestId}
}

function workerConfig(): WorkerConfig {
  return {
    nodeEnv: 'test',
    environment: 'development',
    workerId: `search-worker-${process.pid}`,
    logLevel: 'silent',
    databaseUrl: databaseUrl!,
    pollIntervalMs: 1,
    emptyPollBackoffMs: 1,
    leaseDurationMs: 60_000,
    leaseReapIntervalMs: 60_000,
    outboxDrainIntervalMs: 60_000,
    outboxBatchSize: 10,
    eventSubscriberTimeoutMs: 10_000,
    ingestIntervalMs: 60_000,
    ingestEnabled: false,
    encryptionKeysByVersion: new Map([[1, Buffer.alloc(32, 7)]]),
    encryptionKeyIsEphemeral: true,
    ssrfAllowPrivateNetworks: false,
    moduleRemoteFunctionsEnabled: false,
    moduleCommunityExecutionEnabled: false,
    moduleGithubSyncEnabled: false,
  }
}

async function seedProfileAccount(db: ModulaDb, accountId: string, actorId: string, handle: string, displayName: string): Promise<void> {
  const now = new Date()
  await db.insertInto('greenfield_accounts').values({account_id: accountId, primary_handle: handle, status: 'active', created_at: now, updated_at: now}).execute()
  await db.insertInto('actors').values({id: actorId, account_id: accountId, kind: 'person', created_at: now, updated_at: now, deleted_at: null, version: 1}).execute()
  await db
    .insertInto('profiles')
    .values({
      id: `profile-${actorId}`,
      actor_id: actorId,
      handle,
      display_name: displayName,
      kind: 'person',
      bio: '',
      avatar_url: null,
      cover_url: null,
      cover_colour: null,
      pronouns: null,
      location_label: null,
      location_visibility: null,
      website_label: null,
      website_url: null,
      website_domain: null,
      website_visibility: null,
      focus_status_id: 'available',
      focus_status_label: 'Available',
      focus_status_message: '',
      focus_status_updated_at: now,
      visibility: 'public',
      module_count: 0,
      featured_module_ids: [],
      identity_claims: [],
      joined_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    })
    .execute()
}

function testManifest(moduleId: string, suffix: string) {
  return {
    manifestVersion: 1,
    moduleId,
    name: `Search Module ${suffix}`,
    description: `Searchable module release ${suffix}`,
    version: '1.0.0',
    publisher: {publisherId: 'modula', displayName: 'Modula'},
    source: {
      provider: 'github',
      repository: 'modula-mod/search-module',
      commit: '1234567890abcdef1234567890abcdef12345678',
      manifestPath: 'manifest.json',
    },
    license: {status: 'firstParty', evidenceIds: ['modula-first-party']},
    trust: {requestedLevel: 'firstParty'},
    compatibility: {platforms: ['web', 'ios'], minimumModulaVersion: '0.1.0'},
    permissions: [],
    contributions: {routes: [], profileTabs: [], boardSurfaces: [], settings: [], schemas: [], tools: [], functions: [], widgets: [], plugins: [], connectors: [], jobs: [], events: []},
    lifecycle: {executionMode: 'declarative'},
    integrity: {manifestSha256: '', releaseSha256: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd'},
    extensions: {releaseNotes: `Release notes ${suffix}`, channel: 'stable', categories: ['productivity']},
  } as any
}
