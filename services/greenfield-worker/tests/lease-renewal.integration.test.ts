// GF-OPS-01(c): live-Postgres proof that a long job keeps its lease and the
// worker heartbeat stays fresh while the main loop is blocked by the job.
//
// Time is scaled 1:100 so the suite runs in seconds: a 900 ms job stands in for
// a 90 s job, a 600 ms lease for the 60 s default lease, a 200 ms renewal for
// lease/3, a 150 ms heartbeat for the 15 s default, and 900 ms for the ~90 s
// health threshold. Skipped without MODULA_TEST_DATABASE_URL; CI's
// migration-validation worker step runs it and asserts nothing was skipped.
import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'
import {migrateUp} from '../../greenfield-api/src/database/migrate.js'
import type {WorkerConfig} from '../src/config.js'
import {createDb, type ModulaWorkerDb} from '../src/database.js'
import {recordHeartbeat, startHeartbeat} from '../src/heartbeat/heartbeat.js'
import {claimNextJob, markJobRunning, reapExpiredLeases, renewJobLease} from '../src/jobs/claim.js'
import {processOneJob} from '../src/jobs/runner.js'
import {metrics} from '../src/observability/metrics.js'

const slowJob = vi.hoisted(() => ({durationMs: 0, during: null as null | ((elapsedMs: number) => Promise<void>)}))
// Delays markJobRunning to model a large claim -> RUNNING gap (job sits LEASED).
const slowMark = vi.hoisted(() => ({delayMs: 0, during: null as null | (() => Promise<void>), handlerRuns: 0}))
vi.mock('../src/jobs/claim.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/jobs/claim.js')>()
  return {
    ...actual,
    markJobRunning: async (...args: Parameters<typeof actual.markJobRunning>) => {
      if (slowMark.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, slowMark.delayMs))
        if (slowMark.during) await slowMark.during()
      }
      return actual.markJobRunning(...args)
    },
  }
})
vi.mock('../src/notifications/create.js', () => ({
  handleNotificationCreate: async () => {
    slowMark.handlerRuns += 1
    const started = Date.now()
    while (Date.now() - started < slowJob.durationMs) {
      await new Promise(resolve => setTimeout(resolve, 50))
      if (slowJob.during) await slowJob.during(Date.now() - started)
    }
  },
}))

const SCALE = 100
const JOB_MS = 90_000 / SCALE
const LEASE_MS = 60_000 / SCALE
const RENEW_MS = Math.floor(LEASE_MS / 3)
const HEARTBEAT_MS = 15_000 / SCALE
const HEALTH_THRESHOLD_MS = 90_000 / SCALE

const testDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeLive = testDatabaseUrl ? describe : describe.skip

