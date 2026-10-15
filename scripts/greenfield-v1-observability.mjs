#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {statfsSync} from 'node:fs'

const since = process.env.MODULA_OBSERVABILITY_SINCE ?? '15m'
if (!/^\d+[smhd]$/.test(since)) fail('MODULA_OBSERVABILITY_SINCE must be a bounded Docker duration such as 15m')

const apiContainer = process.env.MODULA_API_CONTAINER ?? 'modula-production-greenfield-api-1'
const workerContainer = process.env.MODULA_WORKER_CONTAINER ?? 'modula-production-greenfield-worker-1'
const databaseContainer = process.env.MODULA_DATABASE_CONTAINER ?? 'modula-production-greenfield-postgres-1'

const apiLogs = dockerLogs(apiContainer)
const workerLogs = dockerLogs(workerContainer)
const completed = apiLogs.filter(value => value.msg === 'request completed' && Number.isFinite(value.responseTime))
const latencies = completed.map(value => Number(value.responseTime)).sort((left, right) => left - right)
const statuses = completed.map(value => Number(value.res?.statusCode ?? 0))
const latestWorkerMetrics = workerLogs.filter(value => value.operation === 'worker.metrics' && value.metrics).at(-1)?.metrics ?? null
const stats = docker(['stats', '--no-stream', '--format', '{{json .}}', apiContainer, workerContainer, databaseContainer])
  .trim().split('\n').filter(Boolean).map(line => JSON.parse(line))

const database = JSON.parse(docker([
  'exec', databaseContainer, 'sh', '-ceu',
  `psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "
    SELECT json_build_object(
      'connections', (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()),
      'maxConnections', current_setting('max_connections')::int,
      'queuedJobs', (SELECT count(*) FROM background_jobs WHERE status IN ('QUEUED','RETRYING')),
      'runningJobs', (SELECT count(*) FROM background_jobs WHERE status IN ('LEASED','RUNNING')),
      'deadLetterJobs', (SELECT count(*) FROM background_jobs WHERE status='DEAD_LETTER'),
      'jobFailureRows', (SELECT count(*) FROM job_failures),
      'deadLetterEvents', (SELECT count(*) FROM greenfield_event_deliveries WHERE status='dead_lettered'),
      'workerHeartbeatAgeSeconds', (SELECT COALESCE(extract(epoch FROM now()-max(last_seen_at))::int,-1) FROM greenfield_worker_heartbeats),
      'databaseBytes', pg_database_size(current_database())
    )"`,
]).trim())

const disk = statfsSync('/var/lib/docker')
const diskFreeBytes = Number(disk.bavail) * Number(disk.bsize)
const diskFreePercent = disk.blocks ? Number(disk.bavail) / Number(disk.blocks) * 100 : 0
const output = {
  format: 'modula.greenfield.observability.v1',
  generatedAt: new Date().toISOString(),
  window: since,
  api: {
    requests: completed.length,
    status2xx: statuses.filter(value => value >= 200 && value < 300).length,
    status4xx: statuses.filter(value => value >= 400 && value < 500).length,
    status5xx: statuses.filter(value => value >= 500 && value < 600).length,
    p50Ms: percentile(latencies, 0.50),
    p95Ms: percentile(latencies, 0.95),
    p99Ms: percentile(latencies, 0.99),
    maxMs: latencies.at(-1) ?? null,
  },
  worker: {
    metrics: latestWorkerMetrics,
    errorLogs: workerLogs.filter(value => Number(value.level) >= 50).length,
  },
  database,
  containers: stats.map(value => ({
    name: value.Name,
    cpu: value.CPUPerc,
    memory: value.MemUsage,
    pids: Number(value.PIDs),
    networkIO: value.NetIO,
    blockIO: value.BlockIO,
  })),
  storage: {diskFreeBytes, diskFreePercent: Number(diskFreePercent.toFixed(2))},
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)

function dockerLogs(container) {
  return docker(['logs', '--since', since, container]).split('\n').flatMap(line => {
    try { return [JSON.parse(line)] } catch { return [] }
  })
}

function docker(args) {
  const result = spawnSync('docker', args, {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024})
  if (result.status !== 0) fail(`docker ${args[0]} failed: ${String(result.stderr).trim().slice(0, 500)}`)
  return result.stdout
}

function percentile(sorted, fraction) {
  if (!sorted.length) return null
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)].toFixed(2))
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
