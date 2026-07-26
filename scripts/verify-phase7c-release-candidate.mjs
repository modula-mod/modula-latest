#!/usr/bin/env node
import {check, finish, maybeSh, read} from './phase7c-verifier-utils.mjs'

const evidenceFiles = [
  'docs/validation/phase7c-after/README.md',
  'docs/validation/phase7c-native-acceptance.md',
  'docs/validation/phase7c-live-acceptance.md',
]

for (const rel of evidenceFiles) {
  const source = read(rel)
  check(`${rel} must be accepted before release candidate`, source.includes('Status: ACCEPTED'))
  check(`${rel} missing build number`, source.includes('Build number:'))
  check(`${rel} missing deployment commit`, source.includes('Deployment commit:'))
  check(`${rel} missing verification commands`, source.includes('Verification commands'))
}

const native = read('docs/validation/phase7c-native-acceptance.md')
check('native acceptance must record physical iPhone evidence', native.includes('Physical iPhone'))
check('native acceptance must record TestFlight candidate evidence', native.includes('TestFlight candidate'))

const live = read('docs/validation/phase7c-live-acceptance.md')
for (const endpoint of [
  'GET /v1/health/live',
  'GET /v1/health/ready',
  'GET /v1/meta',
  'GET /v1/feed/home',
  'GET /v1/search',
  'POST /v1/posts',
  'GET /v1/media/:mediaFile',
  'GET /v1/accounts/me/notification-preferences',
]) {
  check(`live acceptance missing ${endpoint}`, live.includes(endpoint))
}

for (const verifier of [
  'verify-phase7c-product-complete.mjs',
  'verify-phase7c-api-parity.mjs',
  'verify-phase7c-placeholder-free.mjs',
]) {
  const output = maybeSh(['node', `scripts/${verifier}`])
  check(`${verifier} did not pass`, output.includes('passed'))
}

finish('Phase 7C release-candidate verification')
