#!/usr/bin/env node
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {join} from 'node:path'

const root = process.cwd()
const failures = []
const permissionSource = readFileSync(join(root, 'packages/greenfield-module-manifest/src/permissions.ts'), 'utf8')
const runtimeAccess = readFileSync(join(root, 'services/greenfield-api/src/modules/runtime-access.ts'), 'utf8')
const functionService = readFileSync(join(root, 'services/greenfield-api/src/modules/governed-function-service.ts'), 'utf8')
const actionService = readFileSync(join(root, 'services/greenfield-api/src/modules/inter-module-action-service.ts'), 'utf8')

for (const permission of ['settings:read', 'settings:write', 'events:subscribe', 'search:index', 'ai.request', 'ai.context.private']) {
  record(`declared permission ${permission}`, permissionSource.includes(`'${permission}'`), 'known')
}
for (const pattern of ['RECORD_PERMISSION_PATTERN', 'MEDIA_PERMISSION_PATTERN', 'SHARING_PERMISSION_PATTERN', 'FUNCTION_INVOKE_PATTERN', 'INTER_MODULE_ACTION_REQUEST_PATTERN', 'NETWORK_REQUEST_PATTERN', 'PRODUCT_CAPABILITY_PATTERN']) {
  record(`dynamic permission ${pattern}`, permissionSource.includes(pattern), 'validated')
}
for (const check of ['collectionPermission', 'mediaPermission', 'sharingPermission']) record(`runtime enforcement ${check}`, runtimeAccess.includes(check), 'present')
record('runtime permission review fail closed', runtimeAccess.includes('permissionReviewRequired') && runtimeAccess.includes("moduleError('PERMISSION_REVIEW_REQUIRED'"), 'present')
record('function invoke enforcement', functionService.includes('governedFunctionInvokeCapability') && functionService.includes('enforceCapability'), 'present')
record('action request enforcement', actionService.includes('interModuleRequestCapability') && actionService.includes('enforceCapability'), 'present')

const manifestFiles = execFileSync('rg', ['--files', '-g', 'manifest.json', '-g', 'module.json', '-g', 'modula.module.json'], {cwd: root, encoding: 'utf8'}).trim().split('\n').filter(Boolean)
let manifests = 0
let requests = 0
for (const file of manifestFiles) {
  let value
  try { value = JSON.parse(readFileSync(join(root, file), 'utf8')) } catch { continue }
  const permissions = Array.isArray(value.permissions) ? value.permissions : []
  if (!permissions.length) continue
  manifests += 1
  for (const request of permissions) {
    const permission = typeof request === 'string' ? request : request?.permission ?? request?.id
    requests += 1
    record(`${file} ${String(permission)}`, typeof permission === 'string' && sourceSupports(permission), 'manifest request supported')
  }
}
record('permission-bearing manifests inventoried', manifests > 0, `${manifests} manifests / ${requests} requests`)

console.log('\nGREENFIELD V1 PERMISSION INVENTORY')
if (failures.length) {
  console.log(`FAIL (${failures.length})`)
  failures.forEach(failure => console.log(`- ${failure}`))
  process.exit(1)
}
console.log('PASS')

function sourceSupports(permission) {
  if (permissionSource.includes(`'${permission}'`)) return true
  return [
    /^records:module\.[a-z0-9.-]+\.[a-z0-9-]+:(read|write|delete)$/,
    /^media:module\.[a-z0-9.-]+\.[a-z0-9-]+:(read|write)$/,
    /^sharing:module\.[a-z0-9.-]+\.[a-z0-9-]+:(read|write)$/,
    /^functions:[a-z0-9.-]+\.function\.[a-z0-9-]+:invoke$/,
    /^module\.action:request:[a-z0-9.-]+:[a-z0-9-]+:\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/,
    /^network:[a-z0-9.-]+:request$/,
    /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*\.(read|create|update|delete|search|manage|export|contribute|subscribe|invoke|execute|record|transcribe|request|capture|playback)$/,
  ].some(pattern => pattern.test(permission))
}
function record(label, passed, detail) {
  console.log(`${label.padEnd(88)} ${passed ? 'PASS' : 'FAIL'}  ${detail}`)
  if (!passed) failures.push(label)
}
