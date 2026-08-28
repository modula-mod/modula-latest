import {randomBytes} from 'node:crypto'
import {spawnSync} from 'node:child_process'

const previewContainer = 'modula-preview-greenfield-postgres-1'

export function createGreenfieldVerifierDatabaseFixture(name) {
  const supplied = process.env.MODULA_TEST_DATABASE_URL
  if (supplied) {
    return {
      databaseName: new URL(supplied).pathname.slice(1),
      migratorUrl: supplied,
      testUrl: supplied,
      cleanup: () => undefined,
    }
  }

  if (!output('docker', ['container', 'inspect', previewContainer])) return null
  const environment = output('docker', ['inspect', previewContainer, '--format', '{{range .Config.Env}}{{println .}}{{end}}'])
  const values = Object.fromEntries(environment.split('\n').map(line => line.split(/=(.*)/s).slice(0, 2)).filter(parts => parts.length === 2))
  const suffix = `${process.pid}_${Date.now()}`.toLowerCase()
  const safeName = name.replace(/[^a-z0-9_]/gi, '_').toLowerCase()
  const databaseName = `modula_gbv1_${safeName}_${suffix}`
  const testRole = `gbv1_${safeName}_test_${suffix}`
  const testPassword = randomBytes(24).toString('base64url')
  const adminDatabase = values.POSTGRES_DB ?? 'modula'

  const roleCreated = spawnSync('docker', [
    'exec', previewContainer, 'psql', '-U', 'modula_admin', '-d', adminDatabase,
    '-v', 'ON_ERROR_STOP=1', '-c', `CREATE ROLE ${testRole} LOGIN SUPERUSER PASSWORD '${testPassword}'`,
  ], {stdio: 'ignore', shell: false})
  if (roleCreated.status !== 0) return null

  const databaseCreated = spawnSync('docker', [
    'exec', previewContainer, 'createdb', '-U', 'modula_admin', '-O', 'modula_migrator', databaseName,
  ], {stdio: 'ignore', shell: false})
  if (databaseCreated.status !== 0) {
    dropRole(adminDatabase, testRole)
    return null
  }

  return {
    databaseName,
    migratorUrl: databaseUrl('modula_migrator', values.MODULA_MIGRATOR_PASSWORD, databaseName),
    testUrl: databaseUrl(testRole, testPassword, databaseName),
    cleanup: () => {
      spawnSync('docker', [
        'exec', previewContainer, 'dropdb', '-U', 'modula_admin', '--if-exists', '--force', databaseName,
      ], {stdio: 'ignore', shell: false})
      dropRole(adminDatabase, testRole)
    },
  }
}

function dropRole(database, role) {
  spawnSync('docker', [
    'exec', previewContainer, 'psql', '-U', 'modula_admin', '-d', database, '-c', `DROP ROLE IF EXISTS ${role}`,
  ], {stdio: 'ignore', shell: false})
}

function databaseUrl(user, password, database) {
  const url = new URL('postgresql://127.0.0.1:5433')
  url.username = user
  if (password) url.password = password
  url.pathname = `/${database}`
  return url.toString()
}

function output(command, args) {
  const result = spawnSync(command, args, {encoding: 'utf8', shell: false})
  return result.status === 0 ? result.stdout.trim() : ''
}
