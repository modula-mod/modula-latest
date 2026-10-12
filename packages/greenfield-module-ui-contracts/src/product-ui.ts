import {
  parseHostCapabilityReference,
  type HostCapabilityRequirement,
} from './host-capabilities.js'

export const PRODUCT_UI_SCHEMA_VERSION = '1.0.0' as const

export const PRODUCT_UI_PRIMITIVES = [
  'Button',
  'Search',
  'Menu',
  'Toolbar',
  'Sheet',
  'Form',
  'List',
  'RichDocumentEditor',
  'EditorToolbar',
  'PropertyEditor',
  'ReferencePicker',
  'AttachmentGallery',
  'RevisionBrowser',
  'Graph',
  'RecordTable',
  'RecordBoard',
  'CommandMenu',
] as const

export type ProductUiPrimitive = (typeof PRODUCT_UI_PRIMITIVES)[number]

export const PRODUCT_UI_CAPABILITY_BY_PRIMITIVE = {
  Button: 'ui.button',
  Search: 'ui.search',
  Menu: 'ui.menu',
  Toolbar: 'ui.toolbar',
  Sheet: 'ui.sheet',
  Form: 'ui.form',
  List: 'ui.list',
  RichDocumentEditor: 'ui.document-editor',
  EditorToolbar: 'ui.editor-toolbar',
  PropertyEditor: 'ui.property-editor',
  ReferencePicker: 'ui.reference-picker',
  AttachmentGallery: 'ui.attachment-gallery',
  RevisionBrowser: 'ui.revision-browser',
  Graph: 'ui.graph',
  RecordTable: 'ui.record-table',
  RecordBoard: 'ui.record-board',
  CommandMenu: 'ui.command-menu',
} as const satisfies Record<ProductUiPrimitive, string>

export type ProductUiPrimitiveContract = {
  contractVersion: typeof PRODUCT_UI_SCHEMA_VERSION
  inputModel: readonly string[]
  events: readonly string[]
  actions: readonly string[]
  requiredCapabilities: readonly string[]
  optionalCapabilities: readonly string[]
  fallbackBehavior: 'block' | 'read-only' | 'list' | 'form' | 'explicit-node'
  states: {loading: string; error: string; empty: string}
}

/**
 * Renderer-neutral lifecycle contract for advanced Product UI primitives.
 * Renderers may adapt presentation, but must preserve these bindings, events,
 * actions, capability requirements, fallbacks, and observable states.
 */
export const PRODUCT_UI_PRIMITIVE_CONTRACTS = {
  RichDocumentEditor: contract(['documentField', 'readOnly', 'toolbarId'], ['document.changed', 'selection.changed'], ['record.update'], ['ui.document-editor'], ['ui.editor-toolbar'], 'read-only'),
  EditorToolbar: contract(['editorId', 'actionIds'], ['command.selected'], ['editor.command'], ['ui.editor-toolbar'], ['ui.command-menu'], 'explicit-node'),
  PropertyEditor: contract(['binding', 'fields'], ['field.changed', 'validation.changed'], ['record.update'], ['ui.property-editor'], ['ui.form'], 'form'),
  ReferencePicker: contract(['fieldPath', 'recordType', 'multiple'], ['selection.changed', 'search.changed'], ['reference.select'], ['ui.reference-picker'], ['ui.search'], 'explicit-node'),
  AttachmentGallery: contract(['binding', 'fieldPath', 'role', 'reorderable'], ['attachment.selected', 'order.changed'], ['media.bind', 'media.unbind', 'media.reorder'], ['ui.attachment-gallery'], ['media.attachment-picker'], 'list'),
  RevisionBrowser: contract(['recordBinding', 'restoreActionId'], ['revision.selected'], ['record.restore'], ['ui.revision-browser'], [], 'list'),
  Graph: contract(['nodeBinding', 'edgeBinding', 'layout'], ['node.selected', 'viewport.changed'], ['record.open'], ['ui.graph'], ['ui.list'], 'explicit-node'),
  RecordTable: contract(['binding', 'columns', 'rowActionId'], ['row.selected', 'sort.changed'], ['record.open'], ['ui.record-table'], ['ui.list'], 'list'),
  RecordBoard: contract(['binding', 'groupBy', 'columns', 'moveActionId'], ['card.selected', 'card.moved'], ['record.open', 'record.update'], ['ui.record-board'], ['ui.list'], 'list'),
  CommandMenu: contract(['actionIds', 'search'], ['query.changed', 'command.selected'], ['action.invoke'], ['ui.command-menu'], ['ui.menu', 'ui.search'], 'explicit-node'),
} as const satisfies Record<
  'RichDocumentEditor' | 'EditorToolbar' | 'PropertyEditor' | 'ReferencePicker' | 'AttachmentGallery' |
  'RevisionBrowser' | 'Graph' | 'RecordTable' | 'RecordBoard' | 'CommandMenu',
  ProductUiPrimitiveContract
