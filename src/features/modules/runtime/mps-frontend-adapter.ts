import type {
  GreenfieldModuleAction,
  GreenfieldModuleActionKind,
  GreenfieldModuleFieldDefinition,
  GreenfieldModuleLayoutNode,
} from '@modula/greenfield-module-ui-contracts'

import type {
  MpsFrontendAction,
  MpsFrontendArtifact,
  MpsFrontendComponent,
  MpsFrontendRoute,
  MpsFrontendView,
  ModuleRuntimeView,
} from '@/data/repositories/contracts'

const ACTION_FAMILIES = new Set<GreenfieldModuleActionKind>([
  'route.open',
  'record.create',
  'record.read',
  'record.update',
  'record.delete',
  'record.restore',
  'record.purge',
  'record.query',
  'function.invoke',
  'service.invoke',
  'extension.invoke',
  'capability.invoke',
  'settings.update',
  'share',
  'dismiss',
])

export type ResolvedMpsFrontendRoute = {
  route: MpsFrontendRoute
  view: MpsFrontendView
  params: Record<string, string>
}

export function resolveMpsFrontendRoute(
  frontend: MpsFrontendArtifact,
  path: string[],
): ResolvedMpsFrontendRoute | null {
  const routes = frontend.routes ?? []
  const views = new Map((frontend.views ?? []).map(view => [view.id, view]))
  const requestedPath = `/${path.map(segment => encodeURIComponent(decodeURIComponentSafe(segment))).join('/')}`
  let matched = matchRoute(routes, requestedPath || '/')
  const visited = new Set<string>()

  while (matched?.route.redirectTo) {
    if (visited.has(matched.route.path) || visited.size >= routes.length) return null
    visited.add(matched.route.path)
    matched = matchRoute(routes, interpolateRoute(matched.route.redirectTo, matched.params))
  }
  if (!matched?.route.viewId) return null
  const view = views.get(matched.route.viewId)
  return view ? {...matched, view} : null
}

export function adaptMpsFrontendView(input: {
  frontend: MpsFrontendArtifact
  resolved: ResolvedMpsFrontendRoute
}): ModuleRuntimeView {
  const {frontend, resolved} = input
  const view = resolved.view
  const collection = collectionFor(view)
  const recordBinding = recordBindingFor(view, resolved.params)
  const fields = fieldsFor(view.root)
  const actions = (frontend.actions ?? [])
    .flatMap(action => {
      const adapted = adaptAction(frontend.productId, action, view, collection, fields, resolved.params, resolved.route.presentation)
      return adapted && actionAvailableForRoute(action, adapted, Boolean(recordBinding)) ? [adapted] : []
    })
  const actionIds = actionReferences(view.root)
  const allowedActions = actions.filter(action => actionIds.has(action.actionId))
  const toolbarIds = toolbarActionReferences(view.root)
  const toolbar = allowedActions.filter(action => toolbarIds.has(action.actionId))
  const layout = adaptLayout(view.root, view.kind)
  const empty = view.states?.empty

  return {
    viewId: `${frontend.productId}.${view.id}`,
    moduleId: frontend.productId,
    kind: view.kind,
    title: localizedText(view.title, titleize(view.id)),
    collection: collection || undefined,
    query: collection ? queryFor(view, collection) : undefined,
    layout,
    toolbar,
    allowedActions,
    recordBinding,
    recordListActionIds: recordListActionReferences(view.root),
    searchEnabled: componentTypes(view.root).has('search'),
    emptyState: empty ? {
      title: localizedText(empty.text ?? empty.title, 'Nothing here yet'),
      body: typeof empty.description === 'string' ? empty.description : undefined,
      actionId: typeof firstActionReference(empty) === 'string' ? firstActionReference(empty) : undefined,
    } : undefined,
    requiredCapabilities: frontend.capabilities?.required ?? [],
    available: true,
  }
}

function componentTypes(root: MpsFrontendComponent): Set<string> {
  const types = new Set<string>()
  visit(root, component => types.add(component.type))
  return types
}

function actionAvailableForRoute(source: MpsFrontendAction, action: GreenfieldModuleAction, hasRecordBinding: boolean): boolean {
  if (action.kind === 'record.create' && hasRecordBinding) return false
  if ((action.kind === 'record.update' || action.kind === 'record.delete' || action.kind === 'record.restore' || action.kind === 'record.purge')
    && typeof source.recordIdBinding === 'string' && !hasRecordBinding) return false
  return true
}

