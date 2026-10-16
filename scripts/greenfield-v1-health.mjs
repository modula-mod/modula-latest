#!/usr/bin/env node
import {readFileSync, statfsSync, statSync} from 'node:fs'
import {connect} from 'node:tls'
import {spawnSync} from 'node:child_process'

const baseUrl = (process.env.MODULA_HEALTH_BASE_URL ?? 'https://api.modula.digital').replace(/\/$/, '')
const expectedSha = process.env.MODULA_EXPECTED_RELEASE_SHA?.trim() || null
const backupMarker = process.env.MODULA_BACKUP_SUCCESS_MARKER ?? null
const local = process.argv.includes('--local')
const checks = []

await endpoint('/v1/health/live', data => data?.status === 'live')
await endpoint('/v1/health/ready', data => data?.status === 'ready')
const version = await endpoint('/v1/version', data => typeof data?.commit === 'string' && typeof data?.builtAt === 'string')
if (expectedSha) record('release SHA', version.data.commit === expectedSha || version.data.commit === expectedSha.slice(0, 12), version.data.commit)
const status = await endpoint('/v1/status', data => data?.status === 'operational' && Array.isArray(data?.components))
for (const id of ['api', 'database', 'worker', 'jobs', 'mail']) {
  const component = status.data.components.find(value => value.id === id)
  record(`status ${id}`, component?.state === 'operational', component?.state ?? 'missing')
}

await tlsCheck(new URL(baseUrl).hostname)

if (local) {
  for (const container of ['modula-production-greenfield-api-1', 'modula-production-greenfield-worker-1', 'modula-production-greenfield-postgres-1']) {
    const result = spawnSync('docker', ['inspect', container, '--format', '{{json .State}}'], {encoding: 'utf8'})
    const state = result.status === 0 ? JSON.parse(result.stdout) : null
    record(`container ${container}`, state?.Running === true && state?.Status === 'running', state?.Status ?? 'missing')
  }
  const nginx = spawnSync('nginx', ['-t'], {encoding: 'utf8'})
  record('nginx configuration', nginx.status === 0, nginx.status === 0 ? 'valid' : 'invalid')
  const disk = statfsSync('/var/lib/docker')
  const freeBytes = Number(disk.bavail) * Number(disk.bsize)
  const freePercent = disk.blocks ? (Number(disk.bavail) / Number(disk.blocks)) * 100 : 0
  const minimumFreeBytes = Number(process.env.MODULA_HEALTH_MIN_DISK_FREE_BYTES ?? 20 * 1024 ** 3)
  const minimumFreePercent = Number(process.env.MODULA_HEALTH_MIN_DISK_FREE_PERCENT ?? 10)
  record('Docker disk free', freeBytes >= minimumFreeBytes && freePercent >= minimumFreePercent, `${freePercent.toFixed(1)}% / ${Math.round(freeBytes / 1024 ** 3)} GiB`)
}

if (backupMarker) {
  let marker = null
  try { marker = JSON.parse(readFileSync(backupMarker, 'utf8')) } catch {}
  const completed = marker?.completedAt ? new Date(marker.completedAt) : null
  const ageHours = completed ? (Date.now() - completed.getTime()) / 3_600_000 : Number.POSITIVE_INFINITY
  const safePermissions = statSafe(backupMarker)?.mode
  record('backup success age', ageHours <= 30, Number.isFinite(ageHours) ? `${ageHours.toFixed(1)}h` : 'missing')
  record('backup marker permissions', safePermissions !== null && (safePermissions & 0o077) === 0, safePermissions === null ? 'missing' : (safePermissions & 0o777).toString(8))
}

const failed = checks.filter(check => !check.ok)
process.stdout.write(`${JSON.stringify({ok: failed.length === 0, checkedAt: new Date().toISOString(), baseUrl, checks}, null, 2)}\n`)
if (failed.length) process.exitCode = 1

async function endpoint(path, validate) {
  const started = performance.now()
  let response
  let body
  try {
    response = await fetch(`${baseUrl}${path}`, {headers: {'cache-control': 'no-store', 'x-request-id': `health-${crypto.randomUUID()}`}, signal: AbortSignal.timeout(10_000)})
    body = await response.json()
  } catch (error) {
    record(path, false, error instanceof Error ? error.message : 'request failed')
    return {data: null}
  }
  const requestId = response.headers.get('x-request-id')
  const ok = response.status === 200 && body?.ok === true && requestId && body?.meta?.requestId === requestId && validate(body.data)
  record(path, Boolean(ok), `${response.status} ${Math.round(performance.now() - started)}ms request=${requestId ? 'correlated' : 'missing'}`)
  return body
}

function tlsCheck(host) {
  return new Promise(resolve => {
    const socket = connect({host, port: 443, servername: host, rejectUnauthorized: true, timeout: 10_000}, () => {
      const certificate = socket.getPeerCertificate()
      const expiresAt = Date.parse(certificate.valid_to)
      const days = (expiresAt - Date.now()) / 86_400_000
      record('TLS certificate', socket.authorized && days >= 21, `${days.toFixed(0)} days`)
      socket.end()
      resolve()
    })
    socket.on('timeout', () => socket.destroy(new Error('TLS timeout')))
    socket.on('error', error => { record('TLS certificate', false, error.message); resolve() })
  })
}

function record(name, ok, detail) {
  checks.push({name, ok, detail})
}

function statSafe(path) {
  try { return statSync(path) } catch { return null }
}
