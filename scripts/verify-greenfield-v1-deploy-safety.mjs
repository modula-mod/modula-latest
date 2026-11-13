#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {checkComposeReleasePins} from './verify-compose-release-pins.mjs'

const deploy = readFileSync('ops/deploy/greenfield-production.sh', 'utf8')
const backup = readFileSync('ops/backup/greenfield-v1-backup.mjs', 'utf8')
const failures = []

check(deploy.includes('MODULA_BACKUP_EXPECTED_SOURCE_SHA="${PREVIOUS_SHA}"'), 'deploy pins the backup to the currently deployed SHA')
check(!deploy.includes('systemctl start modula-greenfield-backup.service'), 'deploy does not delegate its synchronous backup gate to systemd')
check(deploy.includes('flock -n /run/lock/modula-greenfield-backup.lock'), 'deploy uses the backup lock')
check(deploy.includes('${SCRIPT_ROOT}/ops/backup/greenfield-v1-backup.mjs'), 'deploy resolves the default backup runner from the repository ops directory')
check(deploy.includes('node dist/scripts/db-migrate.js'), 'deploy invokes the compiled migration entrypoint in the production image')
check(deploy.includes('node dist/scripts/db-status.js'), 'deploy invokes the compiled migration status entrypoint in the production image')
check(existsSync('services/greenfield-api/src/scripts/db-migrate.ts'), 'compiled migration entrypoint source is included in the API build')
check(existsSync('services/greenfield-api/src/scripts/db-status.ts'), 'compiled migration status entrypoint source is included in the API build')
check(deploy.indexOf('DEPLOY_PHASE="pre-deploy-backup"') < deploy.indexOf('DEPLOY_PHASE="checkout-fast-forward"'), 'backup precedes checkout fast-forward')
check(backup.includes("process.env.MODULA_BACKUP_EXPECTED_SOURCE_SHA"), 'backup wrapper accepts an explicit expected source SHA')
check(backup.includes("scheduled backup requires production checkout to match origin/main"), 'scheduled backups remain pinned to origin/main')
check(backup.includes("revision !== sourceRevision"), 'backup wrapper verifies running API and worker image revisions')

const syntax = spawnSync('bash', ['-n', 'ops/deploy/greenfield-production.sh'], {encoding: 'utf8'})
check(syntax.status === 0, `deployment script parses${syntax.status === 0 ? '' : `: ${syntax.stderr.trim()}`}`)

// GF-OPS-01: release identity is required in production compose, no migration id defaults, worker heartbeat healthcheck.
check(deploy.includes('export SOURCE_EXPECTED_MIGRATION="${EXPECTED_MIGRATION}"'), 'deploy exports the explicit expected migration to compose')
const pins = checkComposeReleasePins()
for (const failure of pins.failures) check(false, failure)
check(pins.ok, 'production compose requires release identity, has no migration id defaults, and health-checks the worker heartbeat')
const helper = spawnSync('bash', ['-n', 'ops/deploy/running-release-env.sh'], {encoding: 'utf8'})
check(helper.status === 0, `running release env helper parses${helper.status === 0 ? '' : `: ${helper.stderr.trim()}`}`)

if (failures.length) {
  console.error(`GreenField v1 deploy safety verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}
console.log('GreenField v1 deploy safety verifier passed')

function check(condition, message) {
  if (condition) console.log(`PASS ${message}`)
  else {
    failures.push(message)
    console.error(`FAIL ${message}`)
  }
}