function matchRoute(routes: MpsFrontendRoute[], requestedPath: string): {route: MpsFrontendRoute; params: Record<string, string>} | null {
  const requested = segments(requestedPath)
  for (const route of routes) {
    const declared = segments(route.path)
    if (declared.length !== requested.length) continue
    const params: Record<string, string> = {}
    let matches = true
    for (let index = 0; index < declared.length; index += 1) {
      const expected = declared[index]!
      const actual = requested[index]!
      if (expected.startsWith(':')) params[expected.slice(1)] = decodeURIComponentSafe(actual)
      else if (expected !== actual) matches = false
    }
    if (matches) return {route, params}
  }
  return null
}

function segments(path: string): string[] {
  return path.split('/').filter(Boolean)
}

function interpolateRoute(route: string, params: Record<string, string>): string {
  return route.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_, name: string) => {
    const value = params[name]
    return value === undefined ? `:${name}` : encodeURIComponent(value)
  })
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function collectionFor(view: MpsFrontendView): string {
  const binding = view.bindings?.find(candidate =>
    (candidate.source === 'record.query' || candidate.source === 'record.detail')
    && typeof candidate.recordType === 'string',
  )
  return typeof binding?.recordType === 'string' ? binding.recordType : ''
}

function recordBindingFor(view: MpsFrontendView, params: Record<string, string>): ModuleRuntimeView['recordBinding'] {
  const binding = view.bindings?.find(candidate => candidate.source === 'record.detail' && typeof candidate.recordType === 'string')
  const recordIdParam = typeof binding?.recordIdParam === 'string' ? binding.recordIdParam : ''
  const recordId = recordIdParam ? params[recordIdParam] : undefined
  return binding && typeof binding.recordType === 'string' && recordId
    ? {source: 'record.detail', collection: binding.recordType, recordId}
    : undefined
}

function queryFor(view: MpsFrontendView, collection: string): NonNullable<ModuleRuntimeView['query']> {
  const binding = view.bindings?.find(candidate => candidate.source === 'record.query' && candidate.recordType === collection)
  const declaration = isRecord(binding?.query) ? binding.query : {}
  const filters = isRecord(declaration.filters)
    ? Object.fromEntries(Object.entries(declaration.filters).filter((entry): entry is [string, string | number | boolean | null] => entry[1] === null || ['string', 'number', 'boolean'].includes(typeof entry[1])))
    : undefined
  const defaultLimit = typeof declaration.limit === 'number' ? Math.max(1, Math.min(100, declaration.limit)) : 50
  return {
    collection,
    defaultLimit,
    maxLimit: 100,
    allowedSortFields: [],
    allowedFilterFields: filters ? Object.keys(filters) : [],
    searchableFields: [],
    filters,
    recordState: declaration.recordState === 'deleted' ? 'deleted' : 'active',
  }
}

function fieldsFor(root: MpsFrontendComponent): GreenfieldModuleFieldDefinition[] {
  const fields: GreenfieldModuleFieldDefinition[] = []
  visit(root, component => {
    if (component.type !== 'field' || !isRecord(component.field)) return
    const field = component.field
    const name = typeof field.id === 'string' ? field.id : ''
    if (!name || fields.some(candidate => candidate.name === name)) return
    fields.push({
      fieldId: name,
      name,
      type: fieldType(field.type),
      label: localizedText(field.label, titleize(name)),
      required: field.required === true,
      sensitive: field.sensitive === true,
      placeholder: typeof field.placeholder === 'string' ? field.placeholder : undefined,
      helpText: typeof field.helpText === 'string' ? field.helpText : undefined,
      options: Array.isArray(field.options)
        ? field.options.filter(isRecord).map(option => ({value: String(option.value ?? ''), label: localizedText(option.label, String(option.value ?? ''))}))
        : undefined,
      referenceCollection: typeof field.recordType === 'string' ? field.recordType : undefined,
    })
  })
  return fields
}

function fieldType(value: unknown): GreenfieldModuleFieldDefinition['type'] {
  if (value === 'richText') return 'richText'
  if (value === 'assetReference') return 'assetReference'
  if (value === 'text' || value === 'multilineText' || value === 'boolean' || value === 'singleSelect'
    || value === 'multiSelect' || value === 'date' || value === 'dateTime' || value === 'number'
    || value === 'tags' || value === 'url' || value === 'recordReference' || value === 'json') return value
  return 'text'
}

