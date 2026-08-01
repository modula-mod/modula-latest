#!/usr/bin/env node
import {
  finish,
  includes,
  pass,
  root,
  run,
  withIsolatedDatabase,
} from './phase7e-vault-notes-verifier-utils.mjs'

includes('services/greenfield-api/src/app/register-routes.ts', [
  '/v1/accounts/register',
  '/v1/accounts/verify-email',
  '/v1/accounts/resend-verification',
  '/v1/accounts/forgot-password',
  '/v1/accounts/reset-password',
  '/v1/sessions/refresh',
  '/v1/sessions/current',
], 'real auth routes are registered')

includes('services/greenfield-api/src/accounts/service.ts', [
  'acceptedTerms !== true',
  'displayName',
  'greenfield_email_verifications',
  'account.registered',
], 'registration service enforces product account fields')

includes('services/greenfield-api/src/accounts/recovery.ts', [
  'greenfield_recovery_tokens',
  'recovery.completed',
  'Password must be at least 10 characters',
], 'recovery service persists tokens and revokes sessions')

await withIsolatedDatabase('real auth integration', async env => {
  const testEnv = {
    ...env,
    NODE_ENV: 'test',
    MODULA_ENVIRONMENT: 'development',
    MODULA_RATE_LIMIT_ENABLED: 'false',
    MODULA_INVITE_ONLY: 'true',
    MODULA_REGISTRATION_INVITE_CODES: 'test-invite',
  }
  run(
    'pnpm',
    ['--filter', '@modula/greenfield-api', 'exec', 'vitest', 'run', 'tests/greenfield.accounts.test.ts'],
    'isolated register verify login refresh logout recovery integration test',
    root,
    testEnv,
  )
})

pass('Phase 7F Mac/iOS auth acceptance is not claimed by this verifier')
finish('Phase 7E real auth verifier')
