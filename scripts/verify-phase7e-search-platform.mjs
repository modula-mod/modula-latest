#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'

const root = process.cwd()
const apiRequire = createRequire(join(root, 'services/greenfield-api/package.json'))
const pg = apiRequire('pg')
const failures = []

function pass(message) {
  console.log(`PASS ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

function file(path) {
  const absolute = join(root, path)
  if (!existsSync(absolute)) {
    fail(`missing ${path}`)
    return ''
  }
  pass(`found ${path}`)
  return readFileSync(absolute, 'utf8')
}

function includes(path, markers, label = path) {
  const text = file(path)
  const missing = markers.filter(marker => !text.includes(marker))
  if (missing.length > 0) {
    for (const marker of missing) fail(`${label} missing ${marker}`)
  } else {
    pass(`${label} includes required markers`)
  }
  return text
}

function run(command, args, label, env = process.env) {
  const result = spawnSync(command, args, {cwd: root, env, stdio: 'inherit', shell: false})
  if (result.status === 0) pass(label)
  else fail(`${label} exited ${result.status ?? 'without status'}`)
}

includes('packages/greenfield-contracts/src/search.ts', [
  'interface GreenfieldSearchDocument',
  'schemaVersion: typeof GREENFIELD_SEARCH_DOCUMENT_SCHEMA_VERSION',
  "'post' | 'profile' | 'module' | 'module-release'",
  "'public' | 'followers' | 'private' | 'account' | 'system'",
  "'active' | 'deleted' | 'hidden' | 'quarantined' | 'unavailable'",
], 'canonical search document contract')

includes('packages/api-contracts/src/search.ts', [
  'interface GreenfieldSearchRequest',
  'interface GreenfieldSearchResponse',
  'interface GreenfieldSearchResult',
  'interface GreenfieldSearchSuggestion',
  'interface GreenfieldRecentSearch',
  'interface GreenfieldSavedSearch',
], 'public search API contract')

includes('services/greenfield-api/migrations/021_phase7e_unified_search.sql', [
  'CREATE TABLE IF NOT EXISTS search_documents',
  'UNIQUE(entity_type, entity_id)',
  'search_documents_vector_idx',
  'search_projection_state',
  'search_projection_failures',
  'sanitised_details',
  'saved_searches',
  'recent_searches',
  'search_reindex_requests',
  'search.post-projector',
  'search.module-release-projector',
  'search.reindex-requested',
], 'search migration')

includes('services/greenfield-api/migrations/021_phase7e_unified_search.down.sql', [
  'DROP TABLE IF EXISTS search_documents',
  'DELETE FROM greenfield_event_subscriptions',
  "('schema_version','020')",
], 'search rollback migration')

includes('services/greenfield-api/src/domains/search/query-parser.ts', [
  'normalizeSearchQuery',
  'CONTROL_CHARACTER_PATTERN',
  'decodeSearchCursor',
  'maxQueryLength',
  'maxTags',
], 'search query safety')

includes('services/greenfield-api/src/domains/search/repository.ts', [
  'websearch_to_tsquery',
  'SET LOCAL statement_timeout',
  'search_documents.source_version <= EXCLUDED.source_version',
  'visibility = \'public\'',
  'EXISTS (',
  'recent_searches',
  'saved_searches',
  'search_query_metrics',
], 'permission-aware projected search repository')

includes('services/greenfield-api/src/domains/search/service.ts', [
  'GreenfieldPolicyEngine',
  'evaluateAndAudit',
  'recordRecent',
  'requestReindex',
  'search.reindex-requested',
], 'search service policy and reindex orchestration')

includes('services/greenfield-api/src/app/register-routes.ts', [
  '/v1/search/suggestions',
  '/v1/search/recent',
  '/v1/search/saved',
  '/v1/admin/ops/search/health',
  '/v1/admin/ops/search/projections',
  '/v1/admin/ops/search/failures',
  '/v1/admin/ops/search/reindex',
  '/v1/admin/ops/search/failures/:failureId/retry',
], 'search routes')

includes('services/greenfield-worker/src/search/projector.ts', [
  'search_documents.source_version <= EXCLUDED.source_version',
  'tombstone',
  'recordFailure',
  'search_projection_failures',
  'sanitised_details',
], 'search projector correctness')

includes('services/greenfield-worker/src/search/index.ts', [
  'isSearchOperationalEvent',
  'projectPost',
  'projectProfile',
  'projectModule',
  'projectModuleRelease',
  'handleSearchReindex',
], 'search worker subscriber dispatch')

includes('services/greenfield-api/tests/phase7e.search-platform.test.ts', [
  'processOneEventDelivery',
  'private nebula',
  'aggregateVersion: 1',
  'tombstone.status',
  'nextCursor',
  'search.reindex.requested',
], 'search integration tests')

includes('services/greenfield-worker/tests/phase7e.search-projector.test.ts', [
  'ignores a stale source version',
  'toHaveLength(1)',
  'source_version',
], 'search worker tests')

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL ?? process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) {
  fail('MODULA_TEST_DATABASE_URL, MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL is required for isolated search-platform proof')
} else {
  await runIsolatedDatabase(databaseUrl)
}

if (failures.length > 0) {
  console.error(`Phase 7E search platform verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}

console.log('Phase 7E search platform verifier passed')

async function runIsolatedDatabase(baseUrl) {
  const parsed = new URL(baseUrl)
  const templateDb = parsed.pathname.replace(/^\//, '') || 'postgres'
  const dbName = `modula_search_verify_${process.pid}_${Date.now()}`.toLowerCase()
  const createDatabaseSql = `CREATE DATABASE ${quoteIdent(dbName)} OWNER ${quoteIdent(parsed.username)} TEMPLATE template0`
  let adminPool = null
  let dropMode = null
  let created = false
  try {
    const adminConnectionString = adminConnectionStringFor(baseUrl)
    if (adminConnectionString) {
      const adminUrl = new URL(adminConnectionString)
      adminUrl.pathname = `/${templateDb}`
      adminPool = new pg.Pool({connectionString: adminUrl.toString(), max: 1, application_name: 'modula-search-verify-admin'})
      try {
        await adminPool.query(createDatabaseSql)
        dropMode = 'pg'
      } catch {
        await adminPool.end()
        adminPool = null
      }
    }
    if (!dropMode) {
      if (!runDockerPostgresAdminSql(templateDb, createDatabaseSql, 'created isolated search verifier database through preview Postgres container')) {
        fail('unable to create isolated search verifier database with admin URL or preview Postgres container')
        return
      }
      dropMode = 'docker'
    }
    created = true
    if (dropMode === 'pg') pass('created isolated search verifier database')
    const testUrl = new URL(baseUrl)
    testUrl.pathname = `/${dbName}`
    const env = {...process.env, MODULA_TEST_DATABASE_URL: testUrl.toString(), MODULA_DATABASE_URL: testUrl.toString(), MODULA_DATABASE_MIGRATOR_URL: testUrl.toString()}
    run('pnpm', ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/phase7e.search-platform.test.ts'], 'isolated API search platform tests', env)
    run('pnpm', ['--filter', '@modula/greenfield-worker', 'exec', 'vitest', 'run', 'tests/phase7e.search-projector.test.ts'], 'isolated worker search projector tests', env)
    run(
      'pnpm',
      [
        '--filter',
        '@modula/greenfield-api',
        'exec',
        'tsx',
        '-e',
        "import {migrateDown} from './src/database/migrate.ts'; void (async () => { const down = await migrateDown(process.env.MODULA_TEST_DATABASE_URL); if (down !== '021_phase7e_unified_search') { console.error(`expected 021 rollback, got ${down}`); process.exit(1) } })().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1) })",
      ],
      'isolated migration 021 rollback',
      env,
    )
    await verifyRollbackRemovedSearchTables(testUrl.toString())
  } catch (error) {
    fail(`isolated database proof failed: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    if (created) {
      if (dropMode === 'pg' && adminPool) {
        await adminPool.query(
          `
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = $1 AND pid <> pg_backend_pid()
          `,
          [dbName],
        )
        await adminPool.query(`DROP DATABASE IF EXISTS ${quoteIdent(dbName)}`)
        pass('dropped isolated search verifier database')
      } else {
        runDockerPostgresAdminSql(
          templateDb,
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${quoteLiteral(dbName)} AND pid <> pg_backend_pid()`,
          'terminated isolated search verifier database sessions through preview Postgres container',
        )
        runDockerDropDatabase(dbName, 'dropped isolated search verifier database through preview Postgres container')
      }
    }
    if (adminPool) await adminPool.end()
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

async function verifyRollbackRemovedSearchTables(connectionString) {
  const pool = new pg.Pool({connectionString, max: 1, application_name: 'modula-search-verify-rollback'})
  try {
    const result = await pool.query("SELECT to_regclass('public.search_documents') AS relation")
    if (result.rows[0]?.relation === null) pass('confirmed search tables removed after rollback')
    else fail('search_documents still exists after migration 021 rollback')
  } finally {
    await pool.end()
  }
}

function runDockerPostgresAdminSql(database, sqlText, label) {
  const result = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      'ops/docker/compose.preview.yml',
      'exec',
      '-T',
      'greenfield-postgres',
      'psql',
      '-U',
      'modula_admin',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
      '-c',
      sqlText,
    ],
    {cwd: root, encoding: 'utf8', shell: false},
  )
  if (result.status === 0) {
    pass(label)
    return true
  }
  const details = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
  fail(`${label} exited ${result.status ?? 'without status'}${details ? `: ${details}` : ''}`)
  return false
}

function runDockerDropDatabase(database, label) {
  if (!/^[a-z_][a-z0-9_]*$/.test(database)) throw new Error('unsafe database identifier')
  const result = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      'ops/docker/compose.preview.yml',
      'exec',
      '-T',
      'greenfield-postgres',
      'dropdb',
      '-U',
      'modula_admin',
      '--if-exists',
      database,
    ],
    {cwd: root, encoding: 'utf8', shell: false},
  )
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
