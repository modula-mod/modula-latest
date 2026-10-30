import {execFileSync} from 'node:child_process'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {extname, join, relative, resolve} from 'node:path'
import {csvCell, extractSourceRoutes, json, outputDir, repoRoot, walk} from './lib.mjs'

const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')
const nativeRoot = resolve(process.env.MODULA_NATIVE_ROOT ?? '/root/modula-worktrees/modula-native-functional-parity-reference')
const productionRoot = resolve(process.env.MODULA_PRODUCTION_ROOT ?? '/root/modula-latest')
const atlasPath = join(outputDir, 'api-atlas.json')
const workerMapPath = join(outputDir, 'worker-job-map.json')

const nativeMismatchPaths = new Set(['/v1/connections/requests'])
const dormantNativeRouteIds = new Set([
  'DELETE /v1/posts/:postId',
  'PATCH /v1/posts/:postId',
  'POST /v1/posts/:postId/share',
  'POST /v1/stories/items/:itemId/viewed',
])
const explicitNativeRouteIds = {
  '/v1/profiles/me/:param': [
    'DELETE /v1/profiles/me/avatar', 'POST /v1/profiles/me/avatar',
    'DELETE /v1/profiles/me/cover', 'POST /v1/profiles/me/cover',
  ],
  '/v1/profiles/:param/:param': [
    'DELETE /v1/profiles/:profileId/block', 'DELETE /v1/profiles/:profileId/mute',
  ],
  '/v1/modules/:param/records/attachment': ['POST /v1/modules/:moduleId/records/:collection'],
}
const nativeMethodOverrides = {
  '/v1/attachments/:param': ['DELETE', 'GET'],
  '/v1/accounts/me/sessions': ['DELETE', 'GET'],
  '/v1/accounts/me': ['GET'],
  '/v1/sessions/:param': ['DELETE'],
  '/v1/modules/:param/install': ['DELETE', 'POST'],
  '/v1/profiles/:param/follow': ['DELETE', 'POST'],
  '/v1/posts/:param/like': ['DELETE', 'POST'],
  '/v1/posts/:param/save': ['DELETE', 'POST'],
  '/v1/posts/:param/repost': ['DELETE', 'POST'],
  '/v1/posts/:param': ['DELETE', 'GET', 'PATCH'],
  '/v1/in-mail': ['GET', 'POST'],
  '/v1/conversations': ['GET'],
  '/v1/conversations/:param/messages': ['GET', 'POST'],
  '/v1/profiles/:param/block': ['DELETE', 'POST'],
  '/v1/profiles/:param/mute': ['DELETE', 'POST'],
  '/v1/profiles/me/:param': ['DELETE', 'POST'],
  '/v1/accounts/me/app-preferences': ['GET', 'PATCH'],
  '/v1/profiles/:param/:param': ['DELETE'],
  '/v1/accounts/me/notification-preferences': ['GET', 'PATCH'],
  '/v1/support/cases': ['GET', 'POST'],
  '/v1/posts/:param/comments': ['GET', 'POST'],
  '/v1/comments/:param': ['DELETE'],
  '/v1/posts/:param/reaction': ['DELETE', 'PUT'],
  '/v1/comments/:param/replies': ['GET', 'POST'],
  '/v1/comments/:param/pin': ['DELETE', 'PUT'],
  '/v1/comments/:param/reaction': ['DELETE', 'PUT'],
  '/v1/modules/:param/records/:param': ['GET', 'POST'],
  '/v1/modules/:param/records/attachment': ['POST'],
  '/v1/connections/requests': ['GET'],
  '/v1/reels/:param': ['GET'],
}

requireFile(atlasPath, 'canonical API Atlas')
requireFile(join(nativeRoot, 'ios/Modula/Core/Networking/GreenfieldClient.swift'), 'Modula Native source')
requireFile(join(productionRoot, 'services/greenfield-api/src/app/register-routes.ts'), 'production GreenField source')

