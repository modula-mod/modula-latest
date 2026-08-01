export const GREENFIELD_MODULE_VIEW_KINDS = [
  'collection',
  'detail',
  'form',
  'dashboard',
  'settings',
  'emptyState',
] as const

export type GreenfieldModuleViewKind = (typeof GREENFIELD_MODULE_VIEW_KINDS)[number]

export const GREENFIELD_MODULE_COMPONENTS = [
  'section',
  'text',
  'label',
  'metadata',
  'badge',
  'image',
  'icon',
  'divider',
  'recordList',
  'recordRow',
  'field',
  'button',
  'menu',
  'search',
  'filter',
  'sort',
  'emptyState',
  'errorState',
  'loadingState',
] as const

export type GreenfieldModuleComponentKind = (typeof GREENFIELD_MODULE_COMPONENTS)[number]

export const GREENFIELD_MODULE_ACTION_KINDS = [
  'route.open',
  'record.create',
  'record.update',
  'record.delete',
  'record.restore',
  'record.purge',
  'record.query',
  'function.invoke',
  'settings.update',
  'share',
  'dismiss',
] as const

export type GreenfieldModuleActionKind = (typeof GREENFIELD_MODULE_ACTION_KINDS)[number]

export const GREENFIELD_MODULE_FIELD_TYPES = [
  'text',
  'multilineText',
  'boolean',
  'singleSelect',
  'multiSelect',
  'date',
  'dateTime',
  'number',
  'tags',
  'url',
  'recordReference',
  'json',
] as const

export type GreenfieldModuleFieldType = (typeof GREENFIELD_MODULE_FIELD_TYPES)[number]

export type GreenfieldModuleFieldOption = {
  value: string
  label: string
}

export type GreenfieldModuleFieldDefinition = {
  fieldId: string
  name: string
  type: GreenfieldModuleFieldType
  label: string
  required?: boolean
  sensitive?: boolean
  secretRefRequired?: boolean
  options?: GreenfieldModuleFieldOption[]
  referenceCollection?: string
  placeholder?: string
  helpText?: string
}

export type GreenfieldModuleCollectionDefinition = {
  collection: string
  schemaRef: string
  defaultVisibility: 'private' | 'teams' | 'followers' | 'public' | 'system'
  fields: GreenfieldModuleFieldDefinition[]
  searchableFields: string[]
  filterableFields: string[]
  sortableFields: string[]
  folderField?: string
  referenceFields?: string[]
  schemaDefinition?: Record<string, unknown>
  retentionPolicy?: 'keepOnUninstall' | 'deleteOnUninstall' | 'exportRequired'
}

export type GreenfieldModuleQueryDefinition = {
  collection: string
  defaultLimit?: number
  maxLimit?: number
  sort?: Array<{field: string; direction: 'asc' | 'desc'}>
  allowedSortFields: string[]
  allowedFilterFields: string[]
  searchableFields: string[]
  folderField?: string
  referenceFields?: string[]
}

export type GreenfieldModuleActionInputSchema = {
  schemaRef?: string
  fields?: GreenfieldModuleFieldDefinition[]
}

export type GreenfieldModuleSuccessDestination =
  | {kind: 'stay'}
  | {kind: 'dismiss'}
  | {kind: 'view'; viewId: string}
  | {kind: 'route'; path: string}

export type GreenfieldModuleErrorPresentation = {
  kind: 'inline' | 'toast' | 'sheet'
  message?: string
}

export type GreenfieldModuleAction = {
  actionId: string
  kind: GreenfieldModuleActionKind
  label: string
  inputSchema: GreenfieldModuleActionInputSchema
  capability: string
  confirmationPolicy: 'none' | 'confirm' | 'confirmDestructive' | 'recentAuth'
  destructive: boolean
  successDestination: GreenfieldModuleSuccessDestination
  errorPresentation: GreenfieldModuleErrorPresentation
  requiresIdempotencyKey: boolean
  target?: {
    collection?: string
    recordIdField?: string
    routePath?: string
    functionId?: string
    settingsKeys?: string[]
  }
}

export type GreenfieldModuleEmptyState = {
  title: string
  body?: string
  actionId?: string
}

