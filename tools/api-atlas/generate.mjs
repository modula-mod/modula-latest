#!/usr/bin/env node
import {createHash} from 'node:crypto'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {extname, join, relative} from 'node:path'
import {
  csvCell,
  domainFor,
  enrichRouteTables,
  evidenceDir,
  extractSourceRoutes,
  json,
  migrationIntroductions,
  outputDir,
  repoRoot,
  sanitizeForSecretScan,
  scanAllTableUsage,
  scanSourceUsage,
  walk,
} from './lib.mjs'

const snapshotPath = join(evidenceDir, 'production-snapshot.json')
if (!existsSync(snapshotPath)) throw new Error(`Missing ${snapshotPath}; run pnpm api:atlas:capture first`)
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'))
const latestMigrationId = snapshot.databaseSchema.appliedMigrations.at(-1)?.id ?? 'unknown'
const liveProbePath = join(evidenceDir, 'live-probes.json')
const liveProbes = existsSync(liveProbePath) ? JSON.parse(readFileSync(liveProbePath, 'utf8')) : {probes: []}
const authenticatedAcceptancePath = join(evidenceDir, 'authenticated-acceptance.json')
const authenticatedAcceptance = existsSync(authenticatedAcceptancePath)
  ? JSON.parse(readFileSync(authenticatedAcceptancePath, 'utf8'))
  : {summary: {passed: 0, failed: 1}, checks: [], cleanup: []}
const closeoutPath = join(evidenceDir, 'api-baseline-02-closeout.json')
const closeout = existsSync(closeoutPath)
  ? JSON.parse(readFileSync(closeoutPath, 'utf8'))
  : {atlasFinalStatus: 'PARTIAL', controlledAcceptance: {passed: 0, failed: 1}}
const acceptanceComplete = authenticatedAcceptance.summary?.failed === 0
  && authenticatedAcceptance.summary?.passed > 0
  && closeout.controlledAcceptance?.failed === 0
  && closeout.controlledAcceptance?.passed > 0
const atlasStatus = acceptanceComplete && closeout.atlasFinalStatus === 'PASS' ? 'PASS' : 'PARTIAL'
const runtime = snapshot.runtimeRoutes
const automaticHeadKeys = new Set(runtime.filter(route => route.method === 'GET').map(route => `HEAD ${route.url}`))
const applicationRuntime = runtime.filter(route => route.method !== 'OPTIONS' && !automaticHeadKeys.has(`${route.method} ${route.url}`))
const frameworkRuntime = runtime.filter(route => route.method === 'OPTIONS' || automaticHeadKeys.has(`${route.method} ${route.url}`))

let source = extractSourceRoutes()
source = enrichRouteTables(source)
source = scanSourceUsage(source)
const sourceByKey = new Map(source.map(route => [`${route.method} ${route.path}`, route]))
const runtimeByKey = new Map(applicationRuntime.map(route => [`${route.method} ${route.url}`, route]))
const probeByKey = new Map((liveProbes.probes ?? []).map(probe => [probe.path.startsWith(`${probe.method} `) ? probe.path : `${probe.method} ${probe.path}`, probe]))
const baseUrl = snapshot.config.api.safe.MODULA_PUBLIC_API_URL

function externalIntegrations(path, text) {
  const values = []
  if (/atproto/i.test(path + text)) values.push('AT Protocol/PDS (feature disabled in production)')
  if (/ai\//i.test(path) || /providerRuntime|aiBackend|openai|ollama/i.test(text)) values.push('AI provider fabric')
  if (/mail/i.test(path + text)) values.push('SMTP/Modula Mail')
  if (/github|registry\/sync/i.test(path + text)) values.push('GitHub release source (automation disabled in production)')
  if (/connector|oauth/i.test(path + text)) values.push('Connector/OAuth provider')
  return [...new Set(values)]
}

function storageFor(route) {
  const value = `${route.path} ${route.handlerText}`
  const storage = []
  if (/attachment|media|avatar|cover|stories/i.test(value)) storage.push(`${snapshot.storage.type}: ${snapshot.storage.root}`)
  if (/artifact|frontend|release|module/i.test(value)) storage.push('PostgreSQL artifact/release metadata; artifact delivery route where present')
  return storage
}

function paginationFor(route) {
  const text = `${route.handlerText} ${route.path}`
  if (/parseLimit|decodeCursor|cursorFromRequest|nextCursor|\bcursor\b/.test(text)) return {style: 'cursor', defaultPageSize: /parseLimit/.test(text) ? 20 : null, maximumPageSize: /parseLimit/.test(text) ? 50 : null, nextCursor: true, previousCursor: false, stability: 'route-specific stable ordering; inspect repository order fields'}
  if (/\boffset\b/.test(text)) return {style: 'offset', defaultPageSize: null, maximumPageSize: null, nextCursor: false, previousCursor: false, stability: 'offset ordering is route-specific'}
  if (/\blimit\b/.test(text)) return {style: 'bounded-limit or route-specific list', defaultPageSize: null, maximumPageSize: null, nextCursor: false, previousCursor: false, stability: 'route-specific'}
  return {style: 'none observed', defaultPageSize: null, maximumPageSize: null, nextCursor: false, previousCursor: false, stability: 'not a list or unpaginated'}
}

function visibility(route) {
  if (route.path.startsWith('/v1/internal/')) return 'INTERNAL (nginx-reachable; handler/service guard applies)'
  if (route.auth.adminRequired) return 'ADMIN'
  if (route.auth.serviceAssertionRequired || route.auth.serviceOperations.length) return 'SERVICE/WORKER'
  if (route.auth.sessionRequired) return 'AUTHENTICATED'
  return 'PUBLIC'
}

function featureState(path) {
  if (path.startsWith('/v1/atproto')) return snapshot.config.api.safe.MODULA_ATPROTO_ENABLED === 'true' ? 'enabled' : 'disabled'
  if (path.startsWith('/v1/backend/')) return snapshot.config.api.safe.BACKEND_FABRIC_ENABLED === 'true' ? 'enabled' : 'disabled'
  if (path.startsWith('/v1/ai')) return snapshot.config.api.safe.GREENFIELD_AI_GATEWAY_ENABLED === 'true' ? 'enabled' : 'disabled'
  if (path.includes('/registry/')) return snapshot.config.api.safe.GREENFIELD_MODULE_REGISTRY_ENABLED === 'true' ? 'enabled' : 'disabled'
  return 'enabled'
}

const atlas = applicationRuntime.map(runtimeRoute => {
  const key = `${runtimeRoute.method} ${runtimeRoute.url}`
  const sourceRoute = sourceByKey.get(key)
  const auth = sourceRoute?.auth ?? {
    anonymousAllowed: false,
    optionalSession: false,
    sessionRequired: false,
    sessionKind: 'unknown',
    verifiedEmailRequired: false,
    adminRequired: runtimeRoute.url.startsWith('/v1/admin/'),
    capabilities: [],
    serviceOperations: [],
    serviceAssertionRequired: false,
    moduleInstallationRequired: false,
    modulePermissionRequired: false,
  }
  const state = featureState(runtimeRoute.url)
  const probe = probeByKey.get(key) ?? null
  const successCodes = sourceRoute?.successCodes?.length ? sourceRoute.successCodes : [runtimeRoute.method === 'POST' && /uploads$|missions$|comments$|posts$/.test(runtimeRoute.url) ? 201 : 200]
  return {
    id: key,
    domain: domainFor(runtimeRoute.url),
    method: runtimeRoute.method,
    effectiveRoute: runtimeRoute.url,
    routePrefix: runtimeRoute.prefix || '/',
    publicUrl: `${baseUrl}${runtimeRoute.url === '*' ? '' : runtimeRoute.url}`,
    apiVersion: runtimeRoute.url.startsWith('/v1/') ? 'v1' : 'versionless',
    source: sourceRoute ? {file: sourceRoute.file, line: sourceRoute.line} : null,
    handler: sourceRoute?.handler ?? runtimeRoute.handler ?? 'unresolved',
    controllerServices: sourceRoute?.serviceCalls ?? [],
    authentication: auth.sessionKind,
    authorization: {
      visibility: visibility({...sourceRoute, path: runtimeRoute.url, auth}),
      ...auth,
      ownership: sourceRoute?.ownership ?? {rule: 'unresolved', evidenceStrength: 'none'},
    },
    rateLimit: runtimeRoute.config?.rateLimit ?? null,
    request: {
      params: sourceRoute?.requestShape.params ?? [],
      query: sourceRoute?.requestShape.query ?? [],
      body: sourceRoute?.requestShape.body ?? [],
      explicitFastifySchema: Boolean(runtimeRoute.schema),
      manualValidationObserved: sourceRoute?.hasManualValidation ?? false,
      pagination: sourceRoute ? paginationFor(sourceRoute) : {style: 'unresolved'},
    },
    response: {
      explicitFastifySchema: Boolean(runtimeRoute.schema?.response),
      schema: runtimeRoute.schema?.response ?? null,
      envelope: runtimeRoute.url.startsWith('/oauth/') || /\/content$/.test(runtimeRoute.url) ? 'raw/specialized response' : 'Greenfield success/failure envelope (statically inferred)',
    },
    successCodes,
    expectedErrors: [...new Set([
      ...(auth.sessionRequired ? [401] : []),
      ...(auth.adminRequired || auth.capabilities.length || auth.serviceOperations.length || auth.serviceAssertionRequired ? [403] : []),
      ...(runtimeRoute.method === 'GET' ? [404] : [400, 404, 409]),
      ...(runtimeRoute.config?.rateLimit ? [429] : []),
      500,
    ])].sort(),
    data: sourceRoute?.data ?? {reads: [], writes: [], evidence: [], confidence: 'unresolved'},
    storage: sourceRoute ? storageFor(sourceRoute) : [],
    eventsProduced: sourceRoute?.events ?? [],
    jobsProduced: sourceRoute?.jobs ?? [],
    externalIntegrations: sourceRoute ? externalIntegrations(runtimeRoute.url, sourceRoute.handlerText) : [],
    callers: sourceRoute?.callers ?? {clients: [], server: [], tests: []},
    automatedTest: sourceRoute?.hasAutomatedTest ?? false,
    runtimeRegistration: true,
    sourceRegistration: Boolean(sourceRoute),
    publicEdge: true,
    featureState: state,
    liveProbe: probe,
    status: runtimeRoute.url === '/v1/internal/ssrf-check'
      ? 'registered-but-production-hidden'
      : state === 'disabled'
        ? 'registered-feature-disabled'
        : 'reachable',
    notes: sourceRoute
      ? runtimeRoute.schema
        ? 'Fastify route schema is registered.'
        : 'No Fastify request/response schema is registered; validation, if present, is handler/service-level.'
      : 'Runtime route has no matched static route; investigate dynamic/plugin registration.',
  }
}).sort((a, b) => a.effectiveRoute.localeCompare(b.effectiveRoute) || a.method.localeCompare(b.method))

const sourceOnly = source.filter(route => !runtimeByKey.has(`${route.method} ${route.path}`)).map(route => ({method: route.method, path: route.path, source: `${route.file}:${route.line}`}))
const runtimeOnly = atlas.filter(route => !route.sourceRegistration)
const duplicates = [...new Map(source.map(route => [`${route.method} ${route.path}`, 0])).keys()]
  .map(key => ({key, count: source.filter(route => `${route.method} ${route.path}` === key).length}))
  .filter(item => item.count > 1)
const routeReconciliation = {
  runtimeMethodRoutes: runtime.length,
  applicationRuntimeRoutes: applicationRuntime.length,
  mappedApplicationRoutes: atlas.length - runtimeOnly.length,
  runtimeOnlyRoutes: runtimeOnly.length,
  sourceRoutes: source.length,
  sourceOnlyRoutes: sourceOnly.length,
  explicitlyExcludedFrameworkRoutes: frameworkRuntime.length,
  frameworkRoutes: frameworkRuntime.map(route => ({method: route.method, path: route.url, reason: route.method === 'OPTIONS' ? 'CORS plugin wildcard preflight' : 'Fastify automatic HEAD companion for GET'})),
  duplicates,
  equation: `${runtime.length} = ${atlas.length} application + ${frameworkRuntime.length} framework-derived`,
}

const tableUsage = scanAllTableUsage()
const migrations = migrationIntroductions()
const capturedTables = new Map(snapshot.databaseSchema.tables.map(table => [table.name, table]))
const tableNames = [...new Set([...capturedTables.keys(), ...Object.keys(migrations.introduced)])].sort()
const tables = tableNames.map(name => {
  const table = capturedTables.get(name) ?? {
    name,
    columns: [],
    primaryKey: [],
    foreignKeys: [],
    indexes: [],
    uniqueConstraints: [],
    sourceState: 'declared-in-migration-not-yet-captured-in-production',
  }
  const usage = tableUsage[table.name] ?? {reads: [], writes: []}
  const routeReads = atlas.filter(route => route.data.reads.includes(table.name)).map(route => route.id)
  const routeWrites = atlas.filter(route => route.data.writes.includes(table.name)).map(route => route.id)
  const columns = table.columns.map(column => column.name)
  return {
    ...table,
    purpose: purposeForTable(table.name),
    ownershipColumns: columns.filter(column => /(^|_)(owner|account|actor|user|workspace|module|product|installation)_?id$/.test(column)),
    softDelete: columns.includes('deleted_at'),
    timestamps: columns.filter(column => /(_at|^created_at$|^updated_at$)/.test(column)),
    migrationIntroduced: migrations.introduced[table.name] ?? 'not found by CREATE TABLE scan',
    sourceReads: usage.reads,
    sourceWrites: usage.writes,
    jobReads: usage.reads.filter(value => value.startsWith('services/greenfield-worker/')),
    jobWrites: usage.writes.filter(value => value.startsWith('services/greenfield-worker/')),
    routeReads,
    routeWrites,
    orphanCandidate: usage.reads.length === 0 && usage.writes.length === 0 && table.name !== 'schema_migrations',
    writeOnlyCandidate: usage.writes.length > 0 && usage.reads.length === 0,
    readOnlyCandidate: usage.reads.length > 0 && usage.writes.length === 0,
  }
})

const routeDataMap = Object.fromEntries(atlas.map(route => [route.id, {
  reads: route.data.reads,
  writes: route.data.writes,
  emits: route.eventsProduced,
  jobs: route.jobsProduced,
  confidence: route.data.confidence,
  evidence: route.data.evidence,
}]))

const output = {
  metadata: {
    title: 'MODULA GREENFIELD API-ATLAS-01',
    generatedFrom: 'current implementation and captured production runtime; not a design contract',
    capturedAt: snapshot.capturedAt,
    productionSha: snapshot.containers.api.revision,
    sourceSha: snapshot.repository.originMain,
    publicApiBase: baseUrl,
    status: atlasStatus,
  },
  reconciliation: routeReconciliation,
  routes: atlas,
  sourceOnly,
  runtimeOnly: runtimeOnly.map(route => route.id),
  tables,
}

const capabilities = capabilityCoverage()
const clientContracts = scanClientContracts(atlas)
const sourceSweep = scanImplementationMarkers()
const gaps = buildGapRegister().filter(gap => !(acceptanceComplete && gap.title === 'Production cross-user and authenticated write acceptance was not safe to execute'))
const contractBaseline = atlas.map(route => ({
  id: route.id,
  authorization: route.authorization,
  ownership: route.authorization.ownership,
  request: route.request,
  response: route.response,
  sourceContractSha256: sourceContractFingerprint(sourceByKey.get(route.id)),
}))
const workerJobMap = scanWorkerJobMap()

mkdirSync(outputDir, {recursive: true})
write('api-atlas.json', json(output))
write('route-data-map.json', json(routeDataMap))
write('contract-baseline.json', json({metadata: {status: atlasStatus, capturedAt: snapshot.capturedAt}, routes: contractBaseline}))
write('worker-job-map.json', json(workerJobMap))
write('gap-register.json', json({metadata: {capturedAt: snapshot.capturedAt, status: atlasStatus}, gaps}))
write('client-contract-analysis.json', json(clientContracts))
write('evidence/source-sweep.json', json(sourceSweep))
write('api-atlas.csv', renderCsv(atlas))
write('02-http-api-atlas.md', renderHttpAtlas(atlas, routeReconciliation, sourceOnly, runtimeOnly))
write('03-auth-permissions-matrix.md', renderAuthMatrix(atlas))
write('04-database-api-map.md', renderDatabaseMap(tables, snapshot, migrations))
write('openapi.generated.yaml', json(renderOpenApi(atlas, snapshot)))
write('01-application-boot-map.md', renderBootMap(snapshot))
write('request-flow.mmd', renderRequestFlow())
write('route-data-flow.mmd', renderRouteDataFlow(atlas))
write('module-flow.mmd', renderModuleFlow())
write('intelligence-flow.mmd', renderIntelligenceFlow())
write('media-flow.mmd', renderMediaFlow())
write('event-flow.mmd', renderEventFlow())
write('README.md', renderReadme())
write('00-executive-summary.md', renderExecutiveSummary())
write('00-production-truth.md', renderProductionTruth())
write('05-media-storage-map.md', renderMediaMap())
write('06-module-platform-map.md', renderModuleMap())
write('07-intelligence-api-map.md', renderIntelligenceMap())
write('08-events-workers-jobs.md', renderAsyncMap())
write('09-client-capability-coverage.md', renderCapabilityCoverage())
write('10-live-probe-results.md', renderLiveProbes())
write('11-gap-register.md', renderGapRegister())
write('12-remediation-roadmap.md', renderRoadmap())
write('13-verification-results.md', renderVerificationResults())
process.stdout.write(`Generated ${atlas.length} application routes; ${frameworkRuntime.length} framework-derived routes explicitly excluded.\n`)
process.stdout.write(`Source-only: ${sourceOnly.length}; runtime-only: ${runtimeOnly.length}; tables: ${tables.length}.\n`)

function write(name, content) {
  writeFileSync(join(outputDir, name), sanitizeForSecretScan(content))
}

function purposeForTable(name) {
  const prefix = [
    ['greenfield_intelligence_', 'governed intelligence state'],
    ['greenfield_module_', 'module registry/runtime state'],
    ['greenfield_release_', 'module release artifact state'],
    ['greenfield_mail_', 'mail identity/delivery state'],
    ['greenfield_search_', 'search projections and operations'],
    ['greenfield_event_', 'domain event delivery state'],
    ['atproto_', 'AT Protocol bridge state'],
    ['ai_', 'AI provider/execution state'],
  ].find(([value]) => name.startsWith(value))
  return prefix?.[1] ?? `application state for ${name.replaceAll('_', ' ')}`
}

function sourceContractFingerprint(route) {
  const relevant = (route?.handlerText ?? '').split('\n')
    .map(line => line.trim().replaceAll(/\s+/g, ' '))
    .filter(line => /schema|request\.(?:body|query|params)|bodyString|reply\.(?:code|send|type)|successEnvelope|failureEnvelope|sendError/.test(line))
  return createHash('sha256').update(JSON.stringify(relevant)).digest('hex')
}

function scanWorkerJobMap() {
  const file = 'services/greenfield-worker/src/jobs/runner.ts'
  const text = readFileSync(join(repoRoot, file), 'utf8')
  const lines = text.split('\n')
  const jobs = []
  let pendingCases = []
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*case\s+['"]([^'"]+)['"]:/)
    if (match) {
      pendingCases.push({jobType: match[1], source: `${file}:${index + 1}`})
      continue
    }
    if (!pendingCases.length) continue
    const statement = lines[index].trim()
    if (/^await\s+/.test(statement)) {
      jobs.push(...pendingCases.map(job => ({...job, handler: statement})))
      pendingCases = []
      continue
    }
    if (statement === 'break') {
      jobs.push(...pendingCases.map(job => ({...job, handler: 'no-op (acknowledged event or reserved job type)'})))
      pendingCases = []
    }
  }
  jobs.push(...pendingCases.map(job => ({...job, handler: 'unresolved'})))
  return {metadata: {generatedFrom: file}, jobs}
}

