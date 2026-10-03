import {execFileSync, spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readdirSync, readFileSync, statSync} from 'node:fs'
import {dirname, extname, join, relative, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import ts from 'typescript'

export const toolDir = dirname(fileURLToPath(import.meta.url))
export const repoRoot = resolve(toolDir, '../..')
export const outputDir = join(repoRoot, 'docs/audits/api-atlas-01')
export const evidenceDir = join(outputDir, 'evidence')

export function walk(root, predicate = () => true) {
  const files = []
  for (const entry of readdirSync(root, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...walk(path, predicate))
    else if (predicate(path)) files.push(path)
  }
  return files.sort()
}

export function command(command, args = [], options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: options.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

export function commandOr(commandName, args = [], fallback = '', options = {}) {
  try {
    return command(commandName, args, options)
  } catch {
    return fallback
  }
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function csvCell(value) {
  const rendered = Array.isArray(value) ? value.join('; ') : value == null ? '' : String(value)
  return `"${rendered.replaceAll('"', '""')}"`
}

export function domainFor(path) {
  const rules = [
    [/^\/v1\/(accounts|sessions|auth)\b/, 'Authentication'],
    [/^\/v1\/account\b/, 'Account'],
    [/^\/v1\/profiles?\b/, 'Profile'],
    [/^\/v1\/(follows|relationships|blocks|mutes)\b/, 'Social'],
    [/^\/v1\/(feed|reels)\b/, 'Feed'],
    [/^\/v1\/posts?\b/, 'Posts'],
    [/^\/v1\/comments?\b/, 'Comments'],
    [/reaction|like/, 'Reactions'],
    [/^\/v1\/(attachments|media|stories)\b/, 'Media'],
    [/^\/v1\/search\b/, 'Search'],
    [/^\/v1\/discover\b/, 'Discover'],
    [/^\/v1\/(activity|notifications)\b/, 'Activity'],
    [/^\/v1\/(registry|marketplace|installations|modules)\b/, 'Modules'],
    [/^\/v1\/backend\b/, 'Module Runtime'],
    [/^\/v1\/(intelligence|ai)\b/, 'Intelligence'],
    [/^\/v1\/(reports|moderation)\b/, 'Moderation'],
    [/^\/v1\/admin\b/, 'Admin'],
    [/^\/v1\/developer\b/, 'Developer'],
    [/^\/v1\/connect/, 'Connectors'],
    [/^\/v1\/atproto\b|^\/oauth\/atproto/, 'AT Protocol'],
    [/^\/v1\/commerce\b/, 'Commerce'],
    [/^\/v1\/(health|version|meta)\b|^\/version\.json$/, 'Operations'],
    [/^\/v1\/internal\b/, 'Internal'],
  ]
  return rules.find(([pattern]) => pattern.test(path))?.[1] ?? 'Platform'
}

function literal(node, sourceFile) {
  if (!node) return null
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text
    for (const span of node.templateSpans) value += `{${span.expression.getText(sourceFile)}}${span.literal.text}`
    return value
  }
  return null
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

function arrayStrings(node, sourceFile) {
  if (!node) return []
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(item => literal(item, sourceFile)).filter(Boolean)
  const value = literal(node, sourceFile)
  return value ? [value] : []
}

function unwrapExpression(node) {
  let current = node
  while (current && (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current) || ts.isParenthesizedExpression(current) || ts.isSatisfiesExpression(current))) current = current.expression
  return current
}

function loopLiteralValues(loop, sourceFile) {
  const expression = unwrapExpression(loop?.expression)
  return expression && ts.isArrayLiteralExpression(expression)
    ? expression.elements.map(item => literal(unwrapExpression(item), sourceFile)).filter(Boolean)
    : []
}

function routeObjectProperty(object, name) {
  return object.properties.find(property =>
    (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && property.name.getText().replaceAll(/["']/g, '') === name,
  )
}

function propertyValue(property) {
  return property && ts.isShorthandPropertyAssignment(property) ? property.name : property?.initializer
}

function routeAuth(handlerText, path, file) {
  const capabilities = [...handlerText.matchAll(/requireCapability\s*\([^,]+,[^,]+,\s*['"]([^'"]+)['"]/g)].map(match => match[1])
  const serviceOperations = [...handlerText.matchAll(/requireAssertionOperation\s*\([^,]+,\s*['"]([^'"]+)['"]/g)].map(match => match[1])
  const admin = path.startsWith('/v1/admin') || capabilities.some(value => value.startsWith('admin:'))
  const backendAssertion = /requireServiceAssertion|verifyAssertion|requireAssertionOperation|serviceRoute\s*\(/.test(handlerText) || path.startsWith('/v1/backend/')
  const signedModuleIngress = /backendEvents\.ingest|backendWebhooks\.receive|signatureHeader\s*\(/.test(handlerText)
  const wrappedGreenfield = /\baction\s*\(/.test(handlerText) && /\/(account-data|developers|entitlements|providers)\/routes\.ts$/.test(file)
  const internalBuildService = path.startsWith('/v1/internal/build-service/')
  const greenfield = /requireGreenfieldAuth/.test(handlerText) || wrappedGreenfield
  const legacy = /requireAuth\s*\(|requireCapability\s*\(/.test(handlerText)
  const moduleInstallation = /runtimeAccess\.resolve|requireInstallation|installationId|assertInstalled/.test(handlerText)
  const modulePermission = /permission|capabilit|requireAssertionOperation/.test(handlerText) && path.includes('/modules/')
  const verifiedEmail = /verified_at|emailVerified|requireVerified/.test(handlerText)
  const serviceAssertion = backendAssertion || signedModuleIngress || internalBuildService
  const optional = !greenfield && !legacy && !serviceAssertion && /request\.auth\?/.test(handlerText)
  const sessionRequired = greenfield || legacy
  return {
    anonymousAllowed: !sessionRequired && !serviceAssertion,
    optionalSession: optional,
    sessionRequired,
    sessionKind: greenfield
      ? 'greenfield bearer access session'
      : legacy
        ? 'legacy or bridged bearer session'
        : signedModuleIngress
          ? 'module backend bearer token plus HMAC signature'
          : internalBuildService
            ? 'build-service id plus request signature'
            : backendAssertion
              ? 'signed service assertion'
              : 'none',
    serviceAssertionRequired: serviceAssertion,
    verifiedEmailRequired: verifiedEmail,
    adminRequired: admin,
    capabilities: [...new Set(capabilities)].sort(),
    serviceOperations: [...new Set(serviceOperations)].sort(),
    moduleInstallationRequired: moduleInstallation,
    modulePermissionRequired: modulePermission,
  }
}

function ownershipFor(handlerText, path, auth, file) {
  const wrappedAccount = /\baction\s*\(/.test(handlerText) && /\/(account-data|developers|entitlements|providers)\/routes\.ts$/.test(file)
  const account = wrappedAccount || /auth\.accountId|accountId\s*===\s*auth|account_id/.test(handlerText)
  const actor = /auth\.actorId|actorId\s*===\s*auth|owner_actor_id/.test(handlerText)
  const workspace = /workspaceId|workspace_id/.test(handlerText)
  const resourceId = /request\.params|param\(request/.test(handlerText)
  return {
    rule: auth.serviceOperations.length
      ? 'service identity, product/release assertion, and declared operation are resolved server-side'
      : account
        ? 'authenticated account id is passed into the service/repository scope'
        : actor
          ? 'authenticated actor id is passed into the service/repository scope'
          : auth.anonymousAllowed
            ? 'public/optional-viewer policy; downstream visibility checks must enforce privacy'
            : 'not evident in the route handler; inspect downstream service',
    accountScoped: account,
    actorScoped: actor,
    workspaceScoped: workspace,
    parameterizedResource: resourceId,
    evidenceStrength: account || actor || auth.serviceOperations.length ? 'route-handler' : 'downstream-or-none',
  }
}

function requestShape(handlerText) {
  const extract = kind => {
    const patterns = {
      params: /request\.params\s+as\s+([^\n;]+)/g,
      query: /request\.query\s+as\s+([^\n;]+)/g,
      body: /request\.body\s+as\s+([^\n;]+)/g,
    }
    return [...handlerText.matchAll(patterns[kind])].map(match => match[1].trim().replace(/\s+/g, ' ')).slice(0, 4)
  }
  return {params: extract('params'), query: extract('query'), body: extract('body')}
}

function operationTables(text) {
  const reads = new Set()
  const writes = new Set()
  const patterns = [
    [/\.(?:selectFrom|innerJoin|leftJoin|rightJoin|fullJoin)\(\s*['"]([a-zA-Z0-9_]+)/g, reads],
    [/\.(?:insertInto|updateTable|deleteFrom)\(\s*['"]([a-zA-Z0-9_]+)/g, writes],
    [/\b(?:FROM|JOIN)\s+([a-zA-Z][a-zA-Z0-9_]*)/gi, reads],
    [/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-zA-Z][a-zA-Z0-9_]*)/gi, writes],
  ]
  for (const [pattern, target] of patterns) {
    for (const match of text.matchAll(pattern)) target.add(match[1])
  }
  return {reads: [...reads].sort(), writes: [...writes].sort()}
}

function servicesFrom(handlerText) {
  return [...new Set([...handlerText.matchAll(/(?:await\s+)?([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*\(/g)]
    .map(match => `${match[1]}.${match[2]}`)
    .filter(value => !/^(reply|request|Object|Array|String|Number|Boolean|JSON|Math|Date|Promise|console)\./.test(value)))].sort()
}

function eventsAndJobs(handlerText) {
  return {
    events: [...new Set([...handlerText.matchAll(/eventType:\s*['"]([^'"]+)['"]/g)].map(match => match[1]))].sort(),
    jobs: [...new Set([...handlerText.matchAll(/job_type:\s*['"]([^'"]+)['"]/g)].map(match => match[1]))].sort(),
  }
}

export function extractSourceRoutes() {
  const root = join(repoRoot, 'services/greenfield-api/src')
  const files = walk(root, path => extname(path) === '.ts')
  const routes = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const visit = node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const receiver = node.expression.expression.getText(sourceFile)
        const methodName = node.expression.name.text.toLowerCase()
        if (/^(app|server|fastify)$/.test(receiver) && ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(methodName)) {
          const path = literal(node.arguments[0], sourceFile)
          if (path) {
            const loop = findAncestor(node, ts.isForOfStatement)
            const declaration = loop && ts.isVariableDeclarationList(loop.initializer) ? loop.initializer.declarations[0] : null
            const loopName = declaration && ts.isIdentifier(declaration.name) ? declaration.name.text : null
            const values = loopLiteralValues(loop, sourceFile)
            if (loopName && values.length && path.includes(`{${loopName}}`)) {
              for (const value of values) routes.push(sourceRoute({file, sourceFile, node, methods: [methodName.toUpperCase()], path: path.replaceAll(`{${loopName}}`, value), handler: node.arguments.at(-1), config: node.arguments.length >= 3 ? node.arguments[1] : null}))
            } else {
              routes.push(sourceRoute({file, sourceFile, node, methods: [methodName.toUpperCase()], path, handler: node.arguments.at(-1), config: node.arguments.length >= 3 ? node.arguments[1] : null}))
            }
          }
        }
        if (/^(app|server|fastify)$/.test(receiver) && methodName === 'route' && ts.isObjectLiteralExpression(node.arguments[0])) {
          const object = node.arguments[0]
          const methodProp = routeObjectProperty(object, 'method')
          const pathProp = routeObjectProperty(object, 'url') ?? routeObjectProperty(object, 'path')
          const handlerProp = routeObjectProperty(object, 'handler')
          let expanded = false
          const loop = findAncestor(node, ts.isForOfStatement)
          const loopExpression = unwrapExpression(loop?.expression)
          if (loop && loopExpression && ts.isArrayLiteralExpression(loopExpression) && ts.isVariableDeclarationList(loop.initializer)) {
            const declaration = loop.initializer.declarations[0]
            if (declaration && ts.isArrayBindingPattern(declaration.name)) {
              const names = declaration.name.elements.map(element => element.name.getText(sourceFile))
              const methodValue = propertyValue(methodProp)
              const pathValue = propertyValue(pathProp)
              const methodIndex = methodValue && ts.isIdentifier(methodValue) ? names.indexOf(methodValue.text) : -1
              const pathIndex = pathValue && ts.isIdentifier(pathValue) ? names.indexOf(pathValue.text) : -1
              if (methodIndex >= 0 && pathIndex >= 0) {
                for (const tupleNode of loopExpression.elements) {
                  const tuple = unwrapExpression(tupleNode)
                  if (!tuple || !ts.isArrayLiteralExpression(tuple)) continue
                  const method = literal(unwrapExpression(tuple.elements[methodIndex]), sourceFile)
                  const path = literal(unwrapExpression(tuple.elements[pathIndex]), sourceFile)
                  if (method && path) routes.push(sourceRoute({file, sourceFile, node, methods: [method.toUpperCase()], path, handler: propertyValue(handlerProp), config: object}))
                }
                expanded = true
              }
            }
          }
          if (!expanded) {
            const methods = methodProp ? arrayStrings(propertyValue(methodProp), sourceFile).map(value => value.toUpperCase()) : []
            const path = pathProp ? literal(propertyValue(pathProp), sourceFile) : null
            if (methods.length && path) routes.push(sourceRoute({file, sourceFile, node, methods, path, handler: propertyValue(handlerProp), config: object}))
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return routes.flatMap(route => route.methods.map(method => ({...route, method, methods: undefined})))
}

function findAncestor(node, predicate) {
  let current = node.parent
  while (current) {
    if (predicate(current)) return current
    current = current.parent
  }
  return null
}

function sourceRoute({file, sourceFile, node, methods, path, handler, config}) {
  const handlerText = handler?.getText(sourceFile) ?? ''
  const relativeFile = relative(repoRoot, file)
  const auth = routeAuth(handlerText, path, relativeFile)
  const tables = operationTables(handlerText)
  const asyncEffects = eventsAndJobs(handlerText)
  return {
    methods,
    path,
    file: relativeFile,
    line: lineOf(sourceFile, node),
    handler: handler && ts.isIdentifier(handler) ? handler.text : 'inline',
    handlerText,
    configExpression: config?.getText(sourceFile).slice(0, 300) ?? null,
    auth,
    ownership: ownershipFor(handlerText, path, auth, relativeFile),
    requestShape: requestShape(handlerText),
    directTables: tables,
    serviceCalls: servicesFrom(handlerText),
    events: asyncEffects.events,
    jobs: asyncEffects.jobs,
    successCodes: [...new Set([...handlerText.matchAll(/reply\.code\(\s*(\d{3})\s*\)/g)].map(match => Number(match[1])))].sort(),
    hasIdempotency: /idempotency/i.test(handlerText),
    hasManualValidation: /VALIDATION_FAILED|requiredString|parse[A-Z]|safeParse|validate|assert[A-Z]/.test(handlerText),
  }
}

export function scanSourceUsage(routes) {
  const allFiles = walk(repoRoot, path => ['.ts', '.tsx', '.js', '.mjs'].includes(extname(path)))
  const routeFiles = new Set(routes.map(route => route.file))
  const cache = new Map(allFiles.map(file => [file, readFileSync(file, 'utf8')]))
  return routes.map(route => {
    const staticPrefix = route.path.split('/:')[0]
    const leaf = route.path.split('/').filter(Boolean).at(-1)?.replace(/^:/, '') ?? ''
    const matches = []
    for (const [file, text] of cache) {
      const rel = relative(repoRoot, file)
      if (routeFiles.has(rel)) continue
      if (!text.includes(staticPrefix)) continue
      if (route.path.includes('/:') && leaf && !text.includes(leaf) && !text.includes(staticPrefix)) continue
      matches.push(rel)
    }
    const tests = matches.filter(file => /(^|\/)(tests?|__tests__|scripts\/verify)/.test(file))
    const clients = matches.filter(file => file.startsWith('src/'))
    const server = matches.filter(file => file.startsWith('services/') && !/(^|\/)tests?\//.test(file))
    return {...route, callers: {clients, server, tests}, hasAutomatedTest: tests.length > 0, hasKnownCaller: clients.length + server.length > 0}
  })
}

export function scanAllTableUsage() {
  const roots = ['services/greenfield-api/src', 'services/greenfield-worker/src']
  const result = new Map()
  for (const root of roots) {
    for (const file of walk(join(repoRoot, root), path => extname(path) === '.ts')) {
      const rel = relative(repoRoot, file)
      const operations = operationTables(readFileSync(file, 'utf8'))
      for (const table of operations.reads) {
        const entry = result.get(table) ?? {reads: [], writes: []}
        entry.reads.push(rel)
        result.set(table, entry)
      }
      for (const table of operations.writes) {
        const entry = result.get(table) ?? {reads: [], writes: []}
        entry.writes.push(rel)
        result.set(table, entry)
      }
    }
  }
  return Object.fromEntries([...result.entries()].sort().map(([table, usage]) => [table, {reads: [...new Set(usage.reads)].sort(), writes: [...new Set(usage.writes)].sort()}]))
}

export function enrichRouteTables(routes) {
  const root = join(repoRoot, 'services/greenfield-api/src')
  const files = walk(root, path => extname(path) === '.ts')
  const classMethods = new Map()
  const fileVariableClasses = new Map()
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const variableClasses = new Map()
    const visit = node => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isNewExpression(node.initializer)) {
        const className = node.initializer.expression.getText(sourceFile)
        variableClasses.set(node.name.text, className)
      }
      if (ts.isClassDeclaration(node) && node.name) {
        for (const member of node.members) {
          if (!ts.isMethodDeclaration(member) || !member.body) continue
          const name = member.name.getText(sourceFile).replaceAll(/["']/g, '')
          classMethods.set(`${node.name.text}.${name}`, {
            className: node.name.text,
            method: name,
            file: relative(repoRoot, file),
            text: member.body.getText(sourceFile),
          })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    fileVariableClasses.set(relative(repoRoot, file), variableClasses)
  }

  const allClasses = [...new Set([...classMethods.values()].map(value => value.className))]
  const normalize = value => value.toLowerCase().replaceAll(/greenfield|module|service|repository|runtime|provider/g, '')
  const resolveClass = (file, variable) => {
    const direct = fileVariableClasses.get(file)?.get(variable)
    if (direct) return direct
    const wanted = normalize(variable)
    const candidates = allClasses.filter(name => {
      const candidate = normalize(name)
      return candidate === wanted || candidate.startsWith(wanted) || candidate.endsWith(wanted)
    })
    return candidates.length === 1 ? candidates[0] : null
  }
  const methodTables = (className, method, seen = new Set()) => {
    const key = `${className}.${method}`
    if (seen.has(key)) return {reads: [], writes: [], evidence: []}
    seen.add(key)
    const entry = classMethods.get(key)
    if (!entry) return {reads: [], writes: [], evidence: []}
    const direct = operationTables(entry.text)
    const reads = new Set(direct.reads)
    const writes = new Set(direct.writes)
    const evidence = new Set([`${entry.file}#${entry.method}`])
    for (const match of entry.text.matchAll(/this\.([A-Za-z_$][\w$]*)\s*\(/g)) {
      const nested = methodTables(className, match[1], seen)
      nested.reads.forEach(table => reads.add(table))
      nested.writes.forEach(table => writes.add(table))
      nested.evidence.forEach(item => evidence.add(item))
    }
    return {reads: [...reads].sort(), writes: [...writes].sort(), evidence: [...evidence].sort()}
  }

  return routes.map(route => {
    const reads = new Set(route.directTables.reads)
    const writes = new Set(route.directTables.writes)
    const evidence = new Set()
    let resolvedCalls = 0
    for (const call of route.serviceCalls) {
      const [variable, method] = call.split('.')
      const className = resolveClass(route.file, variable)
      if (!className) continue
      const tables = methodTables(className, method)
      if (!tables.evidence.length) continue
      resolvedCalls += 1
      tables.reads.forEach(table => reads.add(table))
      tables.writes.forEach(table => writes.add(table))
      tables.evidence.forEach(item => evidence.add(item))
    }
    return {
      ...route,
      data: {
        reads: [...reads].sort(),
        writes: [...writes].sort(),
        evidence: [...evidence].sort(),
        confidence: route.serviceCalls.length === 0 || resolvedCalls === route.serviceCalls.length ? 'method-level-static' : resolvedCalls > 0 ? 'partial-static' : reads.size + writes.size > 0 ? 'direct-handler-only' : 'unresolved',
      },
    }
  })
}

export function migrationIntroductions() {
  const dir = join(repoRoot, 'services/greenfield-api/migrations')
  const files = readdirSync(dir).filter(name => /^\d{3}_.+\.sql$/.test(name) && !name.endsWith('.down.sql')).sort()
  const introduced = {}
  for (const name of files) {
    const text = readFileSync(join(dir, name), 'utf8')
    for (const match of text.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-zA-Z][a-zA-Z0-9_]*)"?/gi)) {
      introduced[match[1]] ??= name
    }
  }
  return {files, introduced}
}

export function captureRuntimeRoutes(container) {
  const script = String.raw`
import Fastify from './services/greenfield-api/node_modules/fastify/fastify.js'
import {loadConfig} from './services/greenfield-api/dist/config/index.js'
import {createDb} from './services/greenfield-api/dist/database/client.js'
import {registerPlugins} from './services/greenfield-api/dist/app/register-plugins.js'
import {registerRoutes} from './services/greenfield-api/dist/app/register-routes.js'
const config=loadConfig()
const app=Fastify({logger:false,trustProxy:config.trustProxy,bodyLimit:config.requestBodyLimitBytes,genReqId:()=>''})
const routes=[]
app.addHook('onRoute',o=>routes.push({method:o.method,url:o.url,path:o.path,prefix:o.prefix??'',schema:o.schema??null,config:o.config??null,handler:o.handler?.name??null}))
const db=createDb(config.databaseUrl)
await registerPlugins(app,config)
await registerRoutes(app,db,config)
await app.ready()
console.log(JSON.stringify(routes))
await app.close()
await db.destroy()
`
  const result = spawnSync('docker', ['exec', '-i', container, 'node', '--input-type=module'], {
    input: script,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  })
  if (result.status !== 0) throw new Error(`runtime capture failed: ${result.stderr}`)
  return JSON.parse(result.stdout)
}

export function captureDatabaseSchema(container) {
  const sql = String.raw`
SELECT jsonb_build_object(
  'serverVersion', current_setting('server_version'),
  'database', current_database(),
  'appliedMigrations', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'appliedAt', applied_at) ORDER BY id) FROM public.schema_migrations), '[]'::jsonb),
  'tables', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', t.table_name,
      'columns', (SELECT jsonb_agg(jsonb_build_object('name', c.column_name, 'type', c.data_type, 'nullable', c.is_nullable = 'YES', 'default', c.column_default) ORDER BY c.ordinal_position) FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.table_name),
      'primaryKey', COALESCE((SELECT jsonb_agg(kcu.column_name ORDER BY kcu.ordinal_position) FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema AND kcu.table_name=tc.table_name WHERE tc.table_schema='public' AND tc.table_name=t.table_name AND tc.constraint_type='PRIMARY KEY'), '[]'::jsonb),
      'foreignKeys', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', tc.constraint_name, 'column', kcu.column_name, 'referencesTable', ccu.table_name, 'referencesColumn', ccu.column_name) ORDER BY tc.constraint_name, kcu.ordinal_position) FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema WHERE tc.table_schema='public' AND tc.table_name=t.table_name AND tc.constraint_type='FOREIGN KEY'), '[]'::jsonb),
      'uniqueConstraints', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', q.constraint_name, 'columns', q.columns) ORDER BY q.constraint_name) FROM (SELECT tc.constraint_name, jsonb_agg(kcu.column_name ORDER BY kcu.ordinal_position) columns FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema AND kcu.table_name=tc.table_name WHERE tc.table_schema='public' AND tc.table_name=t.table_name AND tc.constraint_type='UNIQUE' GROUP BY tc.constraint_name) q), '[]'::jsonb),
      'indexes', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', indexname, 'definition', indexdef) ORDER BY indexname) FROM pg_indexes i WHERE i.schemaname='public' AND i.tablename=t.table_name), '[]'::jsonb)
    ) ORDER BY t.table_name)
    FROM information_schema.tables t WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
  ), '[]'::jsonb)
);`
  const shell = `psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$API_ATLAS_SQL"`
  const result = spawnSync('docker', ['exec', '-e', `API_ATLAS_SQL=${sql}`, container, 'sh', '-lc', shell], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  })
  if (result.status !== 0) throw new Error(`database schema capture failed: ${result.stderr}`)
  return JSON.parse(result.stdout)
}

export function captureContainer(container) {
  const raw = JSON.parse(command('docker', ['inspect', container]))[0]
  return {
    name: raw.Name.replace(/^\//, ''),
    imageId: raw.Image,
    image: raw.Config.Image,
    created: raw.Created,
    startedAt: raw.State.StartedAt,
    status: raw.State.Status,
    health: raw.State.Health?.Status ?? null,
    restartCount: raw.RestartCount,
    command: [raw.Path, ...(raw.Args ?? [])].join(' '),
    workingDir: raw.Config.WorkingDir,
    revision: raw.Config.Labels?.['org.opencontainers.image.revision'] ?? null,
    source: raw.Config.Labels?.['org.opencontainers.image.source'] ?? null,
    composeFile: raw.Config.Labels?.['com.docker.compose.project.config_files'] ?? null,
    ports: raw.NetworkSettings.Ports,
    mounts: (raw.Mounts ?? []).map(mount => ({type: mount.Type, source: mount.Source, destination: mount.Destination, readWrite: mount.RW})),
    environmentKeys: (raw.Config.Env ?? []).map(item => item.split('=')[0]).sort(),
  }
}

export function captureSanitizedConfig(container, worker = false) {
  const safe = worker
    ? ['NODE_ENV','MODULA_ENVIRONMENT','MODULA_MAIL_TRANSPORT','MODULA_MAIL_REQUIRED','MODULA_SMTP_PORT','MODULA_SMTP_SECURE','MODULA_SMTP_REQUIRE_TLS','MODULA_SMTP_TLS_REJECT_UNAUTHORIZED','MODULA_WORKER_INGEST_ENABLED','MODULA_WORKER_INGEST_INTERVAL_MS','MODULA_WORKER_POLL_INTERVAL_MS','MODULA_WORKER_EMPTY_POLL_BACKOFF_MS','MODULA_WORKER_OUTBOX_BATCH_SIZE','MODULA_WORKER_OUTBOX_DRAIN_INTERVAL_MS','MODULA_WORKER_LEASE_DURATION_MS','MODULA_WORKER_LEASE_REAP_INTERVAL_MS','GREENFIELD_MODULE_GITHUB_SYNC_ENABLED','GREENFIELD_MODULE_REMOTE_FUNCTIONS_ENABLED','GREENFIELD_MODULE_COMMUNITY_EXECUTION_ENABLED','MODULA_RELEASE_SHA']
    : ['NODE_ENV','MODULA_ENVIRONMENT','MODULA_API_HOST','MODULA_API_PORT','MODULA_PUBLIC_API_URL','MODULA_PUBLIC_WEB_URL','MODULA_MEDIA_ROOT','MODULA_MEDIA_UPLOAD_MAX_BYTES','MODULA_REQUEST_BODY_LIMIT_BYTES','MODULA_RATE_LIMIT_ENABLED','MODULA_TRUST_PROXY','MODULA_PRODUCTION_WRITES_ENABLED','MODULA_PREVIEW_WRITES_ENABLED','MODULA_INVITE_ONLY','MODULA_REGISTRATION_MODE','MODULA_MINIMUM_CLIENT_VERSION','MODULA_API_DOCUMENTATION_ENABLED','MODULA_ATPROTO_ENABLED','MODULA_PDS_PILOT_ENABLED','GREENFIELD_MODULE_REGISTRY_ENABLED','GREENFIELD_MODULE_INSTALLATION_ENABLED','GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED','GREENFIELD_MODULE_FIRST_PARTY_EXECUTION_ENABLED','GREENFIELD_MODULE_REMOTE_FUNCTIONS_ENABLED','GREENFIELD_MODULE_COMMUNITY_EXECUTION_ENABLED','GREENFIELD_MODULE_GITHUB_SYNC_ENABLED','GREENFIELD_VAULT_NOTES_REFERENCE_ENABLED','GREENFIELD_DIMON_ENABLED','GREENFIELD_AI_GATEWAY_ENABLED','BACKEND_FABRIC_ENABLED','BACKEND_FABRIC_ENVIRONMENT','BACKEND_FABRIC_CONTRACT_VERSION','MODULA_RELEASE_SHA','MODULA_WORKER_RELEASE_SHA','MODULA_RELEASE_BUILT_AT']
  const secret = worker
    ? ['MODULA_DATABASE_URL','MODULA_SMTP_PASSWORD','MODULA_SMTP_USER','MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY','BACKEND_FABRIC_SIGNING_PRIVATE_KEY']
    : ['MODULA_DATABASE_URL','MODULA_DATABASE_MIGRATOR_URL','MODULA_BACKUP_DATABASE_URL','MODULA_SESSION_PEPPER','MODULA_AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY','MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY','MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY','BACKEND_FABRIC_SIGNING_PRIVATE_KEY','MODULA_CHECKPOINT_SIGNING_KEY']
  const program = `const s=${JSON.stringify(safe)},x=${JSON.stringify(secret)};console.log(JSON.stringify({safe:Object.fromEntries(s.map(k=>[k,process.env[k]??'MISSING'])),secrets:Object.fromEntries(x.map(k=>[k,process.env[k]?'PRESENT':'MISSING']))}))`
  return JSON.parse(command('docker', ['exec', container, 'node', '-e', program]))
}

export function captureHostSnapshot() {
  const dirtyCheckout = '/root/modula-latest'
  const containers = ['modula-production-greenfield-api-1', 'modula-production-greenfield-worker-1', 'modula-production-greenfield-postgres-1', 'modula-production-greenfield-redis-1']
  const api = captureContainer(containers[0])
  const worker = captureContainer(containers[1])
  const database = captureContainer(containers[2])
  const redis = captureContainer(containers[3])
  const nginxPath = '/etc/nginx/conf.d/api.modula.digital.greenfield.conf'
  const mediaRoot = '/var/lib/modula/greenfield-media'
  const mediaStat = statSync(mediaRoot)
  const mediaFiles = Number(commandOr('find', [mediaRoot, '-type', 'f', '-printf', '.'], '').length)
  const mediaBytes = Number(commandOr('du', ['-sb', mediaRoot], '0').split(/\s+/)[0] || 0)
  return {
    capturedAt: new Date().toISOString(),
    hostname: command('hostname', ['--fqdn']),
    os: command('sh', ['-lc', '. /etc/os-release; printf "%s" "$PRETTY_NAME"']),
    kernel: command('uname', ['-sr']),
    architecture: command('uname', ['-m']),
    uptime: command('uptime', ['-p']),
    repository: {
      canonicalPath: dirtyCheckout,
      origin: command('git', ['-C', dirtyCheckout, 'remote', 'get-url', 'origin']),
      branch: command('git', ['-C', dirtyCheckout, 'branch', '--show-current']),
      head: command('git', ['-C', dirtyCheckout, 'rev-parse', 'HEAD']),
      status: command('git', ['-C', dirtyCheckout, 'status', '--short', '--branch']),
      trackedChanges: commandOr('git', ['-C', dirtyCheckout, 'diff', '--name-status']),
      untrackedFiles: commandOr('git', ['-C', dirtyCheckout, 'ls-files', '--others', '--exclude-standard']),
      originMain: command('git', ['-C', repoRoot, 'rev-parse', 'origin/main']),
      auditPath: repoRoot,
      auditBranch: command('git', ['-C', repoRoot, 'branch', '--show-current']),
      auditStartSha: command('git', ['-C', repoRoot, 'rev-parse', 'HEAD']),
    },
    versions: {
      hostNode: command('node', ['--version']),
      hostPnpm: command('pnpm', ['--version']),
      hostNpm: command('npm', ['--version']),
      nginx: command('nginx', ['-v']).replace(/^nginx version:\s*/, ''),
      containerNode: command('docker', ['exec', containers[0], 'node', '--version']),
    },
    containers: {api, worker, database, redis},
    config: {api: captureSanitizedConfig(containers[0]), worker: captureSanitizedConfig(containers[1], true)},
    nginx: {path: nginxPath, sha256: sha256(readFileSync(nginxPath)), content: readFileSync(nginxPath, 'utf8')},
    storage: {type: 'host bind mount', root: mediaRoot, mode: (mediaStat.mode & 0o777).toString(8), files: mediaFiles, bytes: mediaBytes},
    runtimeRoutes: captureRuntimeRoutes(containers[0]),
    databaseSchema: captureDatabaseSchema(containers[2]),
  }
}

export function sanitizeForSecretScan(text) {
  return text
    .replaceAll(/(postgres(?:ql)?:\/\/)[^\s"']+/gi, '$1[REDACTED]')
    .replaceAll(/(Bearer\s+)[A-Za-z0-9._~+\/-]+/gi, '$1[REDACTED]')
}