export type GreenfieldModuleLayoutNode = {
  id: string
  component: GreenfieldModuleComponentKind
  title?: string
  text?: string
  label?: string
  field?: string
  collection?: string
  actionId?: string
  icon?: string
  image?: {source: 'moduleAsset' | 'recordField'; ref: string; alt?: string}
  variant?: 'default' | 'subtle' | 'prominent' | 'warning' | 'destructive' | 'success'
  children?: GreenfieldModuleLayoutNode[]
}

export type GreenfieldModuleView = {
  viewId: string
  moduleId: string
  kind: GreenfieldModuleViewKind
  title: string
  collection?: string
  query?: GreenfieldModuleQueryDefinition
  layout: GreenfieldModuleLayoutNode[]
  toolbar?: GreenfieldModuleAction[]
  emptyState?: GreenfieldModuleEmptyState
  requiredCapabilities: string[]
}

export type GreenfieldModuleValidationIssue = {
  path: string
  code: string
  message: string
}

export type GreenfieldModuleValidationResult<T> = {
  valid: boolean
  value?: T
  issues: GreenfieldModuleValidationIssue[]
}

const VIEW_KIND_SET = new Set<string>(GREENFIELD_MODULE_VIEW_KINDS)
const COMPONENT_SET = new Set<string>(GREENFIELD_MODULE_COMPONENTS)
const ACTION_KIND_SET = new Set<string>(GREENFIELD_MODULE_ACTION_KINDS)
const FIELD_TYPE_SET = new Set<string>(GREENFIELD_MODULE_FIELD_TYPES)
const CONFIRMATION_SET = new Set(['none', 'confirm', 'confirmDestructive', 'recentAuth'])
const ERROR_PRESENTATION_SET = new Set(['inline', 'toast', 'sheet'])
const VISIBILITY_SET = new Set(['private', 'teams', 'followers', 'public', 'system'])
const RETENTION_SET = new Set(['keepOnUninstall', 'deleteOnUninstall', 'exportRequired'])
const SORT_DIRECTION_SET = new Set(['asc', 'desc'])

const FORBIDDEN_KEYS = new Set([
  'jsx',
  'tsx',
  'componentFactory',
  'render',
  'html',
  'remoteHtml',
  'dangerouslySetInnerHTML',
  'webView',
  'webview',
  'css',
  'style',
  'inlineStyle',
  'script',
  'inlineScript',
  'javascript',
  'sql',
  'rawSql',
  'customSql',
  'networkRequest',
  'arbitraryNetworkRequest',
])

const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/
const COLLECTION_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/
const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/

export function isModuleNamespacedIdentifier(moduleId: string, identifier: string): boolean {
  return typeof identifier === 'string' && identifier.startsWith(`${moduleId}.`) && IDENTIFIER_PATTERN.test(identifier)
}