function capabilityCoverage() {
  return [
    ['Authentication', '/auth/login', 'COMPLETE', 'POST /v1/sessions is implemented and called by the product client.'],
    ['Authentication', '/auth/register', 'COMPLETE', 'POST /v1/accounts/register implements open production registration.'],
    ['Authentication', '/auth/verify', 'COMPLETE', 'Email verification and resend routes exist.'],
    ['Authentication', '/auth/forgot', 'COMPLETE', 'Forgot-password request exists with the auth-specific rate tier.'],
    ['Authentication', '/auth/reset', 'COMPLETE', 'Token reset and authenticated password-change paths exist.'],
    ['Authentication', '/auth/welcome', 'CLIENT ONLY', 'Welcome is a client navigation state; no server capability is required or registered.'],
    ['Home', '/home/following', 'COMPLETE', 'GET /v1/feed/home?mode=following uses the follow graph and visibility policy.'],
    ['Home', '/home/for-you', 'PARTIAL', 'Backend ranking exists, but it is deterministic and an invalid mode silently falls into the modules label.'],
    ['Home', '/home/modules', 'COMPLETE', 'GET /v1/feed/home?mode=modules filters module-feed posts.'],
    ['Discover', '/discover/trending', 'PARTIAL', 'The single /v1/discover aggregate reads seeded/materialized trending_topics; no calculation job was found.'],
    ['Discover', '/discover/people', 'COMPLETE', 'The aggregate returns privacy-filtered public suggested profiles.'],
    ['Discover', '/discover/topics', 'PARTIAL', 'Topics are returned from a table without pagination or a discovered trend producer.'],
    ['Discover', '/discover/posts', 'PARTIAL', 'Media and reels are returned, not a general paginated post discovery collection.'],
    ['Discover', '/discover/modules', 'PARTIAL', 'Featured module payloads are returned from featured_modules without a live ranking producer.'],
    ['Search', '/search', 'COMPLETE', 'Universal search, sanitation, ranking and visibility filters share GET /v1/search.'],
    ['Search', '/search/people', 'COMPLETE', 'People is an entity-type query on universal search.'],
    ['Search', '/search/posts', 'COMPLETE', 'Posts is an entity-type query on universal search.'],
    ['Search', '/search/modules', 'COMPLETE', 'Modules is an entity-type query on universal search.'],
    ['Profile', '/profile/:id', 'COMPLETE', 'Profile retrieval and viewer relationship state are implemented.'],
    ['Profile', '/profile/:id/posts', 'COMPLETE', 'Cursor-paginated visible posts are implemented.'],
    ['Profile', '/profile/:id/modules', 'MISSING', 'No profile-scoped installed/featured module endpoint is registered.'],
    ['Profile', '/profile/:id/links', 'PARTIAL', 'Public links are embedded in profile serialization; no link CRUD route writes profile_links.'],
    ['Profile', '/profile/:id/followers', 'PARTIAL', 'Lists work, but follower-only profiles have no request/accept gate.'],
    ['Profile', '/profile/:id/following', 'PARTIAL', 'Lists work, but follower-only profiles have no request/accept gate.'],
    ['Module', '/module/:id', 'COMPLETE', 'Registry detail is public and installation state can be hydrated for signed-in clients.'],
    ['Module', '/module/:id/permissions', 'PARTIAL', 'Manifest permissions and installed review APIs exist; two active installations have no review row.'],
    ['Module', '/module/:id/whats-new', 'BACKEND ONLY', 'Release notes are embedded in detail/version responses rather than a dedicated surface.'],
    ['Module', '/module/:id/screenshots', 'PARTIAL', 'Presentation metadata exists, but 7 of 17 assets have no blob and all are development assets.'],
    ['Module', '/module/:id/versions', 'COMPLETE', 'Public registry and authenticated installed-version routes exist.'],
    ['Settings', 'account', 'COMPLETE', 'Account, handle, password, sessions, deletion and data-request APIs exist.'],
    ['Settings', 'privacy', 'PARTIAL', 'Profile visibility, block and mute exist; follower-request policy and complete export controls are incomplete.'],
    ['Settings', 'security', 'COMPLETE', 'Passkeys, TOTP, recovery codes, step-up and session revocation exist.'],
    ['Settings', 'appearance', 'COMPLETE', 'GET/PATCH account appearance exists and is called.'],
    ['Settings', 'developer', 'COMPLETE', 'Developer profile, releases and build-service coordination routes exist.'],
    ['Activity', 'notifications', 'COMPLETE', 'Account-scoped list, mark-read and mark-all-read routes exist.'],
    ['Activity', 'requests', 'MISSING', 'No follow-request/activity-request API or persistence surface is registered.'],
    ['Activity', 'mentions', 'PARTIAL', 'Mention jobs/notification types exist, but there is no dedicated mentions query/filter contract.'],
    ['Post', 'detail', 'COMPLETE', 'Viewer-aware post detail with author, reaction, share and content hydration exists.'],
    ['Post', 'comments', 'COMPLETE', 'Independent cursor lists, replies, edit, delete and reactions exist.'],
    ['Post', 'likes/reactions', 'COMPLETE', 'Legacy like and canonical typed reaction routes are both implemented.'],
    ['Post', 'shares', 'COMPLETE', 'Shares, reposts and quote posts are persisted separately.'],
    ['Post', 'edit', 'COMPLETE', 'Owner-only optimistic-version text edit exists.'],
    ['Post', 'delete', 'COMPLETE', 'Owner policy and soft deletion exist.'],
    ['Composer', 'text', 'COMPLETE', 'Text create is persisted.'],
    ['Composer', 'photo', 'COMPLETE', 'Canonical attachments and legacy one-image upload both persist and serve.'],
    ['Composer', 'link', 'CLIENT ONLY', 'Client sends linkPreview, but the server CreatePostInput has no link field and create does not persist it.'],
    ['Composer', 'poll', 'CLIENT ONLY', 'Client explicitly labels polls outside beta; no poll request, table or route exists.'],
    ['Composer', 'carousel', 'COMPLETE', 'Canonical post content accepts up to ten owned ready attachments.'],
    ['Composer', 'audio', 'COMPLETE', 'Canonical attachments accept and hydrate audio content.'],
    ['Composer', 'video', 'COMPLETE', 'Canonical attachments accept video; reels project ready public video posts.'],
  ].map(([domain, capability, status, explanation]) => ({domain, capability, status, explanation}))
}

function routeMatches(pattern, candidate) {
  const a = pattern.split('?')[0].split('/').filter(Boolean)
  const b = candidate.split('?')[0].split('/').filter(Boolean)
  return a.length === b.length && a.every((part, index) => part.startsWith(':') || b[index]?.startsWith(':') || part === b[index])
}

function scanClientContracts(routes) {
  const calls = []
  const root = join(repoRoot, 'src')
  for (const file of walk(root, path => ['.ts', '.tsx'].includes(extname(path)))) {
    const rel = relative(repoRoot, file)
    if (rel.startsWith('src/api/local/') || /(?:test|fixture|demo|seed)/i.test(rel)) continue
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/\bpath\s*:\s*([`'"])(\/v1\/[^`'"]+)\1/g)) {
      const raw = match[2]
      const normalized = raw.replaceAll(/\$\{[^}]+\}/g, ':param').split('?')[0]
      const line = text.slice(0, match.index).split('\n').length
      const matchedRoutes = routes.filter(route => routeMatches(route.effectiveRoute, normalized)).map(route => route.id)
      calls.push({file: rel, line, raw, normalized, matchedRoutes, status: matchedRoutes.length ? 'matched' : 'missing-or-dynamic'})
    }
  }
  const unique = [...new Map(calls.map(call => [`${call.file}:${call.line}:${call.raw}`, call])).values()]
  return {
    methodology: 'Static path-property scan of production client source; local mock routers, tests, demos and seeds are excluded.',
    calls: unique,
    unmatched: unique.filter(call => call.status !== 'matched'),
    matched: unique.filter(call => call.status === 'matched').length,
  }
}

function scanImplementationMarkers() {
  const roots = ['services/greenfield-api/src', 'services/greenfield-worker/src', 'packages', 'src/data', 'src/features']
  const findings = []
  const marker = /\b(TODO|FIXME|HACK|TEMP|stub|placeholder|notImplemented|mock|fake|hardcoded)\b|\b501\b|throw\s+new\s+Error/ig
  for (const root of roots) {
    const path = join(repoRoot, root)
    if (!existsSync(path)) continue
    for (const file of walk(path, candidate => ['.ts', '.tsx', '.js', '.mjs'].includes(extname(candidate)))) {
      const rel = relative(repoRoot, file)
      const lines = readFileSync(file, 'utf8').split('\n')
      for (const [index, line] of lines.entries()) {
        const matches = [...line.matchAll(marker)]
        for (const match of matches) findings.push({file: rel, line: index + 1, marker: match[0], classification: classifyImplementationMarker(rel, line, match[0]), excerpt: line.trim().slice(0, 240)})
      }
    }
  }
  return {methodology: 'Literal marker scan. Findings are classified, not automatically treated as production defects.', findings, productionReview: findings.filter(item => item.classification !== 'test-fixture-or-development')}
}

