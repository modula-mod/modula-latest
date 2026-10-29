#!/usr/bin/env node
import {check, finish, maybeSh, read} from './phase7c-verifier-utils.mjs'

const acceptedEvidenceFiles = [
  'docs/validation/phase7c-after/README.md',
  'docs/validation/phase7c-live-acceptance.md',
  'docs/validation/phase7c-final-report.md',
]

for (const rel of acceptedEvidenceFiles) {
  const source = read(rel)
  check(`${rel} must be accepted before release candidate`, /^Status:\s+ACCEPTED\s*$/m.test(source))
  check(`${rel} missing build number`, source.includes('Build number:'))
  check(`${rel} missing deployment commit`, source.includes('Deployment commit:'))
  check(`${rel} missing verification commands`, /^##\s+Verification commands\s*$/im.test(source))
}

const native = read('docs/validation/phase7c-native-acceptance.md')
check('native packaging deferral must be explicit', /^Status:\s+DEFERRED\s*$/m.test(native))
check('native packaging deferral missing EAS Build scope', native.includes('EAS Build: deferred to native packaging phase'))
check('native packaging deferral missing physical iPhone scope', native.includes('Physical iPhone: deferred to native packaging phase'))
check('native packaging deferral missing TestFlight scope', native.includes('TestFlight candidate: deferred to native packaging phase'))
check('native packaging must not be a Phase 7C blocker', native.includes('not a Phase 7C release blocker'))
check('native packaging verifier commands must not run EAS builds', !native.includes('pnpm exec eas build'))

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
for (const evidence of [
  'API image digest:',
  'Worker image digest:',
  'Web release:',
  'Pre-migration backup:',
  'Pre-migration backup SHA-256:',
  'pending": []',
  'scripts/smoke-api-preview.sh https://api.modula.digital',
  'scripts/smoke-web-preview.sh https://modula.digital',
]) {
  check(`live acceptance missing ${evidence}`, live.includes(evidence))
}

const finalReport = read('docs/validation/phase7c-final-report.md')
for (const section of [
  '## Migration Versions',
  '## Deployment Record',
  '## Backup Record',
  '## Verification Results',
  '## Live Acceptance',
  '## Native Packaging Deferral',
  '## Known Issues',
  '## Merge Status',
]) {
  check(`final report missing ${section}`, finalReport.includes(section))
}
check('final report must record revised Phase 7C-C workflow', finalReport.includes('Native packaging is deferred'))
check('final report must keep Phase 7D blocked', finalReport.includes('Phase 7D work has not started'))

const reconciliation = read('docs/validation/phase7c-verifier-reconciliation.md')
check('verifier reconciliation must be accepted', /^Status:\s+ACCEPTED\s*$/m.test(reconciliation))
check('verifier reconciliation missing release-candidate update', reconciliation.includes('does not require EAS Build, TestFlight upload or physical-device acceptance'))

for (const verifier of [
  'verify-phase7c-product-complete.mjs',
  'verify-phase7c-api-parity.mjs',
  'verify-phase7c-placeholder-free.mjs',
]) {
  const output = maybeSh(['node', `scripts/${verifier}`])
  check(`${verifier} did not pass`, output.includes('passed'))
}

finish('Phase 7C release-candidate verification')