const atlas = JSON.parse(readFileSync(atlasPath, 'utf8'))
const workerMap = JSON.parse(readFileSync(workerMapPath, 'utf8'))
const mainBaselineSha = git(repoRoot, ['merge-base', 'HEAD', 'origin/main'])
const nativeSha = git(nativeRoot, ['rev-parse', 'HEAD'])
const productionSha = git(productionRoot, ['rev-parse', 'HEAD'])
const nativeStatus = git(nativeRoot, ['status', '--porcelain'])
const productionStatus = git(productionRoot, ['status', '--porcelain'])
if (nativeStatus) throw new Error(`Native checkout must be clean; found:\n${nativeStatus}`)
if (productionStatus) throw new Error(`Production checkout must be clean; found:\n${productionStatus}`)

const productionRoutes = extractSourceRoutes(productionRoot)
const productionIds = new Set(productionRoutes.map(route => `${route.method} ${route.path}`))
const native = extractNativeReferences(nativeRoot, atlas.routes)
const nativeByRoute = new Map()
for (const item of native.mapped) {
  const rows = nativeByRoute.get(item.routeId) ?? []
  rows.push(item)
  nativeByRoute.set(item.routeId, rows)
}

const requiredNativeIntegrations = new Set([
  'GET /v1/modules/:moduleId/records/sync',
  'GET /v1/modules/:moduleId/records/:collection/:recordId/revisions',
  'GET /v1/modules/:moduleId/records/:collection/:recordId/revisions/:revision',
  'GET /v1/modules/:moduleId/records/:collection/:recordId/media',
  'POST /v1/modules/:moduleId/records/:collection/:recordId/media',
  'DELETE /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId',
  'PATCH /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId',
  'PUT /v1/modules/:moduleId/records/:collection/:recordId/media/order',
])

const inventoryRoutes = atlas.routes.map(route => {
  const nativeSources = nativeByRoute.get(route.id) ?? []
  const deployment = productionAvailability(route.id)
  return {
    id: route.id,
    domain: route.domain,
    method: route.method,
    path: route.effectiveRoute,
    source: route.source,
    owner: ownerFor(route),
    authentication: route.authentication,
    authorization: route.authorization.visibility,
    deployment: {
      main: 'REGISTERED_IN_MAIN',
      qa: 'NOT_VERIFIED',
      production: deployment,
    },
    consumers: {
      native: nativeSources.map(item => ({source: item.source, evidence: item.evidence, state: item.state})),
      web: route.callers.clients,
      internal: route.callers.server,
    },
    exerciseStatus: exerciseStatus(route, nativeSources),
    testEvidence: route.callers.tests,
  }
})

const inventory = {
  schemaVersion: 1,
  mission: 'GREENFIELD-FUNCTIONAL-PARITY-01',
  provenance: {
    atlasCapturedAt: atlas.metadata.capturedAt,
    greenfieldMainSha: mainBaselineSha,
    nativeSha,
    nativeRoot,
    productionSha,
    productionRoot,
    productionIdentityEvidence: 'deployed /version.json and API/worker image labels were independently verified against this checkout',
  },
  counts: {
    applicationRoutes: inventoryRoutes.length,
    frameworkRoutes: atlas.reconciliation.frameworkRoutes.length,
    frameworkHeadRoutes: atlas.reconciliation.frameworkRoutes.filter(route => route.method === 'HEAD').length,
    frameworkCorsRoutes: atlas.reconciliation.frameworkRoutes.filter(route => route.method === 'OPTIONS').length,
    runtimeMethodRoutes: atlas.reconciliation.runtimeMethodRoutes,
    publicRoutes: atlas.routes.filter(route => route.authorization.visibility === 'PUBLIC').length,
    authenticatedRoutes: atlas.routes.filter(route => route.authorization.visibility === 'AUTHENTICATED').length,
    adminRoutes: atlas.routes.filter(route => route.authorization.visibility === 'ADMIN').length,
    serviceToServiceRoutes: atlas.routes.filter(route => route.authorization.visibility === 'SERVICE/WORKER').length,
    internalRoutes: atlas.routes.filter(route => route.authorization.visibility.startsWith('INTERNAL')).length,
    productionApplicationRoutes: productionIds.size,
    nativePathReferences: native.pathReferenceCount,
    nativeMappedPathReferences: native.pathReferenceCount - native.unmatched.length,
    nativeMappedApplicationMethods: nativeByRoute.size,
    nativeUnmatchedPathReferences: native.unmatched.length,
    workerJobInterfaces: workerMap.jobs.length,
  },
  routes: inventoryRoutes,
  frameworkRoutes: atlas.reconciliation.frameworkRoutes,
  nonHttpInterfaces: workerMap.jobs.map(job => ({kind: 'worker-job', id: job.jobType, source: job.source, handler: job.handler})),
  nativeUnmatched: native.unmatched,
}

