import {createHash} from 'node:crypto'
import {
  PRODUCT_UI_PRIMITIVES,
  formatHostCapabilityReference,
  parseHostCapabilityReference,
  validateProductUiNode,
  type HostCapabilityRequirement,
} from '@modula/greenfield-module-ui-contracts'
import {ingestError, type IngestDiagnostic} from './diagnostics.js'

const COMPONENTS = new Set([
  'section', 'text', 'label', 'metadata', 'badge', 'image', 'icon', 'divider', 'stack', 'row', 'grid', 'scroll',
  'recordList', 'recordRow', 'field', 'button', 'menu', 'search', 'filter', 'sort', 'tabs', 'picker', 'toolbar',
  'emptyState', 'errorState', 'loadingState', 'media', 'progress',
  ...PRODUCT_UI_PRIMITIVES,
])
const ACTIONS = new Set([
  'route.open', 'record.create', 'record.read', 'record.update', 'record.delete', 'record.restore', 'record.purge', 'record.query', 'function.invoke',
  'record.toggle', 'media.attach', 'media.open', 'media.detach', 'service.invoke', 'extension.invoke', 'capability.invoke', 'settings.update', 'share', 'dismiss',
])
const VIEW_KINDS = new Set(['collection', 'detail', 'form', 'dashboard', 'settings', 'emptyState'])
const DATA_SOURCES = new Set(['record.query', 'record.detail', 'record.revisions', 'record.revision', 'record.media', 'settings', 'installation', 'capability', 'job'])
const FORBIDDEN_FIELDS = new Set([
  'script', 'rawjs', 'rawhtml', 'html', 'jsx', 'tsx', 'css', 'style', 'remotebundle', 'remoteentry',
  'customcomponentname', 'webview', 'unsafewebview', 'networkurl', 'eval',
])
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
  capabilities?: {
    required?: (string | HostCapabilityRequirement)[]
    optional?: (string | HostCapabilityRequirement)[]
  }
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
  const fieldIds = new Set<string>()
  for (const view of views) collectFieldIds(view.root, fieldIds)
  uniqueIds(contributions, 'contributions', diagnostics)
  const routePaths = new Set<string>()
  for (const [index, route] of routes.entries()) {
    if (!isRecord(route) || typeof route.path !== 'string' || !ROUTE_PATTERN.test(route.path)) diagnostics.push(error('MPS-FRONTEND-103', `routes/${index}`, 'Frontend route is invalid.'))
    if (typeof route.path === 'string' && routePaths.has(route.path)) diagnostics.push(error('MPS-FRONTEND-103', `routes/${index}/path`, 'Frontend route is duplicated.'))
    if (typeof route.path === 'string') routePaths.add(route.path)
    if (route.viewId && !viewIds.has(route.viewId)) diagnostics.push(error('MPS-FRONTEND-104', `routes/${index}/viewId`, 'Frontend route references an unknown view.'))
  }
  const declaredCapabilities = validateCapabilities(artifact.capabilities, diagnostics)
  for (const [index, view] of views.entries()) {
    if (!VIEW_KINDS.has(String(view.kind))) diagnostics.push(error('MPS-FRONTEND-105', `views/${index}/kind`, 'Frontend view kind is unsupported.'))
    const bindings = Array.isArray(view.bindings) ? view.bindings.filter(isRecord) : []
    for (const [bindingIndex, binding] of bindings.entries()) {
      if (!DATA_SOURCES.has(String(binding.source))) diagnostics.push(error('MPS-FRONTEND-106', `views/${index}/bindings/${bindingIndex}`, 'Frontend data binding source is unsupported.'))
      inspectRecordQuery(binding.query, `views/${index}/bindings/${bindingIndex}/query`, diagnostics)
    }
    inspectComponent(view.root, `views/${index}/root`, actionIds, resourceIds, declaredCapabilities, diagnostics, {nodes: 0}, 1)
    if (isRecord(view.states)) for (const [state, component] of Object.entries(view.states)) inspectComponent(component, `views/${index}/states/${state}`, actionIds, resourceIds, declaredCapabilities, diagnostics, {nodes: 0}, 1)
  }
  for (const [index, action] of actions.entries()) {
    if (!ACTIONS.has(String(action.family))) diagnostics.push(error('MPS-FRONTEND-107', `actions/${index}/family`, 'Frontend action family is unsupported.'))
    if (action.family === 'route.open' && (typeof action.route !== 'string' || !routePaths.has(action.route))) diagnostics.push(error('MPS-FRONTEND-108', `actions/${index}/route`, 'route.open requires a declared product route.'))
    if (String(action.family).startsWith('record.')) {
      if (typeof action.recordType !== 'string' || !action.recordType) diagnostics.push(error('MPS-FRONTEND-109', `actions/${index}/recordType`, 'Record actions require a record type.'))
    }
    if (action.family === 'record.purge' && action.confirm !== true) diagnostics.push(error('MPS-FRONTEND-136', `actions/${index}/confirm`, 'record.purge requires explicit destructive confirmation.'))
    if (action.family === 'record.toggle' && (typeof action.recordField !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(action.recordField))) {
      diagnostics.push(error('MPS-FRONTEND-146', `actions/${index}/recordField`, 'record.toggle requires a simple boolean field name.'))
    }
    if (action.activeLabel && action.family !== 'record.toggle') diagnostics.push(error('MPS-FRONTEND-147', `actions/${index}/activeLabel`, 'activeLabel is only used for record.toggle.'))
    if (action.family === 'media.attach' && (typeof action.recordType !== 'string' || typeof action.recordIdBinding !== 'string' || typeof action.capability !== 'string' || !declaredCapabilities.has(action.capability))) {
      diagnostics.push(error('MPS-FRONTEND-143', `actions/${index}`, 'media.attach requires a record type, record binding, and declared capability.'))
    }
    if (action.family === 'media.open' && (typeof action.capability !== 'string' || !declaredCapabilities.has(action.capability))) {
      diagnostics.push(error('MPS-FRONTEND-144', `actions/${index}`, 'media.open requires a declared capability.'))
    }
    if (action.family === 'media.detach' && (typeof action.recordType !== 'string' || typeof action.recordIdBinding !== 'string' || action.confirm !== true)) {
      diagnostics.push(error('MPS-FRONTEND-145', `actions/${index}`, 'media.detach requires a record type, record binding, and confirmation.'))
    }
    inspectActionInput(action.input, fieldIds, `actions/${index}/input`, diagnostics)
  }
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

