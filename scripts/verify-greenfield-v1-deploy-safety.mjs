#!/usr/bin/env node
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'

const deploy = readFileSync('ops/deploy/greenfield-production.sh', 'utf8')
const backup = readFileSync('ops/backup/greenfield-v1-backup.mjs', 'utf8')
const failures = []

check(deploy.includes('MODULA_BACKUP_EXPECTED_SOURCE_SHA="${PREVIOUS_SHA}"'), 'deploy pins the backup to the currently deployed SHA')
check(!deploy.includes('systemctl start modula-greenfield-backup.service'), 'deploy does not delegate its synchronous backup gate to systemd')
check(deploy.includes('flock -n /run/lock/modula-greenfield-backup.lock'), 'deploy uses the backup lock')
check(deploy.indexOf('DEPLOY_PHASE="pre-deploy-backup"') < deploy.indexOf('DEPLOY_PHASE="checkout-fast-forward"'), 'backup precedes checkout fast-forward')
check(backup.includes("process.env.MODULA_BACKUP_EXPECTED_SOURCE_SHA"), 'backup wrapper accepts an explicit expected source SHA')
check(backup.includes("scheduled backup requires production checkout to match origin/main"), 'scheduled backups remain pinned to origin/main')
check(backup.includes("revision !== sourceRevision"), 'backup wrapper verifies running API and worker image revisions')

const syntax = spawnSync('bash', ['-n', 'ops/deploy/greenfield-production.sh'], {encoding: 'utf8'})
check(syntax.status === 0, `deployment script parses${syntax.status === 0 ? '' : `: ${syntax.stderr.trim()}`}`)

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