>

function contract(
  inputModel: readonly string[],
  events: readonly string[],
  actions: readonly string[],
  requiredCapabilities: readonly string[],
  optionalCapabilities: readonly string[],
  fallbackBehavior: ProductUiPrimitiveContract['fallbackBehavior'],
): ProductUiPrimitiveContract {
  return {
    contractVersion: PRODUCT_UI_SCHEMA_VERSION,
    inputModel,
    events,
    actions,
    requiredCapabilities,
    optionalCapabilities,
    fallbackBehavior,
    states: {loading: 'host.loading', error: 'host.error', empty: 'host.empty'},
  }
}

type ProductUiBase<T extends ProductUiPrimitive> = {
  id: string
  type: T
  version: typeof PRODUCT_UI_SCHEMA_VERSION
  accessibilityLabel?: string
  capability?: HostCapabilityRequirement
  fallback?: ProductUiNode
}

export type ProductUiNode =
  | (ProductUiBase<'Button'> & {label: string; actionId: string; role?: 'default' | 'prominent' | 'destructive' | 'cancel'})
  | (ProductUiBase<'Search'> & {queryBinding: string; placeholder?: string; scope?: string})
  | (ProductUiBase<'Menu'> & {label: string; actionIds: string[]})
  | (ProductUiBase<'Toolbar'> & {actionIds: string[]; placement?: 'automatic' | 'top' | 'bottom'})
  | (ProductUiBase<'Sheet'> & {presentation?: 'sheet' | 'modal'; children: ProductUiNode[]})
  | (ProductUiBase<'Form'> & {binding: string; submitActionId?: string; children: ProductUiNode[]})
  | (ProductUiBase<'List'> & {binding: string; itemViewId?: string; actionId?: string})
  | (ProductUiBase<'RichDocumentEditor'> & {documentField: string; readOnly?: boolean; toolbarId?: string})
  | (ProductUiBase<'EditorToolbar'> & {actionIds: string[]; editorId: string})
  | (ProductUiBase<'PropertyEditor'> & {binding: string; fields: string[]})
  | (ProductUiBase<'ReferencePicker'> & {fieldPath: string; recordType: string; multiple?: boolean})
  | (ProductUiBase<'AttachmentGallery'> & {binding: string; fieldPath?: string; role?: string; reorderable?: boolean})
  | (ProductUiBase<'RevisionBrowser'> & {recordBinding: string; restoreActionId?: string})
  | (ProductUiBase<'Graph'> & {nodeBinding: string; edgeBinding: string; layout?: 'force' | 'hierarchical' | 'radial'})
  | (ProductUiBase<'RecordTable'> & {binding: string; columns: string[]; rowActionId?: string})
  | (ProductUiBase<'RecordBoard'> & {binding: string; groupBy: string; columns?: string[]; moveActionId?: string})
  | (ProductUiBase<'CommandMenu'> & {actionIds: string[]; search?: boolean})

export type ProductUiValidationIssue = {
  path: string
  code: string
  message: string
}

export type ProductUiValidationResult = {
  valid: boolean
  value?: ProductUiNode
  issues: ProductUiValidationIssue[]
}

