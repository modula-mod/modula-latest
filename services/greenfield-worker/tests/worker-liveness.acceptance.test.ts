// GF-OPS-01 (c) ACCEPTANCE TEST for Forge. EXPECTED TO FAIL on the current worker runtime.
//
// Finding (SENTINEL, verified at a91d490e / #174): the heartbeat is written only from the
// main loop (src/main.ts:78-80) and the loop awaits processOneJob (src/main.ts:155), so a
// job that runs longer than the healthcheck threshold leaves the heartbeat stale. The job
// lease is set once at claim time (src/jobs/claim.ts:20,27; default 60 s, src/config.ts:13)
// and nothing renews it, while background_jobs.timeout_ms allows up to 900 s
// (migrations/043_greenfield_backend_v1_event_job_fabric.sql:94).
//
// This test spawns the REAL worker (src/main.ts via tsx), blocks one real job for ~90 s by
// holding an ACCESS EXCLUSIVE lock on a table its handler reads, and asserts what a fixed
// worker must guarantee while the job runs:
//   1. its heartbeat row never gets older than MAX_HEARTBEAT_AGE_S;
//   2. the production Docker healthcheck (ops/docker/greenfield-worker-heartbeat-healthcheck.cjs)
//      reports healthy at every sample;
//   3. the job's lease_expires_at stays in the future (renewed) while it is RUNNING;
//   4. the job then completes once (SUCCEEDED, attempt_count 1, never reaped).
//
// It is skipped unless BOTH MODULA_TEST_DATABASE_URL (a disposable, migrated database) and
// MODULA_WORKER_LIVENESS_ACCEPTANCE=1 are set, because it takes ~2 minutes and spawns a
// worker that will process any queued job in that database. Never point it at production.
// Do not convert it to it.fails/it.skip to make CI green: Forge's runtime change must make
// it pass as written. Local runner: docs/audits/GF-OPS-01/long-job-heartbeat-drill.sh.
import {spawn, spawnSync, type ChildProcess} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import pg from 'pg'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const enabled = Boolean(databaseUrl) && process.env.MODULA_WORKER_LIVENESS_ACCEPTANCE === '1'
const JOB_BLOCK_MS = Number(process.env.MODULA_WORKER_LIVENESS_JOB_MS ?? 90_000)
// Harness self-check only: a short block (< 90 s) is allowed with MODULA_WORKER_LIVENESS_CONTROL=1 to
// show the test can pass at all. A control run is never acceptance evidence.
const CONTROL = process.env.MODULA_WORKER_LIVENESS_CONTROL === '1'
const SAMPLE_MS = 5_000
const MAX_HEARTBEAT_AGE_S = 30 // 2 x HEARTBEAT_INTERVAL_MS (15 s)
const workerDir = fileURLToPath(new URL('..', import.meta.url))
const healthcheck = fileURLToPath(new URL('../../../ops/docker/greenfield-worker-heartbeat-healthcheck.cjs', import.meta.url))

type Sample = {atMs: number; jobStatus: string | null; heartbeatAgeS: number | null; leaseRemainingS: number | null; healthcheckExit: number | null; healthcheckOutput: string}

