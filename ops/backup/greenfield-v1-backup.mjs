#!/usr/bin/env node
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs'
import {basename, dirname, join, resolve} from 'node:path'
import {spawnSync} from 'node:child_process'

process.umask(0o077)

const repo = resolve(process.env.MODULA_PRODUCTION_CHECKOUT ?? '/root/modula-latest')
const outputRoot = resolve(process.env.MODULA_RECOVERY_OUTPUT_ROOT ?? '/var/backups/modula/greenfield-v1')
const baseConfigPath = resolve(process.env.MODULA_RECOVERY_CONFIG ?? '/etc/modula/greenfield-backend-v1-recovery.json')
const recoveryTool = join(repo, 'ops/backup/greenfield-backend-v1-recovery.mjs')
const stageParent = resolve(process.env.MODULA_RECOVERY_STAGE_PARENT ?? '/var/lib/modula/greenfield-recovery-staging')
const postgresContainer = process.env.MODULA_POSTGRES_CONTAINER ?? 'modula-production-greenfield-postgres-1'
const apiContainer = process.env.MODULA_API_CONTAINER ?? 'modula-production-greenfield-api-1'
const workerContainer = process.env.MODULA_WORKER_CONTAINER ?? 'modula-production-greenfield-worker-1'

assertDedicatedPath(outputRoot, 'backup output root')
assertDedicatedPath(stageParent, 'backup staging parent')
mkdirSync(outputRoot, {recursive: true, mode: 0o700})
mkdirSync(stageParent, {recursive: true, mode: 0o700})
if ((statSync(outputRoot).mode & 0o077) !== 0) fail('backup output root must be owner-only')

const sourceRevision = git(['rev-parse', 'HEAD'])
if (!/^[0-9a-f]{40}$/.test(sourceRevision)) fail('production checkout has no exact Git SHA')
if (git(['branch', '--show-current']) !== 'main') fail('production checkout must be on main')
if (git(['status', '--short'])) fail('production checkout must be clean')
const expectedSourceRevision = process.env.MODULA_BACKUP_EXPECTED_SOURCE_SHA
if (expectedSourceRevision !== undefined) {
  if (!/^[0-9a-f]{40}$/.test(expectedSourceRevision)) fail('MODULA_BACKUP_EXPECTED_SOURCE_SHA must be an exact Git SHA')
  if (sourceRevision !== expectedSourceRevision) fail('production checkout does not match the expected backup source SHA')
} else {
  const originMain = git(['rev-parse', 'origin/main'])
  if (sourceRevision !== originMain) fail('scheduled backup requires production checkout to match origin/main')
}

for (const container of [apiContainer, workerContainer]) {
  const running = dockerInspect(container)
  const revision = running.Config?.Labels?.['org.opencontainers.image.revision']
  if (running.State?.Running !== true || revision !== sourceRevision) {
    fail(`${container} is not running the accepted production checkout revision`)
  }
}

const postgres = dockerInspect(postgresContainer)
if (postgres.State?.Running !== true) fail('production PostgreSQL container is not running')
const networks = Object.values(postgres.NetworkSettings?.Networks ?? {})
const postgresAddress = networks.map(value => value?.IPAddress).find(Boolean)
if (!postgresAddress) fail('cannot resolve the production PostgreSQL container address')

const databaseUrl = requiredEnv('MODULA_RECOVERY_GREENFIELD_DATABASE_URL')
const resolvedUrl = new URL(databaseUrl)
resolvedUrl.hostname = postgresAddress
process.env.MODULA_RECOVERY_GREENFIELD_DATABASE_URL = resolvedUrl.toString()