const PRIMITIVES = new Set<string>(PRODUCT_UI_PRIMITIVES)
const ID_PATTERN = /^[a-z][A-Za-z0-9]*(?:[.-][a-z][A-Za-z0-9]*)*$/
const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9_.]{0,159}$/
const FORBIDDEN_KEYS = new Set(['render', 'componentFactory', 'jsx', 'tsx', 'html', 'css', 'style', 'script', 'javascript', 'webView', 'remoteBundle', 'networkRequest'])
const BASE_KEYS = ['id', 'type', 'version', 'accessibilityLabel', 'capability', 'fallback']

const TYPE_KEYS: Record<ProductUiPrimitive, readonly string[]> = {
  Button: ['label', 'actionId', 'role'],
  Search: ['queryBinding', 'placeholder', 'scope'],
  Menu: ['label', 'actionIds'],
  Toolbar: ['actionIds', 'placement'],
  Sheet: ['presentation', 'children'],
  Form: ['binding', 'submitActionId', 'children'],
  List: ['binding', 'itemViewId', 'actionId'],
  RichDocumentEditor: ['documentField', 'readOnly', 'toolbarId'],
  EditorToolbar: ['actionIds', 'editorId'],
  PropertyEditor: ['binding', 'fields'],
  ReferencePicker: ['fieldPath', 'recordType', 'multiple'],
  AttachmentGallery: ['binding', 'fieldPath', 'role', 'reorderable'],
  RevisionBrowser: ['recordBinding', 'restoreActionId'],
  Graph: ['nodeBinding', 'edgeBinding', 'layout'],
  RecordTable: ['binding', 'columns', 'rowActionId'],
  RecordBoard: ['binding', 'groupBy', 'columns', 'moveActionId'],
  CommandMenu: ['actionIds', 'search'],
}

export function validateProductUiNode(input: unknown): ProductUiValidationResult {
  const issues: ProductUiValidationIssue[] = []
  rejectForbiddenKeys(input, '$', issues)
  validateNode(input, '$', issues, 0)
  return {valid: issues.length === 0, value: issues.length === 0 ? input as ProductUiNode : undefined, issues}
}

export function defineProductUiNode<T extends ProductUiNode>(node: T): T {
  const result = validateProductUiNode(node)
  if (!result.valid) throw new Error(result.issues.map(issue => `${issue.path} ${issue.code}: ${issue.message}`).join('; '))
  return node
}