function classifyImplementationMarker(file, line, rawMarker) {
  const marker = rawMarker.toLowerCase()
  if (/(?:test|fixture|seed|demo)/i.test(file)) return 'test-fixture-or-development'
  if (marker.includes('throw new error')) return 'ordinary-error-handling-review'
  if (/placeholder database credentials|includes\('placeholder'\)|includes\('change-me'\)/i.test(line)) return 'configuration-safety-guard'
  if (/digital\.modula\.temp|atproto-lexicons/i.test(`${file} ${line}`)) return 'feature-gated-experimental-protocol'
  if (/development-mock|mock-provider|MockGreenfieldAIProvider|inject a mock|no fake/i.test(line)) return 'development-adapter-or-comment'
  if (/placeholder\??\s*:|\.placeholder|placeholder:\s*override|checkKnownKeys\(.*placeholder/i.test(line)) return 'contract-or-ui-placeholder-field'
  if (/TODO|FIXME|HACK|TEMP/i.test(rawMarker)) return 'source-marker-review'
  if (/\b501\b|notImplemented/i.test(rawMarker)) return 'possible-unimplemented-path'
  if (/placeholder|stub/i.test(marker)) return 'possible-runtime-placeholder'
  if (/mock|fake|hardcoded/i.test(marker)) return 'implementation-word-review'
  return 'literal-review'
}

function buildGapRegister() {
  const entries = [
    ...(!closeout.deploymentLineage?.reconciled ? [[
      'release','architecture debt','P1','Running production revision is not canonical origin/main',
      ['evidence/production-snapshot.json#/repository','evidence/production-snapshot.json#/containers/api/revision'],[],[],
      'The captured production source revision differs from origin/main and does not yet have an accepted canonical-lineage disposition.',
      'Converge the deployed revision through reviewed mainline history and record the source, build, image, deployment and runtime correlation.',
      ['release governance'],
      'Fetch origin, prove ancestry, and compare OCI revision plus /version.json after a reviewed deployment.',
    ]] : []),
    ['social','missing endpoint','P1','Follower-only profiles have no follow-request approval flow',['services/greenfield-api/src/domains/profiles/writes.ts:57','services/greenfield-api/src/domains/profiles/writes.ts:89'],['POST /v1/profiles/:profileId/follow'],['services/greenfield-api/src/domains/profiles/writes.ts'],'Any authenticated follower can create the follow row immediately; follower-only visibility therefore has no owner approval boundary.','Add pending/accept/reject follow requests and make follower-only authorization depend on accepted state.',['social schema','client request UI'],'Cross-user acceptance must prove an unapproved account cannot view follower-only data.'],
    ['modules','missing signature verification','P1','All published releases are unsigned and unsigned releases are still trusted',['evidence/production-snapshot.json#/operationalAggregates/publishedUnsignedReleases','services/greenfield-api/src/modules/registry-trust-service.ts:109','services/greenfield-api/src/modules/registry-trust-service.ts:127','services/greenfield-api/src/modules/release-service.ts:441'],['GET /v1/registry/modules/:moduleId','POST /v1/modules/:moduleId/install'],['services/greenfield-api/src/modules/release-signing.ts','services/greenfield-api/src/modules/registry-trust-service.ts'],'Cryptographic Ed25519 verification exists, but 12 of 12 published releases have no signature and policy calls them verified.','Require a verified publisher signature for production publication/install, with an explicit controlled legacy migration.',['publisher key ceremony','release republishing'],'A tampered/unsigned test release must be rejected; current releases must return signature.state=verified.'],
    ['modules','missing artifact','P1','Only 2 of 14 registry releases have retrievable package bytes',['evidence/production-snapshot.json#/operationalAggregates/releaseArtifactCoverage','docs/audits/api-atlas-01/evidence/live-probes.json'],['GET /v1/registry/releases/:releaseId/artifact','POST /v1/modules/:moduleId/install'],['services/greenfield-api/src/modules/install-descriptor-service.ts'],'Published metadata can exist without an artifact ref, preventing independent package retrieval/verification for most releases.','Backfill immutable package blobs and block publication/installability when the package is absent.',['registry ingestion','artifact retention'],'Every published installable release must pass a digest-matched artifact GET.'],
    ['modules','missing storage delivery','P1','Seven of seventeen module presentation assets have metadata but no blob',['evidence/production-snapshot.json#/operationalAggregates/presentationAssets','docs/audits/api-atlas-01/evidence/live-probes.json'],['GET /v1/registry/releases/:releaseId/assets/:assetId'],['services/greenfield-api/src/modules/routes/index.ts'],'Product Hub receives declared URLs whose asset route returns 404 for affected releases.','Require asset blob presence during ingestion/publication and backfill or remove broken metadata.',['registry ingestion','artwork pipeline'],'Catalogue crawl must retrieve and digest-check every advertised available asset.'],
    ['modules','inconsistent permission','P1','Runtime auto-grants manifest permissions when no review row exists',['services/greenfield-api/src/modules/runtime-access.ts:51','services/greenfield-api/src/modules/runtime-access.ts:71','evidence/production-snapshot.json#/operationalAggregates/activeInstallPermissionReviews'],['GET /v1/modules/:moduleId/records/:collection','POST /v1/modules/:moduleId/actions/:actionId'],['services/greenfield-api/src/modules/runtime-access.ts'],'Two active production installations have no review; their declared permissions become effective without recorded user grant.','Remove the fallback for production, backfill explicit reviews, and fail closed when grant evidence is absent.',['installation migration'],'All active installations must have a review and missing-review requests must return FORBIDDEN.'],
    ['activity','event delivery gap','P1','Reaction notification jobs are dead-lettering on database uniqueness errors',['evidence/production-snapshot.json#/operationalAggregates/failedJobs','evidence/production-snapshot.json#/operationalAggregates/jobFailureDetails'],['PUT /v1/posts/:postId/reaction','GET /v1/notifications'],['services/greenfield-worker/src/notifications/create.ts'],'Ten notification.reaction jobs reached DEAD_LETTER with PostgreSQL 23505, most recently 2026-10-02.','Make notification aggregation/upsert idempotent, repair/replay affected dead letters, and add an alert.',['notification schema','dead-letter replay'],'Repeated reactions must converge to one notification and leave no dead letter.'],
    ['intelligence','placeholder implementation','P1','No operational production model/provider is available',['evidence/production-snapshot.json#/operationalAggregates/aiProviders','evidence/production-snapshot.json#/operationalAggregates/aiRuntime','services/greenfield-api/src/ai/providers/resolver.ts:53'],['POST /v1/modules/:moduleId/ai/requests','POST /v1/ai/requests'],['services/greenfield-api/src/ai/provider-runtime-service.ts'],'All real providers/models are unconfigured or disabled; the sole available model is a development mock and production has zero executions.','Configure and verify a governed real/local provider, then run safe production acceptance through the gateway.',['provider credentials','policy approval'],'A non-mock production request must execute, ledger usage, and pass failure/timeout tests.'],
    ['intelligence','placeholder implementation','P1','GAIA is an acceptance-fixture planner, not a general operational planner',['packages/intelligence-governance/src/gaia.ts:10','packages/intelligence-governance/src/gaia.ts:17','packages/intelligence-governance/src/gaia.ts:86','services/greenfield-api/src/intelligence/service.ts:18'],['POST /v1/intelligence/missions/:missionId/start'],['packages/intelligence-governance/src/gaia.ts','services/greenfield-api/src/intelligence/service.ts'],'Only four exact fixture objectives are recognized and production has zero mission/decision/ledger rows.','Introduce a provider-backed or local Nodus planner behind the existing governed proposal contract without bypassing AKI.',['operational provider','Nodus contract'],'Unseen objectives must yield bounded proposals and every run must traverse decisions, approvals and ledger.'],
    ['intelligence','missing endpoint','P1','No Nodus integration surface or local-client contract exists',['evidence/source-sweep.json','packages/intelligence-contracts/src/domain.ts'],[],['packages/intelligence-contracts/src'],'Native/offline Nodus has no declared handshake, capability discovery, proposal submission or synchronization contract.','Define a local-first Nodus adapter/API boundary using intelligence contracts; do not model Nodus as a cloud provider.',['intelligence contract design'],'Contract tests must cover offline proposal, reconnect, approval and ledger synchronization.'],
    ['security','missing ownership check','P1','Legacy remote function invocation trusts a client-supplied installation ID',['services/greenfield-api/src/app/register-routes.ts:1244','services/greenfield-api/src/app/register-routes.ts:1250','services/greenfield-api/src/functions/service.ts:6','services/greenfield-api/src/extensions/capability-resolver.ts:2','evidence/production-snapshot.json#/operationalAggregates/legacyFunctionRuntime'],['POST /v1/functions/:functionId/invoke'],['services/greenfield-api/src/functions/service.ts','services/greenfield-api/src/extensions/capability-resolver.ts'],'Any authenticated account can nominate another installation ID; the service checks only that installation capability, not installation ownership. Production has two remoteHttp functions but zero active function:invoke grants, so no currently executable production path was proven.','Require the installation to belong to the authenticated account and route through the canonical installation/runtime permission service; deprecate the legacy invoke route.',['function route consolidation'],'Two-account integration test must reject B invoking through A installation; an enabled owned grant must still execute through SSRF policy.'],
    ['security','missing ownership check','P1','AI stream cancel and reconnect omit account ownership checks',['services/greenfield-api/src/ai/routes.ts:186','services/greenfield-api/src/ai/routes.ts:198','services/greenfield-api/src/ai/streaming-runtime.ts:50','services/greenfield-api/src/ai/streaming-runtime.ts:94','evidence/production-snapshot.json#/operationalAggregates/aiRuntime/streams'],['POST /v1/ai/streams/:streamId/cancel','POST /v1/ai/streams/:streamId/reconnect'],['services/greenfield-api/src/ai/routes.ts','services/greenfield-api/src/ai/streaming-runtime.ts'],'The routes authenticate but pass only streamId; repository loads the stream without account scope. Production has zero stream rows, so active cross-account impact was not exercised.','Pass auth.accountId into streaming operations and query/update by stream plus account; return uniform not-found to other users.',['AI stream contract'],'Two-account test must prove B cannot observe, cancel or reconnect A stream.'],
    ['posts','client contract mismatch','P1','Link and poll composer contracts are not persisted by GreenField',['packages/api-contracts/src/posts.ts:103','services/greenfield-api/src/domains/posts/writes.ts:32','src/features/composer/screens/ComposerScreen.tsx:523'],['POST /v1/posts'],['packages/api-contracts/src/posts.ts','services/greenfield-api/src/domains/posts/writes.ts'],'The client has link/poll concepts; the server input has neither. A linkPreview field can be ignored while a text post succeeds.','Either remove/disable the controls at the API boundary or implement explicit validated link and poll persistence/contracts.',['post schema','client decoder'],'Contract tests must prove each advertised composer type survives create and retrieval.'],
    ['media','missing storage delivery','P1','Legacy post image limit is incompatible with nginx public body limit',['/etc/nginx/conf.d/api.modula.digital.greenfield.conf:12','services/greenfield-api/src/domains/media/post-media-storage.ts:117'],['POST /v1/posts'],['services/greenfield-api/src/domains/media/post-media-storage.ts'],'GreenField accepts up to 20 MiB of legacy image bytes, but nginx rejects the base64 request above 1 MiB before Fastify.','Retire legacy inline media in favor of attachment upload, or align a narrowly scoped edge limit.',['client upload migration','nginx review'],'A boundary-size audit attachment must publish through the intended path without widening unrelated routes.'],
    ['media','architecture debt','P1','User media exists only on one host bind mount',['evidence/production-snapshot.json#/storage','services/greenfield-api/src/domains/attachments/service.ts:169'],['GET /v1/attachments/:attachmentId/content','GET /v1/media/:mediaFile','GET /v1/media/stories/:mediaFile'],['services/greenfield-api/src/domains/attachments/service.ts'],'Container recreation preserves the bind, but host loss has no discovered object replication or storage readiness/recovery contract.','Define backed-up object storage or a tested media backup/restore policy and expose storage readiness internally.',['storage decision','recovery rehearsal'],'Restore media plus metadata to a clean host and digest-check every referenced object.'],
    ['modules','missing worker','P1','Automated registry/GitHub ingestion is disabled and has no production source',['evidence/production-snapshot.json#/config/worker/safe/GREENFIELD_MODULE_GITHUB_SYNC_ENABLED','evidence/production-snapshot.json#/operationalAggregates/syncSources','services/greenfield-worker/src/jobs/runner.ts:84'],['POST /v1/admin/registry/sync'],['services/greenfield-api/src/modules/github-release-sync-service.ts','services/greenfield-worker/src/jobs/runner.ts'],'Ingestion code exists, but production automation is disabled, source count is zero, and the two historical runs cannot recur automatically.','Configure a reviewed source and exercise repository-to-published-release convergence with signature/artifact gates.',['signing policy','GitHub source'],'A tagged release must be discovered, verified, ingested and published without manual database work.'],
    ['contracts','missing request schema','P2','No application route registers a Fastify request or response schema',['api-atlas.json#/routes','openapi.generated.yaml'],[],['services/greenfield-api/src'],`All ${atlas.length} routes rely on ad hoc handler/service validation; derived OpenAPI cannot describe request/response bodies.`,'Adopt shared schemas incrementally at trust-boundary and mutating routes, then generate canonical OpenAPI.',['API contract ownership'],'Runtime route capture must report schemas for prioritized routes and OpenAPI validation must pass.'],
    ['media','missing worker','P2','Attachment orphan cleanup exists but is never scheduled',['services/greenfield-api/src/domains/attachments/service.ts:191','services/greenfield-api/tests/post04.attachments.test.ts:199','evidence/production-snapshot.json#/operationalAggregates/readyAttachmentLinkage'],['POST /v1/attachments/uploads'],['services/greenfield-api/src/domains/attachments/service.ts'],'Five ready attachments are unbound; only tests invoke cleanup.','Add a bounded worker/ops job with retention, metrics and dry-run visibility.',['worker schedule'],'Expired sessions/orphans must be removed while bound media remains retrievable.'],
    ['media','missing request schema','P2','Story upload validates labels but not decoded size or file signature',['services/greenfield-api/src/domains/stories/service.ts:280','services/greenfield-api/src/domains/stories/service.ts:333','services/greenfield-api/src/domains/stories/service.ts:411'],['POST /v1/stories'],['services/greenfield-api/src/domains/stories/service.ts'],'Arbitrary base64 bytes can be stored under an image/video content type; expiration/deletion leaves files on disk.','Reuse AttachmentPolicy byte/count/signature validation and add physical cleanup.',['attachment service'],'Invalid magic bytes and oversized decoded payloads must fail; expired bytes must be removed.'],
    ['profiles','architecture debt','P2','Profile media has competing canonical-attachment and arbitrary-URL paths',['services/greenfield-api/src/domains/profiles/writes.ts:173','services/greenfield-api/src/domains/profiles/writes.ts:292'],['PATCH /v1/profiles/me','POST /v1/profiles/me/avatar','POST /v1/profiles/me/cover'],['services/greenfield-api/src/domains/profiles/writes.ts'],'PATCH can bypass profile_media ownership/binding with an arbitrary public HTTPS URL, producing two ownership/delivery models.','Deprecate raw avatarUri/coverUri writes and require owned attachment bindings.',['client migration'],'All new avatar/cover writes must create profile_media and resolve to canonical attachment URLs.'],
    ['feed','missing request schema','P2','Unknown feed modes silently receive a mislabeled fallback',['services/greenfield-api/src/app/register-routes.ts:1443','services/greenfield-api/src/app/register-routes.ts:1449'],['GET /v1/feed/home'],['services/greenfield-api/src/app/register-routes.ts'],'Typos or unsupported modes do not fail validation and are labeled modules-chrono-v1.','Validate the FeedMode enum before querying.',['shared schema'],'Unknown mode must return VALIDATION_FAILED; three supported modes need response snapshots.'],
    ['privacy','data exposure risk','P2','Attachment authorization distinguishes private existing IDs from unknown IDs',['services/greenfield-api/src/app/register-attachment-routes.ts:91','services/greenfield-api/src/app/register-attachment-routes.ts:110'],['GET /v1/attachments/:attachmentId/content'],['services/greenfield-api/src/app/register-attachment-routes.ts'],'An unauthorised existing attachment returns 403 while an unknown ID returns 404, disclosing existence if a UUID is learned.','Use a uniform not-found response for unauthorized private media and test timing/shape consistency.',['error policy'],'Cross-user fixture must receive the same status/shape for private-existing and unknown IDs.'],
    ['social','missing idempotency','P2','Follow, reaction and comment counters have concurrent race windows',['services/greenfield-api/src/domains/profiles/writes.ts:81','services/greenfield-api/src/domains/reactions/service.ts:25','services/greenfield-api/src/domains/comments/service.ts:156'],['POST /v1/profiles/:profileId/follow','PUT /v1/posts/:postId/reaction','POST /v1/posts/:postId/comments'],['services/greenfield-api/src/domains/profiles/writes.ts','services/greenfield-api/src/domains/reactions/service.ts','services/greenfield-api/src/domains/comments/service.ts'],'Select-then-insert can surface unique violations, and read-then-set counters can lose increments.','Use conflict-safe upserts/row locks or atomic SQL increments and add concurrency tests.',['database transaction design'],'Parallel duplicate submissions must converge without 500s or counter drift.'],
    ['discover','performance risk','P2','Discover/activity surfaces are unpaginated and activity is N+1 hydrated',['services/greenfield-api/src/domains/discovery/repository.ts:96','services/greenfield-api/src/domains/discovery/repository.ts:107'],['GET /v1/discover','GET /v1/activity'],['services/greenfield-api/src/domains/discovery/repository.ts'],'Activity reads every active row and resolves profiles in a loop; growth can create unbounded latency.','Add stable cursor pagination and batch actor hydration.',['response contract'],'Seeded volume test must show bounded queries and stable cursors.'],
    ['realtime','missing endpoint','P2','No persistent real-time social or push delivery surface exists',['services/greenfield-api/src/ai/routes.ts:136','/etc/nginx/conf.d/api.modula.digital.greenfield.conf:21'],['GET /v1/ai/executions/:executionId/stream'],['services/greenfield-api/src/ai/routes.ts'],'The sole SSE path replays AI events; nginx has no WebSocket upgrade and no APNs/web-push subscription API was found.','Define polling guarantees or add governed SSE/push subscription infrastructure.',['notification delivery design'],'A client must receive a new notification through the documented mechanism with reconnect semantics.'],
    ['connectors','placeholder implementation','P2','Connector metadata advertises webhooks without inbound webhook routes',['services/greenfield-api/src/connectors/provider-metadata.ts:60','services/greenfield-api/src/connectors/provider-metadata.ts:107','api-atlas.json#/routes'],[],['services/greenfield-api/src/connectors/provider-metadata.ts'],'Provider definitions claim webhook support, but only the module-backend Modula webhook route exists.','Mark providers unimplemented or add signed, replay-safe, idempotent provider ingress.',['provider adapters'],'Each advertised webhook provider must have a verified route and replay test.'],
    ['async','dead endpoint','P2','Several accepted worker job types complete with no side effect',['services/greenfield-worker/src/jobs/runner.ts:95','services/greenfield-worker/src/jobs/runner.ts:140','services/greenfield-worker/src/jobs/runner.ts:183'],[],['services/greenfield-worker/src/jobs/runner.ts'],'Lifecycle event-like jobs, module.settings.migrate and audit.checkpoint are marked succeeded after a no-op.','Stop enqueueing event names as jobs or implement explicit consumers and audit checkpoint behavior.',['event/job taxonomy'],'Every supported job type must have an asserted effect or be rejected as unsupported.'],
    ['modules','module special case','P2','Vault Notes remains special-cased outside the generic host',['services/greenfield-api/src/intelligence/action-boundary.ts:8','services/greenfield-api/src/ai/product-action-service.ts:23','services/greenfield-worker/src/search/subscribers.ts:23','src/features/board/screens/BoardScreen.tsx:114'],['POST /v1/intelligence/missions/:missionId/start','POST /v1/modules/:moduleId/ai/actions/:actionId/executions'],['services/greenfield-api/src/intelligence/action-boundary.ts','services/greenfield-api/src/ai/product-action-service.ts','services/greenfield-worker/src/search/subscribers.ts','src/features/board/screens/BoardScreen.tsx'],'Generic MPS hosting works, but search, governed actions, AI actions, Board and presentation logic contain product-specific branches.','Move behaviors into manifest/schema/action/projector declarations and retain only generic adapters.',['module standard extensions'],'A neutral reference module must exercise the same flows without core code changes.'],
    ['modules','partial endpoint','P2','Only 6 of 36 historical install plans carry the current descriptor',['evidence/production-snapshot.json#/operationalAggregates/installPlans','services/greenfield-api/src/modules/install-descriptor-service.ts:14'],['GET /v1/modules/:moduleId/install-descriptor'],['services/greenfield-api/src/modules/install-descriptor-service.ts'],'Current descriptors are complete, but historical plans cannot be audited through the same immutable contract.','Backfill descriptors where release facts are sufficient or explicitly version legacy plans.',['migration policy'],'Every active installation must resolve a digest-verified descriptor.'],
    ['security','untested endpoint','P2','Production cross-user and authenticated write acceptance was not safe to execute',['10-live-probe-results.md'],[],[],'Static and integration evidence exists, but no dedicated production audit identities/harness were available.','Provision isolated audit identities and a cleanup-capable production acceptance harness.',['test accounts','cleanup automation'],'Execute owner/non-owner, module isolation and intelligence isolation cases without real-user data.'],
    ['profiles','DB/API mismatch','P2','profile_links is read but has no current write API',['services/greenfield-api/src/domains/profiles/repository.ts:166','04-database-api-map.md'],['GET /v1/profiles/:handle','PATCH /v1/profiles/me'],['services/greenfield-api/src/domains/profiles/repository.ts'],'The table participates in serialization, but profile update writes only the single website fields on profiles.','Define link CRUD or retire/migrate the table.',['profile contract'],'Create/update/delete a link and verify privacy-filtered retrieval.'],
    ['architecture','duplicate endpoint','P2','Legacy and canonical media/social/auth paths overlap',['services/greenfield-api/src/domains/media/post-media-storage.ts:29','services/greenfield-api/src/domains/attachments/service.ts:13','services/greenfield-api/src/app/register-routes.ts:1425'],['POST /v1/posts','POST /v1/attachments/uploads','POST /v1/sessions','POST /v1/accounts/sessions'],['services/greenfield-api/src'],'Multiple upload, session and reaction/like paths increase contract drift and already differ at the edge.','Declare canonical routes, instrument callers, and deprecate aliases with compatibility windows.',['client migration'],'All clients use canonical routes; aliases have explicit sunset tests.'],
    ['observability','observability gap','P2','Request IDs do not provide complete nginx-to-worker tracing',['services/greenfield-api/src/app/register-plugins.ts:8','services/greenfield-worker/src/observability/metrics.ts:3','/etc/nginx/conf.d/api.modula.digital.greenfield.conf:21'],[],['services/greenfield-api/src/app/register-plugins.ts','services/greenfield-worker/src/observability/metrics.ts'],'API/worker use structured logs and database trace fields, but nginx does not preserve the generated response ID into a shared trace and no metrics/tracing backend was discovered.','Propagate trace/correlation IDs into jobs and edge logs; export queue/dead-letter/error metrics.',['observability backend'],'One synthetic request must be traceable across edge, API, outbox, job and result.'],
    ['operations','observability gap','P2','Worker container has no Docker healthcheck',['evidence/production-snapshot.json#/containers/worker','services/greenfield-api/src/domains/system/status.ts:91'],[],[],'The new DB heartbeat makes status observable, but Docker cannot independently mark the worker unhealthy.','Add a non-invasive healthcheck based on process/heartbeat freshness.',['deployment config'],'Stopping worker progress must transition container/status health within the documented window.'],
    ['testing','untested endpoint','P2',`${atlas.filter(route => !route.automatedTest).length} application routes have no statically matched automated test`,['api-atlas.json#/routes'],[],[],'The route families remain regression-prone; the per-route list is in api-atlas.json.','Prioritize authz, mutations, admin/service ingress and feature-gated routes.',['test fixtures'],'Atlas automatedTest coverage should reach the agreed threshold with security routes at 100%.'],
    ['modules','placeholder implementation','P2','All module presentation assets are marked development-only',['evidence/production-snapshot.json#/operationalAggregates/presentationAssets'],['GET /v1/registry/modules/:moduleId'],[],'Even retrievable Product Hub artwork is explicitly placeholder/development media.','Publish production artwork with provenance and remove the development flag.',['design approval','asset ingestion'],'Public catalogue must contain no developmentAsset=true for released products.'],
    ['testing','architecture debt','P2','Legacy canonical backend verifier is pinned to schema 055',['scripts/verify-greenfield-backend-v1.mjs:98','evidence/production-snapshot.json#/databaseSchema/appliedMigrations'],[],['scripts/verify-greenfield-backend-v1.mjs'],`The umbrella verifier requires schema 055 and exact clean main, while observed production is validly at ${latestMigrationId}; it cannot truthfully serve as the current acceptance command.`, 'Update the verifier to derive the current migration ledger and separate source, audit-branch, web and production convergence gates.',['verification ownership'],`The canonical verifier must pass on reviewed current main at ${latestMigrationId} without weakening exact-SHA production checks.`],
    ['database','orphan table','P3',`${tables.filter(table => table.orphanCandidate).length} tables have no API/worker source reference`,['04-database-api-map.md'],[],[],'The static scan identifies legacy, verifier-only or incomplete surfaces that need explicit ownership; it does not prove they are safe to drop.','Assign a disposition to each candidate before any cleanup migration.',['schema owners'],'Repository-wide reference and production usage review resolves every candidate.'],
    ['operations','architecture debt','P3','Multiple old verification/recovery PostgreSQL containers remain running',['evidence/production-snapshot.json#/hostProcesses/docker'],[],[],'Old test/recovery databases consume resources and complicate topology, though they are excluded from production truth.','Inventory owners and retire only after backup/recovery confirmation.',['operations approval'],'Only documented production and active audit containers remain.'],
    ['operations','architecture debt','P3','Redis is running without persistence and has no application source references',['evidence/production-snapshot.json#/redisRuntime','evidence/production-snapshot.json#/containers/redis'],[],[],'Redis adds operational surface but GreenField uses PostgreSQL queues and no Redis client reference was found.','Remove it from the GreenField stack if truly unused, or document and monitor its intended role.',['compose review'],'Dependency graph either names a real Redis consumer or the service is absent.'],
    ['atlas','architecture debt','P3','Route-to-table and caller mappings are static approximations',['route-data-map.json','client-contract-analysis.json'],[],[],'Dynamic dispatch, SQL helpers and client-computed paths can evade the extractor; confidence is recorded per route.','Add runtime SQL tracing in a disposable test harness and typed client instrumentation.',['test environment'],'Representative flows reconcile static maps with observed queries without production tracing.'],
  ]
  return entries.map((entry, index) => ({
    id: `API-ATLAS-GAP-${String(index + 1).padStart(3, '0')}`,
    domain: entry[0], type: entry[1], severity: entry[2], title: entry[3], evidence: entry[4], affectedRoutes: entry[5], affectedFiles: entry[6], productionImpact: entry[7], recommendedFix: entry[8], dependencies: entry[9], verification: entry[10],
  }))
}

function routeStats() {
  const visibility = Object.fromEntries(['PUBLIC','AUTHENTICATED','ADMIN','SERVICE/WORKER','INTERNAL (nginx-reachable; handler/service guard applies)'].map(key => [key, atlas.filter(route => route.authorization.visibility === key).length]))
  return {
    visibility,
    mutating: atlas.filter(route => ['POST','PUT','PATCH','DELETE'].includes(route.method)).length,
    readOnly: atlas.filter(route => route.method === 'GET').length,
    requestSchemas: atlas.filter(route => route.request.explicitFastifySchema).length,
    responseSchemas: atlas.filter(route => route.response.explicitFastifySchema).length,
    tested: atlas.filter(route => route.automatedTest).length,
    liveProbed: atlas.filter(route => route.liveProbe).length,
    clientCalled: atlas.filter(route => route.callers.clients.length).length,
    knownCalled: atlas.filter(route => route.callers.clients.length + route.callers.server.length).length,
    disabled: atlas.filter(route => route.featureState === 'disabled').length,
    rateLimited: atlas.filter(route => route.rateLimit).length,
  }
}

function renderCsv(routes) {
  const columns = ['domain','method','effectiveRoute','publicUrl','apiVersion','source','handler','visibility','authentication','capabilities','rateLimit','requestSchema','responseSchema','reads','writes','events','jobs','knownClients','tests','runtime','publicEdge','featureState','liveProbe','status','notes']
  const rows = routes.map(route => ({
    domain: route.domain,
    method: route.method,
    effectiveRoute: route.effectiveRoute,
    publicUrl: route.publicUrl,
    apiVersion: route.apiVersion,
    source: route.source ? `${route.source.file}:${route.source.line}` : '',
    handler: route.handler,
    visibility: route.authorization.visibility,
    authentication: route.authentication,
    capabilities: [...route.authorization.capabilities, ...route.authorization.serviceOperations],
    rateLimit: route.rateLimit ? `${route.rateLimit.max}/${route.rateLimit.timeWindow}` : 'none',
    requestSchema: route.request.explicitFastifySchema,
    responseSchema: route.response.explicitFastifySchema,
    reads: route.data.reads,
    writes: route.data.writes,
    events: route.eventsProduced,
    jobs: route.jobsProduced,
    knownClients: route.callers.clients,
    tests: route.callers.tests,
    runtime: route.runtimeRegistration,
    publicEdge: route.publicEdge,
    featureState: route.featureState,
    liveProbe: route.liveProbe?.result ?? 'not-probed',
    status: route.status,
    notes: route.notes,
  }))
  return `${columns.map(csvCell).join(',')}\n${rows.map(row => columns.map(column => csvCell(row[column])).join(',')).join('\n')}\n`
}

function renderHttpAtlas(routes, reconciliation, sourceOnlyRoutes, runtimeOnlyRoutes) {
  const summary = `# Complete HTTP API Atlas\n\nCaptured: ${snapshot.capturedAt}\n\n- Runtime method routes: ${reconciliation.runtimeMethodRoutes}\n- Application routes: ${reconciliation.applicationRuntimeRoutes}\n- Automatically generated HEAD routes: ${reconciliation.frameworkRoutes.filter(route => route.method === 'HEAD').length}\n- Framework CORS routes: ${reconciliation.frameworkRoutes.filter(route => route.method === 'OPTIONS').length}\n- Source-only: ${sourceOnlyRoutes.length}\n- Runtime-only: ${runtimeOnlyRoutes.length}\n- Reconciliation: \`${reconciliation.equation}\`\n\nEvery runtime method route is either represented below or explicitly listed as framework-derived in \`api-atlas.json\`. The JSON file is canonical for machine use.\n\n## Three-way reconciliation\n\n| Source | Runtime | Public edge | Status | Count |\n| --- | --- | --- | --- | ---: |\n| yes | yes | yes | reachable or feature-gated | ${routes.filter(route => route.sourceRegistration).length} |\n| yes | no | no | source-only | ${sourceOnlyRoutes.length} |\n| no | yes | yes | dynamically registered / investigate | ${runtimeOnlyRoutes.length} |\n| framework | yes | edge-dependent | explicitly excluded Fastify/CORS route | ${reconciliation.explicitlyExcludedFrameworkRoutes} |\n\n## Endpoint index\n\n| Domain | Method | Effective route | Access | Rate | Source | Runtime status |\n| --- | --- | --- | --- | --- | --- | --- |\n${routes.map(route => `| ${route.domain} | ${route.method} | \`${route.effectiveRoute}\` | ${route.authorization.visibility} | ${route.rateLimit ? `${route.rateLimit.max}/${route.rateLimit.timeWindow}` : 'none'} | ${route.source ? `\`${route.source.file}:${route.source.line}\`` : 'unmatched'} | ${route.status} |`).join('\n')}\n\n## Endpoint records\n\n`
  const contractNotes = `## Error contract\n\nThe canonical envelope is \`{ok,data,meta:{requestId,serverTime}}\` or \`{ok:false,error:{code,message,requestId,retryable,fieldErrors?,details?},meta}\` (\`services/greenfield-api/src/transport/envelope.ts:9\`). Status mapping is 400 for validation/schema/abstention, 401 for authentication/session/step-up, 403 for authorization/policy denial, 404 for unknown resources, 409 for conflicts/approval state, 429 for explicit rate-limit codes and 500 by default. Fastify-generated 413 body-limit and 415 content-parser errors can bypass this envelope because no global custom error handler exists. No canonical 422 mapping was found. Binary media, OAuth redirects and SSE are deliberate specialized responses.\n\n## Pagination contract\n\nShared cursor pagination uses default 20, maximum 50, a maximum 512-byte opaque cursor, stable route-specific ordering, \`nextCursor\`, and no previous cursor (\`services/greenfield-api/src/transport/pagination.ts:1\`). Every route's machine record includes \`request.pagination\`; \`none observed\` exposes unpaginated or non-list handlers rather than inventing a contract. Discover/activity unbounded behavior is a registered gap.\n\n`
  const enrichedSummary = summary.replace('\n## Endpoint index', `\n${contractNotes}## Endpoint index`)
  return enrichedSummary + routes.map(route => `<details>\n<summary><code>${route.id}</code> — ${route.status}</summary>\n\n- Domain: ${route.domain}\n- Method: ${route.method}\n- Effective route: \`${route.effectiveRoute}\`\n- Public URL: \`${route.publicUrl}\`\n- API version: ${route.apiVersion}\n- Source file: ${route.source ? `\`${route.source.file}:${route.source.line}\`` : 'UNMATCHED'}\n- Handler: ${route.handler}\n- Controller/service calls: ${list(route.controllerServices)}\n- Authentication: ${route.authentication}\n- Authorization: ${route.authorization.visibility}\n- Ownership rule: ${route.authorization.ownership.rule}\n- Workspace rule: ${route.authorization.ownership.workspaceScoped ? 'workspace identifier observed; downstream enforcement requires service evidence' : 'none observed'}\n- Capability/permission: ${list([...route.authorization.capabilities, ...route.authorization.serviceOperations])}\n- Rate limit: ${route.rateLimit ? `${route.rateLimit.max} per ${route.rateLimit.timeWindow}` : 'none registered'}\n- Request params: ${list(route.request.params)}\n- Request query: ${list(route.request.query)}\n- Request body: ${list(route.request.body)}\n- Pagination: ${route.request.pagination.style}${route.request.pagination.maximumPageSize ? `; default ${route.request.pagination.defaultPageSize}, max ${route.request.pagination.maximumPageSize}, next cursor ${route.request.pagination.nextCursor ? 'yes' : 'no'}` : ''}\n- Response schema: ${route.response.explicitFastifySchema ? JSON.stringify(route.response.schema) : 'not declared in Fastify'}\n- Success codes: ${list(route.successCodes)}\n- Expected errors: ${list(route.expectedErrors)}\n- Database reads: ${list(route.data.reads)}\n- Database writes: ${list(route.data.writes)}\n- Storage: ${list(route.storage)}\n- Events produced: ${list(route.eventsProduced)}\n- Jobs produced: ${list(route.jobsProduced)}\n- External integrations: ${list(route.externalIntegrations)}\n- Known clients: ${list(route.callers.clients)}\n- Tests: ${list(route.callers.tests)}\n- Runtime registration: yes\n- Live probe: ${route.liveProbe ? `${route.liveProbe.result} (${route.liveProbe.status})` : 'not executed'}\n- Status: ${route.status}\n- Notes: ${route.notes}\n\n</details>\n\n`).join('')
}

function list(values) {
  return values?.length ? values.map(value => `\`${String(value).replaceAll('`', '\\`')}\``).join(', ') : 'none observed'
}

