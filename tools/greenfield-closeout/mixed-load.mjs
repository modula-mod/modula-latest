#!/usr/bin/env node
import {monitorEventLoopDelay} from 'node:perf_hooks'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'

const options = parseArgs(process.argv.slice(2))
const baseUrl = String(options['base-url'] ?? process.env.MODULA_LOAD_BASE_URL ?? 'http://127.0.0.1:4020').replace(/\/$/, '')
const levels = String(options.concurrency ?? '10,25,50,100,250,500').split(',').map(Number)
const durationSeconds = Number(options.duration ?? 60)
const thinkMs = Number(options['think-ms'] ?? 0)
const token = process.env.MODULA_LOAD_ACCESS_TOKEN?.trim() || null
const production = /(^|\.)api\.modula\.digital$/i.test(new URL(baseUrl).hostname)
const syntheticClientIps = Boolean(options['synthetic-client-ips'])
if (levels.some(value => !Number.isInteger(value) || value < 1 || value > 2_000)) fail('concurrency levels must be integers between 1 and 2000')
if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 3_600) fail('duration must be between 1 and 3600 seconds')
if (!Number.isFinite(thinkMs) || thinkMs < 0 || thinkMs > 60_000) fail('think-ms must be between 0 and 60000')
if (production && !options['production-bounded']) fail('production load requires --production-bounded')
if (production && (Math.max(...levels) > 50 || durationSeconds > 60)) fail('production load is bounded to concurrency <=50 and duration <=60 seconds')
if (production && syntheticClientIps) fail('synthetic client IPs are forbidden for production load')

const endpoints = options.scenarios ? loadScenarios(String(options.scenarios)) : defaultScenarios(Boolean(token))
if (!endpoints.length) fail('at least one load scenario is required')
if (production && endpoints.some(value => value.method !== 'GET' && value.method !== 'HEAD')) fail('production-bounded load is read-only')

const report = {
  format: 'modula.greenfield.mixed-load.v1',
  startedAt: new Date().toISOString(),
  baseUrl,
  productionBounded: production,
  syntheticClientIps,
  durationSeconds,
  thinkMs,
  scenarios: endpoints.map(({name, method, path}) => ({name, method, path})),
  levels: [],
}

for (const concurrency of levels) {
  process.stderr.write(`load level concurrency=${concurrency} duration=${durationSeconds}s\n`)
  report.levels.push(await runLevel(concurrency))
  if (report.levels.at(-1).errorRate > 0.05) {
    process.stderr.write('stopping progression because error rate exceeded 5%\n')
    break
  }
}
report.completedAt = new Date().toISOString()
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (report.levels.some(value => value.errorRate > Number(options['max-error-rate'] ?? 0.01))) process.exitCode = 1

async function runLevel(concurrency) {
  const deadline = Date.now() + durationSeconds * 1000
  const latencies = []
  const statuses = {}
  const errors = {}
  const samples = []
  let requests = 0
  let bytes = 0
  let nextScenario = 0
  const loop = monitorEventLoopDelay({resolution: 20})
  loop.enable()
  const sampleTimer = options['local-metrics'] ? setInterval(() => samples.push(localMetrics()), 1_000) : null
  const started = performance.now()
  await Promise.all(Array.from({length: concurrency}, async (_, clientIndex) => {
    while (Date.now() < deadline) {
      const scenario = endpoints[nextScenario++ % endpoints.length]
      const before = performance.now()
      try {
        const headers = {'cache-control': 'no-store', 'x-request-id': `load-${crypto.randomUUID()}`, ...scenario.headers}
        if (syntheticClientIps) headers['x-forwarded-for'] = syntheticClientIp(clientIndex)
        if (token) headers.authorization = `Bearer ${token}`
        const response = await fetch(`${baseUrl}${scenario.path}`, {
          method: scenario.method,
          headers,
          body: scenario.body === undefined ? undefined : JSON.stringify(scenario.body),
          signal: AbortSignal.timeout(Number(options.timeout ?? 10_000)),
        })
        const payload = await response.arrayBuffer()
        bytes += payload.byteLength
        statuses[response.status] = (statuses[response.status] ?? 0) + 1
        if (!scenario.accept.includes(response.status)) errors[`HTTP_${response.status}`] = (errors[`HTTP_${response.status}`] ?? 0) + 1
      } catch (error) {
        const code = error?.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR'
        errors[code] = (errors[code] ?? 0) + 1
      } finally {
        requests += 1
        latencies.push(performance.now() - before)
      }
      if (thinkMs > 0) await delay(thinkMs)
    }
  }))
  if (sampleTimer) clearInterval(sampleTimer)
  const elapsedSeconds = (performance.now() - started) / 1000
  loop.disable()
  latencies.sort((a, b) => a - b)
  const failed = Object.values(errors).reduce((sum, value) => sum + value, 0)
  return {
    concurrency,
    durationSeconds: Number(elapsedSeconds.toFixed(3)),
    requests,
    rps: Number((requests / elapsedSeconds).toFixed(2)),
    responseBytes: bytes,
    latencyMs: {
      p50: percentile(latencies, 0.50),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: Number((latencies.at(-1) ?? 0).toFixed(2)),
    },
    errorRate: Number((requests ? failed / requests : 1).toFixed(6)),
    statuses,
    errors,
    loadGeneratorEventLoopP99Ms: Number((loop.percentile(99) / 1e6).toFixed(2)),
    resources: summarizeSamples(samples),
  }
}

