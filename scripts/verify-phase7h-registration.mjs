#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const errors = []

function read(rel) {
  const abs = join(root, rel)
  if (!existsSync(abs)) {
    errors.push(`missing ${rel}`)
    return ''
  }
  return readFileSync(abs, 'utf8')
}

function includes(rel, markers, label) {
  const text = read(rel)
  const missing = markers.filter(marker => !text.includes(marker))
  if (missing.length) {
    for (const marker of missing) errors.push(`${label} missing ${marker}`)
  }
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      MODULA_TEST_DATABASE_URL: '',
      MODULA_DATABASE_URL: process.env.MODULA_DATABASE_URL ?? 'postgres://modula:modula@127.0.0.1:5432/modula_test',
    },
    stdio: 'inherit',
    shell: false,
  })
  if (result.status !== 0) errors.push(`${label} exited ${result.status ?? 'without status'}`)
}

includes(
  'services/greenfield-api/src/config/env.ts',
  [
    "export type RegistrationMode = 'open' | 'invite-only' | 'closed'",
    'MODULA_REGISTRATION_MODE',
    "environment === 'production'",
    "registrationMode === 'invite-only'",
  ],
  'server registration config',
)

includes(
  'services/greenfield-api/src/accounts/service.ts',
  [
    "this.config.registrationMode === 'closed'",
    'Registration is closed',
    "this.config.registrationMode === 'invite-only'",
    'Valid invitation required',
  ],
  'account registration policy enforcement',
)

includes(
  'services/greenfield-api/src/app/register-routes.ts',
  [
    'registration:',
    'mode: config.registrationMode',
    'emailVerificationRequired: true',
    'inviteOnly: config.inviteOnly',
  ],
  'metadata registration advertisement',
)

includes(
  'packages/api-contracts/src/metadata.ts',
  [
    'ApiRegistrationMode',
    'ApiRegistrationCapability',
    'registration: ApiRegistrationCapability',
  ],
  'shared metadata contract',
)

includes(
  'src/api/decoding/decodeMetadata.ts',
  [
    'decodeRegistrationMode',
    "mode: 'closed'",
    'capabilities.inviteOnly',
    'registration.emailVerificationRequired',
  ],
  'frontend metadata decoder',
)

includes(
  'src/api/local/routes/metaRoutes.ts',
  [
    'registration:',
    "mode: 'open'",
    'emailVerificationRequired: true',
  ],
  'local metadata route',
)

includes(
  'src/auth/screens/CreateAccountScreen.tsx',
  [
    'useApiMetadataQuery',
    'registrationClosed',
    'Registration unavailable',
    'Sign in only',
    'Enter a valid invitation to create an account.',
  ],
  'auth registration UI contract',
)

includes(
  'services/greenfield-api/tests/greenfield.accounts.test.ts',
  [
    'derives explicit registration modes from server policy',
    "url: '/v1/meta'",
    "mode: 'invite-only'",
    'emailVerificationRequired: true',
  ],
  'registration tests',
)

run(
  'pnpm',
  ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield.accounts.test.ts'],
  'registration policy unit test',
)

if (errors.length) {
  console.error('Phase 7H registration verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7H registration verification passed.')