function collectFieldIds(value: unknown, ids: Set<string>): void {
  if (!isRecord(value)) return
  if (value.type === 'field' && isRecord(value.field) && typeof value.field.id === 'string') ids.add(value.field.id)
  if (Array.isArray(value.children)) value.children.forEach(child => collectFieldIds(child, ids))
}

function inspectRecordQuery(value: unknown, path: string, diagnostics: IngestDiagnostic[]): void {
  if (value === undefined) return
  if (!isRecord(value)) {
    diagnostics.push(error('MPS-FRONTEND-138', path, 'Record query must be an object.'))
    return
  }
  if (value.recordState !== undefined && value.recordState !== 'active' && value.recordState !== 'deleted') {
    diagnostics.push(error('MPS-FRONTEND-138', `${path}/recordState`, 'Record state must be active or deleted.'))
  }
  if (value.filters !== undefined) {
    if (!isRecord(value.filters) || Object.keys(value.filters).length > 24) diagnostics.push(error('MPS-FRONTEND-138', `${path}/filters`, 'Record query filters exceed bounded literal semantics.'))
    else for (const [key, child] of Object.entries(value.filters)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_.]{0,159}$/.test(key) || !(child === null || ['string', 'number', 'boolean'].includes(typeof child))) {
        diagnostics.push(error('MPS-FRONTEND-138', `${path}/filters/${key}`, 'Record query filters must use safe scalar literals.'))
      }
    }
  }
}

function inspectActionInput(value: unknown, fields: Set<string>, path: string, diagnostics: IngestDiagnostic[]): void {
  if (value === undefined) return
  if (!isRecord(value)) {
    diagnostics.push(error('MPS-FRONTEND-139', path, 'Action input shaping must be an object.'))
    return
  }
  if (value.defaults !== undefined && (!isRecord(value.defaults) || Object.keys(value.defaults).length > 32 || !boundedLiteral(value.defaults, 0))) {
    diagnostics.push(error('MPS-FRONTEND-139', `${path}/defaults`, 'Action defaults exceed bounded literal semantics.'))
  }
  if (value.transforms !== undefined) {
    if (!Array.isArray(value.transforms) || value.transforms.length > 16) diagnostics.push(error('MPS-FRONTEND-139', `${path}/transforms`, 'Action transforms exceed bounded semantics.'))
    else for (const [index, transform] of value.transforms.entries()) {
      if (!isRecord(transform) || !['richText.plainText@1', 'text.slug@1'].includes(String(transform.transform)) || typeof transform.target !== 'string' || typeof transform.source !== 'string') {
        diagnostics.push(error('MPS-FRONTEND-139', `${path}/transforms/${index}`, 'Action transform is unsupported.'))
      } else if (!fields.has(transform.source)) {
        diagnostics.push(error('MPS-FRONTEND-137', `${path}/transforms/${index}/source`, `Input transform references unknown field ${transform.source}.`))
      }
    }
  }
}

