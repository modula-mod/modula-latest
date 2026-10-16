#!/usr/bin/env node
import {spawn} from 'node:child_process'
import {cpus, freemem, hostname, loadavg, totalmem} from 'node:os'
import {existsSync, readFileSync, readdirSync, renameSync, writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'

const requireFromApi = createRequire(new URL('../../services/greenfield-api/package.json', import.meta.url))
const pg = requireFromApi('pg')
const {Pool} = pg
const options = parseArgs(process.argv.slice(2))
const durationSeconds = integer(options.duration ?? '1800', 'duration', 60, 3600)
const sampleSeconds = integer(options['sample-seconds'] ?? '5', 'sample-seconds', 1, 60)
const apiPid = integer(options['api-pid'], 'api-pid', 1, Number.MAX_SAFE_INTEGER)
const workerPid = integer(options['worker-pid'], 'worker-pid', 1, Number.MAX_SAFE_INTEGER)
const outputPath = resolve(String(options.output ?? `greenfield-soak-${Date.now()}.json`))
const databaseUrl = process.env.MODULA_SOAK_DATABASE_URL?.trim()
if (!databaseUrl) fail('MODULA_SOAK_DATABASE_URL is required')

const baseUrl = String(options['base-url'] ?? 'http://127.0.0.1:4021').replace(/\/$/, '')
const startedAt = new Date()
const report = {
  format: 'modula.greenfield.soak.v1',
  candidateSha: String(options['candidate-sha'] ?? 'unknown'),
  startedAt: startedAt.toISOString(),
  completedAt: null,
  durationSeconds,
  sampleSeconds,
  baseUrl,
  environment: {
    hostname: hostname(),
    cpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
    node: process.version,
    database: null,
  },
  processes: {apiPid, workerPid},
  samples: [],
  load: null,
  summary: null,
  exitStatus: 'RUNNING',
}

const pool = new Pool({connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000})
const loadArguments = [
  resolve('tools/greenfield-closeout/mixed-load.mjs'),
  '--base-url', baseUrl,
  '--concurrency', String(options.concurrency ?? '25'),
  '--duration', String(durationSeconds),
  '--think-ms', String(options['think-ms'] ?? '100'),
  '--timeout', String(options.timeout ?? '10000'),
  '--max-error-rate', String(options['max-error-rate'] ?? '0.01'),
]
if (options.scenarios) loadArguments.push('--scenarios', resolve(String(options.scenarios)))
if (options['synthetic-client-ips'] !== undefined) loadArguments.push('--synthetic-client-ips')

let loadStdout = ''
let loadStderr = ''
let stopping = false
const load = spawn(process.execPath, loadArguments, {cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe']})
load.stdout.on('data', value => { loadStdout += value })
load.stderr.on('data', value => { loadStderr += value })

const interval = setInterval(() => void sample().catch(error => recordSampleError(error)), sampleSeconds * 1_000)
await sample()
persist()

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (stopping) return
    stopping = true
    load.kill(signal)
  })
}

const loadExit = await new Promise(resolveExit => load.on('exit', (code, signal) => resolveExit({code, signal})))
clearInterval(interval)
await sample()
await pool.end()

let loadResult = null
try { loadResult = JSON.parse(loadStdout) } catch {}
report.completedAt = new Date().toISOString()
report.load = {
  exitCode: loadExit.code,
  signal: loadExit.signal,
  stderr: loadStderr.trim().split('\n').filter(Boolean).slice(-20),
  result: loadResult,
  parseSucceeded: loadResult !== null,
}
report.summary = summarize(report.samples)
const elapsedSeconds = (new Date(report.completedAt).getTime() - startedAt.getTime()) / 1_000
const complete = elapsedSeconds >= durationSeconds && loadExit.code === 0 && loadResult !== null
  && report.samples.every(value => value.api.alive && value.worker.alive)
  && report.samples.every(value => value.database.error === null)
report.exitStatus = complete ? 'PASS' : 'FAIL'
persist()
process.stdout.write(`${JSON.stringify({outputPath, exitStatus: report.exitStatus, elapsedSeconds, summary: report.summary, load: report.load.result?.levels}, null, 2)}\n`)
if (!complete) process.exitCode = 1

async function sample() {
  const at = new Date().toISOString()
  const database = await databaseMetrics()
  report.environment.database ??= database.name
  report.samples.push({
    at,
    api: processMetrics(apiPid),
    worker: processMetrics(workerPid),
    database,
    host: {freeMemoryBytes: freemem(), loadAverage: loadavg(), network: networkMetrics()},
  })
  persist()
}

function recordSampleError(error) {
  report.samples.push({
    at: new Date().toISOString(), api: processMetrics(apiPid), worker: processMetrics(workerPid),
    database: {name: report.environment.database, error: error instanceof Error ? error.message : String(error)},
    host: {freeMemoryBytes: freemem(), loadAverage: loadavg(), network: networkMetrics()},
  })
  persist()
}