const stage = mkdtempSync(join(stageParent, 'greenfield-v1-recovery-stage-'))
const snapshot = join(stage, 'configuration')
mkdirSync(snapshot, {mode: 0o700})
try {
  snapshotProductionConfiguration(snapshot)
  process.env.MODULA_RECOVERY_CONFIGURATION_ROOT = snapshot
  const config = JSON.parse(readFileSync(baseConfigPath, 'utf8'))
  config.sourceRevision = sourceRevision
  config.assets = Array.isArray(config.assets) ? config.assets.filter(asset => asset.id !== 'production-configuration') : []
  config.assets.push({
    id: 'production-configuration',
    role: 'MANAGED_ASSETS',
    pathEnv: 'MODULA_RECOVERY_CONFIGURATION_ROOT',
  })
  const configPath = join(stage, 'recovery.json')
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, {mode: 0o600, flag: 'wx'})

  const result = run(process.execPath, [recoveryTool, 'backup', '--config', configPath, '--output-root', outputRoot], process.env)
  const report = JSON.parse(result.trim().split('\n').at(-1))
  if (report.ok !== true || typeof report.backupDir !== 'string') fail('recovery tool returned an invalid backup report')
  run(process.execPath, [recoveryTool, 'verify', '--config', configPath, '--backup-dir', report.backupDir], process.env)
  const marker = {
    format: 'modula.greenfield.backup-success.v1',
    completedAt: new Date().toISOString(),
    sourceRevision,
    backupSetId: report.backupSetId,
    backupDir: report.backupDir,
    payloadCount: report.payloadCount,
  }
  writeFileSync(join(outputRoot, 'last-success.json'), `${JSON.stringify(marker, null, 2)}\n`, {mode: 0o600})
  process.stdout.write(`${JSON.stringify({ok: true, ...marker})}\n`)
} finally {
  rmSync(stage, {recursive: true, force: true})
}

function snapshotProductionConfiguration(destination) {
  const identity = resolve(requiredEnv('MODULA_RECOVERY_AGE_IDENTITY_FILE'))
  const etcTarget = join(destination, 'etc-modula')
  mkdirSync(etcTarget, {mode: 0o700})
  for (const entry of listFiles('/etc/modula')) {
    const source = join('/etc/modula', entry)
    if (resolve(source) === identity) continue
    copyFileSync(source, join(etcTarget, entry), 0)
  }
  copyRequired('/etc/nginx/conf.d/api.modula.digital.greenfield.conf', join(destination, 'nginx', 'api.modula.digital.greenfield.conf'))
  copyRequired(join(repo, 'ops/docker/compose.production.yml'), join(destination, 'repository', 'compose.production.yml'))
  copyRequired(join(repo, 'ops/docker/postgres/init-roles.sh'), join(destination, 'repository', 'init-roles.sh'))
  for (const path of ['/etc/systemd/system/modula-greenfield-backup.service', '/etc/systemd/system/modula-greenfield-backup.timer']) {
    if (existsSync(path)) copyRequired(path, join(destination, 'systemd', basename(path)))
  }
  const inventory = {
    capturedAt: new Date().toISOString(),
    sourceRevision,
    excludedSecrets: ['age identity is independently escrowed and is never embedded in its own encrypted backup'],
    environmentFiles: listFiles('/etc/modula'),
  }
  writeFileSync(join(destination, 'inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`, {mode: 0o600})
}

function listFiles(path) {
  const result = run('find', [path, '-maxdepth', '1', '-type', 'f', '-printf', '%f\n'], process.env)
  return result.split('\n').filter(Boolean).sort()
}

function copyRequired(source, target) {
  if (!existsSync(source) || !statSync(source).isFile()) fail(`required production configuration is missing: ${source}`)
  mkdirSync(dirname(target), {recursive: true, mode: 0o700})
  copyFileSync(source, target, 0)
}

function dockerInspect(container) {
  return JSON.parse(run('docker', ['inspect', container], process.env))[0]
}

function git(args) {
  return run('git', ['-C', repo, ...args], process.env).trim()
}

function run(command, args, env) {
  const result = spawnSync(command, args, {env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024})
  if (result.status !== 0) fail(`${basename(command)} failed: ${bounded(result.stderr || result.stdout)}`)
  return result.stdout
}

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) fail(`required environment variable missing: ${name}`)
  return value
}

function assertDedicatedPath(path, label) {
  if (!path.startsWith('/') || ['/', '/root', '/var', '/tmp', '/var/lib/modula'].includes(path)) fail(`${label} must be a dedicated absolute path`)
}

function bounded(value) {
  return String(value).replaceAll(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted-database-url]').slice(0, 1200).trim()
}

function fail(message) {
  throw new Error(message)
}