function boundedLiteral(value: unknown, depth: number): boolean {
  if (depth > 12) return false
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true
  if (Array.isArray(value)) return value.length <= 128 && value.every(child => boundedLiteral(child, depth + 1))
  if (!isRecord(value) || Object.keys(value).length > 64) return false
  return Object.entries(value).every(([key, child]) => /^[a-zA-Z][a-zA-Z0-9_.-]{0,159}$/.test(key) && boundedLiteral(child, depth + 1))
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

function inspectComponent(value: unknown, path: string, actions: Set<string>, resources: Set<string>, capabilities: Set<string>, diagnostics: IngestDiagnostic[], counter: {nodes: number}, depth: number): void {
  counter.nodes += 1
  if (depth > 24 || counter.nodes > 2_048) {
    diagnostics.push(error('MPS-FRONTEND-114', path, 'Frontend component tree exceeds safety limits.'))
    return
  }
  if (!isRecord(value) || !COMPONENTS.has(String(value.type))) {
    diagnostics.push(error('MPS-FRONTEND-115', path, 'Frontend component is unknown.'))
    return
  }
  if ((PRODUCT_UI_PRIMITIVES as readonly string[]).includes(String(value.type))) {
    const validation = validateProductUiNode(value)
    for (const issue of validation.issues) diagnostics.push(error('MPS-FRONTEND-SEMANTIC-001', `${path}${issue.path.slice(1)}`, `${issue.code}: ${issue.message}`))
    const requirement = parseHostCapabilityReference(value.capability as HostCapabilityRequirement)
    if (requirement && !capabilities.has(formatHostCapabilityReference(requirement))) {
      diagnostics.push(error('MPS-FRONTEND-SEMANTIC-002', `${path}/capability`, 'Semantic component capability must be declared by the frontend artifact.'))
    }
  }
  if (typeof value.action === 'string' && !actions.has(value.action)) diagnostics.push(error('MPS-FRONTEND-116', `${path}/action`, 'Frontend component references an unknown action.'))
  for (const key of ['actionId', 'submitActionId', 'restoreActionId', 'rowActionId', 'moveActionId']) {
    if (typeof value[key] === 'string' && !actions.has(value[key])) diagnostics.push(error('MPS-FRONTEND-116', `${path}/${key}`, 'Frontend component references an unknown action.'))
  }
  if (Array.isArray(value.actionIds)) for (const [index, action] of value.actionIds.entries()) {
    if (typeof action === 'string' && !actions.has(action)) diagnostics.push(error('MPS-FRONTEND-116', `${path}/actionIds/${index}`, 'Frontend component references an unknown action.'))
  }
  if (typeof value.resource === 'string' && !resources.has(value.resource)) diagnostics.push(error('MPS-FRONTEND-117', `${path}/resource`, 'Frontend component references an unknown resource.'))
  if (typeof value.icon === 'string' && /^(?:https?:|data:|javascript:)/i.test(value.icon)) diagnostics.push(error('MPS-FRONTEND-SECURITY-002', `${path}/icon`, 'Remote and executable icon URLs are forbidden.'))
  if (Array.isArray(value.children)) value.children.forEach((child, index) => inspectComponent(child, `${path}/children/${index}`, actions, resources, capabilities, diagnostics, counter, depth + 1))
  if (value.fallback !== undefined) inspectComponent(value.fallback, `${path}/fallback`, actions, resources, capabilities, diagnostics, counter, depth + 1)
}

function validateCapabilities(
  input: MpsFrontendArtifact['capabilities'],
  diagnostics: IngestDiagnostic[],
): Set<string> {
  const declared = new Set<string>()
  for (const [kind, values] of [['required', input?.required ?? []], ['optional', input?.optional ?? []]] as const) {
    if (!Array.isArray(values) || values.length > 80) {
      diagnostics.push(error('MPS-FRONTEND-110', `capabilities/${kind}`, 'Frontend capabilities must be a bounded array.'))
      continue
    }
    for (const [index, value] of values.entries()) {
      const requirement = parseHostCapabilityReference(value)
      if (!requirement) {
        diagnostics.push(error('MPS-FRONTEND-110', `capabilities/${kind}/${index}`, 'Frontend capability must be a versioned semantic reference.'))
        continue
      }
      if (kind === 'required' && requirement.fallback) diagnostics.push(error('MPS-FRONTEND-110', `capabilities/${kind}/${index}/fallback`, 'Required capabilities cannot declare a fallback.'))
      const key = formatHostCapabilityReference(requirement)
      if (declared.has(key)) diagnostics.push(error('MPS-FRONTEND-110', `capabilities/${kind}/${index}`, `Duplicate frontend capability ${key}.`))
      declared.add(key)
    }
  }
  return declared
}

function error(code: string, path: string, message: string): IngestDiagnostic {
  return ingestError(code, path, message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
