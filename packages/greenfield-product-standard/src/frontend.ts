import {createHash} from 'node:crypto'
import {ingestError, type IngestDiagnostic} from './diagnostics.js'

const COMPONENTS = new Set([
  'section', 'text', 'label', 'metadata', 'badge', 'image', 'icon', 'divider', 'stack', 'row', 'grid', 'scroll',
  'recordList', 'recordRow', 'field', 'button', 'menu', 'search', 'filter', 'sort', 'tabs', 'picker', 'toolbar',
  'emptyState', 'errorState', 'loadingState', 'media', 'progress',
])
const ACTIONS = new Set([
  'route.open', 'record.create', 'record.read', 'record.update', 'record.delete', 'record.query', 'function.invoke',
  'service.invoke', 'extension.invoke', 'capability.invoke', 'settings.update', 'share', 'dismiss',
])
const VIEW_KINDS = new Set(['collection', 'detail', 'form', 'dashboard', 'settings', 'emptyState'])
const DATA_SOURCES = new Set(['record.query', 'record.detail', 'settings', 'installation', 'capability', 'job'])
const FORBIDDEN_FIELDS = new Set([
  'script', 'rawjs', 'rawhtml', 'html', 'jsx', 'tsx', 'css', 'style', 'remotebundle', 'remoteentry',
  'customcomponentname', 'webview', 'unsafewebview', 'networkurl', 'eval',
])
const CAPABILITY_PATTERN = /^(ui|audio|camera|media|file|share|map|game)\.[a-z][A-Za-z0-9.-]*@[1-9][0-9]*$/
const ROUTE_PATTERN = /^\/$|^\/(?:[a-z0-9-]+|:[a-z][a-zA-Z0-9]*)(?:\/(?:[a-z0-9-]+|:[a-z][a-zA-Z0-9]*))*\/?$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const SAFE_PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/

export type MpsFrontendArtifactMetadata = {
  path: string
  mediaType: 'application/vnd.modula.frontend+json'
  sha256: string
  schemaVersion: string
  entryView?: string
}

export type MpsFrontendArtifact = {
  schema: 'modula.frontend.1.0'
  frontendSchemaVersion: '1.0.0'
  mpsVersion: '1.0-RC' | '1.0'
  productId: string
  releaseVersion: string
  mode: 'declarative' | 'host-contribution'
  entry?: string
  hostRuntime: {versionRange: string}
  routes?: Array<{path: string; viewId?: string; redirectTo?: string; presentation?: string}>
  views?: Array<Record<string, unknown> & {id: string; kind: string; title: unknown; root: Record<string, unknown>}>
  navigation?: Record<string, unknown>
  actions?: Array<Record<string, unknown> & {id: string; family: string; label: unknown}>
  contributions?: Array<Record<string, unknown> & {id: string; target: string}>
  resources?: Array<{id: string; path: string; mediaType: string; sha256: string; alt?: unknown}>
  settings?: {viewId: string}
  capabilities?: {required?: string[]; optional?: string[]}
  platformRequirements?: Record<string, unknown>
  accessibility: Record<string, unknown>
}

export type MpsFrontendValidation = {
  ok: boolean
  artifact?: MpsFrontendArtifact
  sha256: string
  diagnostics: IngestDiagnostic[]
}