const matrixHeader = [
  'domain', 'method', 'path', 'source', 'auth', 'client', 'client_source', 'QA availability',
  'production availability', 'exercise status', 'test evidence', 'root-cause classification', 'fixed PR',
]
const matrixRows = atlas.routes.map(route => {
  const nativeSources = nativeByRoute.get(route.id) ?? []
  const clients = []
  const clientSources = []
  if (nativeSources.length) {
    clients.push('Modula Native')
    clientSources.push(...nativeSources.map(item => item.source))
  }
  if (route.callers.clients.length) {
    clients.push('GreenField web')
    clientSources.push(...route.callers.clients)
  }
  if (route.callers.server.length) {
    clients.push('Internal service')
    clientSources.push(...route.callers.server)
  }
  const status = exerciseStatus(route, nativeSources)
  return [
    route.domain,
    route.method,
    route.effectiveRoute,
    route.source ? `${route.source.file}:${route.source.line}` : '',
    `${route.authorization.visibility}; ${route.authentication}`,
    clients.length ? [...new Set(clients)].join('; ') : 'No observed consumer',
    [...new Set(clientSources)].join('; '),
    'NOT_VERIFIED',
    productionAvailability(route.id),
    status,
    route.callers.tests.join('; '),
    rootCauseClassification(route, nativeSources, status),
    fixedPullRequests(route.id),
  ]
})
const usageMatrix = `${matrixHeader.map(csvCell).join(',')}\n${matrixRows.map(row => row.map(csvCell).join(',')).join('\n')}\n`

