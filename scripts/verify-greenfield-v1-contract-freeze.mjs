#!/usr/bin/env node
import {createHash} from 'node:crypto'
import {readFileSync, readdirSync} from 'node:fs'
import {join} from 'node:path'

const root = process.cwd()
const fixtureRoot = join(root, 'fixtures/greenfield-v1-native/1.0.0')
const failures = []
const requiredFiles = [
  'installation-descriptor.json', 'release-descriptor.json', 'install-plan.json', 'update-plan.json',
  'permission-review-required.json', 'host-incompatibility.json', 'revoked-release.json', 'sync-page.json',
  'media-binding.json', 'share.json', 'function-invocation.json', 'action-request-result.json', 'host-capability.json',
]
const requiredPaths = {
  'installation-descriptor.json': ['schemaVersion', 'installationId', 'moduleId', 'version', 'status', 'releaseId', 'permissionReviewRequired', 'permissions.granted', 'trust.verified', 'compatibility.reasons'],
  'release-descriptor.json': ['schemaVersion', 'releaseId', 'moduleId', 'version', 'publicationState', 'revoked', 'digests.manifestSha256', 'digests.packageSha256', 'digests.frontendSha256', 'signer.state', 'provenance.sourceSha'],
  'install-plan.json': ['schemaVersion', 'planId', 'moduleId', 'targetVersion', 'allowed', 'blockedReasonCodes', 'permissionReviewRequired', 'permissions.requested', 'compatibility.reasons'],
  'update-plan.json': ['schemaVersion', 'installationId', 'fromVersion', 'toVersion', 'allowed', 'blockedReasonCodes', 'permissionDelta.added', 'permissionDelta.removed', 'permissionDelta.reviewRequired', 'rollback.available'],
  'permission-review-required.json': ['ok', 'error.code', 'error.message', 'error.requestId', 'error.retryable', 'meta.requestId'],
  'host-incompatibility.json': ['schemaVersion', 'compatible', 'reasons', 'requiredCapabilities'],
  'revoked-release.json': ['schemaVersion', 'releaseId', 'revoked', 'revocation.code', 'installAllowed', 'updateAllowed', 'artifactAuthorization'],
  'sync-page.json': ['schemaVersion', 'changes', 'nextCursor', 'hasMore', 'retentionBoundary'],
  'media-binding.json': ['schemaVersion', 'bindingId', 'moduleId', 'recordType', 'recordId', 'assetId', 'authorized'],
  'share.json': ['schemaVersion', 'shareId', 'ownerAccountId', 'recipientAccountId', 'permission', 'expiresAt', 'revokedAt', 'visibilityLostAt'],
  'function-invocation.json': ['schemaVersion', 'functionId', 'version', 'mutationId', 'idempotent', 'status', 'executionMode', 'output'],
  'action-request-result.json': ['request.targetModuleId', 'request.actionId', 'request.mutationId', 'request.lineage.correlationId', 'result.status', 'result.lineage.modules', 'result.lineage.actionCount'],
  'host-capability.json': ['schemaVersion', 'capabilities'],
}

const expectedChecksums = new Map(readFileSync(join(fixtureRoot, 'checksums.sha256'), 'utf8').trim().split('\n').map(line => {
  const match = /^([a-f0-9]{64})  ([a-z0-9.-]+)$/.exec(line)
  if (!match) throw new Error(`invalid fixture checksum line: ${line}`)
  return [match[2], match[1]]
}))

for (const file of requiredFiles) {
  const bytes = readFileSync(join(fixtureRoot, file))
  const actual = createHash('sha256').update(bytes).digest('hex')
  record(`fixture checksum ${file}`, actual === expectedChecksums.get(file), actual)
  const value = JSON.parse(bytes.toString('utf8'))
  for (const path of requiredPaths[file] ?? []) record(`${file} ${path}`, hasPath(value, path), 'required')
}
record('fixture set exact', sameSets(requiredFiles, readdirSync(fixtureRoot).filter(file => file.endsWith('.json'))), `${requiredFiles.length} JSON fixtures`)

const contract = readFileSync(join(root, 'docs/architecture/greenfield-v1-contract-freeze.md'), 'utf8')
const normalizedContract = contract.replace(/\s+/g, ' ')
for (const name of ['authentication', 'module identity', 'release trust', 'permission request', 'records', 'references', 'history', 'sync', 'media', 'sharing', 'settings', 'functions', 'actions', 'search', 'intelligence', 'Product UI', 'Host capability', 'Distribution', 'Install/update', 'Artifact authorization', 'Compatibility', 'revocation', 'Rollback']) {
  record(`contract ${name}`, contract.toLowerCase().includes(name.toLowerCase()), 'documented')
}
for (const policy of ['No public behavior may silently change', 'Additive optional fields', 'Deprecations require']) record(`policy ${policy}`, normalizedContract.includes(policy), 'frozen')

const errors = readFileSync(join(root, 'packages/api-contracts/src/errors.ts'), 'utf8')
for (const code of ['PERMISSION_REVIEW_REQUIRED', 'MODULE_PERMISSION_DENIED', 'INSTALLATION_DISABLED', 'UNTRUSTED_RELEASE', 'REVISION_CONFLICT', 'MUTATION_REUSE_CONFLICT', 'INVALID_CURSOR', 'FUNCTION_NOT_AVAILABLE', 'CAPABILITY_UNAVAILABLE', 'HOST_VERSION_TOO_OLD', 'RELEASE_REVOKED', 'SIGNER_REVOKED', 'ARTIFACT_DIGEST_MISMATCH', 'RATE_LIMITED']) {
  record(`error ${code}`, errors.includes(`${code}:`) && errors.includes(`'${code}'`), 'typed and mapped')
}
record('bounded error alias', errors.includes("NOTE_REVISION_CONFLICT: 'REVISION_CONFLICT'"), 'canonicalized')

console.log('\nGREENFIELD V1 CONTRACT FREEZE')
if (failures.length) {
  console.log(`FAIL (${failures.length})`)
  failures.forEach(failure => console.log(`- ${failure}`))
  process.exit(1)
}
console.log('PASS')

function record(label, passed, detail) {
  console.log(`${label.padEnd(72)} ${passed ? 'PASS' : 'FAIL'}  ${detail}`)
  if (!passed) failures.push(label)
}
function hasPath(value, path) {
  let current = value
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return false
    current = current[part]
  }
  return true
}
function sameSets(left, right) {
  return left.length === right.length && left.every(value => right.includes(value))
}