describe.skipIf(!enabled)('GF-OPS-01 (c) worker liveness during a long job [acceptance; skipped unless MODULA_WORKER_LIVENESS_ACCEPTANCE=1 and MODULA_TEST_DATABASE_URL are set; fails until Forge lands independent heartbeat + lease renewal]', () => {
  const workerId = `liveness-acceptance-${randomUUID().slice(0, 8)}`
  const releaseSha = 'e'.repeat(40)
  const jobId = `liveness-acceptance-${randomUUID()}`
  const recipientActorId = `actor-${jobId}`
  let worker: ChildProcess | undefined
  let admin: pg.Client
  let locker: pg.Client
  let startedAt: Date

  beforeAll(async () => {
    admin = new pg.Client({connectionString: databaseUrl})
    locker = new pg.Client({connectionString: databaseUrl})
    await admin.connect()
    await locker.connect()
    await admin.query("INSERT INTO actors (id, kind) VALUES ($1, 'service')", [recipientActorId])
    startedAt = new Date(Date.now() - 2_000)
    worker = spawn(process.execPath, [`${workerDir}node_modules/tsx/dist/cli.mjs`, 'src/main.ts'], {
      cwd: workerDir,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        MODULA_ENVIRONMENT: 'development',
        MODULA_LOG_LEVEL: 'warn',
        MODULA_DATABASE_URL: databaseUrl,
        MODULA_WORKER_ID: workerId,
        MODULA_RELEASE_SHA: releaseSha,
        MODULA_WORKER_LEASE_DURATION_MS: '60000',
      },
      stdio: ['ignore', 'ignore', 'inherit'],
    })
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const {rows} = await admin.query('SELECT 1 FROM greenfield_worker_heartbeats WHERE worker_id = $1', [workerId])
      if (rows.length) return
      await delay(500)
    }
    throw new Error('worker never wrote its first heartbeat')
  }, 60_000)

  afterAll(async () => {
    await locker?.query('ROLLBACK').catch(() => {})
    if (worker && worker.exitCode === null) {
      worker.kill('SIGTERM')
      await new Promise(resolve => { worker?.once('exit', resolve); setTimeout(resolve, 15_000) })
    }
    await admin?.query('DELETE FROM background_jobs WHERE id = $1', [jobId]).catch(() => {})
    await admin?.query('DELETE FROM notifications WHERE recipient_actor_id = $1', [recipientActorId]).catch(() => {})
    await admin?.query('DELETE FROM actors WHERE id = $1', [recipientActorId]).catch(() => {})
    await admin?.query('DELETE FROM greenfield_worker_heartbeats WHERE worker_id = $1', [workerId]).catch(() => {})
    await locker?.end().catch(() => {})
    await admin?.end().catch(() => {})
  }, 30_000)

  it(`${CONTROL ? '[CONTROL, not acceptance] ' : ''}keeps heartbeat, healthcheck and lease alive while a job runs ~${Math.round(JOB_BLOCK_MS / 1000)} s`, async () => {
    if (!CONTROL) expect(JOB_BLOCK_MS, 'acceptance requires the job to outlive the 60 s lease and the 90 s healthcheck threshold').toBeGreaterThanOrEqual(90_000)
    await locker.query('BEGIN')
    await locker.query('LOCK TABLE notification_preferences IN ACCESS EXCLUSIVE MODE')
    const now = new Date()
    await admin.query(
      `INSERT INTO background_jobs (id, job_type, payload, status, action, trace_id, priority, available_at, attempt_count, maximum_attempts, created_at, updated_at, timeout_ms)
       VALUES ($1, 'notification.create', $2, 'QUEUED', 'notification.create', $1, -1000000, $3, 0, 1, $3, $3, 600000)`,
      [jobId, JSON.stringify({recipientActorId, type: 'module_event'}), now],
    )
    const samples: Sample[] = []
    const t0 = Date.now()
    while (Date.now() - t0 < JOB_BLOCK_MS) {
      await delay(SAMPLE_MS)
      samples.push(await sample(Date.now() - t0))
    }
    await locker.query('COMMIT')
    let final: {status: string; attempt_count: number; error_code: string | null} | undefined
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const {rows} = await admin.query('SELECT status, attempt_count, error_code FROM background_jobs WHERE id = $1', [jobId])
      final = rows[0]
      if (final && !['QUEUED', 'LEASED', 'RUNNING'].includes(final.status)) break
      await delay(500)
    }
    const report = {workerId, jobBlockMs: JOB_BLOCK_MS, maxHeartbeatAgeS: MAX_HEARTBEAT_AGE_S, samples, final}
    if (process.env.MODULA_WORKER_LIVENESS_REPORT) writeFileSync(process.env.MODULA_WORKER_LIVENESS_REPORT, `${JSON.stringify(report, null, 2)}\n`)

    const running = samples.filter(s => s.jobStatus === 'RUNNING' || s.jobStatus === 'LEASED')
    expect(running.length, 'job never reached RUNNING; the reproduction did not block a job').toBeGreaterThan(0)
    const violations = [
      ...samples.filter(s => s.heartbeatAgeS === null || s.heartbeatAgeS > MAX_HEARTBEAT_AGE_S).map(s => `t=${Math.round(s.atMs / 1000)}s heartbeat age ${s.heartbeatAgeS}s > ${MAX_HEARTBEAT_AGE_S}s`),
      ...samples.filter(s => s.healthcheckExit !== 0).map(s => `t=${Math.round(s.atMs / 1000)}s healthcheck exit ${s.healthcheckExit}: ${s.healthcheckOutput}`),
      ...running.filter(s => s.leaseRemainingS === null || s.leaseRemainingS <= 0).map(s => `t=${Math.round(s.atMs / 1000)}s lease expired ${s.leaseRemainingS}s while ${s.jobStatus}`),
    ]
    expect(violations).toEqual([])
    expect(final).toMatchObject({status: 'SUCCEEDED', attempt_count: 1})
  }, JOB_BLOCK_MS + 90_000)

  async function sample(atMs: number): Promise<Sample> {
    const {rows: [hb]} = await admin.query('SELECT EXTRACT(EPOCH FROM now() - last_seen_at)::float8 AS age FROM greenfield_worker_heartbeats WHERE worker_id = $1', [workerId])
    const {rows: [job]} = await admin.query('SELECT status, EXTRACT(EPOCH FROM lease_expires_at - now())::float8 AS remaining FROM background_jobs WHERE id = $1', [jobId])
    const probe = spawnSync(process.execPath, [healthcheck], {
      encoding: 'utf8',
      timeout: 15_000,
      env: {
        PATH: process.env.PATH,
        MODULA_DATABASE_URL: databaseUrl,
        MODULA_WORKER_ID: workerId,
        MODULA_RELEASE_SHA: releaseSha,
        MODULA_HEALTHCHECK_APP_ROOT: workerDir,
        MODULA_HEALTHCHECK_CONTAINER_STARTED_AT: startedAt.toISOString(),
      },
    })
    return {
      atMs,
      jobStatus: job?.status ?? null,
      heartbeatAgeS: hb ? Math.round(hb.age) : null,
      leaseRemainingS: job?.remaining === null || job?.remaining === undefined ? null : Math.round(job.remaining),
      healthcheckExit: probe.status,
      healthcheckOutput: (probe.stdout || '').trim(),
    }
  }
})

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
