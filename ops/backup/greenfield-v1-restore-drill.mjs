#!/usr/bin/env node
/**
 * GF-OPS-02: restore drill from the off-host copy into a disposable host/DB.
 *
 * 1. pull the committed off-host set into an empty isolated staging dir and
 *    verify every file against the off-host receipt and the signed manifest;
 * 2. run greenfield-backend-v1-recovery.mjs verify + restore (which refuses
 *    non-empty or non-isolated targets: names must contain restore/recovery/dr/test);
 * 3. check the restored core DB: schema_version and inventory counts equal the
 *    signed manifest coverage, migration ledger has zero pending/unknown against
 *    the checkout, and (optional, disposable sources only) every public table's
 *    row count and content digest plus role grants equal a comparison DB.
 *
 * Never point --compare-url-env at production; it is for drills whose source is
 * itself a disposable database. Prints no connection strings.
 *
 *   node ops/backup/greenfield-v1-restore-drill.mjs --set <gbv1-recovery-...> \
 *     --staging /var/lib/modula/restore-drill/stage --config recovery.json \
 *     --targets restore-targets.json [--compare-url-env DRILL_SOURCE_URL] [--report out.json]
 */
import {readFileSync, readdirSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {parseTarget, pull} from './greenfield-v1-offhost.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const args = parseArgs(process.argv.slice(2))
const checks = []
const record = (name, ok, detail = '') => { checks.push({name, ok: Boolean(ok), detail: String(detail)}); return ok }

try {
  const setId = required('set')
  const staging = resolve(required('staging'))
  if (!/(restore|recovery|(^|[._/-])dr([._/-]|$)|test|drill)/i.test(staging)) throw new Error('staging path is not positively identified as an isolated drill path')
  const target = parseTarget(process.env.MODULA_OFFHOST_BACKUP_TARGET)
  const config = JSON.parse(readFileSync(resolve(required('config')), 'utf8'))
  const targetsPath = resolve(required('targets'))
  const targets = JSON.parse(readFileSync(targetsPath, 'utf8'))
  const startedAt = new Date().toISOString()

  const pulled = pull(setId, staging, target)
  record('off-host copy pulled and matches receipt + signed manifest', pulled.ok, `${pulled.fileCount} files, signature ${pulled.manifestSignature}`)
  if (pulled.manifestSignature !== 'valid') throw new Error('MODULA_RECOVERY_SIGNING_KEY is required so the drill verifies the manifest signature')
  const recoveryTool = join(repo, 'ops/backup/greenfield-backend-v1-recovery.mjs')
  const configPath = resolve(required('config'))
  node(recoveryTool, ['verify', '--config', configPath, '--backup-dir', pulled.backupDir])
  record('recovery verify (decrypt + pg_restore --list + archive listing)', true)
  const restored = JSON.parse(node(recoveryTool, ['restore', '--config', configPath, '--backup-dir', pulled.backupDir, '--targets', targetsPath]).trim().split('\n').at(-1))
  record('recovery restore into isolated targets', restored.ok === true, restored.restored?.join(','))

  const manifest = JSON.parse(readFileSync(join(pulled.backupDir, 'manifest.json'), 'utf8'))
  const coreId = config.databases.find(item => item.role === 'GREENFIELD_CORE')?.id
  const coreTarget = targets.databases.find(item => item.id === coreId)
  const core = connection(process.env[coreTarget?.urlEnv ?? ''] ?? '')
  const schema = psql(core, "SELECT value FROM schema_metadata WHERE key='schema_version'")
  record('schema_version equals signed manifest coverage', schema === manifest.coverage?.schemaVersion, `${schema} vs ${manifest.coverage?.schemaVersion}`)
  const tables = {accounts: 'greenfield_accounts', registry: 'greenfield_module_releases', installations: 'greenfield_extension_installations', events: 'greenfield_domain_events', jobs: 'background_jobs', entitlements: 'greenfield_entitlements', builds: 'greenfield_developer_builds', accountDataRequests: 'greenfield_account_data_requests'}
  for (const [name, table] of Object.entries(tables)) {
    const exists = psql(core, `SELECT to_regclass('public.${table}') IS NOT NULL`) === 't'
    const count = exists ? Number(psql(core, `SELECT count(*) FROM ${table}`)) : 0
    record(`inventory count ${name} equals manifest`, count === manifest.coverage?.counts?.[name], `${count} vs ${manifest.coverage?.counts?.[name]}`)
  }
  const source = readdirSync(join(repo, 'services/greenfield-api/migrations')).filter(file => file.endsWith('.sql') && !file.includes('.down.')).map(file => file.replace(/\.sql$/, '')).sort()
  const applied = psql(core, 'SELECT id FROM schema_migrations ORDER BY id').split('\n').filter(Boolean)
  const legacy = new Set([...(/KNOWN_LEGACY_MIGRATIONS\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(readFileSync(join(repo, 'services/greenfield-api/src/database/migrate.ts'), 'utf8'))?.[1] ?? '').matchAll(/'([^']+)'/g)].map(item => item[1]))
  const pending = source.filter(id => !applied.includes(id))
  const unknown = applied.filter(id => !source.includes(id) && !legacy.has(id))
  record('restored migration ledger: zero pending and unknown vs checkout', pending.length === 0 && unknown.length === 0, `applied=${applied.length} source=${source.length} pending=${pending.join(',') || 0} unknown=${unknown.join(',') || 0}`)
  record('restored migration tip equals checkout tip', applied.filter(id => source.includes(id)).at(-1) === source.at(-1), `${applied.at(-1)} vs ${source.at(-1)}`)

  if (args['compare-url-env']) {
    const compare = connection(process.env[args['compare-url-env']] ?? '')
    const list = "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1"
    const sourceTables = psql(compare, list).split('\n').filter(Boolean)
    const restoredTables = psql(core, list).split('\n').filter(Boolean)
    record('public table set equal to comparison DB', sourceTables.join(',') === restoredTables.join(','), `${restoredTables.length} vs ${sourceTables.length}`)
    let rowMismatch = 0
    let digestMismatch = 0
    let rows = 0
    for (const table of sourceTables) {
      if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error('unexpected table identifier')
      const digest = `SELECT count(*) || ':' || coalesce(md5(string_agg(t::text, E'\\n' ORDER BY t::text)), '') FROM public.${table} t`
      const [a, b] = [psql(compare, digest), psql(core, digest)]
      rows += Number(a.split(':')[0])
      if (a.split(':')[0] !== b.split(':')[0]) rowMismatch += 1
      if (a !== b) digestMismatch += 1
    }
    record('per-table row counts equal comparison DB', rowMismatch === 0, `${sourceTables.length} tables, ${rows} rows, mismatched=${rowMismatch}`)
    record('per-table content digests equal comparison DB', digestMismatch === 0, `mismatched=${digestMismatch}`)
    const grants = "SELECT grantee || ':' || table_name || ':' || privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee LIKE 'modula\\_%' ORDER BY 1"
    record('role table grants equal comparison DB (ACL-preserving restore)', psql(compare, grants) === psql(core, grants), `${psql(core, grants).split('\n').filter(Boolean).length} grants`)
  }

  report({ok: checks.every(item => item.ok), operation: 'restore-drill', backupSetId: setId, target: target.display, sourceRevision: manifest.sourceRevision, startedAt, completedAt: new Date().toISOString(), checks})
} catch (error) {
  record('drill', false, error instanceof Error ? error.message.replaceAll(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted-database-url]') : String(error))
  report({ok: false, operation: 'restore-drill', checks})
}

function report(value) {
  const text = `${JSON.stringify(value, null, 2)}\n`
  if (args.report) writeFileSync(resolve(args.report), text, {mode: 0o600})
  process.stdout.write(text)
  process.exit(value.ok ? 0 : 1)
}
function node(script, values) {
  const result = spawnSync(process.execPath, [script, ...values], {env: process.env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024})
  if (result.status !== 0) throw new Error(`${values[0]} failed: ${String(result.stderr || result.stdout).slice(0, 800).trim()}`)
  return result.stdout
}
function connection(value) {
  if (!value) throw new Error('database URL environment variable is not set')
  const url = new URL(value)
  return {...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGAPPNAME: 'modula-gbv1-restore-drill', PGCONNECT_TIMEOUT: '10'}
}
function psql(env, sql) {
  const result = spawnSync('psql', ['--no-psqlrc', '--quiet', '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1', '--command', sql], {env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024})
  if (result.status !== 0) throw new Error(`psql failed: ${String(result.stderr).slice(0, 400).trim()}`)
  return result.stdout.trim()
}
function required(name) {
  if (!args[name]) throw new Error(`--${name} is required`)
  return args[name]
}
function parseArgs(values) {
  const out = {}
  for (let index = 0; index < values.length; index += 2) {
    if (!values[index]?.startsWith('--') || values[index + 1] === undefined) {
      console.error('usage: greenfield-v1-restore-drill.mjs --set <id> --staging <dir> --config <file> --targets <file> [--compare-url-env NAME] [--report file]')
      process.exit(2)
    }
    out[values[index].slice(2)] = values[index + 1]
  }
  return out
}
