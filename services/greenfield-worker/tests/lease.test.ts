import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {claimNextJob, reapExpiredLeases} from '../src/jobs/claim.js'
import {createDb, type ModulaWorkerDb} from '../src/database.js'

describe('lease exclusivity', () => {
  it('uses SKIP LOCKED claim SQL', () => {
    const src = readFileSync(new URL('../src/jobs/claim.ts', import.meta.url), 'utf8')
    expect(src).toContain('FOR UPDATE SKIP LOCKED')
    expect(src).toContain("status = 'LEASED'")
    expect(src).toContain("dispatch_mode = 'GREENFIELD_WORKER'")
  })
})

// These tests only run when a live preview/test database is configured. They are skipped
// (not failed) otherwise so `pnpm test` stays hermetic in CI without a database.
const testDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeLive = testDatabaseUrl ? describe : describe.skip

describeLive('lease exclusivity (live database)', () => {
  let db: ModulaWorkerDb
  const jobIds: string[] = []

  beforeAll(async () => {
    db = createDb(testDatabaseUrl as string)
  })

  afterAll(async () => {
    if (jobIds.length > 0) {
      await db
        .updateTable('background_jobs')
        .set({status: 'SUCCEEDED', lease_owner: null, lease_expires_at: null})
        .where('id', 'in', jobIds)
        .execute()
    }
    await db.destroy()
  })

  it('never lets two concurrent claimers lease the same job', async () => {
    const jobId = `test-lease-${randomUUID()}`
    jobIds.push(jobId)
    await db
      .insertInto('background_jobs')
      .values({
        id: jobId,
        job_type: 'notification.create',
        payload: {smoke: true} as never,
        status: 'QUEUED',
        action: 'notification.create',
        trace_id: jobId,
        priority: -1_000,
        available_at: new Date(),
        attempt_count: 0,
        maximum_attempts: 5,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    const [a, b, c] = await Promise.all([
      claimNextJob(db, 'worker-a', 60_000),
      claimNextJob(db, 'worker-b', 60_000),
      claimNextJob(db, 'worker-c', 60_000),
    ])

    const claimed = [a, b, c].filter(job => job?.id === jobId)
    expect(claimed).toHaveLength(1)
    expect(claimed[0]?.status).toBe('LEASED')
  })

  it('does not reclaim a job whose lease has not expired', async () => {
    const jobId = `test-lease-${randomUUID()}`
    jobIds.push(jobId)
    await db
      .insertInto('background_jobs')
      .values({
        id: jobId,
        job_type: 'notification.create',
        payload: {smoke: true} as never,
        status: 'QUEUED',
        action: 'notification.create',
        trace_id: jobId,
        priority: -1_000,
        available_at: new Date(),
        attempt_count: 0,
        maximum_attempts: 5,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    const first = await claimNextJob(db, 'worker-a', 60_000)
    expect(first?.id).toBe(jobId)

    const second = await claimNextJob(db, 'worker-b', 60_000)
    expect(second?.id).not.toBe(jobId)
  })

  it('dead-letters exhausted expired leases without retaining their payload', async () => {
    const jobId = `test-lease-${randomUUID()}`
    jobIds.push(jobId)
    await db
      .insertInto('background_jobs')
      .values({
        id: jobId,
        job_type: 'notification.create',
        payload: {apiKey: 'must-not-survive'} as never,
        status: 'LEASED',
        action: 'notification.create',
        trace_id: jobId,
        priority: -1_000,
        available_at: new Date(0),
        lease_owner: 'crashed-worker',
        lease_expires_at: new Date(0),
        attempt_count: 1,
        maximum_attempts: 1,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    // The reaper intentionally processes a bounded batch across the shared queue.
    // Other suites may leave additional expired fixtures, so assert that this
    // invocation did work and prove this job's state below instead of assuming
    // exclusive ownership of the database.
    expect(await reapExpiredLeases(db)).toBeGreaterThanOrEqual(1)
    const job = await db.selectFrom('background_jobs').select(['status', 'error_class', 'finished_at']).where('id', '=', jobId).executeTakeFirstOrThrow()
    expect(job).toMatchObject({status: 'DEAD_LETTER', error_class: 'WORKER_LEASE_EXPIRED'})
    expect(job.finished_at).not.toBeNull()
    const failure = await db.selectFrom('job_failures').select(['payload', 'payload_fingerprint', 'error_message']).where('job_id', '=', jobId).executeTakeFirstOrThrow()
    expect(failure.payload).toEqual({})
    expect(failure.payload_fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(failure.error_message).not.toContain('must-not-survive')
  })
})