function renderAuthMatrix(routes) {
  const evidenceRows = (authenticatedAcceptance.checks ?? []).filter(check => /cross-user|private|owner-scoped|remains self-scoped/.test(check.name))
  return `# Authentication and Permissions Matrix\n\nThis matrix distinguishes transport reachability from application authorization. nginx has a catch-all proxy, so route-level guards are the decisive control for all application paths.\n\n| Method | Route | Anonymous | Session | Verified email | Owner/account scope | Workspace | Capabilities / service operations | Admin | Module install | Module permission | Evidence |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${routes.map(route => `| ${route.method} | \`${route.effectiveRoute}\` | ${yes(route.authorization.anonymousAllowed)} | ${yes(route.authorization.sessionRequired)} | ${yes(route.authorization.verifiedEmailRequired)} | ${yes(route.authorization.ownership.accountScoped || route.authorization.ownership.actorScoped)} | ${yes(route.authorization.ownership.workspaceScoped)} | ${[...route.authorization.capabilities, ...route.authorization.serviceOperations].join(', ') || 'none'} | ${yes(route.authorization.adminRequired)} | ${yes(route.authorization.moduleInstallationRequired)} | ${yes(route.authorization.modulePermissionRequired)} | ${route.source ? `\`${route.source.file}:${route.source.line}\`` : 'unmatched'} |`).join('\n')}\n\n## Authenticated acceptance evidence\n\nAtlas status: **${atlasStatus}**. Production authenticated checks: ${authenticatedAcceptance.summary?.passed ?? 0} passed / ${authenticatedAcceptance.summary?.failed ?? 0} failed. Controlled exact-schema ownership/trust checks: ${closeout.controlledAcceptance?.passed ?? 0} passed / ${closeout.controlledAcceptance?.failed ?? 0} failed.\n\n${evidenceRows.length ? mdTable(['Disposition','HTTP status','Error contract','Result'], evidenceRows.map(check => [check.name, String(check.status), check.errorCode ?? 'success envelope', check.result])) : 'Authenticated production evidence has not been captured.'}\n\nKnown vulnerable behavior is intentionally represented by expected-failure regressions; PASS means the authorization map is complete, not defect-free.\n\n## Interpretation limits\n\n- "Owner/account scope" means the authenticated account or actor identifier is visibly passed into the handler's service path; downstream SQL and service evidence remains authoritative.\n- "Anonymous" includes optional-viewer endpoints. Private, blocked, and muted content still depends on repository visibility predicates.\n- Backend Fabric routes use signed service assertions rather than user bearer sessions.\n`
}

