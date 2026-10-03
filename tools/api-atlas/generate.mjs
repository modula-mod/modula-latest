#!/usr/bin/env node
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
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
} from './lib.mjs'

const snapshotPath = join(evidenceDir, 'production-snapshot.json')
if (!existsSync(snapshotPath)) throw new Error(`Missing ${snapshotPath}; run pnpm api:atlas:capture first`)
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'))
const liveProbePath = join(evidenceDir, 'live-probes.json')
const liveProbes = existsSync(liveProbePath) ? JSON.parse(readFileSync(liveProbePath, 'utf8')) : {probes: []}
const runtime = snapshot.runtimeRoutes
const automaticHeadKeys = new Set(runtime.filter(route => route.method === 'GET').map(route => `HEAD ${route.url}`))
const applicationRuntime = runtime.filter(route => route.method !== 'OPTIONS' && !automaticHeadKeys.has(`${route.method} ${route.url}`))
const frameworkRuntime = runtime.filter(route => route.method === 'OPTIONS' || automaticHeadKeys.has(`${route.method} ${route.url}`))

let source = extractSourceRoutes()
source = enrichRouteTables(source)
source = scanSourceUsage(source)
const sourceByKey = new Map(source.map(route => [`${route.method} ${route.path}`, route]))
const runtimeByKey = new Map(applicationRuntime.map(route => [`${route.method} ${route.url}`, route]))
const probeByKey = new Map((liveProbes.probes ?? []).map(probe => [`${probe.method} ${probe.path}`, probe]))
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
const tables = snapshot.databaseSchema.tables.map(table => {
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
  },
  reconciliation: routeReconciliation,
  routes: atlas,
  sourceOnly,
  runtimeOnly: runtimeOnly.map(route => route.id),
  tables,
}

mkdirSync(outputDir, {recursive: true})
write('api-atlas.json', json(output))
write('route-data-map.json', json(routeDataMap))
write('api-atlas.csv', renderCsv(atlas))
write('02-http-api-atlas.md', renderHttpAtlas(atlas, routeReconciliation, sourceOnly, runtimeOnly))
write('03-auth-permissions-matrix.md', renderAuthMatrix(atlas))
write('04-database-api-map.md', renderDatabaseMap(tables, snapshot, migrations))
write('openapi.generated.yaml', json(renderOpenApi(atlas, snapshot)))
write('01-application-boot-map.md', renderBootMap(snapshot))
write('request-flow.mmd', renderRequestFlow())
write('route-data-flow.mmd', renderRouteDataFlow(atlas))
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
  return summary + routes.map(route => `<details>\n<summary><code>${route.id}</code> — ${route.status}</summary>\n\n- Domain: ${route.domain}\n- Method: ${route.method}\n- Effective route: \`${route.effectiveRoute}\`\n- Public URL: \`${route.publicUrl}\`\n- API version: ${route.apiVersion}\n- Source file: ${route.source ? `\`${route.source.file}:${route.source.line}\`` : 'UNMATCHED'}\n- Handler: ${route.handler}\n- Controller/service calls: ${list(route.controllerServices)}\n- Authentication: ${route.authentication}\n- Authorization: ${route.authorization.visibility}\n- Ownership rule: ${route.authorization.ownership.rule}\n- Workspace rule: ${route.authorization.ownership.workspaceScoped ? 'workspace identifier observed; downstream enforcement requires service evidence' : 'none observed'}\n- Capability/permission: ${list([...route.authorization.capabilities, ...route.authorization.serviceOperations])}\n- Rate limit: ${route.rateLimit ? `${route.rateLimit.max} per ${route.rateLimit.timeWindow}` : 'none registered'}\n- Request params: ${list(route.request.params)}\n- Request query: ${list(route.request.query)}\n- Request body: ${list(route.request.body)}\n- Response schema: ${route.response.explicitFastifySchema ? JSON.stringify(route.response.schema) : 'not declared in Fastify'}\n- Success codes: ${list(route.successCodes)}\n- Expected errors: ${list(route.expectedErrors)}\n- Database reads: ${list(route.data.reads)}\n- Database writes: ${list(route.data.writes)}\n- Storage: ${list(route.storage)}\n- Events produced: ${list(route.eventsProduced)}\n- Jobs produced: ${list(route.jobsProduced)}\n- External integrations: ${list(route.externalIntegrations)}\n- Known clients: ${list(route.callers.clients)}\n- Tests: ${list(route.callers.tests)}\n- Runtime registration: yes\n- Live probe: ${route.liveProbe ? `${route.liveProbe.result} (${route.liveProbe.status})` : 'not executed'}\n- Status: ${route.status}\n- Notes: ${route.notes}\n\n</details>\n\n`).join('')
}

function list(values) {
  return values?.length ? values.map(value => `\`${String(value).replaceAll('`', '\\`')}\``).join(', ') : 'none observed'
}

function renderAuthMatrix(routes) {
  return `# Authentication and Permissions Matrix\n\nThis matrix distinguishes transport reachability from application authorization. nginx has a catch-all proxy, so route-level guards are the decisive control for all application paths.\n\n| Method | Route | Anonymous | Session | Verified email | Owner/account scope | Workspace | Capabilities / service operations | Admin | Module install | Module permission | Evidence |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${routes.map(route => `| ${route.method} | \`${route.effectiveRoute}\` | ${yes(route.authorization.anonymousAllowed)} | ${yes(route.authorization.sessionRequired)} | ${yes(route.authorization.verifiedEmailRequired)} | ${yes(route.authorization.ownership.accountScoped || route.authorization.ownership.actorScoped)} | ${yes(route.authorization.ownership.workspaceScoped)} | ${[...route.authorization.capabilities, ...route.authorization.serviceOperations].join(', ') || 'none'} | ${yes(route.authorization.adminRequired)} | ${yes(route.authorization.moduleInstallationRequired)} | ${yes(route.authorization.modulePermissionRequired)} | ${route.source ? `\`${route.source.file}:${route.source.line}\`` : 'unmatched'} |`).join('\n')}\n\n## Interpretation limits\n\n- "Owner/account scope" means the authenticated account or actor identifier is visibly passed into the handler's service path; downstream SQL and service evidence remains authoritative.\n- "Anonymous" includes optional-viewer endpoints. Private, blocked, and muted content still depends on repository visibility predicates.\n- Backend Fabric routes use signed service assertions rather than user bearer sessions.\n`
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