export function validateGreenfieldModuleView(input: unknown): GreenfieldModuleValidationResult<GreenfieldModuleView> {
  const issues: GreenfieldModuleValidationIssue[] = []
  const add = (path: string, code: string, message: string) => issues.push({path, code, message})

  rejectForbiddenKeys(input, '$', add)
  if (!isRecord(input)) {
    add('$', 'VIEW_NOT_OBJECT', 'Module view must be a JSON object')
    return {valid: false, issues}
  }

  const view = input as Partial<GreenfieldModuleView>
  checkKnownKeys(
    view,
    '$',
    ['viewId', 'moduleId', 'kind', 'title', 'collection', 'query', 'layout', 'toolbar', 'emptyState', 'requiredCapabilities'],
    add,
  )
  if (!isBoundedString(view.moduleId, 3, 160) || !IDENTIFIER_PATTERN.test(view.moduleId)) add('$.moduleId', 'INVALID_MODULE_ID', 'Module ID must be a lowercase reverse-domain identifier')
  const moduleId = typeof view.moduleId === 'string' ? view.moduleId : ''
  if (!isBoundedString(view.viewId, 1, 200) || !isModuleNamespacedIdentifier(moduleId, view.viewId ?? '')) add('$.viewId', 'VIEW_ID_NOT_NAMESPACED', 'View ID must be module-namespaced')
  if (!VIEW_KIND_SET.has(String(view.kind))) add('$.kind', 'UNSUPPORTED_VIEW_KIND', 'View kind is not supported')
  checkBoundedString(view.title, '$.title', 1, 140, add)
  if (view.collection !== undefined) checkCollection(view.collection, '$.collection', add)
  if (!Array.isArray(view.requiredCapabilities)) add('$.requiredCapabilities', 'INVALID_CAPABILITIES', 'requiredCapabilities must be an array')
  else view.requiredCapabilities.forEach((capability, index) => checkCapability(capability, `$.requiredCapabilities[${index}]`, add))
  if (!Array.isArray(view.layout) || view.layout.length < 1 || view.layout.length > 80) {
    add('$.layout', 'INVALID_LAYOUT', 'Layout must be a bounded non-empty array')
  } else {
    view.layout.forEach((node, index) => validateLayoutNode(node, `$.layout[${index}]`, add, 0))
  }
  if (view.toolbar !== undefined) {
    if (!Array.isArray(view.toolbar) || view.toolbar.length > 30) add('$.toolbar', 'INVALID_TOOLBAR', 'Toolbar must be a bounded array')
    else view.toolbar.forEach((action, index) => validateAction(action, `$.toolbar[${index}]`, moduleId, add))
  }
  if (view.query !== undefined) validateQuery(view.query, '$.query', add)
  if (view.emptyState !== undefined) validateEmptyState(view.emptyState, '$.emptyState', add)

  return {valid: issues.length === 0, value: issues.length === 0 ? (view as GreenfieldModuleView) : undefined, issues}
}

export function validateGreenfieldModuleCollection(input: unknown, moduleId?: string): GreenfieldModuleValidationResult<GreenfieldModuleCollectionDefinition> {
  const issues: GreenfieldModuleValidationIssue[] = []
  const add = (path: string, code: string, message: string) => issues.push({path, code, message})
  rejectForbiddenKeys(input, '$', add)
  if (!isRecord(input)) {
    add('$', 'COLLECTION_NOT_OBJECT', 'Module collection must be a JSON object')
    return {valid: false, issues}
  }
  const collection = input as Partial<GreenfieldModuleCollectionDefinition>
  checkKnownKeys(collection, '$', ['collection', 'schemaRef', 'defaultVisibility', 'fields', 'searchableFields', 'filterableFields', 'sortableFields', 'folderField', 'referenceFields', 'schemaDefinition', 'retentionPolicy'], add)
  checkCollection(collection.collection, '$.collection', add)
  if (moduleId && typeof collection.collection === 'string' && collection.collection.startsWith('module.')) {
    add('$.collection', 'COLLECTION_SHOULD_BE_LOCAL', 'Collection declarations must use module-local names')
  }
  checkBoundedString(collection.schemaRef, '$.schemaRef', 1, 240, add)
  if (!VISIBILITY_SET.has(String(collection.defaultVisibility))) add('$.defaultVisibility', 'INVALID_VISIBILITY', 'Unsupported default visibility')
  if (!Array.isArray(collection.fields) || collection.fields.length < 1 || collection.fields.length > 100) {
    add('$.fields', 'INVALID_FIELDS', 'Collection fields must be a bounded non-empty array')
  } else {
    collection.fields.forEach((field, index) => validateField(field, `$.fields[${index}]`, add))
  }
  validateFieldList(collection.searchableFields, '$.searchableFields', add)
  validateFieldList(collection.filterableFields, '$.filterableFields', add)
  validateFieldList(collection.sortableFields, '$.sortableFields', add)
  if (collection.folderField !== undefined) checkFieldName(collection.folderField, '$.folderField', add)
  if (collection.referenceFields !== undefined) validateFieldList(collection.referenceFields, '$.referenceFields', add)
  if (collection.schemaDefinition !== undefined && !isRecord(collection.schemaDefinition)) {
    add('$.schemaDefinition', 'INVALID_SCHEMA_DEFINITION', 'schemaDefinition must be a JSON object')
  }
  if (collection.retentionPolicy !== undefined && !RETENTION_SET.has(String(collection.retentionPolicy))) add('$.retentionPolicy', 'INVALID_RETENTION_POLICY', 'Unsupported retention policy')
  return {valid: issues.length === 0, value: issues.length === 0 ? (collection as GreenfieldModuleCollectionDefinition) : undefined, issues}
}