function adaptAction(
  productId: string,
  action: MpsFrontendAction,
  view: MpsFrontendView,
  collection: string,
  fields: GreenfieldModuleFieldDefinition[],
  params: Record<string, string>,
  presentation: string | undefined,
): GreenfieldModuleAction | null {
  if (!ACTION_FAMILIES.has(action.family as GreenfieldModuleActionKind)) return null
  const kind = action.family as GreenfieldModuleActionKind
  const destructive = kind === 'record.delete' || kind === 'record.purge' || action.destructive === true
  const declaredRoute = typeof action.route === 'string' ? interpolateRoute(action.route, params) : undefined
  return {
    actionId: action.id,
    kind,
    label: localizedText(action.label, titleize(action.id)),
    inputSchema: {fields: kind === 'record.create' || kind === 'record.update' || kind === 'settings.update' ? fields : []},
    capability: typeof action.capability === 'string' ? action.capability : `frontend.action.${kind}`,
    confirmationPolicy: destructive || action.confirm === true ? 'confirmDestructive' : 'none',
    destructive,
    successDestination: kind === 'dismiss' || ((presentation === 'sheet' || presentation === 'modal') && (kind === 'record.create' || kind === 'record.update'))
      ? {kind: 'dismiss'}
      : {kind: 'stay'},
    errorPresentation: {kind: 'inline'},
    requiresIdempotencyKey: kind.startsWith('record.') || kind === 'settings.update' || kind === 'function.invoke',
    inputDefaults: isRecord(action.input) && isRecord(action.input.defaults) ? action.input.defaults : undefined,
    inputTransforms: isRecord(action.input) && Array.isArray(action.input.transforms)
      ? action.input.transforms.filter(isRecord).flatMap(transform =>
        typeof transform.target === 'string' && typeof transform.source === 'string' && transform.transform === 'richText.plainText@1'
          ? [{target: transform.target, source: transform.source, transform: 'richText.plainText@1' as const}]
          : [],
      )
      : undefined,
    target: {
      collection: typeof action.recordType === 'string' ? action.recordType : collection || undefined,
      recordIdField: recordIdFieldFor(action, view),
      routePath: declaredRoute === undefined ? undefined : `/module/${encodeURIComponent(productId)}${declaredRoute === '/' ? '' : declaredRoute}`,
      functionId: typeof action.functionId === 'string' ? action.functionId : undefined,
      serviceId: typeof action.serviceId === 'string' ? action.serviceId : undefined,
      commandId: typeof action.commandId === 'string' ? action.commandId : undefined,
      settingsKeys: typeof action.settingsKey === 'string' ? [action.settingsKey] : undefined,
    },
  }
}

function recordIdFieldFor(action: MpsFrontendAction, view: MpsFrontendView): string {
  if (typeof action.recordIdParam === 'string') return action.recordIdParam
  if (typeof action.recordIdBinding === 'string') {
    const binding = view.bindings?.find(candidate => candidate.id === action.recordIdBinding)
    if (typeof binding?.recordIdParam === 'string') return binding.recordIdParam
  }
  if (typeof action.route === 'string') {
    const parameter = action.route.match(/:([A-Za-z][A-Za-z0-9]*)/)
    if (parameter?.[1]) return parameter[1]
  }
  return 'recordId'
}

function adaptLayout(root: MpsFrontendComponent, viewKind: MpsFrontendView['kind']): GreenfieldModuleLayoutNode[] {
  let sequence = 0
  const suppressFormControls = viewKind === 'form' || viewKind === 'settings'
  const convert = (component: MpsFrontendComponent): GreenfieldModuleLayoutNode | null => {
    sequence += 1
    const id = typeof component.id === 'string' ? component.id : `node-${sequence}`
    const children = component.children?.map(convert).filter((child): child is GreenfieldModuleLayoutNode => Boolean(child))
    if (component.type === 'recordList' || component.type === 'recordRow' || component.type === 'field'
      || component.type === 'search' || component.type === 'filter' || component.type === 'sort') return null
    if (component.type === 'toolbar') return null
    if (component.type === 'stack' || component.type === 'row' || component.type === 'grid' || component.type === 'scroll'
      || component.type === 'tabs' || component.type === 'picker' || component.type === 'menu') {
      const title = textOrUndefined(component.title)
      const text = textOrUndefined(component.text)
      if (!title && !text && children?.length === 1) return children[0]!
      return title || text || children?.length ? {id, component: 'section', title, text, children} : null
    }
    if (component.type === 'button' && suppressFormControls) return null
    if (component.type === 'section') {
      const title = textOrUndefined(component.title)
      const text = textOrUndefined(component.text)
      if (!title && !text && children?.length === 1) return children[0]!
      return title || text || children?.length ? {id, component: 'section', title, text, children} : null
    }
    if (component.type === 'text' || component.type === 'label' || component.type === 'metadata'
      || component.type === 'badge' || component.type === 'image' || component.type === 'icon' || component.type === 'divider'
      || component.type === 'button' || component.type === 'emptyState' || component.type === 'errorState' || component.type === 'loadingState') {
      return {
        id,
        component: component.type,
        title: textOrUndefined(component.title),
        text: textOrUndefined(component.text),
        label: textOrUndefined(component.label),
        field: textOrUndefined(component.valuePath),
        actionId: textOrUndefined(component.action),
        icon: textOrUndefined(component.icon),
        children,
      }
    }
    return children?.length ? {id, component: 'section', children} : null
  }
  const converted = convert(root)
  return converted ? [converted] : []
}

