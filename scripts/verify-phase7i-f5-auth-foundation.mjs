#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const target = process.argv[2] ?? 'all'

const checks = {
  'auth-password': [
    fileContains('services/greenfield-api/src/auth/credentials/service.ts', 'findActivePasswordMethod'),
    fileContains('services/greenfield-api/src/authentication/service.ts', 'authenticationMethodId: passwordMethod.methodId'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'greenfield_authentication_methods'),
    fileContains('services/greenfield-api/migrations/031_phase7i_f5_auth_domain.sql', "'password'"),
  ],
  'auth-email-otp': [
    fileContains('services/greenfield-api/src/auth/types.ts', "'email_login'"),
    fileContains('services/greenfield-api/src/auth/credentials/service.ts', 'createEmailOtpMethod'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'CHALLENGE_REPLAYED'),
    fileContains('services/greenfield-api/migrations/031_phase7i_f5_auth_domain.sql', "'email_otp'"),
  ],
  'auth-sessions': [
    fileContains('services/greenfield-api/src/sessions/service.ts', 'recent_authentication_at'),
    fileContains('services/greenfield-api/src/sessions/service.ts', 'authentication_strength'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'recent_authentication_at'),
  ],
  'auth-step-up': [
    fileContains('services/greenfield-api/src/auth/step-up/policy.ts', 'evaluateStepUpRequirement'),
    fileContains('services/greenfield-api/tests/greenfield.accounts.test.ts', 'dimon_operation'),
  ],
  'auth-totp': [blocked('TOTP enrollment, encrypted secret storage integration, QR provisioning, and step-up disable flow are not wired yet.')],
  'auth-passkeys': [blocked('WebAuthn/passkey registration/assertion verification and associated-domain validation are not wired yet.')],
  'auth-recovery': [blocked('One-time recovery-code sets are modeled in migration 031, but generation/use endpoints are not wired yet.')],
  'mail-identity': [blocked('Modula Mail identity tables/provisioner workflow are not implemented in this F5 auth-foundation slice.')],
  'mail-provisioner': [blocked('modula-mail-provisioner service is not implemented in this F5 auth-foundation slice.')],
  social: [blocked('Full two-account social golden path is outside this auth-foundation slice.')],
  stories: [blocked('Real Story data creation/viewer/expiry acceptance is outside this auth-foundation slice.')],
  marketplace: [blocked('Marketplace/Vault Notes Runtime 2 acceptance is outside this auth-foundation slice.')],
  'live-web-release': [blocked('Live web SHA deployment verification is outside this auth-foundation slice.')],
  mainline: [blocked('Branch audit, convergence branch, fresh-main clone/build are outside this auth-foundation slice.')],
}

const aggregateOrder = [
  'auth-password',
  'auth-email-otp',
  'auth-totp',
  'auth-passkeys',
  'auth-recovery',
  'auth-sessions',
  'auth-step-up',
  'mail-identity',
  'mail-provisioner',
  'social',
  'stories',
  'marketplace',
  'live-web-release',
  'mainline',
]

const targets = target === 'all' || target === 'phase7i-f5' ? aggregateOrder : [target]
let failures = 0
for (const name of targets) {
  const targetChecks = checks[name]
  if (!targetChecks) {
    console.error(`UNKNOWN verifier target: ${name}`)
    failures += 1
    continue
  }
  console.log(`\n${name}`)
  for (const check of targetChecks) {
    const result = check()
    console.log(`${result.ok ? 'PASS' : 'BLOCKED'} ${result.message}`)
    if (!result.ok) failures += 1
  }
}

if (failures > 0) {
  console.error(`\nPhase 7I-F5 verifier blocked: ${failures} unmet check(s).`)
  process.exit(1)
}

console.log('\nPhase 7I-F5 auth-foundation verifier passed.')

function fileContains(relativePath, text) {
  return () => {
    const fullPath = path.join(repoRoot, relativePath)
    if (!fs.existsSync(fullPath)) return {ok: false, message: `${relativePath} missing`}
    const body = fs.readFileSync(fullPath, 'utf8')
    return body.includes(text)
      ? {ok: true, message: `${relativePath} contains ${JSON.stringify(text)}`}
      : {ok: false, message: `${relativePath} missing ${JSON.stringify(text)}`}
  }
}

function blocked(message) {
  return () => ({ok: false, message})
}