export function validateGreenfieldModuleAction(input: unknown, moduleId: string): GreenfieldModuleValidationResult<GreenfieldModuleAction> {
  const issues: GreenfieldModuleValidationIssue[] = []
  const add = (path: string, code: string, message: string) => issues.push({path, code, message})
  rejectForbiddenKeys(input, '$', add)
  validateAction(input, '$', moduleId, add)
  return {valid: issues.length === 0, value: issues.length === 0 ? (input as GreenfieldModuleAction) : undefined, issues}
}

function validateAction(input: unknown, path: string, moduleId: string, add: (path: string, code: string, message: string) => void): void {
  if (!isRecord(input)) {
    add(path, 'ACTION_NOT_OBJECT', 'Action must be a JSON object')
    return
  }
  const action = input as Partial<GreenfieldModuleAction>
  checkKnownKeys(action, path, ['actionId', 'kind', 'label', 'inputSchema', 'capability', 'confirmationPolicy', 'destructive', 'successDestination', 'errorPresentation', 'requiresIdempotencyKey', 'target'], add)
  if (!isModuleNamespacedIdentifier(moduleId, action.actionId ?? '')) add(`${path}.actionId`, 'ACTION_ID_NOT_NAMESPACED', 'Action ID must be module-namespaced')
  if (!ACTION_KIND_SET.has(String(action.kind))) add(`${path}.kind`, 'UNSUPPORTED_ACTION_KIND', 'Action kind is not supported')
  checkBoundedString(action.label, `${path}.label`, 1, 80, add)
  validateActionInputSchema(action.inputSchema, `${path}.inputSchema`, add)
  checkCapability(action.capability, `${path}.capability`, add)
  if (!CONFIRMATION_SET.has(String(action.confirmationPolicy))) add(`${path}.confirmationPolicy`, 'INVALID_CONFIRMATION_POLICY', 'Unsupported confirmation policy')
  if (typeof action.destructive !== 'boolean') add(`${path}.destructive`, 'INVALID_DESTRUCTIVE_FLAG', 'destructive must be boolean')
  if (action.destructive && action.confirmationPolicy !== 'confirmDestructive' && action.confirmationPolicy !== 'recentAuth') {
    add(`${path}.confirmationPolicy`, 'DESTRUCTIVE_CONFIRMATION_REQUIRED', 'Destructive actions require destructive confirmation or recent authentication')
  }
  validateSuccessDestination(action.successDestination, `${path}.successDestination`, moduleId, add)
  validateErrorPresentation(action.errorPresentation, `${path}.errorPresentation`, add)
  if (typeof action.requiresIdempotencyKey !== 'boolean') add(`${path}.requiresIdempotencyKey`, 'INVALID_IDEMPOTENCY_FLAG', 'requiresIdempotencyKey must be boolean')
  validateActionTarget(action.target, `${path}.target`, add)
}

function validateActionInputSchema(input: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!isRecord(input)) {
    add(path, 'INPUT_SCHEMA_REQUIRED', 'Action input schema must be declared')
    return
  }
  const schema = input as Partial<GreenfieldModuleActionInputSchema>
  checkKnownKeys(schema, path, ['schemaRef', 'fields'], add)
  if (schema.schemaRef !== undefined) checkBoundedString(schema.schemaRef, `${path}.schemaRef`, 1, 240, add)
  if (schema.fields !== undefined) {
    if (!Array.isArray(schema.fields) || schema.fields.length > 80) add(`${path}.fields`, 'INVALID_FIELDS', 'Input fields must be a bounded array')
    else schema.fields.forEach((field, index) => validateField(field, `${path}.fields[${index}]`, add))
  }
  if (schema.schemaRef === undefined && schema.fields === undefined) add(path, 'EMPTY_INPUT_SCHEMA', 'Action input schema must include schemaRef or fields')
}