async function databaseMetrics() {
  try {
    const client = await pool.connect()
    try {
      const activity = await client.query(`select current_database() as name,
        count(*) filter (where datname = current_database())::int as connections,
        count(*) filter (where datname = current_database() and state = 'active')::int as active_connections,
        pg_database_size(current_database())::text as database_bytes
        from pg_stat_activity`)
      const jobs = await client.query(`select
        count(*) filter (where lower(status) in ('queued','pending','retrying'))::int as queued,
        count(*) filter (where lower(status) in ('leased','running'))::int as running,
        count(*) filter (where lower(status) = 'dead_letter')::int as dead_letters
        from background_jobs`)
      const heartbeat = await client.query(`select coalesce(extract(epoch from (now() - max(last_seen_at))), -1)::float8 as age_seconds
        from greenfield_worker_heartbeats`)
      return {
        name: activity.rows[0].name,
        connections: activity.rows[0].connections,
        activeConnections: activity.rows[0].active_connections,
        databaseBytes: Number(activity.rows[0].database_bytes),
        queue: jobs.rows[0],
        workerHeartbeatAgeSeconds: Number(heartbeat.rows[0].age_seconds),
        error: null,
      }
    } finally { client.release() }
  } catch (error) {
    return {name: report.environment.database, error: error instanceof Error ? error.message : String(error)}
  }
}

function processMetrics(pid) {
  const root = `/proc/${pid}`
  if (!existsSync(root)) return {alive: false, rssBytes: null, virtualBytes: null, threads: null, openFileDescriptors: null, io: null}
  const status = Object.fromEntries(readFileSync(`${root}/status`, 'utf8').split('\n').filter(Boolean).map(line => {
    const split = line.indexOf(':')
    return split === -1 ? [line, ''] : [line.slice(0, split), line.slice(split + 1).trim()]
  }))
  const io = Object.fromEntries(readFileSync(`${root}/io`, 'utf8').split('\n').filter(Boolean).map(line => {
    const [key, value] = line.split(':')
    return [key, Number(value.trim())]
  }))
  return {
    alive: true,
    rssBytes: kib(status.VmRSS),
    virtualBytes: kib(status.VmSize),
    threads: Number(status.Threads),
    openFileDescriptors: readdirSync(`${root}/fd`).length,
    io: {readBytes: io.read_bytes, writeBytes: io.write_bytes},
  }
}

function networkMetrics() {
  const lines = readFileSync('/proc/net/dev', 'utf8').trim().split('\n').slice(2)
  let receivedBytes = 0
  let transmittedBytes = 0
  for (const line of lines) {
    const [, values] = line.trim().split(':')
    const parts = values.trim().split(/\s+/).map(Number)
    receivedBytes += parts[0]
    transmittedBytes += parts[8]
  }
  return {receivedBytes, transmittedBytes}
}

function summarize(samples) {
  const valid = samples.filter(value => value.api.alive && value.worker.alive && value.database.error === null)
  const first = valid[0]
  const last = valid.at(-1)
  const max = selector => Math.max(...valid.map(selector))
  return {
    sampleCount: samples.length,
    validSampleCount: valid.length,
    apiMemoryStartBytes: first?.api.rssBytes ?? null,
    apiMemoryEndBytes: last?.api.rssBytes ?? null,
    apiMemoryGrowthBytes: first && last ? last.api.rssBytes - first.api.rssBytes : null,
    apiMemoryMaxBytes: valid.length ? max(value => value.api.rssBytes) : null,
    workerMemoryStartBytes: first?.worker.rssBytes ?? null,
    workerMemoryEndBytes: last?.worker.rssBytes ?? null,
    workerMemoryGrowthBytes: first && last ? last.worker.rssBytes - first.worker.rssBytes : null,
    workerMemoryMaxBytes: valid.length ? max(value => value.worker.rssBytes) : null,
    databaseConnectionsStart: first?.database.connections ?? null,
    databaseConnectionsEnd: last?.database.connections ?? null,
    databaseConnectionsMax: valid.length ? max(value => value.database.connections) : null,
    queuedJobsStart: first?.database.queue.queued ?? null,
    queuedJobsEnd: last?.database.queue.queued ?? null,
    queuedJobsMax: valid.length ? max(value => value.database.queue.queued) : null,
    runningJobsMax: valid.length ? max(value => value.database.queue.running) : null,
    workerHeartbeatAgeMaxSeconds: valid.length ? max(value => value.database.workerHeartbeatAgeSeconds) : null,
    apiAliveThroughout: samples.every(value => value.api.alive),
    workerAliveThroughout: samples.every(value => value.worker.alive),
    databaseAvailableThroughout: samples.every(value => value.database.error === null),
  }
}

function persist() {
  const temporary = `${outputPath}.tmp`
  writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, {mode: 0o600})
  renameSync(temporary, outputPath)
}

function kib(value) {
  const match = String(value ?? '').match(/^(\d+)\s+kB$/)
  return match ? Number(match[1]) * 1024 : null
}

function integer(value, label, minimum, maximum) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) fail(`${label} must be an integer between ${minimum} and ${maximum}`)
  return parsed
}

function parseArgs(values) {
  const result = {}
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index]
    if (!item.startsWith('--')) fail(`invalid argument: ${item}`)
    const key = item.slice(2)
    if (key === 'synthetic-client-ips') result[key] = true
    else if (values[index + 1] === undefined) fail(`--${key} requires a value`)
    else result[key] = values[++index]
  }
  return result
}

function fail(message) { throw new Error(message) }