function validateNode(input: unknown, path: string, issues: ProductUiValidationIssue[], depth: number): void {
  if (!isRecord(input)) {
    issue(issues, path, 'PRODUCT_UI_NODE_NOT_OBJECT', 'Product UI node must be an object')
    return
  }
  if (depth > 10) {
    issue(issues, path, 'PRODUCT_UI_DEPTH_EXCEEDED', 'Product UI fallback and child nesting is bounded')
    return
  }
  const type = String(input.type)
  if (!PRIMITIVES.has(type)) {
    issue(issues, `${path}.type`, 'UNSUPPORTED_PRODUCT_UI_PRIMITIVE', 'Product UI primitive is not supported by the contract')
    return
  }
  const primitive = type as ProductUiPrimitive
  const allowed = new Set([...BASE_KEYS, ...TYPE_KEYS[primitive]])
  for (const key of Object.keys(input)) if (!allowed.has(key)) issue(issues, `${path}.${key}`, 'UNKNOWN_PROPERTY', `${key} is not part of ${primitive}`)
  boundedIdentifier(input.id, `${path}.id`, issues)
  if (input.version !== PRODUCT_UI_SCHEMA_VERSION) issue(issues, `${path}.version`, 'UNSUPPORTED_PRODUCT_UI_VERSION', `Product UI version must be ${PRODUCT_UI_SCHEMA_VERSION}`)
  if (input.accessibilityLabel !== undefined) boundedString(input.accessibilityLabel, `${path}.accessibilityLabel`, issues, 1, 240)
  const capability = input.capability === undefined ? undefined : parseHostCapabilityReference(input.capability as HostCapabilityRequirement)
  if (input.capability !== undefined && !capability) issue(issues, `${path}.capability`, 'INVALID_HOST_CAPABILITY', 'Capability must be a versioned host capability requirement')
  const requiredCapability = PRODUCT_UI_CAPABILITY_BY_PRIMITIVE[primitive]
  if (requiredCapability && (!capability || capability.id !== requiredCapability)) {
    issue(issues, `${path}.capability`, 'PRODUCT_UI_CAPABILITY_REQUIRED', `${primitive} requires ${requiredCapability}`)
  }
  if (input.fallback !== undefined) validateNode(input.fallback, `${path}.fallback`, issues, depth + 1)

  switch (primitive) {
    case 'Button':
      boundedString(input.label, `${path}.label`, issues, 1, 120)
      boundedIdentifier(input.actionId, `${path}.actionId`, issues)
      enumValue(input.role, `${path}.role`, issues, ['default', 'prominent', 'destructive', 'cancel'], false)
      break
    case 'Search':
      boundedIdentifier(input.queryBinding, `${path}.queryBinding`, issues)
      optionalString(input.placeholder, `${path}.placeholder`, issues, 160)
      optionalField(input.scope, `${path}.scope`, issues)
      break
    case 'Menu':
      boundedString(input.label, `${path}.label`, issues, 1, 120)
      identifierList(input.actionIds, `${path}.actionIds`, issues)
      break
    case 'Toolbar':
      identifierList(input.actionIds, `${path}.actionIds`, issues)
      enumValue(input.placement, `${path}.placement`, issues, ['automatic', 'top', 'bottom'], false)
      break
    case 'Sheet':
      enumValue(input.presentation, `${path}.presentation`, issues, ['sheet', 'modal'], false)
      childList(input.children, `${path}.children`, issues, depth)
      break
    case 'Form':
      boundedIdentifier(input.binding, `${path}.binding`, issues)
      optionalIdentifier(input.submitActionId, `${path}.submitActionId`, issues)
      childList(input.children, `${path}.children`, issues, depth)
      break
    case 'List':
      boundedIdentifier(input.binding, `${path}.binding`, issues)
      optionalIdentifier(input.itemViewId, `${path}.itemViewId`, issues)
      optionalIdentifier(input.actionId, `${path}.actionId`, issues)
      break
    case 'RichDocumentEditor':
      field(input.documentField, `${path}.documentField`, issues)
      optionalBoolean(input.readOnly, `${path}.readOnly`, issues)
      optionalIdentifier(input.toolbarId, `${path}.toolbarId`, issues)
      break
    case 'EditorToolbar':
      identifierList(input.actionIds, `${path}.actionIds`, issues)
      boundedIdentifier(input.editorId, `${path}.editorId`, issues)
      break
    case 'PropertyEditor':
      boundedIdentifier(input.binding, `${path}.binding`, issues)
      fieldList(input.fields, `${path}.fields`, issues)
      break
    case 'ReferencePicker':
      field(input.fieldPath, `${path}.fieldPath`, issues)
      boundedIdentifier(input.recordType, `${path}.recordType`, issues)
      optionalBoolean(input.multiple, `${path}.multiple`, issues)
      break
    case 'AttachmentGallery':
      boundedIdentifier(input.binding, `${path}.binding`, issues)
      optionalField(input.fieldPath, `${path}.fieldPath`, issues)
      optionalIdentifier(input.role, `${path}.role`, issues)
      optionalBoolean(input.reorderable, `${path}.reorderable`, issues)
      break
    case 'RevisionBrowser':
      boundedIdentifier(input.recordBinding, `${path}.recordBinding`, issues)
      optionalIdentifier(input.restoreActionId, `${path}.restoreActionId`, issues)
      break
    case 'Graph':
      boundedIdentifier(input.nodeBinding, `${path}.nodeBinding`, issues)
      boundedIdentifier(input.edgeBinding, `${path}.edgeBinding`, issues)
      enumValue(input.layout, `${path}.layout`, issues, ['force', 'hierarchical', 'radial'], false)
      break
    case 'RecordTable':
      boundedIdentifier(input.binding, `${path}.binding`, issues)
      fieldList(input.columns, `${path}.columns`, issues)
      optionalIdentifier(input.rowActionId, `${path}.rowActionId`, issues)
      break
    case 'RecordBoard':
      boundedIdentifier(input.binding, `${path}.binding`, issues)
      field(input.groupBy, `${path}.groupBy`, issues)
      if (input.columns !== undefined) fieldList(input.columns, `${path}.columns`, issues)
      optionalIdentifier(input.moveActionId, `${path}.moveActionId`, issues)
      break
    case 'CommandMenu':
      identifierList(input.actionIds, `${path}.actionIds`, issues)
      optionalBoolean(input.search, `${path}.search`, issues)
      break
  }
}