const gaps = {
  schemaVersion: 1,
  mission: 'GREENFIELD-FUNCTIONAL-PARITY-01',
  provenance: {greenfieldMainSha: mainBaselineSha, nativeSha, productionSha},
  gaps: [
    {
      feature: 'Native Activity follow requests',
      severity: 'P1',
      endpoint: 'GET /v1/connections/requests',
      owningRepository: 'modula-mod/modula-native',
      reproduction: 'Open Activity > Requests while authenticated; Native calls /v1/connections/requests, which resolves as connector id "requests" rather than the follow-request collection.',
      expectedResult: 'Native calls GET /v1/profiles/me/follow-requests and decodes the cursor page.',
      observedResult: 'The active Native request does not map to the follow-request API contract.',
      rootCause: 'ActivityRepository uses an outdated path; the canonical secured route already exists and its response is compatible with ActivityPayloadDecoder.',
      fixStatus: 'NATIVE_HANDOFF_REQUIRED',
      linkedTest: 'services/greenfield-api/tests/api-fix-01.follow-privacy.test.ts',
      linkedPR: '',
    },
    {
      feature: 'Nodus downloadable model release discovery',
      severity: 'P1',
      endpoint: 'GET /v1/intelligence/nodus/releases/latest',
      owningRepository: 'modula-mod/modula-latest',
      reproduction: 'Open the Nodus model settings card without an Info.plist/developer override; the default GreenField endpoint returns HTTP 404 in main and production.',
      expectedResult: 'A governed descriptor names immutable, digest-pinned model files for an approved Nodus release, or the client explicitly reports that no release channel is configured.',
      observedResult: 'Native constructs and fetches the default endpoint, but GreenField registers no such route and owns no approved model artifact.',
      rootCause: 'The Native download contract was added without a corresponding governed GreenField release source; adding a fabricated descriptor would weaken artifact trust.',
      fixStatus: 'BLOCKED_APPROVED_MODEL_ARTIFACT_AND_RELEASE_POLICY',
      linkedTest: 'modula-native/ios/ModulaTests/NodusReleaseTests.swift',
      linkedPR: '',
    },
    {
      feature: 'Story/AR attachment publishing',
      severity: 'P0',
      endpoint: 'POST /v1/attachments/uploads; PUT /v1/attachments/uploads/:uploadId/content; POST /v1/stories',
      owningRepository: 'modula-mod/modula-native',
      reproduction: 'Publish an exported AR-composited image from StoryCamera; Native still base64-inlines the image in POST /v1/stories instead of using the attachment workflow.',
      expectedResult: 'Upload bytes through the attachment session, then create the story with attachmentId and an idempotency key.',
      observedResult: 'GreenField supports attachment-backed stories, but the pinned Native client does not consume that contract.',
      rootCause: 'Backend support landed after the current Native story request implementation.',
      fixStatus: 'BACKEND_FIXED_NATIVE_HANDOFF_REQUIRED',
      linkedTest: 'services/greenfield-api/tests/story-attachment.integration.test.ts',
      linkedPR: 'https://github.com/modula-mod/modula-latest/pull/142',
    },
    {
      feature: 'Generic module sync, revision browser, and record media bindings',
      severity: 'P0',
      endpoint: 'GET /v1/modules/:moduleId/records/sync; /revisions; /media',
      owningRepository: 'modula-mod/modula-native',
      reproduction: 'Inspect the closed ModuleBackendRequest vocabulary and ProductUI runtime; they call record CRUD/restore/purge but never call sync, revision, or record-media binding routes.',
      expectedResult: 'Offline replay consumes revision cursors/conflicts, revision UI loads history, and attachments use the generic record media binding contract.',
      observedResult: 'The backend contracts and PostgreSQL tests exist, but the current Native runtime has no caller for these required integrations.',
      rootCause: 'Native bridge vocabulary stops at record CRUD and stores attachment-like metadata as a record rather than binding uploaded attachment bytes.',
      fixStatus: 'NATIVE_HANDOFF_REQUIRED',
      linkedTest: 'services/greenfield-api/tests/module-platform-02.records.test.ts; services/greenfield-api/tests/module-platform-02b.media-sharing.test.ts',
      linkedPR: '',
    },
    {
      feature: 'Developer Studio server draft persistence',
      severity: 'P0',
      endpoint: 'MISSING_EXISTING_DEVELOPER_DRAFT_CONTRACT',
      owningRepository: 'modula-mod/modula-latest',
      reproduction: 'Save a Module Generator project on one device and attempt to reopen it on another; DeveloperModuleStore writes only the local application-support directory and GreenField has no draft resource.',
      expectedResult: 'Authenticated creators can create, update, reopen, and preview account-scoped drafts with optimistic concurrency.',
      observedResult: 'Draft save/reopen is device-local only.',
      rootCause: 'The Developer domain has publisher/product/build/release rows but no account-scoped project draft persistence contract.',
      fixStatus: 'BACKEND_DEFECT_CONFIRMED',
      linkedTest: '',
      linkedPR: '',
    },
    {
      feature: 'Developer release to signed registry promotion',
      severity: 'P0',
      endpoint: 'POST /v1/developer/products/:productId/releases',
      owningRepository: 'modula-mod/modula-latest',
      reproduction: 'Create a successful verified build and then a Developer release; the row remains CANDIDATE with module_release_id null and cannot enter the registry installation path.',
      expectedResult: 'The official QA/private publication flow verifies the signed artifact, creates one immutable registry release, links module_release_id, and makes it installable by an authorized second account.',
      observedResult: 'Developer release persistence and registry publication are disconnected lifecycles.',
      rootCause: 'DeveloperService.createRelease records metadata only; no governed promotion service joins build provenance, publisher signing, registry review, and publication.',
      fixStatus: 'BACKEND_DEFECT_CONFIRMED',
      linkedTest: 'services/greenfield-api/tests/greenfield-backend-v1.developer-domain.test.ts; services/greenfield-api/tests/greenfield-mps-v1.publish.test.ts',
      linkedPR: '',
    },
    {
      feature: 'Production parity with accepted GreenField main',
      severity: 'P1',
      endpoint: `${atlas.routes.length - productionIds.size} registered main routes`,
      owningRepository: 'modula-mod/modula-latest',
      reproduction: `Compare accepted main ${mainBaselineSha} with deployed source/image ${productionSha}.`,
      expectedResult: 'A separately approved rollout advances migrations 076 through 079 and deploys retained API/worker images after backup and recovery rehearsal.',
      observedResult: `Production remains intentionally at migration 075 with ${productionIds.size} application routes; main has ${atlas.routes.length}.`,
      rootCause: 'Production deployment is explicitly outside this mission authority.',
      fixStatus: 'DEPLOYMENT_APPROVAL_REQUIRED',
      linkedTest: 'API Atlas source/runtime reconciliation and migration-validation CI',
      linkedPR: 'https://github.com/modula-mod/modula-latest/pull/142; https://github.com/modula-mod/modula-latest/pull/143',
    },
  ],
}