describeLive('GF-OPS-01(c) heartbeat and lease renewal (live Postgres)', () => {
  let db: ModulaWorkerDb
  const suffix = randomUUID().slice(0, 8)
  const jobIds: string[] = []
  const workerIds: string[] = []

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const jobRow = (id: string) => db.selectFrom('background_jobs').select(['status', 'lease_owner', 'lease_expires_at', 'attempt_count']).where('id', '=', id).executeTakeFirstOrThrow()
  const heartbeatAgeMs = async (workerId: string) => {
    const row = await db.selectFrom('greenfield_worker_heartbeats').select('last_seen_at').where('worker_id', '=', workerId).executeTakeFirstOrThrow()
    return Date.now() - new Date(row.last_seen_at).getTime()
  }

  function config(workerId: string): WorkerConfig {
    workerIds.push(workerId)
    return {
      nodeEnv: 'test', environment: 'development', workerId, logLevel: 'silent', databaseUrl: testDatabaseUrl as string,
      pollIntervalMs: 1, emptyPollBackoffMs: 1, leaseDurationMs: LEASE_MS, leaseReapIntervalMs: 30_000,
      leaseRenewIntervalMs: RENEW_MS, heartbeatIntervalMs: HEARTBEAT_MS,
      outboxDrainIntervalMs: 1_000, outboxBatchSize: 10, eventSubscriberTimeoutMs: 1_000, databaseBackoffMaxMs: 60_000,
      shutdownTimeoutMs: 30_000, ingestIntervalMs: 60_000, ingestEnabled: false, mediaRoot: '/tmp/modula-greenfield-test-media',
      mediaCleanupMode: 'disabled', mediaCleanupIntervalMs: 3_600_000, mediaCleanupRetentionMs: 86_400_000,
      mediaCleanupActiveUploadGraceMs: 3_600_000, mediaCleanupBatchSize: 10, mailTransport: 'disabled',
      mailProvisionerMode: 'disabled', mailDomain: 'modula.test', mailProvisionerCommandTimeoutMs: 1_000,
      mailDefaultQuotaBytes: 1, mailRequired: false, mailFrom: 'test@modula.test', smtpPort: 587, smtpSecure: false,
      smtpRequireTls: true, smtpTlsRejectUnauthorized: true, encryptionKeysByVersion: new Map([[1, Buffer.alloc(32, 7)]]),
      encryptionKeyIsEphemeral: true, ssrfAllowPrivateNetworks: false, moduleRemoteFunctionsEnabled: false,
      moduleCommunityExecutionEnabled: false, moduleAllowUntrustedDevelopmentReleases: false, moduleGithubSyncEnabled: false,
    }
  }

  async function enqueue(): Promise<string> {
    const id = `gf-ops-01c-${suffix}-${randomUUID().slice(0, 8)}`
    jobIds.push(id)
    const now = new Date()
    await db.insertInto('background_jobs').values({
      id, job_type: 'notification.create', payload: {gfOps01c: true} as never, status: 'QUEUED', action: 'notification.create',
      trace_id: id, priority: -1_000_000_000, available_at: now, attempt_count: 0, maximum_attempts: 5,
      timeout_ms: 30_000, created_at: now, updated_at: now,
    } as any).execute()
    return id
  }

  /** Releases any unrelated job a probing claimer picked up so the shared queue is left as found. */
  async function releaseForeignClaim(claimed: {id: string} | undefined, ownJobId: string) {
    if (!claimed || claimed.id === ownJobId) return
    await db.updateTable('background_jobs')
      .set(eb => ({status: 'QUEUED', lease_owner: null, lease_expires_at: null, attempt_count: eb('attempt_count', '-', 1)}))
      .where('id', '=', claimed.id).execute()
  }

  beforeAll(async () => {
    await migrateUp(testDatabaseUrl as string)
    db = createDb(testDatabaseUrl as string)
  })

  beforeEach(() => {
    slowJob.durationMs = 0
    slowJob.during = null
    slowMark.delayMs = 0
    slowMark.during = null
    slowMark.handlerRuns = 0
  })

  afterAll(async () => {
    if (!db) return
    if (jobIds.length > 0) {
      await db.deleteFrom('job_failures').where('job_id', 'in', jobIds).execute()
      await db.deleteFrom('background_jobs').where('id', 'in', jobIds).execute()
    }
    if (workerIds.length > 0) await db.deleteFrom('greenfield_worker_heartbeats').where('worker_id', 'in', workerIds).execute()
    await db.destroy()
  })

  it('baseline (pre-fix pattern): a heartbeat written only between jobs and an unrenewed lease both fail a 90 s job', async () => {
    const cfg = config(`gf-ops-01c-baseline-${suffix}`)
    const jobId = await enqueue()
    // The old main loop wrote the heartbeat, then blocked inside the job.
    await recordHeartbeat(db, {workerId: cfg.workerId, releaseSha: null, startedAt: new Date()})
    const job = await claimNextJob(db, cfg.workerId, LEASE_MS)
    expect(job?.id).toBe(jobId)
    await markJobRunning(db, jobId, cfg.workerId)
    await sleep(JOB_MS)
    const age = await heartbeatAgeMs(cfg.workerId)
    console.info(`[GF-OPS-01(c) evidence] baseline heartbeat age after a ${JOB_MS} ms (=90 s) job: ${age} ms (=${(age * SCALE / 1000).toFixed(1)} s scaled)`)
    expect(age).toBeGreaterThanOrEqual(JOB_MS)
    // Without renewal the 60 s lease expired mid-job and the reaper takes it.
    await reapExpiredLeases(db)
    expect(await jobRow(jobId)).toMatchObject({status: 'RETRYING', lease_owner: null})
    // Take the reaped fixture out of the queue so later tests claim their own job.
    await db.deleteFrom('background_jobs').where('id', '=', jobId).execute()
  })

  it('keeps the heartbeat fresh and renews the lease past 60 s through a 90 s job, so no one can reclaim it', async () => {
    const cfg = config(`gf-ops-01c-worker-${suffix}`)
    const jobId = await enqueue()
    const heartbeat = startHeartbeat(db, {workerId: cfg.workerId, releaseSha: null, startedAt: new Date(), intervalMs: HEARTBEAT_MS})
    const renewalsBefore = metrics.read().jobLeaseRenewals
    let maxHeartbeatAgeMs = 0
    let probedPastLease = false
    slowJob.durationMs = JOB_MS
    slowJob.during = async elapsedMs => {
      maxHeartbeatAgeMs = Math.max(maxHeartbeatAgeMs, await heartbeatAgeMs(cfg.workerId))
      if (!probedPastLease && elapsedMs > LEASE_MS + 100) {
        probedPastLease = true
        // Past the original 60 s lease: the reaper and a second claimer must both leave it alone.
        await reapExpiredLeases(db)
        const thief = await claimNextJob(db, `gf-ops-01c-thief-${suffix}`, LEASE_MS)
        await releaseForeignClaim(thief, jobId)
        expect(thief?.id).not.toBe(jobId)
        const row = await jobRow(jobId)
        expect(row).toMatchObject({status: 'RUNNING', lease_owner: cfg.workerId})
        expect(new Date(row.lease_expires_at!).getTime()).toBeGreaterThan(Date.now())
      }
    }
    const log = {warn: vi.fn(), error: vi.fn()}
    try {
      await expect(processOneJob(db, cfg, {log})).resolves.toBe(true)
    } finally {
      await heartbeat.stop()
    }
    console.info(`[GF-OPS-01(c) evidence] fixed: max heartbeat age during a ${JOB_MS} ms (=90 s) job: ${maxHeartbeatAgeMs} ms (=${(maxHeartbeatAgeMs * SCALE / 1000).toFixed(1)} s scaled); renewals: ${metrics.read().jobLeaseRenewals - renewalsBefore}`)
    expect(probedPastLease).toBe(true)
    expect(maxHeartbeatAgeMs).toBeLessThan(HEALTH_THRESHOLD_MS)
    expect(maxHeartbeatAgeMs).toBeLessThan(HEARTBEAT_MS * 3)
    expect(metrics.read().jobLeaseRenewals - renewalsBefore).toBeGreaterThanOrEqual(3)
    expect(await jobRow(jobId)).toMatchObject({status: 'SUCCEEDED', lease_owner: null, lease_expires_at: null, attempt_count: 1})
    expect(log.warn).not.toHaveBeenCalled()
    expect(log.error).not.toHaveBeenCalled()
  })

  it('never renews a lease that was reaped or reclaimed by another worker', async () => {
    const jobId = await enqueue()
    const a = `gf-ops-01c-a-${suffix}`
    const job = await claimNextJob(db, a, LEASE_MS)
    expect(job?.id).toBe(jobId)
    expect(await renewJobLease(db, jobId, a, LEASE_MS)).toBe(true) // LEASED
    expect(await renewJobLease(db, jobId, 'gf-ops-01c-not-owner', LEASE_MS)).toBe(false)
    await markJobRunning(db, jobId, a)
    expect(await renewJobLease(db, jobId, a, LEASE_MS)).toBe(true) // RUNNING

    // Reaper reclaims it (scoped to just past this job's lease expiry) ...
    const expiry = new Date((await jobRow(jobId)).lease_expires_at!)
    await reapExpiredLeases(db, new Date(expiry.getTime() + 1))
    expect(await jobRow(jobId)).toMatchObject({status: 'RETRYING', lease_owner: null})
    expect(await renewJobLease(db, jobId, a, LEASE_MS)).toBe(false)
    expect(await jobRow(jobId)).toMatchObject({status: 'RETRYING', lease_owner: null, lease_expires_at: null})

    // ... and another worker claims and runs it: the stale worker still cannot extend it.
    await db.updateTable('background_jobs').set({available_at: new Date(0)}).where('id', '=', jobId).execute()
    const b = `gf-ops-01c-b-${suffix}`
    const reclaimed = await claimNextJob(db, b, LEASE_MS)
    expect(reclaimed?.id).toBe(jobId)
    await markJobRunning(db, jobId, b)
    const ownedByB = await jobRow(jobId)
    expect(await renewJobLease(db, jobId, a, 60 * 60_000)).toBe(false)
    const after = await jobRow(jobId)
    expect(after).toMatchObject({status: 'RUNNING', lease_owner: b, attempt_count: 2})
    expect(new Date(after.lease_expires_at!).getTime()).toBe(new Date(ownedByB.lease_expires_at!).getTime())
    await db.deleteFrom('background_jobs').where('id', '=', jobId).execute()
  })

  it('stops renewing after losing the lease mid-job and records no outcome (no double completion, no self-retry)', async () => {
    const cfg = config(`gf-ops-01c-loser-${suffix}`)
    const jobId = await enqueue()
    const other = `gf-ops-01c-new-owner-${suffix}`
    let stolen = false
    slowJob.durationMs = JOB_MS
    slowJob.during = async elapsedMs => {
      if (!stolen && elapsedMs > RENEW_MS + 50) {
        stolen = true
        // Simulates a stall long enough for reap + re-claim by another worker.
        await db.updateTable('background_jobs')
          .set({status: 'RUNNING', lease_owner: other, lease_expires_at: new Date(Date.now() + 60_000), attempt_count: 2})
          .where('id', '=', jobId).execute()
      }
    }
    const lostBefore = metrics.read().jobLeasesLost
    const log = {warn: vi.fn(), error: vi.fn()}
    await expect(processOneJob(db, cfg, {log})).resolves.toBe(true)
    expect(stolen).toBe(true)
    expect(await jobRow(jobId)).toMatchObject({status: 'RUNNING', lease_owner: other, attempt_count: 2})
    expect(metrics.read().jobLeasesLost - lostBefore).toBe(1)
    const operations = log.warn.mock.calls.map(([fields]) => (fields as {operation: string}).operation)
    expect(operations).toEqual(['job.lease.renew', 'job.lease.lost'])
    expect(JSON.stringify(log.warn.mock.calls)).not.toMatch(/postgres(ql)?:\/\//)
    expect(await db.selectFrom('job_failures').select('id').where('job_id', '=', jobId).execute()).toHaveLength(0)
  })

  it('renews the lease of a job still LEASED when markJobRunning is delayed past the lease', async () => {
    const cfg = config(`gf-ops-01c-leased-${suffix}`)
    const jobId = await enqueue()
    const renewalsBefore = metrics.read().jobLeaseRenewals
    let probed = false
    // markJobRunning only starts after 1.5x the lease; the job is LEASED the whole time.
    slowMark.delayMs = Math.round(LEASE_MS * 1.5)
    slowMark.during = async () => {
      probed = true
      await reapExpiredLeases(db)
      const row = await jobRow(jobId)
      expect(row).toMatchObject({status: 'LEASED', lease_owner: cfg.workerId})
      expect(new Date(row.lease_expires_at!).getTime()).toBeGreaterThan(Date.now())
    }
    await expect(processOneJob(db, cfg)).resolves.toBe(true)
    expect(probed).toBe(true)
    expect(metrics.read().jobLeaseRenewals - renewalsBefore).toBeGreaterThanOrEqual(3)
    expect(slowMark.handlerRuns).toBe(1)
    expect(await jobRow(jobId)).toMatchObject({status: 'SUCCEEDED', lease_owner: null, attempt_count: 1})
  })

  it('does not run the handler or record an outcome when a LEASED job is reclaimed before it starts', async () => {
    const cfg = config(`gf-ops-01c-leased-lost-${suffix}`)
    const jobId = await enqueue()
    const other = `gf-ops-01c-leased-owner-${suffix}`
    slowMark.delayMs = RENEW_MS
    slowMark.during = async () => {
      await db.updateTable('background_jobs')
        .set({status: 'LEASED', lease_owner: other, lease_expires_at: new Date(Date.now() + 60_000), attempt_count: 2})
        .where('id', '=', jobId).execute()
    }
    const log = {warn: vi.fn(), error: vi.fn()}
    await expect(processOneJob(db, cfg, {log})).resolves.toBe(true)
    expect(slowMark.handlerRuns).toBe(0)
    expect(await jobRow(jobId)).toMatchObject({status: 'LEASED', lease_owner: other, attempt_count: 2})
    expect(log.warn.mock.calls.map(([fields]) => (fields as {operation: string}).operation)).toContain('job.lease.lost')
    expect(await db.selectFrom('job_failures').select('id').where('job_id', '=', jobId).execute()).toHaveLength(0)
    await db.deleteFrom('background_jobs').where('id', '=', jobId).execute()
  })

  it('stops the renewal timer when the job finishes and the heartbeat timer on shutdown', async () => {
    const cfg = config(`gf-ops-01c-stop-${suffix}`)
    const jobId = await enqueue()
    slowJob.durationMs = RENEW_MS * 2
    await processOneJob(db, cfg)
    expect(await jobRow(jobId)).toMatchObject({status: 'SUCCEEDED'})
    const renewals = metrics.read().jobLeaseRenewals
    await sleep(RENEW_MS * 3)
    expect(metrics.read().jobLeaseRenewals).toBe(renewals)

    const heartbeat = startHeartbeat(db, {workerId: cfg.workerId, releaseSha: null, startedAt: new Date(), intervalMs: HEARTBEAT_MS})
    await sleep(HEARTBEAT_MS * 2)
    await heartbeat.stop()
    const stoppedAt = (await db.selectFrom('greenfield_worker_heartbeats').select('last_seen_at').where('worker_id', '=', cfg.workerId).executeTakeFirstOrThrow()).last_seen_at
    await sleep(HEARTBEAT_MS * 3)
    const later = (await db.selectFrom('greenfield_worker_heartbeats').select('last_seen_at').where('worker_id', '=', cfg.workerId).executeTakeFirstOrThrow()).last_seen_at
    expect(new Date(later).getTime()).toBe(new Date(stoppedAt).getTime())
  })
})
