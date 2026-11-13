#!/usr/bin/env node
// GF-OPS-01 (G033): Docker healthcheck for the GreenField worker.
//
// Uses the existing liveness mechanism only: the worker upserts its row in
// greenfield_worker_heartbeats every 15 s (services/greenfield-worker/src/heartbeat).
// The check passes when a heartbeat for this container's release, started after
// this container started, is younger than the operational threshold used by
// /v1/status (WORKER_OPERATIONAL_SECONDS = 90). No new port, no app code change,
// read-only SELECT with the worker's own database role. Never prints the URL.
'use strict'
const {createRequire} = require('node:module')
const {readFileSync} = require('node:fs')

const appRoot = process.env.MODULA_HEALTHCHECK_APP_ROOT || '/app/'
const maxAgeSeconds = Number(process.env.MODULA_WORKER_HEALTHCHECK_MAX_AGE_SECONDS || 90)
const url = process.env.MODULA_DATABASE_URL
const releaseSha = (process.env.MODULA_RELEASE_SHA || '').slice(0, 80) || null
const workerId = process.env.MODULA_WORKER_ID ? process.env.MODULA_WORKER_ID.slice(0, 160) : null

function done(ok, message) {
  process.stdout.write(`worker-heartbeat ${ok ? 'healthy' : 'unhealthy'}: ${message}\n`)
  process.exit(ok ? 0 : 1)
}

// Container start as epoch seconds, from PID 1 start time (docker-init with
// `init: true`). Returns null when /proc is not readable; the start filter is
// then skipped and freshness alone decides.
function containerStartedAtEpoch() {
  if (process.env.MODULA_HEALTHCHECK_CONTAINER_STARTED_AT) {
    const value = Date.parse(process.env.MODULA_HEALTHCHECK_CONTAINER_STARTED_AT)
    return Number.isFinite(value) ? value / 1000 : null
  }
  try {
    const stat = readFileSync('/proc/1/stat', 'utf8')
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
    const startTicks = Number(fields[19])
    const uptime = Number(readFileSync('/proc/uptime', 'utf8').split(' ')[0])
    if (!Number.isFinite(startTicks) || !Number.isFinite(uptime)) return null
    return Date.now() / 1000 - (uptime - startTicks / 100)
  } catch {
    return null
  }
}

async function main() {
  if (!url) return done(false, 'MODULA_DATABASE_URL is not set')
  if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) return done(false, 'invalid max age')
  let pg
  try {
    pg = createRequire(appRoot.endsWith('/') ? appRoot : `${appRoot}/`)('pg')
  } catch {
    return done(false, 'pg driver not resolvable from worker image')
  }
  const startedAt = containerStartedAtEpoch()
  const client = new pg.Client({connectionString: url, connectionTimeoutMillis: 4000, statement_timeout: 3000, application_name: 'modula-worker-healthcheck'})
  try {
    await client.connect()
    const {rows} = await client.query(
      `SELECT EXTRACT(EPOCH FROM (now() - max(last_seen_at)))::float8 AS age_seconds, count(*)::int AS rows
         FROM greenfield_worker_heartbeats
        WHERE ($1::text IS NULL OR release_sha = $1)
          AND ($2::text IS NULL OR worker_id = $2)
          AND ($3::float8 IS NULL OR started_at >= to_timestamp($3::float8 - 5))`,
      [releaseSha, workerId, startedAt],
    )
    const age = rows[0]?.age_seconds
    if (age === null || age === undefined) return done(false, `no heartbeat for release ${releaseSha ?? '(any)'} since container start`)
    if (age > maxAgeSeconds) return done(false, `heartbeat age ${Math.round(age)}s > ${maxAgeSeconds}s`)
    return done(true, `heartbeat age ${Math.max(0, Math.round(age))}s`)
  } catch (error) {
    return done(false, `database check failed (${error && error.code ? error.code : 'error'})`)
  } finally {
    client.end().catch(() => {})
  }
}

main()