emit('api-inventory.json', json(inventory))
emit('api-usage-matrix.csv', usageMatrix)
emit('api-gaps.json', json(gaps))

console.log(JSON.stringify({
  mode: checkOnly ? 'check' : 'write',
  applicationRoutes: atlas.routes.length,
  productionApplicationRoutes: productionIds.size,
  nativePathReferences: native.pathReferenceCount,
  nativeMappedApplicationMethods: nativeByRoute.size,
  nativeUnmatched: native.unmatched,
  gaps: gaps.gaps.length,
}, null, 2))

function exerciseStatus(route, nativeSources) {
  if (route.authorization.adminRequired || route.effectiveRoute.startsWith('/v1/admin/')) return 'ADMIN_ONLY'
  if (requiredNativeIntegrations.has(route.id) && nativeSources.length === 0) return 'MISSING_CLIENT_INTEGRATION'
  if (nativeSources.some(source => source.state === 'DORMANT')) return 'INTENTIONALLY_DORMANT'
  if (nativeSources.length) return 'NOT_VERIFIED'
  if (/legacy|compatib/i.test(`${route.notes} ${route.source?.file ?? ''}`)) return 'LEGACY_COMPATIBILITY'
  return 'REGISTERED_NOT_EXERCISED'
}

function rootCauseClassification(route, nativeSources, status) {
  if (status === 'MISSING_CLIENT_INTEGRATION') return 'REQUIRED_NATIVE_CONSUMER_ABSENT'
  if (status === 'ADMIN_ONLY') return 'ADMIN_ONLY'
  if (status === 'LEGACY_COMPATIBILITY') return 'LEGACY_COMPATIBILITY'
  if (status === 'INTENTIONALLY_DORMANT') return 'NATIVE_CAPABILITY_DISABLED'
  if (nativeSources.length) return 'NATIVE_SOURCE_REFERENCE_ONLY'
  if (route.callers.clients.length) return 'WEB_SOURCE_REFERENCE_ONLY'
  if (route.callers.server.length) return 'INTERNAL_CONSUMER'
  return 'NO_OBSERVED_CONSUMER'
}

function productionAvailability(routeId) {
  if (!productionIds.has(routeId)) return 'NOT_AVAILABLE_IN_PRODUCTION'
  if (/^(?:GET|POST|PUT|PATCH|DELETE) \/(?:v1\/atproto|oauth\/atproto)/.test(routeId)) return 'FEATURE_DISABLED'
  if (routeId === 'POST /v1/admin/registry/sync') return 'FEATURE_DISABLED'
  return 'AVAILABLE_IN_PRODUCTION'
}