function validateField(input: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!isRecord(input)) {
    add(path, 'FIELD_NOT_OBJECT', 'Field must be a JSON object')
    return
  }
  const field = input as Partial<GreenfieldModuleFieldDefinition>
  checkKnownKeys(field, path, ['fieldId', 'name', 'type', 'label', 'required', 'sensitive', 'secretRefRequired', 'options', 'referenceCollection', 'placeholder', 'helpText'], add)
  checkBoundedString(field.fieldId, `${path}.fieldId`, 1, 160, add)
  checkFieldName(field.name, `${path}.name`, add)
  if (!FIELD_TYPE_SET.has(String(field.type))) add(`${path}.type`, 'UNSUPPORTED_FIELD_TYPE', 'Field type is not supported')
  checkBoundedString(field.label, `${path}.label`, 1, 80, add)
  if (field.required !== undefined && typeof field.required !== 'boolean') add(`${path}.required`, 'INVALID_REQUIRED_FLAG', 'required must be boolean')
  if (field.sensitive !== undefined && typeof field.sensitive !== 'boolean') add(`${path}.sensitive`, 'INVALID_SENSITIVE_FLAG', 'sensitive must be boolean')
  if (field.secretRefRequired !== undefined && typeof field.secretRefRequired !== 'boolean') add(`${path}.secretRefRequired`, 'INVALID_SECRET_REF_FLAG', 'secretRefRequired must be boolean')
  if (field.sensitive && !field.secretRefRequired) add(`${path}.secretRefRequired`, 'SENSITIVE_FIELD_REQUIRES_SECRET_REF', 'Sensitive fields must use secret references')
  if (field.options !== undefined) {
    if (!Array.isArray(field.options) || field.options.length > 80) add(`${path}.options`, 'INVALID_OPTIONS', 'Options must be a bounded array')
    else {
      field.options.forEach((option, index) => {
        if (!isRecord(option)) {
          add(`${path}.options[${index}]`, 'OPTION_NOT_OBJECT', 'Option must be a JSON object')
          return
        }
        checkBoundedString((option as GreenfieldModuleFieldOption).value, `${path}.options[${index}].value`, 1, 120, add)
        checkBoundedString((option as GreenfieldModuleFieldOption).label, `${path}.options[${index}].label`, 1, 120, add)
      })
    }
  }
  if (field.referenceCollection !== undefined) checkCollection(field.referenceCollection, `${path}.referenceCollection`, add)
  if (field.placeholder !== undefined) checkBoundedString(field.placeholder, `${path}.placeholder`, 0, 160, add)
  if (field.helpText !== undefined) checkBoundedString(field.helpText, `${path}.helpText`, 0, 240, add)
}

function validateLayoutNode(input: unknown, path: string, add: (path: string, code: string, message: string) => void, depth: number): void {
  if (!isRecord(input)) {
    add(path, 'LAYOUT_NODE_NOT_OBJECT', 'Layout node must be a JSON object')
    return
  }
  if (depth > 8) add(path, 'LAYOUT_DEPTH_EXCEEDED', 'Layout nesting is bounded')
  const node = input as Partial<GreenfieldModuleLayoutNode>
  checkKnownKeys(node, path, ['id', 'component', 'title', 'text', 'label', 'field', 'collection', 'actionId', 'icon', 'image', 'variant', 'children'], add)
  checkBoundedString(node.id, `${path}.id`, 1, 160, add)
  if (!COMPONENT_SET.has(String(node.component))) add(`${path}.component`, 'UNSUPPORTED_COMPONENT', 'Component is not supported')
  if (node.title !== undefined) checkBoundedString(node.title, `${path}.title`, 0, 160, add)
  if (node.text !== undefined) checkBoundedString(node.text, `${path}.text`, 0, 2000, add)
  if (node.label !== undefined) checkBoundedString(node.label, `${path}.label`, 0, 160, add)
  if (node.field !== undefined) checkFieldName(node.field, `${path}.field`, add)
  if (node.collection !== undefined) checkCollection(node.collection, `${path}.collection`, add)
  if (node.actionId !== undefined && (!isBoundedString(node.actionId, 1, 200) || !IDENTIFIER_PATTERN.test(node.actionId))) add(`${path}.actionId`, 'INVALID_ACTION_REFERENCE', 'Action reference must be an identifier')
  if (node.image !== undefined) validateImage(node.image, `${path}.image`, add)
  if (node.children !== undefined) {
    if (!Array.isArray(node.children) || node.children.length > 40) add(`${path}.children`, 'INVALID_CHILDREN', 'Children must be a bounded array')
    else node.children.forEach((child, index) => validateLayoutNode(child, `${path}.children[${index}]`, add, depth + 1))
  }
}