function toolbarActionReferences(root: MpsFrontendComponent): Set<string> {
  const ids = new Set<string>()
  visit(root, component => {
    if (component.type !== 'toolbar') return
    if (typeof component.action === 'string') ids.add(component.action)
    if (Array.isArray(component.actions)) component.actions.filter((id): id is string => typeof id === 'string').forEach(id => ids.add(id))
    component.children?.forEach(child => {
      if (typeof child.action === 'string') ids.add(child.action)
    })
  })
  return ids
}

function recordListActionReferences(root: MpsFrontendComponent): string[] {
  const ids = new Set<string>()
  visit(root, component => {
    if (component.type !== 'recordList' && component.type !== 'recordRow') return
    if (typeof component.action === 'string') ids.add(component.action)
    if (Array.isArray(component.actions)) component.actions.filter((id): id is string => typeof id === 'string').forEach(id => ids.add(id))
  })
  return [...ids]
}

export function resolveRuntimeActionRoute(action: GreenfieldModuleAction, input: Record<string, unknown>): string | null {
  const path = action.target?.routePath
  if (!path) return null
  let unresolved = false
  const resolved = path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_, name: string) => {
    const value = input[name]
    if (typeof value !== 'string' || !value) {
      unresolved = true
      return `:${name}`
    }
    return encodeURIComponent(value)
  })
  return unresolved ? null : resolved
}

export function shapeMpsActionInput(action: GreenfieldModuleAction, input: Record<string, unknown>): Record<string, unknown> {
  const shaped = {...(action.inputDefaults ?? {}), ...input}
  for (const transform of action.inputTransforms ?? []) {
    if (transform.transform === 'richText.plainText@1') shaped[transform.target] = richTextPlainText(shaped[transform.source])
  }
  return shaped
}

function richTextPlainText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!isRecord(value) || value.schemaVersion !== '1.0.0' || !Array.isArray(value.blocks)) return ''
  return value.blocks.filter(isRecord).map(block => {
    if (Array.isArray(block.items)) return block.items.filter(item => typeof item === 'string').join('\n')
    if (Array.isArray(block.inlines)) return block.inlines.filter(isRecord).map(item => typeof item.text === 'string' ? item.text : '').join('')
    return typeof block.text === 'string' ? block.text : typeof block.title === 'string' ? block.title : ''
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function richTextEditingText(value: unknown): string {
  return richTextPlainText(value)
}

export function richTextDocumentFromText(text: string): Record<string, unknown> {
  return {
    schemaVersion: '1.0.0',
    blocks: text.split(/\n{2,}/).filter(paragraph => paragraph.trim().length > 0).map((paragraph, index) => ({
      id: `block-${index + 1}`,
      type: 'paragraph',
      text: paragraph.trim(),
    })),
  }
}

function actionReferences(root: MpsFrontendComponent): Set<string> {
  const ids = new Set<string>()
  visit(root, component => {
    if (typeof component.action === 'string') ids.add(component.action)
    if (Array.isArray(component.actions)) component.actions.filter((id): id is string => typeof id === 'string').forEach(id => ids.add(id))
  })
  return ids
}

function firstActionReference(root: MpsFrontendComponent): string | undefined {
  let action: string | undefined
  visit(root, component => {
    if (!action && typeof component.action === 'string') action = component.action
  })
  return action
}

function visit(root: MpsFrontendComponent, callback: (component: MpsFrontendComponent) => void): void {
  callback(root)
  root.children?.forEach(child => visit(child, callback))
}

function localizedText(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value
  if (isRecord(value) && typeof value.default === 'string' && value.default.trim()) return value.default
  return fallback
}

function textOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function titleize(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/[-_.]+/g, ' ').replace(/^./, char => char.toUpperCase())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
