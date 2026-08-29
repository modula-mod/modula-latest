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
  'record.update',
  'record.delete',
  'record.query',
  'function.invoke',
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
  const fields = fieldsFor(view.root)
  const actions = (frontend.actions ?? [])
    .map(action => adaptAction(frontend.productId, action, collection, fields, resolved.params))
    .filter((action): action is GreenfieldModuleAction => Boolean(action))
  const actionIds = actionReferences(view.root)
  const allowedActions = actions.filter(action => actionIds.has(action.actionId))
  const layout = adaptLayout(view.root)
  const empty = view.states?.empty

  return {
    viewId: `${frontend.productId}.${view.id}`,
    moduleId: frontend.productId,
    kind: view.kind,
    title: localizedText(view.title, titleize(view.id)),
    collection: collection || undefined,
    query: collection ? {
      collection,
      defaultLimit: 50,
      maxLimit: 100,
      allowedSortFields: [],
      allowedFilterFields: [],
      searchableFields: [],
    } : undefined,
    layout: layout.length ? layout : [{id: `${view.id}.root`, component: 'section', text: localizedText(view.title, view.id)}],
    toolbar: allowedActions,
    allowedActions,
    emptyState: empty ? {
      title: localizedText(empty.text ?? empty.title, 'Nothing here yet'),
      body: typeof empty.description === 'string' ? empty.description : undefined,
      actionId: typeof firstActionReference(empty) === 'string' ? firstActionReference(empty) : undefined,
    } : undefined,
    requiredCapabilities: frontend.capabilities?.required ?? [],
    available: true,
  }
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
  return route.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_, name: string) => encodeURIComponent(params[name] ?? `:${name}`))
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
  if (value === 'richText') return 'multilineText'
  if (value === 'assetReference') return 'text'
  if (value === 'text' || value === 'multilineText' || value === 'boolean' || value === 'singleSelect'
    || value === 'multiSelect' || value === 'date' || value === 'dateTime' || value === 'number'
    || value === 'tags' || value === 'url' || value === 'recordReference' || value === 'json') return value
  return 'text'
}

function adaptAction(
  productId: string,
  action: MpsFrontendAction,
  collection: string,
  fields: GreenfieldModuleFieldDefinition[],
  params: Record<string, string>,
): GreenfieldModuleAction | null {
  if (!ACTION_FAMILIES.has(action.family as GreenfieldModuleActionKind)) return null
  const kind = action.family as GreenfieldModuleActionKind
  const destructive = kind === 'record.delete' || action.destructive === true
  const declaredRoute = typeof action.route === 'string' ? interpolateRoute(action.route, params) : undefined
  return {
    actionId: action.id,
    kind,
    label: localizedText(action.label, titleize(action.id)),
    inputSchema: {fields: kind === 'record.create' || kind === 'record.update' ? fields : []},
    capability: typeof action.capability === 'string' ? action.capability : `frontend.action.${kind}`,
    confirmationPolicy: destructive || action.confirm === true ? 'confirmDestructive' : 'none',
    destructive,
    successDestination: kind === 'dismiss' ? {kind: 'dismiss'} : {kind: 'stay'},
    errorPresentation: {kind: 'inline'},
    requiresIdempotencyKey: kind.startsWith('record.') || kind === 'settings.update' || kind === 'function.invoke',
    target: {
      collection: typeof action.recordType === 'string' ? action.recordType : collection || undefined,
      recordIdField: typeof action.recordIdParam === 'string' ? action.recordIdParam : 'recordId',
      routePath: declaredRoute === undefined ? undefined : `/module/${encodeURIComponent(productId)}${declaredRoute === '/' ? '' : declaredRoute}`,
      functionId: typeof action.functionId === 'string' ? action.functionId : undefined,
      settingsKeys: typeof action.settingsKey === 'string' ? [action.settingsKey] : undefined,
    },
  }
}

function adaptLayout(root: MpsFrontendComponent): GreenfieldModuleLayoutNode[] {
  let sequence = 0
  const convert = (component: MpsFrontendComponent): GreenfieldModuleLayoutNode | null => {
    sequence += 1
    const id = typeof component.id === 'string' ? component.id : `node-${sequence}`
    const children = component.children?.map(convert).filter((child): child is GreenfieldModuleLayoutNode => Boolean(child))
    if (component.type === 'recordList' || component.type === 'recordRow' || component.type === 'field'
      || component.type === 'search' || component.type === 'filter' || component.type === 'sort') return null
    if (component.type === 'stack' || component.type === 'row' || component.type === 'grid' || component.type === 'scroll'
      || component.type === 'toolbar' || component.type === 'tabs' || component.type === 'picker' || component.type === 'menu') {
      return {id, component: 'section', title: textOrUndefined(component.title), text: textOrUndefined(component.text), children}
    }
    if (component.type === 'section' || component.type === 'text' || component.type === 'label' || component.type === 'metadata'
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

function actionReferences(root: MpsFrontendComponent): Set<string> {
  const ids = new Set<string>()
  visit(root, component => {
    if (typeof component.action === 'string') ids.add(component.action)
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