function validateImage(input: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!isRecord(input)) {
    add(path, 'IMAGE_NOT_OBJECT', 'Image must be declarative')
    return
  }
  const image = input as {source?: unknown; ref?: unknown; alt?: unknown}
  checkKnownKeys(image, path, ['source', 'ref', 'alt'], add)
  if (image.source !== 'moduleAsset' && image.source !== 'recordField') add(`${path}.source`, 'INVALID_IMAGE_SOURCE', 'Image source must be a module asset or record field')
  checkBoundedString(image.ref, `${path}.ref`, 1, 240, add)
  if (image.alt !== undefined) checkBoundedString(image.alt, `${path}.alt`, 0, 240, add)
}

function validateQuery(input: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!isRecord(input)) {
    add(path, 'QUERY_NOT_OBJECT', 'Query definition must be declarative')
    return
  }
  const query = input as Partial<GreenfieldModuleQueryDefinition>
  checkKnownKeys(query, path, ['collection', 'defaultLimit', 'maxLimit', 'sort', 'allowedSortFields', 'allowedFilterFields', 'searchableFields', 'folderField', 'referenceFields'], add)
  checkCollection(query.collection, `${path}.collection`, add)
  if (query.defaultLimit !== undefined) checkLimit(query.defaultLimit, `${path}.defaultLimit`, add)
  if (query.maxLimit !== undefined) checkLimit(query.maxLimit, `${path}.maxLimit`, add)
  validateFieldList(query.allowedSortFields, `${path}.allowedSortFields`, add)
  validateFieldList(query.allowedFilterFields, `${path}.allowedFilterFields`, add)
  validateFieldList(query.searchableFields, `${path}.searchableFields`, add)
  if (query.folderField !== undefined) checkFieldName(query.folderField, `${path}.folderField`, add)
  if (query.referenceFields !== undefined) validateFieldList(query.referenceFields, `${path}.referenceFields`, add)
  if (query.sort !== undefined) {
    if (!Array.isArray(query.sort) || query.sort.length > 8) {
      add(`${path}.sort`, 'INVALID_SORT', 'Sort must be a bounded array')
    } else {
      query.sort.forEach((sort, index) => {
        if (!isRecord(sort)) {
          add(`${path}.sort[${index}]`, 'SORT_NOT_OBJECT', 'Sort entry must be an object')
          return
        }
        checkFieldName(sort.field, `${path}.sort[${index}].field`, add)
        if (!SORT_DIRECTION_SET.has(String(sort.direction))) add(`${path}.sort[${index}].direction`, 'INVALID_SORT_DIRECTION', 'Sort direction must be asc or desc')
      })
    }
  }
}

function validateEmptyState(input: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!isRecord(input)) {
    add(path, 'EMPTY_STATE_NOT_OBJECT', 'Empty state must be declarative')
    return
  }
  const empty = input as Partial<GreenfieldModuleEmptyState>
  checkKnownKeys(empty, path, ['title', 'body', 'actionId'], add)
  checkBoundedString(empty.title, `${path}.title`, 1, 160, add)
  if (empty.body !== undefined) checkBoundedString(empty.body, `${path}.body`, 0, 400, add)
  if (empty.actionId !== undefined && (!isBoundedString(empty.actionId, 1, 200) || !IDENTIFIER_PATTERN.test(empty.actionId))) add(`${path}.actionId`, 'INVALID_ACTION_REFERENCE', 'Action reference must be an identifier')
}

function validateSuccessDestination(input: unknown, path: string, moduleId: string, add: (path: string, code: string, message: string) => void): void {
  if (!isRecord(input)) {
    add(path, 'SUCCESS_DESTINATION_REQUIRED', 'Success destination must be declared')
    return
  }
  const destination = input as GreenfieldModuleSuccessDestination
  checkKnownKeys(destination, path, ['kind', 'viewId', 'path'], add)
  if (!['stay', 'dismiss', 'view', 'route'].includes(String(destination.kind))) add(`${path}.kind`, 'INVALID_SUCCESS_DESTINATION', 'Unsupported success destination')
  if (destination.kind === 'view' && !isModuleNamespacedIdentifier(moduleId, destination.viewId ?? '')) add(`${path}.viewId`, 'VIEW_ID_NOT_NAMESPACED', 'Success view target must be module-namespaced')
  if (destination.kind === 'route' && (typeof destination.path !== 'string' || !destination.path.startsWith(`/module/${moduleId}`))) add(`${path}.path`, 'INVALID_ROUTE_DESTINATION', 'Route success target must remain under the module route')
}

