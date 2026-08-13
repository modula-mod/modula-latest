#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {rmSync} from 'node:fs'

const apiBaseURL = process.env.MODULA_PUBLIC_API_URL ?? 'http://127.0.0.1:4022'
const webBaseURL = process.env.MODULA_BROWSER_BASE_URL ?? 'http://127.0.0.1:4174'
const apiURL = new URL(apiBaseURL)
const webURL = new URL(webBaseURL)
const webPort = webURL.port || (webURL.protocol === 'https:' ? '443' : '80')
const inputDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL ?? process.env.MODULA_DATABASE_URL
const adminDatabaseUrl = process.env.MODULA_TEST_DATABASE_ADMIN_URL ?? process.env.MODULA_DATABASE_ADMIN_URL
const shouldCreateIsolatedDatabase =
  Boolean(adminDatabaseUrl) && process.env.MODULA_PHASE7LB_REUSE_DATABASE !== 'true'

if (!inputDatabaseUrl) {
  console.error('Phase 7L-B auth regression requires MODULA_TEST_DATABASE_URL or MODULA_DATABASE_URL.')
  process.exit(1)
}

const allowedOrigins = Array.from(
  new Set([
    webURL.origin,
    `http://127.0.0.1:${webPort}`,
    `http://localhost:${webPort}`,
  ]),
).join(',')

function sqlIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`
}

function psqlArgsFromUrl(connectionString) {
  const url = new URL(connectionString)
  return {
    args: [
      '-h',
      url.hostname,
      '-p',
      url.port || '5432',
      '-U',
      decodeURIComponent(url.username),
      '-d',
      decodeURIComponent(url.pathname.replace(/^\//, '')),
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ],
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(url.password),
    },
  }
}

function runPsql(label, connectionString, sql) {
  console.log(`\n=== ${label} ===`)
  const {args, env} = psqlArgsFromUrl(connectionString)
  const result = spawnSync('psql', [...args, '-c', sql], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw Object.assign(new Error(`${label} failed`), {exitCode: result.status ?? 1})
  }
}

function withDatabaseName(connectionString, databaseName) {
  const url = new URL(connectionString)
  url.pathname = `/${databaseName}`
  return url.toString()
}

function buildEnvironment(databaseUrl) {
  const migratorDatabaseUrl = shouldCreateIsolatedDatabase
    ? databaseUrl
    : process.env.MODULA_DATABASE_MIGRATOR_URL ?? databaseUrl
  const sharedEnv = {
    ...process.env,
    CI: process.env.CI ?? 'true',
    NODE_ENV: process.env.NODE_ENV ?? 'test',
    MODULA_ENVIRONMENT: process.env.MODULA_ENVIRONMENT ?? 'development',
    MODULA_API_HOST: apiURL.hostname,
    MODULA_API_PORT: apiURL.port || '4022',
    MODULA_PUBLIC_API_URL: apiURL.origin,
    MODULA_PUBLIC_WEB_URL: webURL.origin,
    MODULA_BROWSER_BASE_URL: webURL.origin,
    MODULA_TEST_DATABASE_URL: databaseUrl,
    MODULA_DATABASE_URL: databaseUrl,
    MODULA_DATABASE_MIGRATOR_URL: migratorDatabaseUrl,
    MODULA_ALLOWED_ORIGINS: process.env.MODULA_ALLOWED_ORIGINS ?? allowedOrigins,
    MODULA_PREVIEW_WRITES_ENABLED: process.env.MODULA_PREVIEW_WRITES_ENABLED ?? 'true',
    MODULA_REGISTRATION_MODE: process.env.MODULA_REGISTRATION_MODE ?? 'open',
    MODULA_INVITE_ONLY: process.env.MODULA_INVITE_ONLY ?? 'false',
    MODULA_RATE_LIMIT_ENABLED: process.env.MODULA_RATE_LIMIT_ENABLED ?? 'false',
    MODULA_ATPROTO_ENABLED: process.env.MODULA_ATPROTO_ENABLED ?? 'false',
    MODULA_LOG_LEVEL: process.env.MODULA_LOG_LEVEL ?? 'silent',
  }

  return {
    sharedEnv,
    webBuildEnv: {
      ...sharedEnv,
      EXPO_PUBLIC_APP_ENV: 'development',
      EXPO_PUBLIC_DATA_SOURCE: 'remote',
      EXPO_PUBLIC_API_URL: apiURL.origin,
      EXPO_PUBLIC_DEMO_SESSION: 'signedOut',
    },
  }
}

function run(label, command, args, env) {
  console.log(`\n=== ${label} ===`)
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.error(`${label} failed with exit code ${result.status ?? 'signal'}.`)
    throw Object.assign(new Error(`${label} failed`), {exitCode: result.status ?? 1})
  }
}

let databaseUrl = inputDatabaseUrl
let createdDatabaseName = ''
const inputUrl = new URL(inputDatabaseUrl)

try {
  if (shouldCreateIsolatedDatabase) {
    createdDatabaseName = `modula_phase7lb_auth_${Date.now().toString(36)}_${process.pid}`
    const owner = decodeURIComponent(inputUrl.username)
    databaseUrl = withDatabaseName(inputDatabaseUrl, createdDatabaseName)
    runPsql(
      'CREATE ISOLATED AUTH DB',
      adminDatabaseUrl,
      `create database ${sqlIdentifier(createdDatabaseName)} owner ${sqlIdentifier(owner)}`,
    )
  } else {
    console.log('\n=== REUSE AUTH DB ===')
    console.log('Using supplied MODULA_TEST_DATABASE_URL. Set MODULA_DATABASE_ADMIN_URL for an isolated disposable DB.')
  }

  const {sharedEnv, webBuildEnv} = buildEnvironment(databaseUrl)

  run('MIGRATIONS', 'pnpm', ['--filter', '@modula/greenfield-api', 'db:migrate'], sharedEnv)
  rmSync('dist', {force: true, recursive: true})
  run('WEB EXPORT LOCAL API', 'pnpm', ['exec', 'expo', 'export', '--platform', 'web', '--clear'], webBuildEnv)
  run('WEB VERSION MARKER', 'node', ['scripts/write-web-version.mjs'], webBuildEnv)
  run('AUTH BROWSER REGRESSION', 'pnpm', [
    'exec',
    'playwright',
    'test',
    '--config',
    'playwright.phase7l-b-auth.config.ts',
    'tests/phase7l-b-auth-regression.test.ts',
  ], sharedEnv)
} catch (error) {
  process.exitCode =
    error && typeof error === 'object' && 'exitCode' in error
      ? Number((error).exitCode)
      : 1
} finally {
  if (createdDatabaseName && adminDatabaseUrl) {
    runPsql(
      'TERMINATE ISOLATED AUTH DB CONNECTIONS',
      adminDatabaseUrl,
      `
        select pg_terminate_backend(pid)
        from pg_stat_activity
        where datname = ${sqlLiteral(createdDatabaseName)};
      `,
    )
    runPsql('DROP ISOLATED AUTH DB', adminDatabaseUrl, `drop database if exists ${sqlIdentifier(createdDatabaseName)}`)
  }
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}

console.log('\nPhase 7L-B auth browser regression passed.')