function defaultScenarios(authenticated) {
  const values = [
    {name: 'live', method: 'GET', path: '/v1/health/live', accept: [200]},
    {name: 'ready', method: 'GET', path: '/v1/health/ready', accept: [200]},
    {name: 'meta', method: 'GET', path: '/v1/meta', accept: [200]},
    {name: 'status', method: 'GET', path: '/v1/status', accept: [200]},
    {name: 'registry', method: 'GET', path: '/v1/registry/modules?limit=20', accept: [200]},
    {name: 'vault-release', method: 'GET', path: '/v1/registry/modules/digital.modula.vault-notes/versions/1.8.0', accept: [200]},
    {name: 'public-feed', method: 'GET', path: '/v1/feed/home?limit=20', accept: [200]},
    {name: 'public-search', method: 'GET', path: '/v1/search?q=modula&limit=20', accept: [200]},
  ]
  if (authenticated) values.push(
    {name: 'account', method: 'GET', path: '/v1/accounts/me', accept: [200]},
    {name: 'modules', method: 'GET', path: '/v1/modules', accept: [200]},
    {name: 'installed', method: 'GET', path: '/v1/modules/installed', accept: [200]},
    {name: 'functions', method: 'GET', path: '/v1/functions', accept: [200]},
    {name: 'settings', method: 'GET', path: '/v1/accounts/me/app-preferences', accept: [200]},
  )
  return values
}

function loadScenarios(path) {
  const value = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(value)) fail('scenario file must be an array')
  return value.map(item => ({
    name: String(item.name), method: String(item.method ?? 'GET').toUpperCase(), path: String(item.path),
    accept: Array.isArray(item.accept) ? item.accept.map(Number) : [200], headers: item.headers ?? {}, body: item.body,
  }))
}

function localMetrics() {
  const result = spawnSync('docker', ['stats', '--no-stream', '--format', '{{json .}}', 'modula-production-greenfield-api-1', 'modula-production-greenfield-worker-1', 'modula-production-greenfield-postgres-1'], {encoding: 'utf8'})
  if (result.status !== 0) return null
  return result.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
}

function summarizeSamples(samples) {
  const values = samples.flatMap(sample => sample ?? [])
  return Object.fromEntries([...new Set(values.map(value => value.Name))].sort().map(name => {
    const matching = values.filter(value => value.Name === name)
    return [name, {cpuPercentMax: Math.max(...matching.map(value => Number.parseFloat(value.CPUPerc) || 0)), memoryObserved: matching.at(-1)?.MemUsage ?? null}]
  }))
}

function percentile(values, fraction) {
  if (!values.length) return 0
  return Number(values[Math.min(values.length - 1, Math.floor(values.length * fraction))].toFixed(2))
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function parseArgs(values) {
  const result = {}
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index]
    if (!item.startsWith('--')) fail(`unexpected argument: ${item}`)
    const key = item.slice(2)
    if (['production-bounded', 'local-metrics', 'synthetic-client-ips'].includes(key)) result[key] = true
    else if (values[index + 1] === undefined) fail(`--${key} requires a value`)
    else result[key] = values[++index]
  }
  return result
}

function syntheticClientIp(clientIndex) {
  // RFC 2544 benchmarking space; never routable as a public client address.
  const thirdOctet = Math.floor(clientIndex / 254)
  const fourthOctet = (clientIndex % 254) + 1
  return `198.18.${thirdOctet}.${fourthOctet}`
}

function fail(message) {
  throw new Error(message)
}
