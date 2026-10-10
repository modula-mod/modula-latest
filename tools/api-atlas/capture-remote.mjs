#!/usr/bin/env node
import {execFileSync} from 'node:child_process'
import {writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {evidenceDir} from './lib.mjs'

// The VPS checkout is read only. Capture runs there over SSH and streams only
// sanitized evidence back to this Mac worktree; production-snapshot.json is
// written locally, never on the VPS.
const remoteCode = `
import {readFileSync} from 'node:fs'
import {captureHostSnapshot, json, sanitizeForSecretScan} from './tools/api-atlas/lib.mjs'
const snapshot = captureHostSnapshot()
const runtimeAccess = readFileSync('./services/greenfield-api/src/modules/runtime-access.ts', 'utf8')
if (snapshot.repository.head === snapshot.containers.api.revision
  && runtimeAccess.includes('grantedPermissions: arrayOfStrings(review?.granted_permissions)')) {
  for (const missing of snapshot.operationalAggregates.activeInstallPermissionReviews.missingReviews ?? []) {
    missing.effectiveAuthorizationSource = 'no recorded grants (fail closed)'
  }
}
process.stdout.write(sanitizeForSecretScan(json(snapshot)))
`
const evidence = execFileSync(
  'ssh',
  ['modula-vps', 'cd /root/modula-latest && node --input-type=module -'],
  {input: remoteCode, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe']},
)
const snapshot = JSON.parse(evidence)
if (!snapshot.capturedAt || !snapshot.containers?.api?.revision || !snapshot.containers?.worker?.revision) {
  throw new Error('Incomplete remote production snapshot')
}
if (snapshot.containers.api.revision !== snapshot.containers.worker.revision) {
  throw new Error('API and worker release revisions differ; refusing to capture mixed runtime')
}
if (!Array.isArray(snapshot.runtimeRoutes) || !snapshot.runtimeRoutes.length || !snapshot.databaseSchema?.appliedMigrations?.length) {
  throw new Error('Remote runtime routes or migration evidence is missing')
}
writeFileSync(join(evidenceDir, 'production-snapshot.json'), evidence)
process.stdout.write(JSON.stringify({
  capturedAt: snapshot.capturedAt,
  runtimeSha: snapshot.containers.api.revision,
  runtimeRoutes: snapshot.runtimeRoutes.length,
  migration: snapshot.databaseSchema.appliedMigrations.at(-1)?.id,
}) + '\n')