function childList(value: unknown, path: string, issues: ProductUiValidationIssue[], depth: number): void {
  if (!Array.isArray(value) || value.length < 1 || value.length > 40) return issue(issues, path, 'INVALID_PRODUCT_UI_CHILDREN', 'Children must be a bounded non-empty array')
  value.forEach((child, index) => validateNode(child, `${path}[${index}]`, issues, depth + 1))
}

function identifierList(value: unknown, path: string, issues: ProductUiValidationIssue[]): void {
  if (!Array.isArray(value) || value.length < 1 || value.length > 80) return issue(issues, path, 'INVALID_IDENTIFIER_LIST', 'Identifier list must be bounded and non-empty')
  value.forEach((item, index) => boundedIdentifier(item, `${path}[${index}]`, issues))
}

function fieldList(value: unknown, path: string, issues: ProductUiValidationIssue[]): void {
  if (!Array.isArray(value) || value.length < 1 || value.length > 80) return issue(issues, path, 'INVALID_FIELD_LIST', 'Field list must be bounded and non-empty')
  value.forEach((item, index) => field(item, `${path}[${index}]`, issues))
}

function boundedIdentifier(value: unknown, path: string, issues: ProductUiValidationIssue[]): void {
  if (typeof value !== 'string' || value.length > 200 || !ID_PATTERN.test(value)) issue(issues, path, 'INVALID_IDENTIFIER', 'Value must be a bounded semantic identifier')
}

function optionalIdentifier(value: unknown, path: string, issues: ProductUiValidationIssue[]): void {
  if (value !== undefined) boundedIdentifier(value, path, issues)
}

function field(value: unknown, path: string, issues: ProductUiValidationIssue[]): void {
  if (typeof value !== 'string' || !FIELD_PATTERN.test(value)) issue(issues, path, 'INVALID_FIELD_PATH', 'Value must be a bounded declarative field path')
}

function optionalField(value: unknown, path: string, issues: ProductUiValidationIssue[]): void {
  if (value !== undefined) field(value, path, issues)
}

function boundedString(value: unknown, path: string, issues: ProductUiValidationIssue[], min: number, max: number): void {
  if (typeof value !== 'string' || value.length < min || value.length > max) issue(issues, path, 'INVALID_STRING', `Value must be between ${min} and ${max} characters`)
}

function optionalString(value: unknown, path: string, issues: ProductUiValidationIssue[], max: number): void {
  if (value !== undefined) boundedString(value, path, issues, 0, max)
}

function optionalBoolean(value: unknown, path: string, issues: ProductUiValidationIssue[]): void {
  if (value !== undefined && typeof value !== 'boolean') issue(issues, path, 'INVALID_BOOLEAN', 'Value must be boolean')
}

function enumValue(value: unknown, path: string, issues: ProductUiValidationIssue[], values: readonly string[], required: boolean): void {
  if ((value !== undefined || required) && !values.includes(String(value))) issue(issues, path, 'INVALID_ENUM_VALUE', `Value must be one of ${values.join(', ')}`)
}

function rejectForbiddenKeys(input: unknown, path: string, issues: ProductUiValidationIssue[]): void {
  if (Array.isArray(input)) return input.forEach((child, index) => rejectForbiddenKeys(child, `${path}[${index}]`, issues))
  if (!isRecord(input)) return
  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_KEYS.has(key)) issue(issues, `${path}.${key}`, 'FORBIDDEN_PRODUCT_UI_KEY', `${key} is not allowed in renderer-neutral UI`)
    rejectForbiddenKeys(value, `${path}.${key}`, issues)
  }
}

function issue(issues: ProductUiValidationIssue[], path: string, code: string, message: string): void {
  issues.push({path, code, message})
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
