import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {GreenfieldRuntimeManager, GreenfieldRuntimeProviderRegistry} from '@modula/greenfield-runtime'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldRuntimeSessionRepository} from '../src/runtime/session-store.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIf = databaseUrl ? describe : describe.skip

describeIf('Phase 7D runtime session persistence', () => {
  let db: ModulaDb
  let accountId = ''

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    accountId = `runtime-account-${Date.now().toString(36)}`
    await db
      .insertInto('greenfield_accounts')
      .values({
        account_id: accountId,
        primary_handle: `runtime${Date.now().toString(36)}`.slice(0, 20),
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('persists logical sessions and lifecycle events without provider handles', async () => {
    const store = new GreenfieldRuntimeSessionRepository(db)
    const manager = new GreenfieldRuntimeManager({
      registry: new GreenfieldRuntimeProviderRegistry(),
      sessionStore: store,
      idFactory: () => `runtime-session-persisted-${accountId}`,
      clock: () => new Date('2026-07-28T12:00:00.000Z'),
    })

    const created = await manager.createLogicalSession({
      sessionKind: 'automation-run',
      accountId,
      providerIds: ['modula.automation'],
      metadata: {scheduleAttached: true},
    })
    expect(created.state).toBe('creating')
    expect(created.providerIds).toEqual(['modula.automation'])

    const resolving = await manager.transition(created.sessionId, 'resolving')
    expect(resolving.state).toBe('resolving')
    expect(resolving.metadata.scheduleAttached).toBe(true)

    const sessions = await store.listForAccount(accountId)
    expect(sessions.map(session => session.sessionId)).toContain(created.sessionId)

    const events = await db
      .selectFrom('greenfield_runtime_session_events')
      .select(['event_type', 'to_state'])
      .where('session_id', '=', created.sessionId)
      .execute()
    expect(events.map(event => event.event_type)).toEqual(expect.arrayContaining([
      'runtime.session.created',
      'runtime.session.transitioned',
    ]))
    expect(events.find(event => event.event_type === 'runtime.session.transitioned')?.to_state).toBe('resolving')
  })

  it('rejects database persistence of provider implementation references', async () => {
    const store = new GreenfieldRuntimeSessionRepository(db)
    await expect(
      store.create({
        sessionId: `runtime-session-provider-handle-${accountId}`,
        sessionKind: 'ai-tool-run',
        accountId,
        providerIds: ['modula.ai'],
        state: 'creating',
        reasonCodes: ['runtime.session.created'],
        metadata: {providerHandle: 'not-persistable'},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/provider implementation reference/)
  })
})