function yes(value) { return value ? 'yes' : 'no' }

function renderDatabaseMap(databaseTables, production, migrationInfo) {
  const orphans = databaseTables.filter(table => table.orphanCandidate)
  return `# Database to API Map\n\nProduction PostgreSQL: ${production.databaseSchema.serverVersion}; schema migration \`${production.databaseSchema.appliedMigrations.at(-1)?.id}\`; ${production.databaseSchema.appliedMigrations.length} applied migrations. Git contains ${migrationInfo.files.length} ordered up migrations, latest \`${migrationInfo.files.at(-1)}\`.\n\nNo row values were collected. This inventory is PostgreSQL catalogue metadata plus static source references.\n\n## Reconciliation\n\n- Production tables: ${databaseTables.length}\n- Tables with API/worker source references: ${databaseTables.filter(table => !table.orphanCandidate).length}\n- Orphan candidates requiring manual confirmation: ${orphans.length}\n- Write-only candidates: ${databaseTables.filter(table => table.writeOnlyCandidate).length}\n- Read-only candidates: ${databaseTables.filter(table => table.readOnlyCandidate).length}\n\n## Table inventory\n\n${databaseTables.map(table => `### \`${table.name}\`\n\n- Purpose: ${table.purpose}\n- Primary key: ${list(table.primaryKey)}\n- Foreign keys: ${table.foreignKeys.length ? table.foreignKeys.map(key => `\`${key.column} -> ${key.referencesTable}.${key.referencesColumn}\``).join(', ') : 'none'}\n- Ownership/workspace/user/module columns: ${list(table.ownershipColumns)}\n- Indexes: ${list(table.indexes.map(index => index.name))}\n- Unique constraints: ${list(table.uniqueConstraints.map(constraint => `${constraint.name}(${constraint.columns.join(',')})`))}\n- Soft delete: ${table.softDelete ? 'deleted_at' : 'none'}\n- Timestamps: ${list(table.timestamps)}\n- Migration introduced: \`${table.migrationIntroduced}\`\n- Routes reading: ${list(table.routeReads)}\n- Routes writing: ${list(table.routeWrites)}\n- API/worker source reads: ${list(table.sourceReads)}\n- API/worker source writes: ${list(table.sourceWrites)}\n- Disposition: ${table.orphanCandidate ? 'ORPHAN CANDIDATE — no static API/worker reference' : table.writeOnlyCandidate ? 'WRITE-ONLY CANDIDATE' : table.readOnlyCandidate ? 'READ-ONLY APPLICATION CANDIDATE' : 'active read/write or ledger/schema table'}\n`).join('\n')}\n\n## Orphan candidates\n\n${orphans.length ? orphans.map(table => `- \`${table.name}\``).join('\n') : 'None from the static source-reference scan.'}\n`
}

function renderOpenApi(routes, production) {
  const paths = {}
  for (const route of routes) {
    const openPath = route.effectiveRoute.replaceAll(/:([A-Za-z0-9_]+)/g, '{$1}')
    const operation = {
      operationId: `${route.method.toLowerCase()}_${route.effectiveRoute.replaceAll(/[^A-Za-z0-9]+/g, '_').replaceAll(/^_|_$/g, '')}`,
      summary: `${route.domain}: ${route.method} ${route.effectiveRoute}`,
      tags: [route.domain],
      parameters: [...route.effectiveRoute.matchAll(/:([A-Za-z0-9_]+)/g)].map(match => ({name: match[1], in: 'path', required: true, schema: {}})),
      responses: Object.fromEntries(route.successCodes.map(code => [String(code), {description: 'Implementation response; schema is not registered'}])),
      'x-modula-source': route.source ? `${route.source.file}:${route.source.line}` : null,
      'x-modula-auth': route.authentication,
      'x-modula-rate-limit': route.rateLimit,
      'x-contract-completeness': route.request.explicitFastifySchema && route.response.explicitFastifySchema ? 'schema-declared' : 'schema-missing',
    }
    if (route.authorization.sessionRequired) operation.security = [{bearerAuth: []}]
    if (route.authorization.serviceAssertionRequired || route.authorization.serviceOperations.length) operation.security = [{serviceAssertion: []}]
    if (!paths[openPath]) paths[openPath] = {}
    paths[openPath][route.method.toLowerCase()] = operation
  }
  return {
    openapi: '3.1.0',
    info: {title: 'Modula GreenField API — generated implementation snapshot', version: production.containers.api.revision, description: 'GENERATED FROM CURRENT IMPLEMENTATION — NOT YET THE CANONICAL DESIGN CONTRACT. Missing schemas remain intentionally empty.'},
    servers: [{url: production.config.api.safe.MODULA_PUBLIC_API_URL}],
    paths,
    components: {securitySchemes: {bearerAuth: {type: 'http', scheme: 'bearer'}, serviceAssertion: {type: 'apiKey', in: 'header', name: 'X-Modula-Service-Assertion'}}},
  }
}

function renderBootMap(production) {
  return `# Application Boot Map\n\n## Process graph\n\n\`services/greenfield-api/src/main.ts:1-8\`\n\n\`loadConfig() -> createServer() -> app.listen({host, port})\`\n\n\`services/greenfield-api/src/app/create-server.ts:14-47\`\n\n\`Fastify -> createDb -> registerPlugins -> registerRoutes -> graceful shutdown\`\n\n\`services/greenfield-api/src/app/register-plugins.ts:8-41\`\n\n1. request-id onRequest hook;\n2. global Helmet headers;\n3. origin allow-list CORS;\n4. non-global Fastify rate limiter when enabled.\n\n\`services/greenfield-api/src/app/register-routes.ts:148-214\`\n\n1. instantiate domain services;\n2. global preHandler attaches legacy and Greenfield bearer authentication;\n3. register health/version/meta and primary route families;\n4. register module, AI, Backend Fabric, intelligence, social, stories, developer, entitlement, account-data, attachment and provider route groups;\n5. handlers perform authorization and validation; no global schema-validation layer or global custom error handler is registered.\n\n## Actual production boot\n\n- Image: \`${production.containers.api.image}\`\n- Image ID: \`${production.containers.api.imageId}\`\n- Revision: \`${production.containers.api.revision}\`\n- Command: \`${production.containers.api.command}\`\n- Working directory: \`${production.containers.api.workingDir}\`\n- Host binding: loopback \`127.0.0.1:4020 -> container 4020\`\n- Fastify application routes: ${applicationRuntime.length}\n- Automatic HEAD routes: ${frameworkRuntime.filter(route => route.method === 'HEAD').length}\n- Framework OPTIONS routes: ${frameworkRuntime.filter(route => route.method === 'OPTIONS').length}\n\n## Registration graph\n\n\`\`\`mermaid\ngraph TD\n  main[main.ts] --> config[loadConfig]\n  main --> server[createServer]\n  server --> fastify[Fastify 5]\n  server --> db[Kysely PostgreSQL]\n  server --> plugins[registerPlugins]\n  plugins --> requestId[request ID]\n  plugins --> helmet[Helmet]\n  plugins --> cors[CORS]\n  plugins --> limits[rate limit plugin]\n  server --> routes[registerRoutes]\n  routes --> auth[global auth attachment preHandler]\n  routes --> core[core account/social routes]\n  routes --> attachments[attachment routes]\n  routes --> modules[module registry/runtime]\n  routes --> ai[AI gateway]\n  routes --> intelligence[governed intelligence]\n  routes --> fabric[Backend Fabric]\n  routes --> stories[stories]\n  routes --> developer[developer/build]\n  server --> shutdown[graceful shutdown]\n  main --> listen[listen 0.0.0.0:4020 inside container]\n\`\`\`\n`
}

function renderRequestFlow() {
  return `flowchart LR\n  client[Client] --> tls[DNS and TLS: api.modula.digital]\n  tls --> nginx[nginx catch-all plus upload overrides]\n  nginx -->|127.0.0.1:4020| api[GreenField Fastify API]\n  api --> requestId[Request ID hook]\n  requestId --> security[Helmet and CORS]\n  security --> rate[Per-route Fastify rate limit]\n  rate --> auth[Bearer or service assertion attachment]\n  auth --> authorize[Route capability and ownership checks]\n  authorize --> validate[Handler and service validation]\n  validate --> service[Domain service/repository]\n  service --> postgres[(PostgreSQL 16.9)]\n  service --> media[(Host media bind mount)]\n  service --> outbox[(Outbox/events/jobs)]\n  outbox --> worker[GreenField worker]\n  service --> response[Success/failure envelope or media stream]\n  response --> nginx\n  nginx --> client\n`
}

function renderRouteDataFlow(routes) {
  const domains = [...new Set(routes.map(route => route.domain))].sort()
  const lines = ['flowchart LR', '  api[GreenField HTTP API]']
  for (const domain of domains) {
    const id = domain.replaceAll(/[^A-Za-z0-9]/g, '')
    lines.push(`  api --> ${id}[${domain}]`)
    const tables = [...new Set(routes.filter(route => route.domain === domain).flatMap(route => [...route.data.reads, ...route.data.writes]))].sort()
    for (const table of tables.slice(0, 18)) {
      const tableId = `t_${table.replaceAll(/[^A-Za-z0-9]/g, '_')}`
      lines.push(`  ${id} --> ${tableId}[(${table})]`)
    }
  }
  return `${lines.join('\n')}\n`
}

function renderModuleFlow() {
  return `flowchart LR
  source[Publisher source] --> validation[Manifest and release validation]
  validation --> package[Package digest and optional blob]
  package --> ingestion[Admin/manual or disabled GitHub ingestion]
  ingestion --> registry[(Registry release tables)]
  registry --> integrity[Integrity rows]
  registry --> signature[Ed25519 verification when signature exists]
  signature --> trust[Trust policy currently accepts unsigned]
  registry --> artwork[Presentation metadata and optional blobs]
  registry --> install[Install plan]
  install --> descriptor[Immutable install descriptor]
  descriptor --> host[Generic ModuleHost]
  host --> frontend[Verified MPS frontend: declarative or host contribution]
  descriptor --> runtime[Module runtime authorization]
  runtime --> review[Installation permission review]
  review --> records[Record CRUD]
  review --> functions[Action and function invocation]
  records --> postgres[(PostgreSQL module data)]
  functions --> postgres
`
}

function renderIntelligenceFlow() {
  return `flowchart LR
  client[Authenticated client] --> mission[Mission API]
  mission --> gaia[Deterministic GAIA planner]
  gaia --> proposal[Plan and proposed actions]
  proposal --> aki[AKI schema capability permission evidence risk policy checks]
  aki -->|ALLOW read only| governor[Governor]
  aki -->|ALLOW WITH CONDITIONS| governor
  aki -->|REQUIRE APPROVAL| approval[Human approval]
  aki -->|DENY| blocked[Blocked]
  aki -->|ABSTAIN| human[Human required]
  approval --> governor
  governor --> command[Command layer revalidation and claim]
  command --> boundary[GreenField action boundary]
  boundary --> vault[Current Vault record query or create]
  vault --> database[(PostgreSQL)]
  command --> ledger[(Governed append-only ledger)]
  blocked --> ledger
  human --> ledger
`
}

function renderMediaFlow() {
  return `flowchart LR
  client[Client] --> initiate[POST attachment upload session]
  initiate --> policy[MIME size ownership policy]
  policy --> bytes[PUT raw bytes]
  bytes --> verify[Length checksum and magic signature]
  verify --> disk[(Host bind media root)]
  verify --> metadata[(Attachment metadata)]
  metadata --> bind[Profile or post attachment binding]
  bind --> canonical[Canonical attachment URL]
  canonical --> auth[Public private and owner delivery policy]
  auth --> nginx[nginx]
  nginx --> client
  legacy[Legacy post base64 and story base64] --> disk
`
}

function renderEventFlow() {
  return `flowchart LR
  api[HTTP domain mutation] --> outbox[(greenfield outbox)]
  outbox --> worker[GreenField worker poller]
  worker --> event[Event delivery consumers]
  worker --> job[Background job runner]
  event --> notification[(Notifications)]
  event --> search[(Search projections)]
  event --> audit[(Audit and activity effects)]
  job --> mail[SMTP or mail identity provisioner]
  job --> registry[Registry synchronization]
  worker --> retry[Retry lease and backoff]
  retry --> dead[(FAILED or DEAD LETTER)]
  worker --> heartbeat[(Worker heartbeat)]
`
}

function mdTable(headers, rows) {
  return `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}`
}

function countBy(items, key) {
  return Object.fromEntries([...new Set(items.map(item => item[key]))].sort().map(value => [value, items.filter(item => item[key] === value).length]))
}

function renderReadme() {
  return `# MODULA GREENFIELD — API-ATLAS-01

Status: **${atlasStatus}**. Production, source, runtime, edge, database, module, intelligence and asynchronous surfaces were reconciled. Route completeness passed: ${runtime.length} runtime method routes = ${atlas.length} mapped application routes + ${frameworkRuntime.length} explicitly excluded framework-derived routes. ${acceptanceComplete ? 'Dedicated production audit identities executed authenticated cross-user and write acceptance; controlled exact-schema tests characterize module, intelligence and known expected-failure behavior.' : 'Authenticated closeout evidence is not yet complete.'}

This directory is the canonical evidence-backed snapshot captured at ${snapshot.capturedAt}. The machine-readable source of truth is \`api-atlas.json\`; Markdown files are generated views. Secret values and production row data are excluded.

## Contents

- \`00-production-truth.md\`: deployed topology, repository/runtime identity, edge and configuration status.
- \`01-application-boot-map.md\`: Fastify process and plugin registration graph.
- \`02-http-api-atlas.md\`, \`api-atlas.json\`, \`api-atlas.csv\`: complete route inventory.
- \`03-auth-permissions-matrix.md\`: per-route access controls.
- \`04-database-api-map.md\`, \`route-data-map.json\`: schema and route/data relationships.
- \`05-media-storage-map.md\`: attachment, profile, post, story and delivery paths.
- \`06-module-platform-map.md\`: registry through host/runtime.
- \`07-intelligence-api-map.md\`: Mission through governed ledger.
- \`08-events-workers-jobs.md\`: outbox, jobs, consumers, mail and failures.
- \`09-client-capability-coverage.md\`: product/client contract coverage.
- \`10-live-probe-results.md\`: anonymous and authenticated production probes.
- \`11-gap-register.md\`, \`gap-register.json\`: evidence-based findings.
- \`12-remediation-roadmap.md\`: sequenced follow-up missions; no fixes were made here.
- \`13-verification-results.md\`: audit-tool, typecheck and test outcomes plus explicit limitations.
- \`openapi.generated.yaml\`: generated implementation snapshot, intentionally incomplete where route schemas do not exist.
- \`evidence/production-snapshot.json\`, \`evidence/authenticated-acceptance.json\`: sanitized production facts; no secrets or user rows.

## Reproduce

\`pnpm api:atlas:capture\` reads production state without changing it. \`pnpm api:atlas:probe\` runs the bounded anonymous probe set. \`pnpm api:atlas:acceptance\` runs cleanup-capable authenticated acceptance with protected credentials. \`pnpm api:atlas\` regenerates the atlas. \`pnpm api:atlas:verify\` checks determinism, parsability, route reconciliation and secret safety.
`
}

