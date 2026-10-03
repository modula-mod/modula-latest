#!/usr/bin/env node
import {execFileSync} from 'node:child_process'
import {mkdirSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {repoRoot} from './lib.mjs'

function output(file, args, options = {}) {
  return execFileSync(file, args, {cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options}).trim()
}

function inspect(kind, target) {
  return JSON.parse(output('docker', [...kind, 'inspect', target]))[0]
}

function selectedEnv(container) {
  const allowed = new Set(['MODULA_RELEASE_SHA', 'MODULA_RELEASE_BUILT_AT', 'MODULA_RELEASE_ID', 'MODULA_EXPECTED_MIGRATION'])
  return Object.fromEntries((container.Config.Env ?? []).map(value => value.split(/=(.*)/s).slice(0, 2)).filter(([key]) => allowed.has(key)))
}

function databaseScalar(sql) {
  return output('docker', [
    'exec', 'modula-production-greenfield-postgres-1', 'sh', '-ceu',
    'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$1"',
    'api-atlas-lineage', sql,
  ])
}

async function main() {
  const acceptedSha = output('git', ['rev-parse', 'HEAD'])
  const originMain = output('git', ['rev-parse', 'origin/main'])
  const api = inspect(['container'], 'modula-production-greenfield-api-1')
  const worker = inspect(['container'], 'modula-production-greenfield-worker-1')
  const apiImage = inspect(['image'], api.Image)
  const workerImage = inspect(['image'], worker.Image)
  const versionResponse = await fetch('https://api.modula.digital/version.json', {headers: {'cache-control': 'no-store'}})
  if (!versionResponse.ok) throw new Error(`version.json returned ${versionResponse.status}`)
  const version = await versionResponse.json()
  const migration = databaseScalar('SELECT id FROM schema_migrations ORDER BY applied_at DESC, id DESC LIMIT 1;')
  const workerHeartbeatSha = databaseScalar('SELECT coalesce(release_sha,\'\') FROM greenfield_worker_heartbeats ORDER BY last_seen_at DESC LIMIT 1;')
  const apiEnv = selectedEnv(api)
  const workerEnv = selectedEnv(worker)
  const checks = {
    originMainAccepted: originMain === acceptedSha,
    apiLabelAccepted: apiImage.Config.Labels?.['org.opencontainers.image.revision'] === acceptedSha,
    workerLabelAccepted: workerImage.Config.Labels?.['org.opencontainers.image.revision'] === acceptedSha,
    apiEnvironmentAccepted: apiEnv.MODULA_RELEASE_SHA === acceptedSha,
    workerEnvironmentAccepted: workerEnv.MODULA_RELEASE_SHA === acceptedSha,
    publicVersionAccepted: version.commit === acceptedSha,
    publicMigrationExpected: version.expectedMigration === migration,
    workerHeartbeatAccepted: workerHeartbeatSha === acceptedSha,
  }
  const record = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    acceptedGitCommit: acceptedSha,
    originMain,
    releaseId: version.releaseId ?? null,
    buildTimestamp: version.builtAt ?? null,
    migration,
    api: {
      containerId: api.Id,
      containerImageReference: api.Config.Image,
      imageId: api.Image,
      imageRevision: apiImage.Config.Labels?.['org.opencontainers.image.revision'] ?? null,
      releaseEnvironment: apiEnv,
      publicVersion: version,
    },
    worker: {
      containerId: worker.Id,
      containerImageReference: worker.Config.Image,
      imageId: worker.Image,
      imageRevision: workerImage.Config.Labels?.['org.opencontainers.image.revision'] ?? null,
      releaseEnvironment: workerEnv,
      heartbeatReleaseSha: workerHeartbeatSha,
    },
    checks,
  }
  const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name)
  if (failures.length) throw new Error(`Release lineage mismatch: ${failures.join(', ')}`)
  const target = process.env.API_ATLAS_LINEAGE_PATH ?? join('/var/lib/modula/deployments', `${acceptedSha}.json`)
  mkdirSync(dirname(target), {recursive: true})
  writeFileSync(target, `${JSON.stringify(record, null, 2)}\n`, {mode: 0o640})
  process.stdout.write(`${JSON.stringify({target, releaseId: record.releaseId, acceptedGitCommit: acceptedSha, migration, checks}, null, 2)}\n`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