export function validateMpsFrontendArtifact(input: {
  bytes: string | Buffer
  metadata: MpsFrontendArtifactMetadata
  productId: string
  version: string
  mode: 'declarative' | 'host-contribution'
}): MpsFrontendValidation {
  const diagnostics: IngestDiagnostic[] = []
  const bytes = typeof input.bytes === 'string' ? Buffer.from(input.bytes) : input.bytes
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (bytes.byteLength > 1_048_576) diagnostics.push(error('MPS-FRONTEND-101', '', 'Frontend artifact exceeds the 1 MiB MPS limit.'))
  if (sha256 !== input.metadata.sha256) diagnostics.push(error('MPS-FRONTEND-013', 'sha256', 'Frontend artifact hash does not match release metadata.'))
  if (!SAFE_PATH_PATTERN.test(input.metadata.path)) diagnostics.push(error('MPS-FRONTEND-011', 'path', 'Frontend artifact path is unsafe.'))
  if (input.metadata.mediaType !== 'application/vnd.modula.frontend+json') diagnostics.push(error('MPS-FRONTEND-012', 'mediaType', 'Frontend artifact media type is unsupported.'))
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf8'))
  } catch (cause) {
    diagnostics.push(error('MPS-FRONTEND-100', '', `Frontend artifact is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`))
    return {ok: false, sha256, diagnostics}
  }
  inspectForbiddenFields(parsed, '', diagnostics)
  if (!isRecord(parsed)) {
    diagnostics.push(error('MPS-FRONTEND-100', '', 'Frontend artifact root must be an object.'))
    return {ok: false, sha256, diagnostics}
  }
  const artifact = parsed as unknown as MpsFrontendArtifact
  const allowedRoot = new Set(['$schema', 'schema', 'frontendSchemaVersion', 'mpsVersion', 'productId', 'releaseVersion', 'mode', 'entry', 'hostRuntime', 'routes', 'views', 'navigation', 'actions', 'contributions', 'resources', 'settings', 'capabilities', 'platformRequirements', 'accessibility'])
  for (const key of Object.keys(parsed)) if (!allowedRoot.has(key)) diagnostics.push(error('MPS-FRONTEND-100', key, `Unknown frontend artifact field ${key}.`))
  if (artifact.schema !== 'modula.frontend.1.0' || artifact.frontendSchemaVersion !== '1.0.0') diagnostics.push(error('MPS-FRONTEND-100', 'frontendSchemaVersion', 'Unsupported frontend schema version.'))
  if (artifact.mpsVersion !== '1.0-RC' && artifact.mpsVersion !== '1.0') diagnostics.push(error('MPS-FRONTEND-100', 'mpsVersion', 'Unsupported MPS version.'))
  if (artifact.productId !== input.productId || artifact.releaseVersion !== input.version) diagnostics.push(error('MPS-FRONTEND-014', 'identity', 'Frontend artifact identity does not match the product release.'))
  if (artifact.mode !== input.mode) diagnostics.push(error('MPS-FRONTEND-015', 'mode', 'Frontend artifact mode does not match the product manifest.'))
  if (!isRecord(artifact.hostRuntime) || typeof artifact.hostRuntime.versionRange !== 'string' || !artifact.hostRuntime.versionRange) diagnostics.push(error('MPS-FRONTEND-100', 'hostRuntime', 'Frontend artifact requires host runtime compatibility.'))
  if (!isRecord(artifact.accessibility)
    || artifact.accessibility.declaration !== 'host-baseline-with-product-semantics'
    || artifact.accessibility.screenReader !== true
    || artifact.accessibility.scalableText !== true
    || artifact.accessibility.keyboardNavigation !== true
    || artifact.accessibility.reduceMotion !== true) {
    diagnostics.push(error('MPS-FRONTEND-ACCESSIBILITY-010', 'accessibility', 'Frontend artifact must declare the complete host accessibility baseline.'))
  }
  const views = Array.isArray(artifact.views) ? artifact.views : []
  const routes = Array.isArray(artifact.routes) ? artifact.routes : []
  const actions = Array.isArray(artifact.actions) ? artifact.actions : []
  const contributions = Array.isArray(artifact.contributions) ? artifact.contributions : []
  const resources = Array.isArray(artifact.resources) ? artifact.resources : []
  if (views.length > 96 || routes.length > 96 || actions.length > 192 || resources.length > 128) diagnostics.push(error('MPS-FRONTEND-102', '', 'Frontend artifact exceeds structural limits.'))
  const viewIds = uniqueIds(views, 'views', diagnostics)
  const actionIds = uniqueIds(actions, 'actions', diagnostics)
  const resourceIds = uniqueIds(resources, 'resources', diagnostics)
  uniqueIds(contributions, 'contributions', diagnostics)
  const routePaths = new Set<string>()
  for (const [index, route] of routes.entries()) {
    if (!isRecord(route) || typeof route.path !== 'string' || !ROUTE_PATTERN.test(route.path)) diagnostics.push(error('MPS-FRONTEND-103', `routes/${index}`, 'Frontend route is invalid.'))
    if (typeof route.path === 'string' && routePaths.has(route.path)) diagnostics.push(error('MPS-FRONTEND-103', `routes/${index}/path`, 'Frontend route is duplicated.'))
    if (typeof route.path === 'string') routePaths.add(route.path)
    if (route.viewId && !viewIds.has(route.viewId)) diagnostics.push(error('MPS-FRONTEND-104', `routes/${index}/viewId`, 'Frontend route references an unknown view.'))
  }
  for (const [index, view] of views.entries()) {
    if (!VIEW_KINDS.has(String(view.kind))) diagnostics.push(error('MPS-FRONTEND-105', `views/${index}/kind`, 'Frontend view kind is unsupported.'))
    const bindings = Array.isArray(view.bindings) ? view.bindings.filter(isRecord) : []
    for (const [bindingIndex, binding] of bindings.entries()) {
      if (!DATA_SOURCES.has(String(binding.source))) diagnostics.push(error('MPS-FRONTEND-106', `views/${index}/bindings/${bindingIndex}`, 'Frontend data binding source is unsupported.'))
    }
    inspectComponent(view.root, `views/${index}/root`, actionIds, resourceIds, diagnostics, {nodes: 0}, 1)
    if (isRecord(view.states)) for (const [state, component] of Object.entries(view.states)) inspectComponent(component, `views/${index}/states/${state}`, actionIds, resourceIds, diagnostics, {nodes: 0}, 1)
  }
  for (const [index, action] of actions.entries()) {
    if (!ACTIONS.has(String(action.family))) diagnostics.push(error('MPS-FRONTEND-107', `actions/${index}/family`, 'Frontend action family is unsupported.'))
    if (action.family === 'route.open' && (typeof action.route !== 'string' || !routePaths.has(action.route))) diagnostics.push(error('MPS-FRONTEND-108', `actions/${index}/route`, 'route.open requires a declared product route.'))
    if (action.family === 'record.create' || action.family === 'record.read' || action.family === 'record.update' || action.family === 'record.delete' || action.family === 'record.query') {
      if (typeof action.recordType !== 'string' || !action.recordType) diagnostics.push(error('MPS-FRONTEND-109', `actions/${index}/recordType`, 'Record actions require a record type.'))
    }
  }
  const capabilities = [...(artifact.capabilities?.required ?? []), ...(artifact.capabilities?.optional ?? [])]
  for (const capability of capabilities) if (!CAPABILITY_PATTERN.test(capability)) diagnostics.push(error('MPS-FRONTEND-110', 'capabilities', `Invalid frontend capability ${capability}.`))
  for (const [index, resource] of resources.entries()) {
    if (!SAFE_PATH_PATTERN.test(resource.path) || !SHA256_PATTERN.test(resource.sha256)) diagnostics.push(error('MPS-FRONTEND-111', `resources/${index}`, 'Frontend resource path or hash is invalid.'))
  }
  if (artifact.mode === 'declarative') {
    if (!artifact.entry || !viewIds.has(artifact.entry)) diagnostics.push(error('MPS-FRONTEND-107', 'entry', 'Declarative frontend entry view is missing.'))
    if (!routes.length || !views.length) diagnostics.push(error('MPS-FRONTEND-107', '', 'Declarative frontend requires routes and views.'))
  }
  if (artifact.mode === 'host-contribution' && contributions.length === 0) diagnostics.push(error('MPS-FRONTEND-112', 'contributions', 'Host-contribution frontend requires a contribution.'))
  if (input.metadata.entryView !== artifact.entry) diagnostics.push(error('MPS-FRONTEND-016', 'entry', 'Frontend entry metadata does not match the artifact.'))
  return {ok: diagnostics.length === 0, artifact: diagnostics.length === 0 ? artifact : undefined, sha256, diagnostics}
}