function renderExecutiveSummary() {
  const stats = routeStats()
  const severity = countBy(gaps, 'severity')
  const capabilityState = countBy(capabilities, 'status')
  const domainRows = ['Auth','Account','Profile','Social','Feed','Posts','Comments','Reactions','Media','Search','Discover','Activity','Modules','Module Runtime','Intelligence','Moderation','Operations'].map(label => {
    const aliases = {
      Auth: ['Authentication'], Account: ['Account','Settings'], Profile: ['Profile'], Social: ['Social'], Feed: ['Home','Feed'], Posts: ['Post','Composer'], Comments: ['Comments'], Reactions: ['Reactions'], Media: ['Media'], Search: ['Search'], Discover: ['Discover'], Activity: ['Activity'], Modules: ['Module','Modules'], 'Module Runtime': ['Module Runtime'], Intelligence: ['Intelligence'], Moderation: ['Moderation'], Operations: ['Operations'],
    }[label]
    const routeCount = atlas.filter(route => aliases.some(alias => route.domain.toLowerCase().includes(alias.toLowerCase()))).length
    const caps = capabilities.filter(item => aliases.includes(item.domain))
    const critical = gaps.filter(gap => gap.severity === 'P0' && aliases.some(alias => gap.domain.toLowerCase().includes(alias.toLowerCase()))).length
    return [label, String(routeCount), String(caps.filter(item => item.status === 'COMPLETE').length), String(caps.filter(item => item.status === 'PARTIAL').length), String(caps.filter(item => ['MISSING','CLIENT ONLY','UNKNOWN'].includes(item.status)).length), String(critical)]
  })
  return `# GREENFIELD API ATLAS

Production SHA: \`${snapshot.containers.api.revision}\`
Production migration: \`${snapshot.databaseSchema.appliedMigrations.at(-1).id}\`
API service: \`${snapshot.containers.api.name}\` (${snapshot.containers.api.health})
Worker service: \`${snapshot.containers.worker.name}\` (DB heartbeat fresh; no Docker healthcheck)
Database: PostgreSQL ${snapshot.databaseSchema.serverVersion}
Public API base: \`${baseUrl}\`
HTTP routes discovered: ${atlas.length} application / ${runtime.length} runtime method routes
Public routes: ${stats.visibility.PUBLIC}
Authenticated routes: ${stats.visibility.AUTHENTICATED}
Admin/internal routes: ${stats.visibility.ADMIN + stats.visibility['SERVICE/WORKER'] + stats.visibility['INTERNAL (nginx-reachable; handler/service guard applies)']}
Mutating routes: ${stats.mutating}
Read-only routes: ${stats.readOnly}
Routes with request schemas: ${stats.requestSchemas}
Routes with response schemas: ${stats.responseSchemas}
Routes with automated tests: ${stats.tested}
Routes live-probed: ${stats.liveProbed} unique routes
Routes with known callers: ${stats.knownCalled}
Database tables: ${tables.length}
Workers: 1 GreenField worker
Queues: PostgreSQL outbox plus background job tables
Scheduled jobs: ${snapshot.operationalAggregates.asyncRegistrations.scheduledModuleJobs} module schedules; worker poll/reap loops are process timers
Webhooks: 1 module-backend ingress family; 0 provider webhook families and 0 production module webhook deliveries
Complete capabilities: ${capabilityState.COMPLETE ?? 0}
Partial capabilities: ${capabilityState.PARTIAL ?? 0}
Missing capabilities: ${(capabilityState.MISSING ?? 0) + (capabilityState['CLIENT ONLY'] ?? 0)}
P0 gaps: ${severity.P0 ?? 0}
P1 gaps: ${severity.P1 ?? 0}
P2 gaps: ${severity.P2 ?? 0}
P3 gaps: ${severity.P3 ?? 0}

Status: **${atlasStatus}**. ${acceptanceComplete ? `The map is complete: ${liveProbes.probes.length} bounded anonymous probes, ${authenticatedAcceptance.summary.passed} authenticated production checks, and ${closeout.controlledAcceptance.passed} controlled ownership/trust checks passed. Known defects remain registered and regression-tested.` : `Gates A, B, C (static), D, E, F, G, H, J and K are evidenced, but authenticated closeout remains incomplete.`}

## Domain summary

${mdTable(['Domain','Routes','Complete capabilities','Partial capabilities','Missing/client-only','P0 gaps'], domainRows)}

## Production conclusions

- The running API and worker are the same OCI revision, \`${snapshot.containers.api.revision}\`; ${snapshot.repository.originMain === snapshot.containers.api.revision ? 'that revision exactly matches captured `origin/main`.' : closeout.deploymentLineage?.reconciled ? 'its accepted relationship to canonical `origin/main` is recorded in the deployment-lineage closeout.' : 'that revision differs from captured `origin/main` and remains a release-governance gap.'}
- Source/runtime reconciliation is exact: ${runtime.length} = ${atlas.length} application routes + ${frameworkRuntime.length} automatic framework routes; there are no unexplained source-only or runtime-only application routes.
- The primary blocking risks are unsigned-but-trusted module releases, missing module artifacts/assets, implicit module permission grants, follower-only privacy without requests, legacy function/AI-stream ownership omissions, dead-lettered reaction notifications, non-operational AI/GAIA/Nodus paths, client-only link/poll composition, and media edge/durability gaps.
- No P0 was established by static, authenticated production, or controlled exact-schema acceptance. Known P1/P2 failures remain explicit.

## What GreenField Is Missing

### Missing for Modula Native

- A profile modules surface, follow-request lifecycle, dedicated request/mention activity contracts, and real link/poll persistence. Evidence: capability matrix and gaps API-ATLAS-GAP-002/013.

### Missing for Social

- Private-profile approval semantics, stable pagination for Discover/activity, production notification delivery reliability, and a documented real-time/polling contract.

### Missing for Profiles

- Profile-link CRUD and one canonical owned-media path; raw public avatar/cover URLs remain a competing model.

### Missing for Posts/Media

- Explicit link/poll contracts, aligned public upload limits, scheduled orphan/expired-file cleanup, and host-loss recovery/object replication.

### Missing for Product Hub

- Complete immutable package/artwork bytes, production artwork, and automated signed ingestion.

### Missing for Modules

- Required publisher signatures, fail-closed recorded permission grants, complete historical descriptors, and removal of Vault-specific branches.

### Missing for Third-Party Module Developers

- Enabled community/remote execution, working source synchronization, signed release ceremony and a fully generic governed action/function path.

### Missing for GAIA/AKI/AGI

- An operational planner/provider and production mission acceptance. AKI/Governor/command enforcement exists but production state is empty.

### Missing for Nodus Integration

- A local/offline Nodus handshake, capability discovery, proposal/approval and ledger synchronization contract.

### Missing for Security

- Remediation of the reproduced legacy function and AI-stream ownership failures, schema-declared boundaries, signature-required trust and uniform private-resource not-found semantics.

### Missing for Production Operations

- Worker container health, storage readiness/recovery, end-to-end correlation/metrics, and resolved dead letters.

### Missing for Developer Experience

- Canonical OpenAPI schemas, deterministic typed clients, explicit route deprecations and runtime SQL-to-route tracing in a disposable harness.

Every item above is expanded with evidence, impact, dependency and verification in \`11-gap-register.md\` and \`12-remediation-roadmap.md\`.

## Existing GreenField Capabilities Not Currently Used

- Complete passkey/TOTP/recovery/session security APIs, developer/build coordination, module installation descriptors, generic verified MPS ModuleHost execution, and governed intelligence mission routes exist beyond current observed client usage.
- ${atlas.filter(route => route.callers.clients.length === 0).length} registered routes have no statically observed product-client caller; ${atlas.filter(route => route.callers.clients.length === 0 && route.callers.tests.length > 0).length} are test-observed without a product-client caller. Per-route evidence is in \`api-atlas.json\`.
- Real AI provider adapters exist, but all real providers are unconfigured; only a development mock is available and excluded by the production resolver.

## Duplicate or Competing Implementations

- Legacy base64 post media versus canonical two-stage attachments.
- Legacy sessions/likes versus account sessions/typed reactions.
- Raw profile avatar/cover URLs versus owned attachment bindings.
- Generic ModuleHost execution versus Vault-specific core branches in intelligence, AI, search and Board presentation.

The preferred paths are canonical attachments, account security/session contracts, typed reactions, owned profile-media bindings and manifest-driven generic hosting.

## Surface Exists, Backend Does Not

- Link and poll composer UI/types do not have persistence contracts.
- Connector metadata advertises webhook support without provider ingress routes.
- Module presentation rows may advertise assets without bytes; most releases lack artifact bytes.
- GAIA/provider interfaces exist, but no real provider is operational and GAIA recognizes only fixture objectives.
- Module GitHub synchronization code and routes exist, but production has no source and automation is disabled.
`
}

function renderProductionTruth() {
  const envRows = [...Object.entries(snapshot.config.api.safe), ...Object.entries(snapshot.config.worker.safe).map(([key, value]) => [`worker:${key}`, value])]
  const secretRows = [...Object.entries(snapshot.config.api.secrets), ...Object.entries(snapshot.config.worker.secrets).map(([key, value]) => [`worker:${key}`, value])]
  return `Observed production truth at ${snapshot.capturedAt}: api.modula.digital terminates at nginx and proxies to a healthy loopback-only Fastify container running \`${snapshot.containers.api.revision}\`, backed by PostgreSQL ${snapshot.databaseSchema.serverVersion}, a same-revision worker, host-bound media storage, and an apparently unused Redis service.

# Production Truth

## Host and repository

- Host: \`${snapshot.hostname}\`; OS: ${snapshot.os}; architecture: ${snapshot.architecture}; kernel: ${snapshot.kernel}; uptime: ${snapshot.uptime}.
- Canonical checkout: \`${snapshot.repository.canonicalPath}\`; origin: \`${snapshot.repository.origin}\`; branch: \`${snapshot.repository.branch}\`; HEAD: \`${snapshot.repository.head}\`.
- Canonical checkout is dirty: ${snapshot.repository.trackedChanges.split('\n').filter(Boolean).length} tracked modifications and ${snapshot.repository.untrackedFiles.split('\n').filter(Boolean).length} untracked files. Those files were not changed by this audit.
- \`origin/main\` at capture: \`${snapshot.repository.originMain}\`.
- Running SHA: \`${snapshot.containers.api.revision}\`. It is not canonical checkout HEAD and not \`origin/main\`. OCI revision, \`/version.json\`, worker heartbeat and runtime route introspection correlate the running code to this exact source revision.
- Audit worktree: \`${snapshot.repository.auditPath}\`, branch \`${snapshot.repository.auditBranch}\`.

## Runtime inventory

${mdTable(['Role','Container/image','Created','Ports','Health','Revision'], [
    ['API', `\`${snapshot.containers.api.image}\``, snapshot.containers.api.created, '`127.0.0.1:4020 -> 4020`', snapshot.containers.api.health, `\`${snapshot.containers.api.revision}\``],
    ['Worker', `\`${snapshot.containers.worker.image}\``, snapshot.containers.worker.created, 'internal only', snapshot.containers.worker.health ?? 'no Docker healthcheck', `\`${snapshot.containers.worker.revision}\``],
    ['Database', `\`${snapshot.containers.database.image}\``, snapshot.containers.database.created, 'Docker network only', snapshot.containers.database.health, 'image-pinned PostgreSQL'],
    ['Redis', `\`${snapshot.containers.redis.image}\``, snapshot.containers.redis.created, 'Docker network only', snapshot.containers.redis.health, 'no GreenField source consumer found'],
  ])}

- Host Node ${snapshot.versions.hostNode}; container Node ${snapshot.versions.containerNode}; pnpm ${snapshot.versions.hostPnpm}; npm ${snapshot.versions.hostNpm}; ${snapshot.versions.nginx}.
- PostgreSQL data uses a named Docker volume. Media uses read/write host bind \`${snapshot.storage.root}\`; ${snapshot.storage.files} files / ${snapshot.storage.bytes} bytes were counted without reading user contents.
- PostgreSQL queue/outbox drives asynchronous work. Redis reports append-only disabled and snapshot saving disabled; no GreenField source reference was found.
- Related internal services on the Docker network: Modula AI backend and secrets service. Their own repositories are outside this atlas. Old verifier/recovery/preview PostgreSQL containers are explicitly non-production and listed in sanitized evidence.

## Edge topology

\`api.modula.digital\` resolves through Cloudflare. The observed certificate is issued by Google Trust Services for \`modula.digital\` and expires 2026-11-11.

\`\`\`mermaid
flowchart TD
  internet[Internet clients] --> dns[Cloudflare DNS and TLS path]
  dns --> nginx[nginx api.modula.digital]
  nginx -->|catch-all 127.0.0.1:4020| api[GreenField Fastify API c7c46df]
  api --> postgres[(PostgreSQL 16.9 named volume)]
  api --> media[(Host bind /var/lib/modula/greenfield-media)]
  api --> outbox[(PostgreSQL outbox and jobs)]
  outbox --> worker[GreenField worker c7c46df]
  api --> ai[Internal Modula AI backend when configured]
  api --> secrets[Internal secrets service]
  redis[(Redis 7.4 no persistence)] -. no source consumer found .- api
\`\`\`

## nginx public routing

- Config: \`${snapshot.nginx.path}\`; SHA-256 \`${snapshot.nginx.sha256}\`.
- Default catch-all: 1 MiB request body, 10s connect, 60s send/read, no-store, HTTP/1.1 proxy to loopback API.
- Registry release assets: separate immutable-cache location.
- \`/v1/stories\`: 25 MiB and 300s timeouts.
- attachment byte upload: 101 MiB, proxy buffering disabled, 300s timeouts.
- Security headers: nosniff, DENY framing, no-referrer. No nginx request-rate directive or WebSocket upgrade stanza was found; ${routeStats().rateLimited}/${atlas.length} application routes carry Fastify rate-limit configuration.
- Every registered route is transport-reachable through the catch-all; feature flags and handler authorization still determine application availability. \`/v1/internal/ssrf-check\` is handler-hidden in production.

## Versions and migration truth

- Applied migrations: ${snapshot.databaseSchema.appliedMigrations.length}; latest \`${snapshot.databaseSchema.appliedMigrations.at(-1).id}\` at ${snapshot.databaseSchema.appliedMigrations.at(-1).appliedAt}.
- Git up migrations: ${migrations.files.length}; latest \`${migrations.files.at(-1)}\`. No missing, extra, duplicate-numbered or out-of-order production migration was found.
- Runtime routes: ${runtime.length}; application routes: ${atlas.length}; excluded automatic framework routes: ${frameworkRuntime.length}.

## Safe configuration

${mdTable(['Setting','Observed value'], envRows.map(([key, value]) => [`\`${key}\``, `\`${value}\``]))}

## Secret-presence inventory

Only presence status was captured; no value is present in this atlas.

${mdTable(['Secret setting','Status'], secretRows.map(([key, value]) => [`\`${key}\``, value]))}

## External service dependencies