function validateErrorPresentation(input: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!isRecord(input)) {
    add(path, 'ERROR_PRESENTATION_REQUIRED', 'Error presentation must be declared')
    return
  }
  const presentation = input as GreenfieldModuleErrorPresentation
  checkKnownKeys(presentation, path, ['kind', 'message'], add)
  if (!ERROR_PRESENTATION_SET.has(String(presentation.kind))) add(`${path}.kind`, 'INVALID_ERROR_PRESENTATION', 'Unsupported error presentation')
  if (presentation.message !== undefined) checkBoundedString(presentation.message, `${path}.message`, 0, 200, add)
}

function validateActionTarget(input: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (input === undefined) return
  if (!isRecord(input)) {
    add(path, 'TARGET_NOT_OBJECT', 'Action target must be declarative')
    return
  }
  const target = input as NonNullable<GreenfieldModuleAction['target']>
  checkKnownKeys(target, path, ['collection', 'recordIdField', 'routePath', 'functionId', 'settingsKeys'], add)
  if (target.collection !== undefined) checkCollection(target.collection, `${path}.collection`, add)
  if (target.recordIdField !== undefined) checkFieldName(target.recordIdField, `${path}.recordIdField`, add)
  if (target.routePath !== undefined) checkBoundedString(target.routePath, `${path}.routePath`, 1, 240, add)
  if (target.functionId !== undefined) checkBoundedString(target.functionId, `${path}.functionId`, 1, 200, add)
  if (target.settingsKeys !== undefined) validateFieldList(target.settingsKeys, `${path}.settingsKeys`, add)
}

function rejectForbiddenKeys(input: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!input || typeof input !== 'object') return
  if (Array.isArray(input)) {
    input.forEach((item, index) => rejectForbiddenKeys(item, `${path}[${index}]`, add))
    return
  }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) add(`${path}.${key}`, 'FORBIDDEN_DECLARATIVE_KEY', `${key} is not supported in module UI declarations`)
    rejectForbiddenKeys(value, `${path}.${key}`, add)
  }
}

function checkKnownKeys(input: Record<string, unknown>, path: string, allowed: string[], add: (path: string, code: string, message: string) => void): void {
  const known = new Set(allowed)
  for (const key of Object.keys(input)) {
    if (!known.has(key)) add(`${path}.${key}`, 'UNKNOWN_PROPERTY', `${key} is not part of the declarative contract`)
  }
}

function checkCollection(value: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!isBoundedString(value, 1, 120) || !COLLECTION_PATTERN.test(value)) add(path, 'INVALID_COLLECTION', 'Collection must be a bounded module-local identifier')
}

function checkFieldName(value: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!isBoundedString(value, 1, 80) || !FIELD_PATTERN.test(value)) add(path, 'INVALID_FIELD_NAME', 'Field name must be a bounded identifier')
}

function validateFieldList(input: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!Array.isArray(input) || input.length > 100) {
    add(path, 'INVALID_FIELD_LIST', 'Field list must be a bounded array')
    return
  }
  input.forEach((field, index) => checkFieldName(field, `${path}[${index}]`, add))
}

function checkCapability(value: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!isBoundedString(value, 1, 240) || /[\n\r;]/.test(value)) add(path, 'INVALID_CAPABILITY', 'Capability must be a bounded permission identifier')
}

function checkLimit(value: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 100) add(path, 'INVALID_LIMIT', 'Limits must be between 1 and 100')
}

function checkBoundedString(value: unknown, path: string, min: number, max: number, add: (path: string, code: string, message: string) => void): void {
  if (!isBoundedString(value, min, max)) add(path, 'INVALID_STRING', `${path} must be a string between ${min} and ${max} characters`)
}

function isBoundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
