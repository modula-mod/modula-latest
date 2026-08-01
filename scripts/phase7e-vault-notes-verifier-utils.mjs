import {readFileSync, existsSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'

export const root = process.cwd()
export const vaultNotesRoot = resolve(root, '../modula-mod/modula-vault-notes')
export const standardRoot = resolve(root, '../modula-mod/modula-module-standard')
export const failures = []

export function pass(message) {
  console.log(`PASS ${message}`)
}

export function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

export function finish(label) {
  if (failures.length > 0) {
    console.error(`${label} failed: ${failures.length} issue(s)`)
    process.exit(1)
  }
  console.log(`${label} passed`)
}

export function file(path, base = root) {
  const absolute = join(base, path)
  if (!existsSync(absolute)) {
    fail(`missing ${path}`)
    return ''
  }
  pass(`found ${relativeLabel(path, base)}`)
  return readFileSync(absolute, 'utf8')
}

export function json(path, base = vaultNotesRoot) {
  try {
    return JSON.parse(file(path, base) || '{}')
  } catch (error) {
    fail(`${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
    return {}
  }
}

export function includes(path, markers, label = path, base = root) {
  const text = file(path, base)
  const missing = markers.filter(marker => !text.includes(marker))
  if (missing.length) {
    for (const marker of missing) fail(`${label} missing ${marker}`)
  } else {
    pass(`${label} includes required markers`)
  }
  return text
}

export function run(command, args, label, cwd = root, env = process.env) {
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit', shell: false})
  if (result.status === 0) pass(label)
  else fail(`${label} exited ${result.status ?? 'without status'}`)
  return result.status === 0
}

export function runQuiet(command, args, cwd = root) {
  return spawnSync(command, args, {cwd, encoding: 'utf8', shell: false})
}

export function git(cwd, args) {
  const result = runQuiet('git', ['-C', cwd, ...args])
  if (result.status !== 0) return null
  return result.stdout.trim()
}

export function loadEnvFile(path = resolve(root, 'services/greenfield-api/.env')) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const index = trimmed.indexOf('=')
      const key = trimmed.slice(0, index)
      const value = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {}
}

export async function withIsolatedDatabase(label, callback) {
  loadEnvFile()
  const requireFromApi = createRequire(new URL('../services/greenfield-api/package.json', import.meta.url))
  const {Pool} = requireFromApi('pg')
  const baseUrl = process.env.MODULA_TEST_DATABASE_URL ?? process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
  if (!baseUrl) {
    fail(`${label} requires MODULA_TEST_DATABASE_URL, MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL`)
    return
  }
  const parsed = new URL(baseUrl)
  const templateDb = parsed.pathname.replace(/^\//, '') || 'postgres'
  const dbName = `modula_vault_notes_verify_${process.pid}_${Date.now()}`.toLowerCase()
  const createDatabaseSql = `CREATE DATABASE ${quoteIdent(dbName)} OWNER ${quoteIdent(parsed.username)} TEMPLATE template0`
  let adminPool = null
  let dropMode = null
  let created = false
  try {
    const adminConnectionString = adminConnectionStringFor(baseUrl)
    if (adminConnectionString) {
      const adminUrl = new URL(adminConnectionString)
      adminUrl.pathname = `/${templateDb}`
      adminPool = new Pool({connectionString: adminUrl.toString(), max: 1, application_name: 'modula-vault-notes-verify-admin'})
      try {
        await adminPool.query(createDatabaseSql)
        dropMode = 'pg'
      } catch {
        await adminPool.end()
        adminPool = null
      }
    }
    if (!dropMode) {
      if (!runDockerPostgresAdminSql(templateDb, createDatabaseSql, 'created isolated Vault Notes verifier database through preview Postgres container')) {
        fail('unable to create isolated Vault Notes verifier database')
        return
      }
      dropMode = 'docker'
    }
    created = true
    if (dropMode === 'pg') pass('created isolated Vault Notes verifier database')
    const testUrl = new URL(baseUrl)
    testUrl.pathname = `/${dbName}`
    const env = {...process.env, MODULA_TEST_DATABASE_URL: testUrl.toString(), MODULA_DATABASE_URL: testUrl.toString(), MODULA_DATABASE_MIGRATOR_URL: testUrl.toString()}
    await callback(env)
  } catch (error) {
    fail(`${label} failed: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    if (created) {
      if (dropMode === 'pg' && adminPool) {
        await adminPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [dbName])
        await adminPool.query(`DROP DATABASE IF EXISTS ${quoteIdent(dbName)}`)
        pass('dropped isolated Vault Notes verifier database')
      } else {
        runDockerPostgresAdminSql(templateDb, `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${quoteLiteral(dbName)} AND pid <> pg_backend_pid()`, 'terminated isolated Vault Notes verifier database sessions through preview Postgres container')
        runDockerDropDatabase(dbName, 'dropped isolated Vault Notes verifier database through preview Postgres container')
      }
    }
    if (adminPool) await adminPool.end()
  }
}

export async function rollbackLatestMigration(env, expected) {
  run(
    'pnpm',
    [
      '--filter',
      '@modula/greenfield-api',
      'exec',
      'tsx',
      '-e',
      `import {migrateDown} from './src/database/migrate.ts'; void (async () => { const rolledBack = []; for (let i = 0; i < 20; i += 1) { const down = await migrateDown(process.env.MODULA_TEST_DATABASE_URL); rolledBack.push(down); if (down === '${expected}') return; if (down === null) break; } console.error(\`expected rollback through ${expected}, got \${rolledBack.join(',')}\`); process.exit(1) })().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1) })`,
    ],
    `isolated migration rollback reaches ${expected}`,
    root,
    env,
  )
}

export async function verifyTableAbsent(env, table) {
  const requireFromApi = createRequire(new URL('../services/greenfield-api/package.json', import.meta.url))
  const {Pool} = requireFromApi('pg')
  const pool = new Pool({connectionString: env.MODULA_TEST_DATABASE_URL, max: 1, application_name: 'modula-vault-notes-verify-rollback'})
  try {
    const result = await pool.query(`SELECT to_regclass('public.${table}') AS relation`)
    if (result.rows[0]?.relation === null) pass(`confirmed ${table} removed after rollback`)
    else fail(`${table} still exists after rollback`)
  } finally {
    await pool.end()
  }
}

function adminConnectionStringFor(baseUrl) {
  if (process.env.MODULA_DATABASE_ADMIN_URL) return process.env.MODULA_DATABASE_ADMIN_URL
  if (!process.env.MODULA_ADMIN_PASSWORD) return null
  const adminUrl = new URL(baseUrl)
  adminUrl.username = 'modula_admin'
  adminUrl.password = process.env.MODULA_ADMIN_PASSWORD
  return adminUrl.toString()
}

function runDockerPostgresAdminSql(database, sqlText, label) {
  const result = spawnSync('docker', ['compose', '-f', 'ops/docker/compose.preview.yml', 'exec', '-T', 'greenfield-postgres', 'psql', '-U', 'modula_admin', '-d', database, '-v', 'ON_ERROR_STOP=1', '-q', '-c', sqlText], {cwd: root, encoding: 'utf8', shell: false})
  if (result.status === 0) {
    pass(label)
    return true
  }
  const details = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
  fail(`${label} exited ${result.status ?? 'without status'}${details ? `: ${details}` : ''}`)
  return false
}

function runDockerDropDatabase(database, label) {
  const result = spawnSync('docker', ['compose', '-f', 'ops/docker/compose.preview.yml', 'exec', '-T', 'greenfield-postgres', 'dropdb', '-U', 'modula_admin', '--if-exists', database], {cwd: root, encoding: 'utf8', shell: false})
  if (result.status === 0) {
    pass(label)
    return true
  }
  const details = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
  fail(`${label} exited ${result.status ?? 'without status'}${details ? `: ${details}` : ''}`)
  return false
}

function quoteIdent(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) throw new Error('unsafe database identifier')
  return `"${identifier.replaceAll('"', '""')}"`
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function relativeLabel(path, base) {
  if (base === root) return path
  if (base === vaultNotesRoot) return `modula-vault-notes/${path}`
  if (base === standardRoot) return `modula-module-standard/${path}`
  return path
}