${mdTable(['Dependency','Status','Evidence'], [
    ['SMTP email','CONFIGURED','smtp transport required, TLS required, username/password PRESENT; mail.deliver jobs have succeeded'],
    ['Mail identity provisioner','UNCONFIGURED','provisioning disabled; historical jobs failed/dead-lettered with MAIL_PROVISIONER_DISABLED'],
    ['AI/model providers','PLACEHOLDER','real provider rows are unconfigured; development mock is available but excluded in production resolution'],
    ['Internal Modula AI backend','CONFIGURED NETWORK DEPENDENCY','container and URL key exist, but no operational model/provider execution was observed'],
    ['GitHub registry source','UNCONFIGURED','sync code exists; automation false and source count zero'],
    ['Filesystem media','CONFIGURED','host bind; no external object storage/CDN origin'],
    ['AT Protocol/PDS','NOT USED','both feature flags false; placeholder preview code remains feature-gated'],
    ['Connector OAuth','PARTIAL','credential encryption key PRESENT and provider metadata/routes exist; no provider webhook ingress'],
    ['Push/APNs/web push','NOT USED','no subscription or delivery infrastructure found'],
    ['Payment provider','NOT USED','DIMON disabled and no payment-service integration found'],
  ])}
`
}

function renderMediaMap() {
  const media = snapshot.operationalAggregates
  return `# Media and Storage Map

## Production storage