function fixedPullRequests(routeId) {
  if (/^POST \/v1\/stories$|^DELETE \/v1\/stories\/items\//.test(routeId)) return '#142'
  if (/^POST \/v1\/attachments\/uploads$|^PUT \/v1\/attachments\/uploads\//.test(routeId)) return '#142; #143'
  return ''
}

function ownerFor(route) {
  if (route.authorization.adminRequired || route.effectiveRoute.startsWith('/v1/admin/')) return 'GreenField administration'
  if (route.authorization.serviceAssertionRequired || route.effectiveRoute.startsWith('/v1/internal/')) return 'GreenField internal services'
  return 'GreenField API'
}

function extractNativeReferences(root, routes) {
  const sourceRoot = join(root, 'ios/Modula')
  const refs = []
  for (const file of walk(sourceRoot, path => extname(path) === '.swift')) {
    const text = readFileSync(file, 'utf8')
    for (const literal of swiftPathStrings(text)) {
      if (!literal.value.startsWith('/v1/')) continue
      const path = normalizeNativePath(literal.value)
      if (path === '/v1') continue
      refs.push({
        path,
        source: `${relative(root, file)}:${literal.line}`,
        methods: enclosingCallMethods(text, literal.start),
      })
    }
    if (file.endsWith('/Core/Intelligence/Nodus/NodusRelease.swift')) {
      const marker = 'static let defaultPath = "v1/intelligence/nodus/releases/latest"'
      const offset = text.indexOf(marker)
      if (offset >= 0) refs.push({path: '/v1/intelligence/nodus/releases/latest', source: `${relative(root, file)}:${lineAt(text, offset)}`, methods: ['GET']})
    }
  }

  const synthetic = [
    ['GET', '/v1/modules/:moduleId/records/:collection', 'ios/Modula/ModuleRuntime/Bridge/ModuleBackendRequest.swift:38'],
    ['POST', '/v1/modules/:moduleId/records/:collection', 'ios/Modula/ModuleRuntime/Bridge/ModuleBackendRequest.swift:69'],
    ['GET', '/v1/modules/:moduleId/records/:collection/:recordId', 'ios/Modula/ModuleRuntime/Bridge/ModuleBackendRequest.swift:66'],
    ['PATCH', '/v1/modules/:moduleId/records/:collection/:recordId', 'ios/Modula/ModuleRuntime/Bridge/ModuleBackendRequest.swift:72'],
    ['DELETE', '/v1/modules/:moduleId/records/:collection/:recordId', 'ios/Modula/ModuleRuntime/Bridge/ModuleBackendRequest.swift:76'],
    ['POST', '/v1/modules/:moduleId/records/:collection/:recordId/restore', 'ios/Modula/ModuleRuntime/ProductUIRuntime.swift:417'],
    ['DELETE', '/v1/modules/:moduleId/records/:collection/:recordId/permanent', 'ios/Modula/ModuleRuntime/ProductUIRuntime.swift:417'],
  ].map(([method, path, source]) => ({method, path, source, evidence: 'constructed-closed-vocabulary', state: 'ACTIVE'}))

  const routeById = new Map(routes.map(route => [route.id, route]))
  const mapped = [...synthetic]
  const unmatched = []
  const grouped = new Map()
  for (const ref of refs) {
    const row = grouped.get(ref.path) ?? {path: ref.path, refs: [], methods: new Set()}
    row.refs.push(ref.source)
    for (const method of ref.methods) row.methods.add(method)
    grouped.set(ref.path, row)
  }
  for (const row of grouped.values()) {
    const explicitIds = explicitNativeRouteIds[row.path]
    const candidates = explicitIds
      ? explicitIds.map(id => routeById.get(id)).filter(Boolean)
      : bestRouteCandidates(row.path, routes)
    const methods = new Set([...row.methods, ...(nativeMethodOverrides[row.path] ?? [])])
    if (methods.size === 0 && new Set(candidates.map(route => route.method)).size === 1) methods.add(candidates[0]?.method)
    const selected = candidates.filter(route => methods.has(route.method))
    if (selected.length === 0 || nativeMismatchPaths.has(row.path)) {
      unmatched.push({
        path: row.path,
        methods: [...methods].sort(),
        sources: [...new Set(row.refs)].sort(),
        classification: row.path === '/v1/reels/:param' ? 'INTENTIONALLY_DORMANT' : row.path === '/v1/connections/requests' ? 'CONTRACT_MISMATCH' : 'BACKEND_DEFECT',
      })
      continue
    }
    for (const route of selected) {
      for (const source of [...new Set(row.refs)]) mapped.push({
        method: route.method,
        path: route.effectiveRoute,
        routeId: route.id,
        source,
        evidence: row.methods.has(route.method) ? 'direct-call' : 'path-and-capability-contract',
        state: dormantNativeRouteIds.has(route.id) ? 'DORMANT' : 'ACTIVE',
      })
    }
  }
  for (const item of mapped) item.routeId ??= `${item.method} ${item.path}`
  return {
    pathReferenceCount: grouped.size,
    mapped,
    unmatched: unmatched.sort((a, b) => a.path.localeCompare(b.path)),
  }
}

function bestRouteCandidates(path, routes) {
  const candidates = routes.map(route => ({route, score: routeMatchScore(path, route.effectiveRoute)})).filter(item => item.score >= 0)
  const best = Math.max(-1, ...candidates.map(item => item.score))
  return candidates.filter(item => item.score === best).map(item => item.route)
}

function routeMatchScore(nativePath, routePath) {
  const nativeParts = nativePath.split('/')
  const routeParts = routePath.split('/')
  if (nativeParts.length !== routeParts.length) return -1
  let score = 0
  for (let index = 0; index < nativeParts.length; index += 1) {
    const nativePart = nativeParts[index]
    const routePart = routeParts[index]
    if (nativePart === routePart) score += 4
    else if (nativePart.startsWith(':') && routePart.startsWith(':')) score += 2
    else if (nativePart.startsWith(':') || routePart.startsWith(':')) score += 1
    else return -1
  }
  return score
}

function enclosingCallMethods(text, offset) {
  const pattern = /\b(authenticatedJSON|publicJSON|json|authenticated|send|moduleRequest|authenticatedUpload)\s*\(/g
  const start = Math.max(0, offset - 1_600)
  pattern.lastIndex = start
  let best = null
  for (let match = pattern.exec(text); match && match.index < offset; match = pattern.exec(text)) {
    const open = text.indexOf('(', match.index)
    const close = matchingParen(text, open)
    if (close > offset && (!best || match.index > best.index)) best = {index: match.index, name: match[1], open}
  }
  if (!best) return []
  if (best.name === 'authenticatedUpload') return ['PUT']
  return [...new Set([...text.slice(best.open, offset).matchAll(/"(GET|POST|PUT|PATCH|DELETE)"/g)].map(match => match[1]))]
}

function matchingParen(text, open) {
  let depth = 0
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '"') {
      index = skipSwiftString(text, index).end
      continue
    }
    if (text[index] === '(') depth += 1
    else if (text[index] === ')' && --depth === 0) return index
  }
  return -1
}

function swiftPathStrings(text) {
  const values = []
  let blockDepth = 0
  for (let index = 0; index < text.length; index += 1) {
    if (blockDepth > 0) {
      if (text.startsWith('/*', index)) { blockDepth += 1; index += 1 }
      else if (text.startsWith('*/', index)) { blockDepth -= 1; index += 1 }
      continue
    }
    if (text.startsWith('//', index)) {
      index = text.indexOf('\n', index)
      if (index < 0) break
      continue
    }
    if (text.startsWith('/*', index)) { blockDepth = 1; index += 1; continue }
    if (text[index] !== '"') continue
    const parsed = skipSwiftString(text, index)
    values.push({value: parsed.value, start: index, line: lineAt(text, index)})
    index = parsed.end
  }
  return values
}

function skipSwiftString(text, start) {
  let value = ''
  let index = start + 1
  for (; index < text.length; index += 1) {
    if (text[index] === '"') return {value, end: index}
    if (text[index] === '\\' && text[index + 1] === '(') {
      value += ':param'
      index = skipInterpolation(text, index + 2)
      continue
    }
    if (text[index] === '\\' && index + 1 < text.length) {
      value += text[index + 1]
      index += 1
      continue
    }
    value += text[index]
  }
  return {value, end: index}
}

function skipInterpolation(text, start) {
  let depth = 1
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === '"') { index = skipSwiftString(text, index).end; continue }
    if (text[index] === '(') depth += 1
    else if (text[index] === ')' && --depth === 0) return index
  }
  return text.length - 1
}

function normalizeNativePath(value) {
  const path = value.split('?')[0].replace(/\/$/, '')
  return path || '/'
}

function lineAt(text, offset) {
  return text.slice(0, offset).split('\n').length
}

function emit(name, content) {
  const target = join(outputDir, name)
  if (checkOnly) {
    if (!existsSync(target) || readFileSync(target, 'utf8') !== content) throw new Error(`${name} is stale; rerun api:functional-parity:reconcile`)
    return
  }
  writeFileSync(target, content)
}

function git(cwd, commandArgs) {
  return execFileSync('git', ['-C', cwd, ...commandArgs], {encoding: 'utf8'}).trim()
}

function requireFile(path, label) {
  if (!existsSync(path)) throw new Error(`${label} is missing at ${path}`)
}
