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

export function apiSourceFingerprint() {
  const root = join(repoRoot, 'services/greenfield-api/src')
  const files = walk(root, path => extname(path) === '.ts')
  const content = files.map(file => `${relative(repoRoot, file)}\0${readFileSync(file)}`).join('\0')
  return sha256(content)
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
    [/^\/v1\/support\b/, 'Support'],
    [/^\/v1\/(extensions|function-jobs|functions|module-host|plugins|product-standard|providers|tools|widgets)\b/, 'Modules'],
    [/^\/v1\/repositories\b/, 'Account'],
    [/^\/v1\/(board)\b/, 'Account'],
    [/^\/v1\/saves\b/, 'Posts'],
    [/\/comments?(?:\/|$)|\/replies(?:\/|$)/, 'Comments'],
    [/\/reactions?(?:\/|$)|\/likes?(?:\/|$)/, 'Reactions'],
    [/\/(?:followers|following|follow|unfollow|relationships?|blocks?|mutes?)(?:\/|$)/, 'Social'],
    [/\/(?:shares?|reposts?|quote)(?:\/|$)/, 'Sharing'],
    [/^\/v1\/profiles?\b/, 'Profile'],
    [/^\/v1\/(follows|relationships|blocks|mutes)\b/, 'Social'],
    [/^\/v1\/(feed|reels)\b/, 'Feed'],
    [/^\/v1\/posts?\b/, 'Posts'],
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
    [/^\/v1\/(health|version|meta|status)\b|^\/version\.json$/, 'Operations'],
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
  const wrappedGreenfield = /\baction\s*\(/.test(handlerText) && /\/(account-data|developers|entitlements|providers|settings-v2|support)\/routes\.ts$/.test(file)
  const adminWrapper = path.startsWith('/v1/admin/') && /(?:releaseAdminAction|publisherAdminAction|\baction)\s*\(/.test(handlerText)
  const internalBuildService = path.startsWith('/v1/internal/build-service/')
  const greenfield = /requireGreenfieldAuth/.test(handlerText) || wrappedGreenfield || adminWrapper
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
  const wrappedAccount = /\baction\s*\(/.test(handlerText) && /\/(account-data|developers|entitlements|providers|settings-v2|support)\/routes\.ts$/.test(file)
  const account = wrappedAccount || /auth\.accountId|auth\.session|accountId\s*===\s*auth|account_id|resolveSearchActorContext/.test(handlerText)
  const actor = /auth\.actorId|actorId\s*===\s*auth|owner_actor_id/.test(handlerText)
  const workspace = /workspaceId|workspace_id/.test(handlerText)
  const resourceId = /request\.params|param\(request/.test(handlerText)
  return {
    rule: auth.adminRequired
          ? 'admin capability is the resource boundary; per-user ownership is not applicable'
          : auth.serviceAssertionRequired || auth.serviceOperations.length
      ? 'service identity, product/release assertion, and declared operation are resolved server-side'
      : account
        ? 'authenticated account id is passed into the service/repository scope'
        : actor
          ? 'authenticated actor id is passed into the service/repository scope'
          : auth.anonymousAllowed
            ? 'public/optional-viewer policy; downstream visibility checks must enforce privacy'
            : /^\/v1\/ai\/(providers|models)$/.test(path)
              ? 'authenticated global catalogue read; no user-owned resource identifier'
              : 'not evident in the route handler; inspect downstream service',
    accountScoped: account,
    actorScoped: actor,
    workspaceScoped: workspace,
    parameterizedResource: resourceId,
    evidenceStrength: account || actor || auth.adminRequired || auth.serviceAssertionRequired || auth.serviceOperations.length
        ? 'route-handler'
        : 'downstream-or-none',
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
  const commonTableExpressions = new Set(
    [...text.matchAll(/(?:\bWITH|,)\s*([a-zA-Z][a-zA-Z0-9_]*)\s+AS\s*\(/gi)].map(match => match[1]),
  )
  const patterns = [
    [/\.(?:selectFrom|innerJoin|leftJoin|rightJoin|fullJoin)\(\s*['"]([a-zA-Z0-9_]+)/g, reads],
    [/\.(?:insertInto|updateTable|deleteFrom)\(\s*['"]([a-zA-Z0-9_]+)/g, writes],
    [/\b(?:FROM|JOIN)\s+([a-zA-Z][a-zA-Z0-9_]*)/gi, reads],
    [/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-zA-Z][a-zA-Z0-9_]*)/gi, writes],
  ]
  for (const [pattern, target] of patterns) {
    for (const match of text.matchAll(pattern)) target.add(match[1])
  }
  for (const match of text.matchAll(/@atlas-reads[ \t]+([a-zA-Z0-9_, \t]+)/g)) {
    for (const table of match[1].trim().split(/[\s,]+/)) if (table) reads.add(table)
  }
  for (const match of text.matchAll(/@atlas-writes[ \t]+([a-zA-Z0-9_, \t]+)/g)) {
    for (const table of match[1].trim().split(/[\s,]+/)) if (table) writes.add(table)
  }
  for (const alias of commonTableExpressions) {
    reads.delete(alias)
    writes.delete(alias)
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
      if (ts.isCallExpression(node) && ts.isElementAccessExpression(node.expression)) {
        const receiver = node.expression.expression.getText(sourceFile)
        const methodExpression = unwrapExpression(node.expression.argumentExpression)
        const path = literal(node.arguments[0], sourceFile)
        const loop = findAncestor(node, ts.isForOfStatement)
        const loopExpression = unwrapExpression(loop?.expression)
        const declaration = loop && ts.isVariableDeclarationList(loop.initializer) ? loop.initializer.declarations[0] : null
        if (/^(app|server|fastify)$/.test(receiver)
          && path
          && methodExpression && ts.isIdentifier(methodExpression)
          && declaration?.name && ts.isArrayBindingPattern(declaration.name)
          && loopExpression && ts.isArrayLiteralExpression(loopExpression)) {
          const names = declaration.name.elements.map(element => element.name.getText(sourceFile))
          const methodIndex = names.indexOf(methodExpression.text)
          if (methodIndex >= 0) {
            for (const tupleNode of loopExpression.elements) {
              const tuple = unwrapExpression(tupleNode)
              if (!tuple || !ts.isArrayLiteralExpression(tuple)) continue
              const method = literal(unwrapExpression(tuple.elements[methodIndex]), sourceFile)
              if (method && ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())) {
                routes.push(sourceRoute({file, sourceFile, node, methods: [method.toUpperCase()], path, handler: node.arguments.at(-1), config: node.arguments.length >= 3 ? node.arguments[1] : null}))
              }
            }
          }
        }
      }
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

export function captureLocalRuntimeRoutes() {
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
  const result = spawnSync(process.execPath, ['--input-type=module'], {
    cwd: repoRoot,
    input: script,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      MODULA_ENVIRONMENT: 'development',
      MODULA_PUBLIC_API_URL: 'http://127.0.0.1:4020',
      MODULA_PUBLIC_WEB_URL: 'http://127.0.0.1:8081',
      MODULA_DATABASE_URL: 'postgresql://candidate-runtime@127.0.0.1:1/candidate-runtime',
      MODULA_ALLOWED_ORIGINS: 'http://127.0.0.1:8081',
      MODULA_RATE_LIMIT_ENABLED: 'false',
    },
  })
  if (result.status !== 0) throw new Error(`candidate runtime capture failed: ${result.stderr}`)
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

function captureSqlJson(container, sql) {
  const shell = `psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$API_ATLAS_SQL"`
  const result = spawnSync('docker', ['exec', '-e', `API_ATLAS_SQL=${sql}`, container, 'sh', '-lc', shell], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  })
  if (result.status !== 0) throw new Error(`database aggregate capture failed: ${result.stderr}`)
  return JSON.parse(result.stdout)
}

export function captureOperationalAggregates(container) {
  const sql = String.raw`
SELECT jsonb_build_object(
  'moduleReleasesByState', COALESCE((SELECT jsonb_object_agg(release_state, n) FROM (SELECT release_state, count(*) n FROM greenfield_module_releases GROUP BY release_state ORDER BY release_state) q), '{}'::jsonb),
  'publishedReleases', (SELECT count(*) FROM greenfield_module_releases WHERE release_state='published'),
  'publishedUnsignedReleases', (SELECT count(*) FROM greenfield_module_releases r WHERE r.release_state='published' AND NOT EXISTS (SELECT 1 FROM greenfield_module_release_signatures s WHERE s.release_id=r.release_id AND s.verification_state='verified' AND s.revoked_at IS NULL)),
  'publisherSigningKeys', (SELECT count(*) FROM greenfield_publisher_signing_keys),
  'releaseSignatures', (SELECT count(*) FROM greenfield_module_release_signatures),
  'releaseIntegrityRows', (SELECT count(*) FROM greenfield_module_release_integrity),
  'releaseArtifactCoverage', (SELECT jsonb_build_object('releases', count(*), 'blobAvailable', count(*) FILTER (WHERE b.sha256 IS NOT NULL)) FROM greenfield_module_releases r LEFT JOIN greenfield_release_asset_blobs b ON b.sha256=r.release_sha256),
  'releaseAssetBlobs', (SELECT jsonb_build_object('count', count(*), 'bytes', COALESCE(sum(byte_size),0)) FROM greenfield_release_asset_blobs),
  'presentationAssets', (SELECT jsonb_build_object('count', count(*), 'blobAvailable', count(*) FILTER (WHERE b.sha256 IS NOT NULL), 'development', count(*) FILTER (WHERE a.development_asset)) FROM greenfield_release_presentation_assets a LEFT JOIN greenfield_release_asset_blobs b ON b.sha256=a.sha256),
  'frontendsByMode', COALESCE((SELECT jsonb_object_agg(frontend_mode, n) FROM (SELECT frontend_mode, count(*) n FROM greenfield_release_frontends GROUP BY frontend_mode ORDER BY frontend_mode) q), '{}'::jsonb),
  'verifiedFrontends', (SELECT count(*) FROM greenfield_release_frontends WHERE verified_at IS NOT NULL),
  'installPlans', (SELECT jsonb_build_object('count', count(*), 'withDescriptor', count(*) FILTER (WHERE install_descriptor IS NOT NULL), 'withDescriptorDigest', count(*) FILTER (WHERE install_descriptor_sha256 IS NOT NULL)) FROM greenfield_module_install_plans),
  'installDescriptorKeys', COALESCE((SELECT jsonb_agg(key ORDER BY key) FROM (SELECT DISTINCT jsonb_object_keys(install_descriptor) key FROM greenfield_module_install_plans WHERE install_descriptor IS NOT NULL) q), '[]'::jsonb),
  'installationsByStatus', COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM greenfield_extension_installations GROUP BY status ORDER BY status) q), '{}'::jsonb),
  'activeInstallPermissionReviews', (SELECT jsonb_build_object(
    'active', count(*),
    'withoutReview', count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM greenfield_module_permission_reviews p WHERE p.installation_id=i.installation_id AND p.release_id=r.release_id)),
    'reviews', (SELECT count(*) FROM greenfield_module_permission_reviews),
    'missingReviews', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'moduleId', missing.module_id,
        'requestedPermissionClasses', missing.requested_permission_classes,
        'requestedPermissions', missing.requested_permissions,
        'reviewRowPresent', false,
        'effectiveAuthorizationSource', 'no recorded grants (fail closed)'
      ) ORDER BY missing.module_id)
      FROM (
        SELECT
          missing_release.module_id,
          COALESCE(jsonb_agg(DISTINCT regexp_replace(permission.permission, '[:.].*$', '') ORDER BY regexp_replace(permission.permission, '[:.].*$', '')) FILTER (WHERE permission.permission IS NOT NULL), '[]'::jsonb) AS requested_permission_classes,
          COALESCE(jsonb_agg(DISTINCT permission.permission ORDER BY permission.permission) FILTER (WHERE permission.permission IS NOT NULL), '[]'::jsonb) AS requested_permissions
        FROM greenfield_extension_installations missing_installation
        JOIN greenfield_module_releases missing_release ON missing_release.extension_version_id=missing_installation.extension_version_id
        LEFT JOIN greenfield_module_permissions permission ON permission.release_id=missing_release.release_id
        WHERE missing_installation.status NOT IN ('removed','uninstalled','notInstalled')
          AND NOT EXISTS (
            SELECT 1
            FROM greenfield_module_permission_reviews review
            WHERE review.installation_id=missing_installation.installation_id
              AND review.release_id=missing_release.release_id
          )
        GROUP BY missing_release.module_id
      ) missing
    ), '[]'::jsonb)
  ) FROM greenfield_extension_installations i JOIN greenfield_module_releases r ON r.extension_version_id=i.extension_version_id WHERE i.status NOT IN ('removed','uninstalled','notInstalled')),
  'syncSources', (SELECT jsonb_build_object('count', count(*), 'enabled', count(*) FILTER (WHERE enabled)) FROM greenfield_module_sync_sources),
  'syncRunsByStatus', COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM greenfield_module_sync_runs GROUP BY status ORDER BY status) q), '{}'::jsonb),
  'aiProvidersByState', COALESCE((SELECT jsonb_object_agg(provider_kind || ':' || status, n) FROM (SELECT provider_kind, status, count(*) n FROM greenfield_ai_providers GROUP BY provider_kind,status ORDER BY provider_kind,status) q), '{}'::jsonb),
  'aiProviders', COALESCE((SELECT jsonb_agg(jsonb_build_object('providerId',provider_id,'kind',provider_kind,'status',status,'configurationMode',configuration_mode) ORDER BY provider_id) FROM greenfield_ai_providers), '[]'::jsonb),
  'aiModelsByState', COALESCE((SELECT jsonb_object_agg(availability || ':' || lifecycle_status || ':enabled=' || enabled::text, n) FROM (SELECT availability,lifecycle_status,enabled,count(*) n FROM greenfield_ai_models GROUP BY availability,lifecycle_status,enabled ORDER BY availability,lifecycle_status,enabled) q), '{}'::jsonb),
  'aiRequests', (SELECT count(*) FROM greenfield_ai_request_ledger),
  'aiRuntime', jsonb_build_object('credentials',(SELECT count(*) FROM ai_provider_credentials),'executions',(SELECT count(*) FROM ai_executions),'streams',(SELECT count(*) FROM ai_stream_sessions),'productActions',(SELECT count(*) FROM ai_product_action_executions)),
  'legacyFunctionRuntime', jsonb_build_object('functions',(SELECT count(*) FROM greenfield_functions),'remoteHttp',(SELECT count(*) FROM greenfield_functions WHERE kind='remoteHttp'),'activeInvokeCapabilityInstallations',(SELECT count(DISTINCT installation_id) FROM greenfield_extension_capabilities WHERE capability='function:invoke' AND revoked_at IS NULL)),
  'intelligence', jsonb_build_object(
    'missions', (SELECT count(*) FROM intelligence_missions),
    'plans', (SELECT count(*) FROM intelligence_plans),
    'proposals', (SELECT count(*) FROM intelligence_proposals),
    'akiDecisions', (SELECT count(*) FROM intelligence_aki_decisions),
    'governorDecisions', (SELECT count(*) FROM intelligence_governor_decisions),
    'approvals', (SELECT count(*) FROM intelligence_approvals),
    'runs', (SELECT count(*) FROM intelligence_runs),
    'ledgerEvents', (SELECT count(*) FROM intelligence_ledger_events)
  ),
  'backgroundJobsByStatus', COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM background_jobs GROUP BY status ORDER BY status) q), '{}'::jsonb),
  'backgroundJobsByType', COALESCE((SELECT jsonb_object_agg(job_type, n) FROM (SELECT job_type, count(*) n FROM background_jobs GROUP BY job_type ORDER BY job_type) q), '{}'::jsonb),
  'failedJobs', COALESCE((SELECT jsonb_agg(jsonb_build_object('jobType',job_type,'status',status,'count',n,'latest',latest) ORDER BY job_type,status) FROM (SELECT job_type,status,count(*) n,max(updated_at) latest FROM background_jobs WHERE status IN ('FAILED','DEAD_LETTER') GROUP BY job_type,status) q), '[]'::jsonb),
  'jobFailuresByCode', COALESCE((SELECT jsonb_object_agg(COALESCE(error_code,'UNCLASSIFIED'), n) FROM (SELECT error_code, count(*) n FROM job_failures GROUP BY error_code ORDER BY error_code) q), '{}'::jsonb),
  'jobFailureDetails', COALESCE((SELECT jsonb_agg(jsonb_build_object('code',COALESCE(error_code,'UNCLASSIFIED'),'count',n,'latest',latest) ORDER BY error_code) FROM (SELECT error_code,count(*) n,max(created_at) latest FROM job_failures GROUP BY error_code) q), '[]'::jsonb),
  'outbox', (SELECT jsonb_build_object('count', count(*), 'pending', count(*) FILTER (WHERE published_at IS NULL), 'failed', count(*) FILTER (WHERE last_error IS NOT NULL)) FROM outbox_events),
  'eventDeliveriesByStatus', COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM greenfield_event_deliveries GROUP BY status ORDER BY status) q), '{}'::jsonb),
  'asyncRegistrations', jsonb_build_object('moduleJobs',(SELECT count(*) FROM greenfield_module_job_registrations),'scheduledModuleJobs',(SELECT count(*) FROM greenfield_module_job_registrations WHERE schedule IS NOT NULL),'extensionEventSubscriptions',(SELECT count(*) FROM greenfield_extension_event_subscriptions),'engineJobs',(SELECT count(*) FROM greenfield_engine_job_registrations),'engineConsumers',(SELECT count(*) FROM greenfield_engine_event_consumer_registrations)),
  'attachmentsByStatus', COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM attachments GROUP BY status ORDER BY status) q), '{}'::jsonb),
  'readyAttachmentLinkage', (SELECT jsonb_build_object('ready', count(*) FILTER (WHERE a.status='ready'), 'linked', count(*) FILTER (WHERE a.status='ready' AND (pm.attachment_id IS NOT NULL OR pcm.attachment_id IS NOT NULL)), 'orphanCandidates', count(*) FILTER (WHERE a.status='ready' AND pm.attachment_id IS NULL AND pcm.attachment_id IS NULL)) FROM attachments a LEFT JOIN profile_media pm ON pm.attachment_id=a.attachment_id LEFT JOIN post_content pcm ON pcm.attachment_id=a.attachment_id),
  'profileMediaByKind', COALESCE((SELECT jsonb_object_agg(kind, n) FROM (SELECT kind, count(*) n FROM profile_media GROUP BY kind ORDER BY kind) q), '{}'::jsonb),
  'postContentByType', COALESCE((SELECT jsonb_object_agg(content_type, n) FROM (SELECT content_type, count(*) n FROM post_content GROUP BY content_type ORDER BY content_type) q), '{}'::jsonb),
  'postMedia', (SELECT jsonb_build_object('count', count(*), 'active', count(*) FILTER (WHERE deleted_at IS NULL), 'activeWithUrl', count(*) FILTER (WHERE deleted_at IS NULL AND url IS NOT NULL)) FROM post_media),
  'storyItems', (SELECT jsonb_build_object('count', count(*), 'active', count(*) FILTER (WHERE deleted_at IS NULL AND status='active'), 'deletedOrInactive', count(*) FILTER (WHERE deleted_at IS NOT NULL OR status<>'active')) FROM greenfield_story_items),
  'workerHeartbeats', (SELECT jsonb_build_object('count', count(*), 'fresh', count(*) FILTER (WHERE last_seen_at > now()-interval '2 minutes'), 'releases', COALESCE(jsonb_agg(DISTINCT release_sha) FILTER (WHERE release_sha IS NOT NULL),'[]'::jsonb)) FROM greenfield_worker_heartbeats),
  'moduleWebhookDeliveriesByStatus', COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM module_backend_webhook_deliveries GROUP BY status ORDER BY status) q), '{}'::jsonb),
  'notifications', (SELECT jsonb_build_object('count', count(*), 'active', count(*) FILTER (WHERE deleted_at IS NULL), 'unread', count(*) FILTER (WHERE deleted_at IS NULL AND read_at IS NULL)) FROM notifications)
);`
  return captureSqlJson(container, sql)
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
  const mediaClasses = Object.fromEntries(readdirSync(mediaRoot, {withFileTypes: true}).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name)).map(entry => {
    const path = join(mediaRoot, entry.name)
    return [entry.name, {files: Number(commandOr('find', [path, '-type', 'f', '-printf', '.'], '').length), bytes: Number(commandOr('du', ['-sb', path], '0').split(/\s+/)[0] || 0)}]
  }))
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
      auditHeadAtCapture: command('git', ['-C', repoRoot, 'rev-parse', 'HEAD']),
      tagsAtCanonicalHead: commandOr('git', ['-C', dirtyCheckout, 'tag', '--points-at', 'HEAD']).split('\n').filter(Boolean),
      describeCanonicalHead: commandOr('git', ['-C', dirtyCheckout, 'describe', '--tags', '--always', '--dirty']),
    },
    versions: {
      hostNode: command('node', ['--version']),
      hostPnpm: command('pnpm', ['--version']),
      hostNpm: command('npm', ['--version']),
      nginx: command('sh', ['-lc', 'nginx -v 2>&1']).replace(/^nginx version:\s*/, ''),
      containerNode: command('docker', ['exec', containers[0], 'node', '--version']),
    },
    containers: {api, worker, database, redis},
    config: {api: captureSanitizedConfig(containers[0]), worker: captureSanitizedConfig(containers[1], true)},
    edge: {
      dns: commandOr('sh', ['-lc', "getent ahosts api.modula.digital | awk '{print $1}' | sort -u"]).split('\n').filter(Boolean),
      tls: commandOr('sh', ['-lc', "printf '' | openssl s_client -servername api.modula.digital -connect api.modula.digital:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates -fingerprint -sha256 2>/dev/null"]).split('\n').filter(Boolean),
    },
    nginx: {path: nginxPath, sha256: sha256(readFileSync(nginxPath)), content: readFileSync(nginxPath, 'utf8')},
    hostProcesses: {
      docker: command('docker', ['ps', '--format', '{{json .}}']).split('\n').filter(Boolean).map(line => JSON.parse(line)),
      relevantSystemdUnits: commandOr('sh', ['-lc', "systemctl list-units --type=service --all --no-legend --plain | grep -Ei 'modula|nginx|docker|postgres|redis' || true"]).split('\n').filter(Boolean),
      timers: commandOr('sh', ['-lc', "systemctl list-timers --all --no-legend --plain | grep -Ei 'modula|greenfield|registry|backup|mail' || true"]).split('\n').filter(Boolean),
      cronFiles: commandOr('find', ['/etc/cron.d', '-maxdepth', '1', '-type', 'f', '-printf', '%f\n']).split('\n').filter(Boolean).sort(),
    },
    redisRuntime: {
      appendonly: commandOr('docker', ['exec', containers[3], 'sh', '-lc', 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning CONFIG GET appendonly']).split('\n')[1] ?? 'UNKNOWN',
      save: commandOr('docker', ['exec', containers[3], 'sh', '-lc', 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning CONFIG GET save']).split('\n')[1] || 'disabled',
      applicationSourceReferences: 0,
    },
    storage: {type: 'host bind mount', root: mediaRoot, mode: (mediaStat.mode & 0o777).toString(8), files: mediaFiles, bytes: mediaBytes, classes: mediaClasses},
    runtimeRoutes: captureRuntimeRoutes(containers[0]),
    databaseSchema: captureDatabaseSchema(containers[2]),
    operationalAggregates: captureOperationalAggregates(containers[2]),
  }
}

export function sanitizeForSecretScan(text) {
  return text
    .replaceAll(/(postgres(?:ql)?:\/\/)[^\s"']+/gi, '$1[REDACTED]')
    .replaceAll(/(Bearer\s+)[A-Za-z0-9._~+\/-]{16,}/gi, '$1[REDACTED]')
}