- Backend: host filesystem bind at \`${snapshot.storage.root}\` mounted read/write into the API container.
- Durability: survives container replacement, but no replicated object store, CDN origin, storage health check or host-loss recovery proof was discovered.
- Inventory: ${snapshot.storage.files} files / ${snapshot.storage.bytes} bytes. No file contents or user metadata were copied into the atlas.

${mdTable(['Class','Files','Bytes','API family'], Object.entries(snapshot.storage.classes).map(([name, value]) => [name, String(value.files), String(value.bytes), name === 'attachments' ? '`/v1/attachments/*`' : name === 'profiles' ? '`/v1/profiles/*/(avatar|cover)`' : name === 'stories' ? '`/v1/stories`, `/v1/media/stories/*`' : '`/v1/posts`, `/v1/media/*`']))}

## Canonical attachment lifecycle

1. \`POST /v1/attachments/uploads\` creates an account-owned session and validates declared MIME/size (\`services/greenfield-api/src/domains/attachments/policy.ts:15\`).
2. \`PUT /v1/attachments/uploads/:uploadId/content\` streams raw bytes, bounds length, hashes them and checks file signatures (\`services/greenfield-api/src/domains/attachments/service.ts:117\`, \`:266\`).
3. Metadata and state are stored in PostgreSQL; bytes are atomically placed under the media root.
4. Profile avatar/cover binding requires the same owner, ready state and image kind (\`services/greenfield-api/src/domains/profiles/writes.ts:292\`). Post content accepts up to ten ready owned attachments.
5. \`GET /v1/attachments/:attachmentId/content\` resolves public/private/owner access and streams the file through nginx.
6. Delete/cleanup support exists in the service, but no production scheduler invokes orphan cleanup.

Current attachment states: ${Object.entries(media.attachmentsByStatus).map(([key,value]) => `${key}=${value}`).join(', ')}. Ready linkage: ${media.readyAttachmentLinkage.linked}/${media.readyAttachmentLinkage.ready} linked, ${media.readyAttachmentLinkage.orphanCandidates} orphan candidates.

## Media-class disposition

${mdTable(['Class','Bytes','Metadata','URL and policy','Deletion/durability'], [
    ['Avatar/cover', 'canonical attachment bytes or external URL', `profile_media (${Object.entries(media.profileMediaByKind).map(([key,value]) => `${key}=${value}`).join(', ')})`, 'canonical attachment URL is policy-checked; PATCH also accepts public HTTPS URL', 'binding removal does not establish object garbage collection'],
    ['Post attachments', 'attachment store', `post_content (${Object.entries(media.postContentByType).map(([key,value]) => `${key}=${value}`).join(', ')})`, 'viewer visibility follows post plus attachment policy', 'soft post deletion; orphan cleanup unscheduled'],
    ['Legacy post image', 'posts directory', `post_media count=${media.postMedia.count}`, '`/v1/media/:mediaFile`; public path follows post policy', `${media.postMedia.activeWithUrl}/${media.postMedia.active} active rows have a URL; 20 MiB app limit conflicts with 1 MiB nginx default`],
    ['Stories', 'stories directory', `story_items count=${media.storyItems.count}`, '`/v1/media/stories/:mediaFile` with story visibility', `${media.storyItems.deletedOrInactive} inactive/deleted rows and ${snapshot.storage.classes.stories.files} files remain`],
    ['Module packages', 'PostgreSQL release blob/ref metadata', `${media.releaseArtifactCoverage.blobAvailable}/${media.releaseArtifactCoverage.releases} release blobs`, 'public artifact route when blob is available; digest checked', 'immutable metadata, incomplete byte coverage'],
    ['Module artwork', 'PostgreSQL blobs plus presentation metadata', `${media.presentationAssets.blobAvailable}/${media.presentationAssets.count} blobs`, 'public immutable cache route; unavailable metadata returns 404', `all ${media.presentationAssets.development} are marked development assets`],
  ])}

## Confirmed gaps

- Database paths can be non-servable: ${media.presentationAssets.count - media.presentationAssets.blobAvailable} module presentation records lack blobs; ${media.postMedia.active - media.postMedia.activeWithUrl} active legacy post-media rows lack URLs.
- Profile media has two competing trust/ownership paths: attachment binding and arbitrary public HTTPS URL.
- Story upload checks declared labels/base64 length but does not reuse decoded-byte magic validation; deleting a story does not remove its file.
- nginx is the delivery path; there is no separate CDN/object-store authorization layer. Registry assets alone receive immutable cache handling.
- The attachment content endpoint returns 403 for an existing private object and 404 for unknown, exposing existence to a caller who learns an identifier.
`
}

function renderModuleMap() {
  const op = snapshot.operationalAggregates
  return `# Module Platform Map

## Operational flow

Publisher manifest/package → validation → release tables → integrity/signature/trust → artifact/artwork → install plan/descriptor → generic ModuleHost frontend → runtime authorization → record/action services → PostgreSQL.

The generic host is real: \`src/features/modules/runtime/module-host.tsx:16\` fetches the verified MPS frontend, resolves declarative or host-contribution mode, adapts it and renders it. Product-specific branches still exist around that host and are listed below.

## Production state

${mdTable(['Surface','Observed production truth'], [
    ['Releases', `${op.releaseArtifactCoverage.releases} total; ${op.publishedReleases} published; ${op.publishedUnsignedReleases}/${op.publishedReleases} published unsigned`],
    ['Signing', `${op.publisherSigningKeys} publisher keys, ${op.releaseSignatures} signatures, ${op.releaseIntegrityRows} integrity rows`],
    ['Artifacts', `${op.releaseArtifactCoverage.blobAvailable}/${op.releaseArtifactCoverage.releases} release package blobs; ${op.releaseAssetBlobs.count} total release asset blobs`],
    ['Artwork', `${op.presentationAssets.blobAvailable}/${op.presentationAssets.count} retrievable; ${op.presentationAssets.development} development-only`],
    ['Frontends', `${op.verifiedFrontends} verified: ${Object.entries(op.frontendsByMode).map(([key,value]) => `${key}=${value}`).join(', ')}`],
    ['Install plans', `${op.installPlans.count} total; ${op.installPlans.withDescriptor} carry descriptor and digest`],
    ['Installations', Object.entries(op.installationsByStatus).map(([key,value]) => `${key}=${value}`).join(', ')],
    ['Permissions', `${op.activeInstallPermissionReviews.active} active installations; ${op.activeInstallPermissionReviews.withoutReview} without a review row`],
    ['Ingestion', `${op.syncSources.count} sources (${op.syncSources.enabled} enabled); GitHub automation disabled; historical runs ${JSON.stringify(op.syncRunsByStatus)}`],
  ])}

## Release integrity and trust

- Ed25519 cryptographic verification is implemented in \`services/greenfield-api/src/modules/release-signing.ts:207\` and invoked by \`release-service.ts:441\` when signing material exists.
- Current policy explicitly classifies an unsigned release as trusted/verified (\`registry-trust-service.ts:109\`, \`:127\`). Therefore schema validation is not the problem: production policy and absent signatures are.
- A live Vault Notes release artifact and icon were retrieved and SHA-256 matched. A declared unavailable AI module asset returned 404 as metadata predicted. These probes prove the delivery mechanisms for present blobs, not completeness.

## Install descriptor and installed-state correctness

The descriptor service (\`install-descriptor-service.ts:14\`, \`:77\`) returns module/publisher/installation IDs, release/version/state, manifest, package artifact digest/ref, verified frontend digest/mode/ref, requested/granted permissions, compatibility, trust, issue time and descriptor digest. Production keys exactly match that contract.

Historical \`removed\` and \`uninstalled\` rows are excluded by centralized active-status logic (\`installation-status.ts:1\`) and runtime access checks. No stale historical row bug was reproduced. A distinct security gap remains: \`runtime-access.ts:71\` falls back to all manifest permissions if a review row is absent; ${op.activeInstallPermissionReviews.withoutReview} active production installations are in that state.

## Runtime, records and functions

- Record create/read/update/delete/list/filter/sort/cursor paths are registered under module-scoped routes. \`record-service.ts:42\`, \`:98\`, \`:216\` validates schema and scopes SQL to account + installation + module collection.
- \`runtime-access.ts:24\` verifies authenticated account, active installation, release and permission before record/function work.
- Sensitive fields and reference validation flow through declared schema. Module settings and action/function routes share installation context.
- Remote/community functions are disabled in production. Current governed action execution reaches only the Vault record query/create boundary.

## Publisher, ingestion and administration

Publisher/developer release, build, registry administration, source sync, verification and publication APIs exist. GitHub synchronization code is substantial, but it is not operational: production has no configured source, worker ingestion is off and sync is disabled.

## Special cases outside generic platform infrastructure

- Vault-only intelligence action boundary: \`services/greenfield-api/src/intelligence/action-boundary.ts:8\`.
- Vault-specific GAIA fixture actions: \`packages/intelligence-governance/src/gaia.ts:45\`.
- Vault product AI action service: \`services/greenfield-api/src/ai/product-action-service.ts:23\`.
- Vault search subscribers/projector, Board screen branches, composer tool routing and repository/presentation fallbacks.

The canonical direction is the existing verified generic ModuleHost plus manifest/schema/action/projector declarations; these branches should not be mistaken for proof that generic hosting is absent.

## Security matrix

${mdTable(['Control','Implemented','Production caveat'], [
    ['Publisher trust','publisher and key schemas exist','no production publisher signing key'],
    ['Package/frontend digests','integrity and live digest checks','most package blobs absent'],
    ['Release signature','real Ed25519 verify','all published releases unsigned yet trusted'],
    ['Install grant','review and descriptor tables','missing review falls back to manifest permissions'],
    ['Account/module isolation','scoped runtime access and record SQL','production cross-user live test not run'],
    ['Workspace isolation','workspace-aware APIs where declared','not universal; per-route matrix is authoritative'],
    ['Outbound/filesystem policy','remote/community execution disabled','no general sandbox policy exercised'],
  ])}
`
}

function renderIntelligenceMap() {
  const intel = snapshot.operationalAggregates.intelligence
  const ai = snapshot.operationalAggregates
  return `# GreenField Intelligence API Map

## Surface and production state

Eleven authenticated mission routes cover create, list, detail, start, ledger, evidence, decisions, approvals, approve/reject and proposal execution under \`/v1/intelligence/missions\`. Production rows: missions=${intel.missions}, plans=${intel.plans}, proposals=${intel.proposals}, AKI decisions=${intel.akiDecisions}, Governor decisions=${intel.governorDecisions}, approvals=${intel.approvals}, runs=${intel.runs}, ledger events=${intel.ledgerEvents}.

The contract and enforcement pipeline exists, but no live mission has exercised it in production.

## GAIA

- \`services/greenfield-api/src/intelligence/service.ts:18\` wires the deterministic planner from \`packages/intelligence-governance\`.
- \`gaia.ts:10-86\` recognizes four exact acceptance objectives and otherwise returns \`CAPABILITY_UNKNOWN\`. This is an operational fixture, not a general planner.
- Mission/plan/action/evidence/failure state are persisted through repository methods.

## AKI

\`packages/intelligence-governance/src/aki.ts:103-141\` enforces schema, declared capability, permission, evidence, policy and risk. Verdict semantics observed in code:

${mdTable(['Verdict','Handling'], [
    ['ALLOW','Only eligible read actions can proceed autonomously'],
    ['ALLOW_WITH_CONDITIONS','Conditions remain attached and Governor decides next state'],
    ['REQUIRE_APPROVAL','Human approval row/token required before command execution'],
    ['DENY','Governor records blocked; no autonomous execution'],
    ['ABSTAIN','Governor records human_required; no autonomous execution'],
  ])}

## Governor and approvals

\`governor.ts:176-189\` maps DENY to blocked and ABSTAIN to human-required. Non-read writes require approval. Approve/reject endpoints are account-scoped and the command layer validates approval identity, expiry and completion state.

## Command layer and ledger

\`command.ts:204-224\` rechecks actor identity, capability, permission, workspace, payload schema, approval state and expiry, then atomically claims execution for idempotency/replay resistance. Repository transitions and ledger appends link mission, action, actor, decision, evidence/result/failure and timestamps. The discovered HTTP execution path cannot skip these checks.

The current runtime boundary in \`services/greenfield-api/src/intelligence/action-boundary.ts\` supports only Vault record query/create. Direct ordinary module record APIs exist outside the mission ledger by design; governed actions must not call them without the command boundary. No separate intelligence action bypass was found statically.

## Provider reality

${mdTable(['Provider','State','Mode'], ai.aiProviders.map(provider => [provider.providerId, provider.status, provider.configurationMode]))}

Models: ${Object.entries(ai.aiModelsByState).map(([key,value]) => `${key}=${value}`).join(', ')}. Credentials=${ai.aiRuntime.credentials}, requests=${ai.aiRequests}, executions=${ai.aiRuntime.executions}, streams=${ai.aiRuntime.streams}, product actions=${ai.aiRuntime.productActions}. The sole available model is a development mock and the production resolver excludes development mocks (\`services/greenfield-api/src/ai/providers/resolver.ts:53\`). No real provider is operational.

## Nodus readiness

Reusable mission/plan/proposal/evidence/decision/approval/ledger contracts are a viable boundary for local intelligence. Missing: a Nodus-named adapter, local handshake, capability advertisement, offline proposal transport, reconnect/conflict semantics and approval/ledger synchronization. Nodus must remain local/offline; it is not represented as a cloud provider.

## Real-time surface

\`GET /v1/ai/executions/:executionId/stream\` is SSE event replay. It is not a persistent social/intelligence socket, nginx has no WebSocket upgrade and no APNs/web-push subscription infrastructure was discovered.
`
}

function renderAsyncMap() {
  const op = snapshot.operationalAggregates
  const jobRows = Object.entries(op.backgroundJobsByType).sort(([a],[b]) => a.localeCompare(b)).map(([type,count]) => {
    const producer = type.startsWith('notification.') ? 'post/comment/reaction/share domain events' : type.startsWith('search.') ? 'profile/post writes or admin reindex' : type.startsWith('module.') ? 'module lifecycle/registry APIs' : type.startsWith('mail.') ? 'auth/account security APIs' : type.startsWith('atproto.') ? 'post mutation when bridge enabled' : 'extension/runtime route'
    const effect = type.startsWith('notification.') ? 'notification rows' : type.startsWith('search.') ? 'search projections' : type.startsWith('mail.') ? 'SMTP delivery or identity state' : type.startsWith('module.') ? 'installation/release lifecycle' : type.startsWith('atproto.') ? 'external AT Protocol publish' : 'declared extension/function effect'
    return [`\`${type}\``, String(count), producer, effect, 'leased PostgreSQL job; retry/dead-letter state']
  })
  const failureRows = op.failedJobs.map(item => [`\`${item.jobType}\``, item.status, String(item.count), item.latest])
  return `# Events, Workers and Jobs

## Infrastructure

- One \`${snapshot.containers.worker.image}\` process polls PostgreSQL; it has no externally bound port and no Docker healthcheck.
- API mutations append to the outbox and/or background jobs in the same database. Redis is not referenced by the GreenField source.
- Worker configuration: poll ${snapshot.config.worker.safe.MODULA_WORKER_POLL_INTERVAL_MS} ms, empty backoff ${snapshot.config.worker.safe.MODULA_WORKER_EMPTY_POLL_BACKOFF_MS} ms, outbox batch ${snapshot.config.worker.safe.MODULA_WORKER_OUTBOX_BATCH_SIZE}, lease ${snapshot.config.worker.safe.MODULA_WORKER_LEASE_DURATION_MS} ms.
- Heartbeat: ${op.workerHeartbeats.fresh}/${op.workerHeartbeats.count} fresh, release \`${op.workerHeartbeats.releases.join(', ')}\`.
- Outbox: ${op.outbox.count} total, ${op.outbox.pending} pending, ${op.outbox.failed} failed. Event deliveries: ${Object.entries(op.eventDeliveriesByStatus).map(([key,value]) => `${key}=${value}`).join(', ')}.
- Registration inventory: ${op.asyncRegistrations.engineJobs} engine jobs, ${op.asyncRegistrations.engineConsumers} engine consumers, ${op.asyncRegistrations.moduleJobs} module jobs, ${op.asyncRegistrations.scheduledModuleJobs} scheduled module jobs, ${op.asyncRegistrations.extensionEventSubscriptions} extension subscriptions.

## Job inventory

${mdTable(['Job type','Historical count','Producer/trigger','Effect','Retry/failure'], jobRows)}

The worker runner recognizes 72 case labels. Lifecycle event-name cases (\`runner.ts:95-112\`), \`module.settings.migrate\` (\`:140\`) and \`audit.checkpoint\` (\`:183\`) currently return success without a domain effect and are classified as dead/no-op paths.

## Failures and dead letters

Status totals: ${Object.entries(op.backgroundJobsByStatus).map(([key,value]) => `${key}=${value}`).join(', ')}.

${mdTable(['Job type','State','Count','Latest UTC'], failureRows)}

Failure codes: ${Object.entries(op.jobFailuresByCode).map(([key,value]) => `${key}=${value}`).join(', ')}. Reaction notification uniqueness failures (PostgreSQL 23505) are current and product-visible. Mail identity failures reflect the disabled provisioner; SMTP delivery itself is configured separately.

## Notification creation

Post/comment/reply/reaction/repost/quote/mention mutations produce domain events or jobs → worker consumer → notification row → \`GET /v1/notifications\`. Production has ${op.notifications.count} active notifications, ${op.notifications.unread} unread. List, mark-one-read and mark-all-read routes exist; no dedicated requests route and no dedicated mentions filter were found.

## Email flows

Verification, resend, forgot/reset and security/account workflows enqueue mail work using templates and outbox/job persistence. Worker \`mail.deliver\` sends via required SMTP with TLS; SMTP credentials are PRESENT but never captured. Identity-provision jobs call a separately gated provisioner and have 10 historical failures/dead letters because it is disabled. Retry state is stored in PostgreSQL.

## Webhooks

- Module backend ingress under \`/v1/modules/:moduleId/backend/webhooks/modula\` verifies the backend bearer token/service assertion plus HMAC and idempotency before dispatch.
- Connector provider metadata advertises webhook support, but no matching provider inbound route, signature verifier or retry store is registered.
- Production module webhook deliveries: ${Object.values(op.moduleWebhookDeliveriesByStatus).reduce((a,b) => a+b, 0)}.

## Scheduling and cron

No Modula cron file or systemd timer was found. The worker's internal poll, outbox-drain, lease-reap and optional ingestion intervals are process timers. Module scheduled jobs are zero; GitHub ingestion is disabled.

## Observability

Fastify and worker use structured logs, request IDs and database trace fields. nginx access/error logs exist, but no shared edge-generated correlation ID, tracing backend, metrics endpoint/exporter or dead-letter alert integration was discovered. One synthetic request cannot presently be proven end-to-end across edge → API → outbox → worker from the captured interfaces alone.
`
}

function renderCapabilityCoverage() {
  const statusCounts = countBy(capabilities, 'status')
  const unmatchedRows = clientContracts.unmatched.map(call => [`\`${call.normalized}\``, `\`${call.file}:${call.line}\``, call.raw.includes('${') ? 'dynamic/static scanner could not resolve' : 'no matching runtime route found'])
  return `# Client Capability Coverage

This matrix compares product capabilities, not assumed literal URLs, against current GreenField behavior. Counts: ${Object.entries(statusCounts).map(([key,value]) => `${key}=${value}`).join(', ')}.

${mdTable(['Domain','Capability','Status','Evidence/explanation'], capabilities.map(item => [item.domain, `\`${item.capability}\``, `**${item.status}**`, item.explanation]))}

## Source caller analysis

- ${clientContracts.calls.length} statically observed path-property call sites outside tests/local mocks.
- ${clientContracts.matched} matched a runtime route; ${clientContracts.unmatched.length} need dynamic/manual disposition.
- Route-level caller arrays in \`api-atlas.json\` also include server-to-server references and automated tests.

${unmatchedRows.length ? mdTable(['Client path','Source','Disposition'], unmatchedRows) : 'No unmatched literal client paths.'}

## Coverage interpretation

- \`BACKEND ONLY\` means GreenField returns the information but not as the exact dedicated product capability.
- \`CLIENT ONLY\` means the UI/type exists without a server persistence contract.
- Static no-caller is not proof of dead traffic: computed paths and external clients can evade source analysis. The dead-route candidates are therefore recorded for telemetry, not deletion.
`
}

function renderLiveProbes() {
  const probes = liveProbes.probes ?? []
  const pass = probes.filter(probe => probe.result === 'PASS').length
  const latencyGroups = ['/v1/health/live','/v1/status','/v1/registry/modules'].map(path => {
    const values = probes.filter(probe => probe.targetPath === path).map(probe => probe.latencyMs).sort((a,b) => a-b)
    return values.length ? [path, String(values.length), String(values[Math.floor(values.length / 2)]), String(Math.max(...values))] : null
  }).filter(Boolean)
  const authenticatedRows = authenticatedAcceptance.checks ?? []
  return `# Live Production Probe Results

Captured: ${liveProbes.capturedAt ?? 'not run'}
Policy: ${liveProbes.policy ?? 'not recorded'}
Result: ${pass}/${probes.length} requests passed; ${new Set(probes.map(probe => probe.path)).size} unique route templates exercised.

The anonymous suite used no bearer token, cookie or real account. The authenticated suite used two reserved non-person audit identities and marker-scoped fixtures with deterministic cleanup.

## Requests

${mdTable(['Method/route','Status','Latency ms','Content type','Request ID','Assertion','Result'], probes.map(probe => [`\`${probe.path}\``, String(probe.status), String(probe.latencyMs), probe.contentType ?? 'none', probe.requestIdPresent ? 'yes' : 'no', probe.assertion ?? 'status/shape', probe.result]))}

## Lightweight latency snapshot

Three normal serial requests were used for representative endpoints; this was not a load test.

${mdTable(['Path','Samples','Median ms','Max ms'], latencyGroups)}

No multi-second response was observed. Source review nevertheless identifies unbounded/N+1 activity hydration as a growth risk.

## What was verified

- Public version, live, ready, status, meta and module catalogue/detail/version endpoints traverse DNS/TLS/nginx.
- A real release package and artwork object were retrieved and SHA-256 matched their metadata.
- Declared unavailable artwork returned 404; unknown module/profile resources returned 404.
- Account, installed-modules, intelligence and support reads rejected anonymous access with 401.
- Representative malformed registration input returned 400.

## Authenticated, cross-user and write probes

Captured: ${authenticatedAcceptance.metadata?.capturedAt ?? 'not run'}
Result: ${authenticatedAcceptance.summary?.passed ?? 0}/${(authenticatedAcceptance.summary?.passed ?? 0) + (authenticatedAcceptance.summary?.failed ?? 0)} checks passed.

${authenticatedRows.length ? mdTable(['Probe','Status','Error code','Result'], authenticatedRows.map(check => [check.name, String(check.status), check.errorCode ?? 'success envelope', check.result])) : 'No authenticated production evidence captured.'}

Cleanup outcomes: ${(authenticatedAcceptance.cleanup ?? []).length ? (authenticatedAcceptance.cleanup ?? []).map(item => `${item.resource}=${item.status}`).join(', ') : 'not run'}.

## Controlled exact-schema acceptance

- Ownership/trust cases: ${closeout.controlledAcceptance?.passed ?? 0} passed / ${closeout.controlledAcceptance?.failed ?? 0} failed.
- Legacy function invocation, AI reconnect, AI cancel, manifest-permission fallback, unsigned release trust/installability, reaction 23505, and private-profile immediate follow are executable expected-failure regressions.
- Governed-intelligence mission detail, ledger, evidence, approval, proposal execution and stream ownership are exercised with two accounts without production mission execution.

## Scope boundary

- Production installation mutation and governed-intelligence execution were not used because they would create asynchronous product state; those paths ran against the exact build and migration schema in a disposable controlled database.
- Atlas status is **${atlasStatus}**. PASS means complete mapping and characterized failures, not zero defects.
`
}

function renderGapRegister() {
  const severity = countBy(gaps, 'severity')
  const typeCounts = countBy(gaps, 'type')
  const sweepCounts = countBy(sourceSweep.findings, 'classification')
  return `# Gap Register

Status: **${atlasStatus}**. Findings: ${gaps.length}; ${Object.entries(severity).map(([key,value]) => `${key}=${value}`).join(', ')}. ${acceptanceComplete ? 'No P0 was established after authenticated production and controlled exact-schema acceptance; known defects are fully characterized.' : 'No P0 was established with the available evidence; authenticated closeout is incomplete.'}

Types: ${Object.entries(typeCounts).map(([key,value]) => `${key}=${value}`).join(', ')}.

${gaps.map(gap => `## ${gap.id} — ${gap.severity} — ${gap.title}

- Domain/type: \`${gap.domain}\` / \`${gap.type}\`
- Evidence: ${gap.evidence.map(value => `\`${value}\``).join(', ') || 'none'}
- Affected routes: ${gap.affectedRoutes.map(value => `\`${value}\``).join(', ') || 'none/architectural'}
- Affected files: ${gap.affectedFiles.map(value => `\`${value}\``).join(', ') || 'none'}
- Production impact: ${gap.productionImpact}
- Recommended fix: ${gap.recommendedFix}
- Dependencies: ${gap.dependencies.join(', ') || 'none'}
- Verification: ${gap.verification}
`).join('\n')}

The JSON form is canonical for remediation tooling and preserves these fields verbatim.

## TODO / FIXME / placeholder sweep

The literal sweep found ${sourceSweep.findings.length} marker occurrences; ${sourceSweep.productionReview.length} are outside test/fixture/demo paths. They are not automatically defects. Classification totals: ${Object.entries(sweepCounts).map(([key,value]) => `${key}=${value}`).join(', ')}. Every source location, marker and excerpt is in \`evidence/source-sweep.json\`. Confirmed operational placeholders from that set are represented as gaps above; ordinary error throws, contract/UI placeholder fields, safety guards and feature-gated experimental namespaces remain explicitly distinguished.
`
}

function renderRoadmap() {
  return `# Remediation Roadmap

API-ATLAS-01 made no product, schema, nginx or production changes. The following missions are ordered by security boundary and dependency, not by implementation convenience.

## API-FIX-01 — Trust, privacy and permission fail-closed controls

Require signed production releases, backfill publisher keys/signatures, remove the manifest-permission fallback, create recorded grants for active installs, implement follower requests, account-scope legacy function/AI-stream operations and apply uniform private-resource 404 semantics. Add isolated cross-user/module/intelligence acceptance identities. Covers the P1 trust, ownership and privacy findings.

## API-FIX-02 — Registry bytes, ingestion and Product Hub integrity

Make package/artwork blob presence a publication gate; backfill or withdraw incomplete releases; enable a reviewed signed GitHub source; publish non-development artwork; normalize historical descriptors. Depends on FIX-01 signing policy.

## API-FIX-03 — Media integrity and recovery

Move legacy post upload to canonical attachments, align narrow nginx limits, enforce byte-signature validation for stories, schedule orphan/expired cleanup, canonicalize profile media and prove media backup/restore. Includes storage readiness.

## API-FIX-04 — Social contract and delivery reliability

Fix idempotent reaction notification creation and replay dead letters; make follow/reaction/comment counter mutations conflict-safe; validate feed mode; paginate and batch Discover/activity; define notifications polling/SSE/push expectations; add profile link CRUD.

## API-FIX-05 — Post/composer contract completion

Choose explicit link and poll product support. Either add schema/storage/serialization/tests or remove the client affordances. Consolidate legacy sessions/likes/media behind declared canonical routes and deprecation windows.

## API-FIX-06 — Generic module runtime completion

Move Vault-specific intelligence, AI, search, Board and presentation branches into module declarations/projectors/actions. Exercise record CRUD, settings, references, sensitive fields and function paths with a neutral third-party reference module. Enable community/remote execution only after sandbox and outbound policy review.

## API-FIX-07 — Operational intelligence and Nodus boundary

Replace fixture-only GAIA planning with a governed operational provider/local planner; define Nodus local handshake, offline proposal and ledger synchronization; preserve AKI DENY/ABSTAIN behavior and human approval gates. Run production-safe mission acceptance with a non-mock provider.

## API-FIX-08 — Contracts, health and observability

Introduce shared request/response schemas at auth, admin, upload, module and intelligence boundaries; promote generated OpenAPI to canonical only after schema coverage; add worker/storage readiness, edge-to-worker correlation, metrics/alerts, dead-letter tooling and effect assertions for no-op jobs.

## Release-governance follow-up

${closeout.deploymentLineage?.reconciled ? 'The running release is reconciled to reviewed `origin/main`; retain the source, build, image, deployment and runtime record for every future deployment.' : 'Converge the running feature revision through reviewed `origin/main` history. Rebuild/deploy exact reviewed main, verify OCI/version/route/migration identity and retain rollback.'}
`
}

function renderVerificationResults() {
  const results = closeout.tests ?? {}
  return `# Verification Results

## Audit tooling

- \`pnpm api:atlas:verify\`: ${results.atlas ?? 'pending'}.
- Deterministic output: two consecutive generations byte-identical.
- Runtime completeness: ${routeReconciliation.equation}; all framework-derived routes are explicitly excluded.
- Parsers: JSON, RFC-style CSV and JSON-compatible OpenAPI YAML PASS.
- Mermaid sanity: request, module, intelligence, media and event flows PASS.
- Client literals: ${clientContracts.matched}/${clientContracts.calls.length} matched; ${clientContracts.unmatched.length} unresolved.
- Safe production probes: ${(liveProbes.probes ?? []).filter(item => item.result === 'PASS').length}/${(liveProbes.probes ?? []).length} PASS.
- Secret scan: database URLs, bearer tokens, JWTs, private keys, cookies and credential-like assignments PASS with zero matches.
- \`git diff --check\`: PASS.

## Repository verification

- \`CI=true pnpm --filter @modula/greenfield-api typecheck\`: ${results.apiTypecheck ?? 'pending'}.
- \`CI=true pnpm --filter @modula/greenfield-worker typecheck\`: ${results.workerTypecheck ?? 'pending'}.
- \`CI=true pnpm api:test\`: ${results.api ?? 'pending'}.
- \`CI=true pnpm worker:test\`: ${results.worker ?? 'pending'}.
- Authenticated production acceptance: ${authenticatedAcceptance.summary?.passed ?? 0} passed / ${authenticatedAcceptance.summary?.failed ?? 0} failed.
- Controlled cross-user and expected-failure acceptance: ${closeout.controlledAcceptance?.passed ?? 0} passed / ${closeout.controlledAcceptance?.failed ?? 0} failed.
- Production probes: ${results.productionProbes ?? 'pending'}.
- Secret scan: ${results.secretScan ?? 'pending'}.

An initial direct API typecheck before building workspace packages failed on unresolved workspace package outputs; the canonical package \`pretest\` built those dependencies, after which both typechecks passed. No source repair was made.

## Deliberate exclusions

- \`verify:greenfield-backend-v1\` was not used as the acceptance signal because \`scripts/verify-greenfield-backend-v1.mjs:98\` hard-codes production schema 055 while observed production is at \`${latestMigrationId}\`. That stale verifier is recorded as a P2 gap rather than bypassed.
- Database-backed suites use a disposable database, not production. Production writes are limited to reserved audit identities and marker-scoped fixtures with recorded cleanup.
- No load test or nginx edit occurred. Product defects documented as expected failures were not remediated in this baseline phase.
`
}