function uniqueIds(values: unknown[], path: string, diagnostics: IngestDiagnostic[]): Set<string> {
  const ids = new Set<string>()
  for (const [index, value] of values.entries()) {
    if (!isRecord(value) || typeof value.id !== 'string' || !value.id) {
      diagnostics.push(error('MPS-FRONTEND-100', `${path}/${index}/id`, 'Frontend declaration requires an identifier.'))
      continue
    }
    if (ids.has(value.id)) diagnostics.push(error('MPS-FRONTEND-113', `${path}/${index}/id`, `Duplicate frontend identifier ${value.id}.`))
    ids.add(value.id)
  }
  return ids
}

function inspectForbiddenFields(value: unknown, path: string, diagnostics: IngestDiagnostic[]): void {
  if (Array.isArray(value)) return value.forEach((child, index) => inspectForbiddenFields(child, `${path}/${index}`, diagnostics))
  if (!isRecord(value)) return
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.has(key.toLowerCase())) diagnostics.push(error('MPS-FRONTEND-SECURITY-001', `${path}/${key}`, `Executable or unbounded frontend field ${key} is forbidden.`))
    inspectForbiddenFields(child, `${path}/${key}`, diagnostics)
  }
}

function inspectComponent(value: unknown, path: string, actions: Set<string>, resources: Set<string>, diagnostics: IngestDiagnostic[], counter: {nodes: number}, depth: number): void {
  counter.nodes += 1
  if (depth > 24 || counter.nodes > 2_048) {
    diagnostics.push(error('MPS-FRONTEND-114', path, 'Frontend component tree exceeds safety limits.'))
    return
  }
  if (!isRecord(value) || !COMPONENTS.has(String(value.type))) {
    diagnostics.push(error('MPS-FRONTEND-115', path, 'Frontend component is unknown.'))
    return
  }
  if (typeof value.action === 'string' && !actions.has(value.action)) diagnostics.push(error('MPS-FRONTEND-116', `${path}/action`, 'Frontend component references an unknown action.'))
  if (typeof value.resource === 'string' && !resources.has(value.resource)) diagnostics.push(error('MPS-FRONTEND-117', `${path}/resource`, 'Frontend component references an unknown resource.'))
  if (typeof value.icon === 'string' && /^(?:https?:|data:|javascript:)/i.test(value.icon)) diagnostics.push(error('MPS-FRONTEND-SECURITY-002', `${path}/icon`, 'Remote and executable icon URLs are forbidden.'))
  if (Array.isArray(value.children)) value.children.forEach((child, index) => inspectComponent(child, `${path}/children/${index}`, actions, resources, diagnostics, counter, depth + 1))
}

function error(code: string, path: string, message: string): IngestDiagnostic {
  return ingestError(code, path, message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
