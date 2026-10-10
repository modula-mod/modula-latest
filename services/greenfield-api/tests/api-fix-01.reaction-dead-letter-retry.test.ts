import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {listEligibleReactionDeadLetters, retryReactionNotificationDeadLetter} from '../src/domains/notifications/reaction-dead-letter-retry.js'
import {configureRegistryTestEnv, registerAccount} from './helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb.sequential('API-FIX-01 reaction dead-letter replay authority', () => {
  const suffix = randomUUID().slice(0, 8)
  const adminHandle = `replayadmin${suffix}`
  const operatorHandle = `replayoperator${suffix}`
  const eligibleId = `reaction-replay-eligible-${suffix}`
  const unrelatedId = `reaction-replay-unrelated-${suffix}`
  const wrongConstraintId = `reaction-replay-wrong-constraint-${suffix}`
  const staleEvidenceId = `reaction-replay-stale-evidence-${suffix}`
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let adminToken = ''
  let operatorToken = ''
  let adminActorId = ''

  beforeAll(async () => {
    configureRegistryTestEnv(databaseUrl!, '4097')
    process.env.MODULA_ADMIN_HANDLES = adminHandle
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    const admin = await registerAccount(app, `replay-admin-${suffix}@example.com`, adminHandle, db)
    const operator = await registerAccount(app, `replay-operator-${suffix}@example.com`, operatorHandle, db)
    adminToken = admin.token
    operatorToken = operator.token
    adminActorId = `actor-${admin.accountId}`
    const now = new Date()
    for (const [id, jobType, failureMessage] of [
      [eligibleId, 'notification.reaction', 'duplicate key value violates unique constraint "notifications_recipient_dedupe_uidx"'],
      [unrelatedId, 'notification.comment', 'duplicate key value violates unique constraint "notifications_recipient_dedupe_uidx"'],
      [wrongConstraintId, 'notification.reaction', 'duplicate key value violates unique constraint "other_unique_idx"'],
      [staleEvidenceId, 'notification.reaction', 'duplicate key value violates unique constraint "notifications_recipient_dedupe_uidx"'],
    ] as const) {
      await db.insertInto('background_jobs').values({
        id, job_type: jobType, payload: {}, status: 'DEAD_LETTER', priority: 100,
        available_at: now, lease_owner: null, lease_expires_at: null,
        attempt_count: 5, maximum_attempts: 5, last_error: failureMessage,
        action: jobType, trace_id: id, created_at: now, updated_at: now,
        completed_at: now, error_code: '23505', error_class: '23505', finished_at: now,
      }).execute()
      await db.insertInto('job_failures').values({
        id: `failure-${id}`, job_id: id, job_type: jobType, payload: {},
        error_code: '23505', error_class: '23505', error_message: failureMessage,
        permanent: false, payload_fingerprint: `sha256:${'0'.repeat(64)}`,
        created_at: new Date(now.getTime() - 1_000),
      }).execute()
    }
    await db.insertInto('job_failures').values({
      id: `failure-newer-${staleEvidenceId}`, job_id: staleEvidenceId,
      job_type: 'notification.reaction', payload: {}, error_code: '23505',
      error_class: '23505', error_message: 'duplicate key value violates unique constraint "other_unique_idx"',
      permanent: false, payload_fingerprint: `sha256:${'0'.repeat(64)}`, created_at: now,
    }).execute()
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  const auth = (token: string) => ({authorization: `Bearer ${token}`})
  const url = (id: string) => `/v1/admin/ops/jobs/reaction-dead-letters/${id}/retry`

  it('inventories only dead letters with the latest exact reaction constraint evidence', async () => {
    expect(await listEligibleReactionDeadLetters(db)).toEqual([eligibleId])
  })

  it('denies anonymous and non-admin callers without changing the job', async () => {
    const anonymous = await app.inject({method: 'POST', url: url(eligibleId), payload: {reason: 'test'}})
    expect(anonymous.statusCode).toBe(401)
    expect(anonymous.json().error.code).toBe('UNAUTHENTICATED')
    const nonAdmin = await app.inject({method: 'POST', url: url(eligibleId), headers: auth(operatorToken), payload: {reason: 'test'}})
    expect(nonAdmin.statusCode).toBe(403)
    expect(nonAdmin.json().error.code).toBe('CAPABILITY_DISABLED')
    const job = await db.selectFrom('background_jobs').select('status').where('id', '=', eligibleId).executeTakeFirstOrThrow()
    expect(job.status).toBe('DEAD_LETTER')
  })

  it('rejects malformed IDs and bodies before replay', async () => {
    const oversizedId = await app.inject({method: 'POST', url: url('x'.repeat(201)), headers: auth(adminToken), payload: {reason: 'test'}})
    expect([400, 414]).toContain(oversizedId.statusCode)
    const malformedId = await app.inject({method: 'POST', url: url('invalid%20job'), headers: auth(adminToken), payload: {reason: 'test'}})
    expect(malformedId.statusCode).toBe(400)
    const oversizedReason = await app.inject({method: 'POST', url: url(eligibleId), headers: auth(adminToken), payload: {reason: 'x'.repeat(501)}})
    expect(oversizedReason.statusCode).toBe(400)
    const blankReason = await app.inject({method: 'POST', url: url(eligibleId), headers: auth(adminToken), payload: {reason: '   '}})
    expect(blankReason.statusCode).toBe(400)
    expect((await db.selectFrom('background_jobs').select('status').where('id', '=', eligibleId).executeTakeFirstOrThrow()).status).toBe('DEAD_LETTER')
  })

  it('requeues only the latest matching historical collision and retains failure evidence', async () => {
    await expect(retryReactionNotificationDeadLetter(db, unrelatedId, adminActorId))
      .rejects.toMatchObject({code: 'NOT_FOUND'})
    for (const id of [wrongConstraintId, staleEvidenceId]) {
      await expect(retryReactionNotificationDeadLetter(db, id, adminActorId))
        .rejects.toMatchObject({code: 'CONFLICT'})
    }
    const response = await app.inject({method: 'POST', url: url(eligibleId), headers: auth(adminToken), payload: {reason: 'verified API-FIX-01 historical replay'}})
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json().data).toEqual({jobId: eligibleId, status: 'RETRYING'})
    const job = await db.selectFrom('background_jobs').selectAll().where('id', '=', eligibleId).executeTakeFirstOrThrow()
    expect(job).toMatchObject({status: 'RETRYING', attempt_count: 0, error_code: null, error_class: null})
    expect(job.completed_at).toBeNull()
    expect(job.finished_at).toBeNull()
    const failure = await db.selectFrom('job_failures').select('id').where('job_id', '=', eligibleId).executeTakeFirstOrThrow()
    expect(failure.id).toBe(`failure-${eligibleId}`)
    const audit = await db.selectFrom('audit_events').select(['actor_id', 'request_id', 'metadata'])
      .where('event_type', '=', 'admin.notification.reaction_dead_letter.retried')
      .where('resource_id', '=', eligibleId).executeTakeFirstOrThrow()
    expect(audit.actor_id).toBe(adminActorId)
    expect(audit.request_id).toBe(response.json().meta.requestId)
    expect(audit.metadata).toMatchObject({originalFailureId: failure.id, reason: 'verified API-FIX-01 historical replay'})
    const repeat = await app.inject({method: 'POST', url: url(eligibleId), headers: auth(adminToken), payload: {reason: 'repeat'}})
    expect(repeat.statusCode).toBe(409)
    for (const id of [unrelatedId, wrongConstraintId, staleEvidenceId]) {
      const other = await db.selectFrom('background_jobs').select('status').where('id', '=', id).executeTakeFirstOrThrow()
      expect(other.status).toBe('DEAD_LETTER')
    }
  })
})
