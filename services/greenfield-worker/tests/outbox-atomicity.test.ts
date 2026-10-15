import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {migrateUp} from '../../greenfield-api/src/database/migrate.js'
import {createDb, type ModulaWorkerDb} from '../src/database.js'
import {drainOutboxOnce} from '../src/outbox/drain.js'

const testDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeLive = testDatabaseUrl ? describe : describe.skip

describeLive('transactional outbox fault recovery', () => {
  let db: ModulaWorkerDb
  const suffix = randomUUID().replaceAll('-', '')
  const outboxId = `closeout-outbox-${suffix}`
  const functionName = `greenfield_closeout_outbox_fault_${suffix}`
  const triggerName = `greenfield_closeout_outbox_fault_trigger_${suffix}`

  beforeAll(async () => {
    await migrateUp(testDatabaseUrl as string)
    db = createDb(testDatabaseUrl as string)
  })

  afterAll(async () => {
    if (!db) return
    await sql.raw(`DROP TRIGGER IF EXISTS ${triggerName} ON outbox_events`).execute(db).catch(() => undefined)
    await sql.raw(`DROP FUNCTION IF EXISTS ${functionName}()`).execute(db).catch(() => undefined)
    await db.deleteFrom('background_jobs').where(sql<boolean>`payload ->> 'outboxId' = ${outboxId}`).execute()
    await db.deleteFrom('outbox_events').where('id', '=', outboxId).execute()
    await db.destroy()
  })

  it('rolls back job creation when publish marking fails, then replays exactly once', async () => {
    await db.insertInto('outbox_events').values({
      id: outboxId,
      event_type: 'audit.checkpoint',
      aggregate_type: 'closeout-probe',
      aggregate_id: outboxId,
      payload: {probe: 'outbox-atomicity'},
      created_at: new Date(0),
      published_at: null,
      attempt_count: 0,
      last_error: null,
    }).execute()

    await sql.raw(`
      CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.id = '${outboxId}' AND NEW.published_at IS NOT NULL THEN
          RAISE EXCEPTION 'closeout outbox publish fault';
        END IF;
        RETURN NEW;
      END
      $$
    `).execute(db)
    await sql.raw(`
      CREATE TRIGGER ${triggerName}
      BEFORE UPDATE ON outbox_events
      FOR EACH ROW EXECUTE FUNCTION ${functionName}()
    `).execute(db)

    await expect(drainOutboxOnce(db, 1_000)).rejects.toThrow('closeout outbox publish fault')
    expect(await outboxJobs()).toHaveLength(0)
    expect((await db.selectFrom('outbox_events').select(['published_at', 'attempt_count']).where('id', '=', outboxId).executeTakeFirstOrThrow()))
      .toMatchObject({published_at: null, attempt_count: 0})

    await sql.raw(`DROP TRIGGER ${triggerName} ON outbox_events`).execute(db)
    await sql.raw(`DROP FUNCTION ${functionName}()`).execute(db)

    expect(await drainOutboxOnce(db, 1_000)).toBeGreaterThanOrEqual(1)
    expect(await outboxJobs()).toHaveLength(1)
    const published = await db.selectFrom('outbox_events').select(['published_at', 'attempt_count']).where('id', '=', outboxId).executeTakeFirstOrThrow()
    expect(published.published_at).not.toBeNull()
    expect(published.attempt_count).toBe(1)

    await drainOutboxOnce(db, 1_000)
    expect(await outboxJobs()).toHaveLength(1)
  })

  async function outboxJobs() {
    return db.selectFrom('background_jobs').select('id').where(sql<boolean>`payload ->> 'outboxId' = ${outboxId}`).execute()
  }
})
