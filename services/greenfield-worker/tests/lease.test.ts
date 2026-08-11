import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {claimNextJob} from '../src/jobs/claim.js'
import {createDb, type ModulaWorkerDb} from '../src/database.js'

describe('lease exclusivity', () => {
  it('uses SKIP LOCKED claim SQL', () => {
    const src = readFileSync(new URL('../src/jobs/claim.ts', import.meta.url), 'utf8')
    expect(src).toContain('FOR UPDATE SKIP LOCKED')
    expect(src).toContain("status = 'leased'")
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
        .set({status: 'completed', lease_owner: null, lease_expires_at: null})
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
        status: 'pending',
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
    expect(claimed[0]?.status).toBe('leased')
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
        status: 'pending',
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
})
