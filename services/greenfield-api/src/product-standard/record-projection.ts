import {moduleError} from '../modules/module-errors.js'
import {
  validateGreenfieldModuleCollection,
  type GreenfieldModuleCollectionDefinition,
  type GreenfieldModuleFieldDefinition,
  type GreenfieldModuleFieldType,
} from '@modula/greenfield-module-ui-contracts'

export type MpsSchemaArtifact = {
  path: string
  bytes: string | Buffer
}

export type MpsRecordCollectionProjection = GreenfieldModuleCollectionDefinition & {
  defaultVisibility: 'private'
  schemaDefinition: Record<string, unknown>
  retentionPolicy: 'keepOnUninstall'
}

const MAX_SCHEMA_ARTIFACTS = 50
const MAX_SCHEMA_BYTES = 256 * 1024
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,79}$/
const FIELD_TYPES = new Set<GreenfieldModuleFieldType>([
  'text', 'multilineText', 'boolean', 'singleSelect', 'multiSelect', 'date', 'dateTime',
  'number', 'tags', 'url', 'recordReference', 'json', 'assetReference', 'richText',
])
const SCALAR_FIELD_TYPES = new Set(['text', 'multilineText', 'boolean', 'singleSelect', 'date', 'dateTime', 'number', 'url'])
const SEARCHABLE_FIELD_TYPES = new Set(['text', 'multilineText', 'richText', 'tags'])

export function projectMpsRecordCollections(input: {
  manifest: Record<string, unknown>
  frontend: Record<string, unknown> | null
  schemas: MpsSchemaArtifact[]
}): MpsRecordCollectionProjection[] {
  const backend = asRecord(input.manifest.backend)
  if (backend.mode !== 'greenfield-records') return []
  const records = arrayOfRecords(backend.records)
  if (records.length === 0 || records.length > MAX_SCHEMA_ARTIFACTS) {
    throw moduleError('VALIDATION_FAILED', 'Greenfield-records products require a bounded record schema list')
  }
  if (input.schemas.length > MAX_SCHEMA_ARTIFACTS) throw moduleError('VALIDATION_FAILED', 'Too many MPS record schema artifacts')
  const artifacts = new Map<string, Record<string, unknown>>()
  for (const artifact of input.schemas) {
    if (!SAFE_PATH.test(artifact.path)) throw moduleError('VALIDATION_FAILED', `Unsafe MPS record schema path ${artifact.path}`)
    const bytes = Buffer.isBuffer(artifact.bytes) ? artifact.bytes : Buffer.from(artifact.bytes)
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_SCHEMA_BYTES) {
      throw moduleError('VALIDATION_FAILED', `MPS record schema ${artifact.path} exceeds safety limits`)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(bytes.toString('utf8'))
    } catch {
      throw moduleError('VALIDATION_FAILED', `MPS record schema ${artifact.path} is not valid JSON`)
    }
    if (!isRecord(parsed)) throw moduleError('VALIDATION_FAILED', `MPS record schema ${artifact.path} must be an object`)
    artifacts.set(artifact.path, parsed)
  }

  const frontendFields = collectFrontendFields(input.frontend)
  const queryPolicies = collectQueryPolicies(input.frontend)
  return records.map(record => {
    const collection = requiredIdentifier(record.id, 'MPS record id')
    const schemaRef = requiredSafePath(record.schemaPath, `MPS record ${collection} schemaPath`)
    const schema = artifacts.get(schemaRef)
    if (!schema) throw moduleError('VALIDATION_FAILED', `Verified MPS record schema ${schemaRef} is required`)
    if (schema.type !== 'object' || schema.additionalProperties !== false) {
      throw moduleError('VALIDATION_FAILED', `MPS record schema ${schemaRef} must be a closed object schema`)
    }
    const properties = asRecord(schema.properties)
    const propertyEntries = Object.entries(properties)
    if (propertyEntries.length === 0 || propertyEntries.length > 100) {
      throw moduleError('VALIDATION_FAILED', `MPS record schema ${schemaRef} requires 1 to 100 fields`)
    }
    const required = new Set(arrayOfStrings(schema.required))
    const overrides = frontendFields.get(collection) ?? new Map()
    const fields = propertyEntries.map(([name, raw]) => {
      if (!FIELD_NAME.test(name)) throw moduleError('VALIDATION_FAILED', `Unsupported record field name ${name}`)
      const property = asRecord(raw)
      const override = overrides.get(name)
      return fieldDefinition(name, property, required.has(name), override)
    })
    const fieldNames = new Set(fields.map(field => field.fieldId))
    const policy = queryPolicies.get(collection)
    for (const field of policy?.staticFilters ?? []) {
      if (!fieldNames.has(field)) throw moduleError('VALIDATION_FAILED', `Frontend filter ${field} is not declared by record schema ${schemaRef}`)
    }
    const scalar = fields.filter(field => SCALAR_FIELD_TYPES.has(field.type)).map(field => field.fieldId)
    const searchable = fields.filter(field => SEARCHABLE_FIELD_TYPES.has(field.type)).map(field => field.fieldId)
    const projection: MpsRecordCollectionProjection = {
      collection,
      schemaRef,
      defaultVisibility: 'private',
      fields,
      searchableFields: policy?.search ? searchable : [],
      filterableFields: policy?.filter ? scalar : [...(policy?.staticFilters ?? [])],
      sortableFields: policy?.sort ? scalar : [],
      referenceFields: fields.filter(field => field.type === 'recordReference').map(field => field.fieldId),
      schemaDefinition: schema,
      retentionPolicy: 'keepOnUninstall',
    }
    const validation = validateGreenfieldModuleCollection(projection)
    if (!validation.valid) {
      throw moduleError('VALIDATION_FAILED', `MPS record schema ${schemaRef} cannot be projected: ${validation.issues.map(issue => `${issue.code} ${issue.path}`).join('; ')}`)
    }
    return projection
  })
}

function fieldDefinition(
  name: string,
  schema: Record<string, unknown>,
  required: boolean,
  override?: Record<string, unknown>,
): GreenfieldModuleFieldDefinition {
  const rawDeclaredType = typeof override?.type === 'string' ? override.type : null
  if (rawDeclaredType && !FIELD_TYPES.has(rawDeclaredType as GreenfieldModuleFieldType)) {
    throw moduleError('VALIDATION_FAILED', `Unsupported MPS frontend field type ${rawDeclaredType}`)
  }
  const declaredType = rawDeclaredType as GreenfieldModuleFieldType | null
  const type = declaredType ?? schemaFieldType(schema)
  const label = typeof override?.label === 'string' ? override.label : humanize(name)
  const options = arrayOfRecords(override?.options).map(option => ({value: String(option.value), label: String(option.label)}))
  const enumOptions = Array.isArray(schema.enum)
    ? schema.enum.filter(value => typeof value === 'string').map(value => ({value, label: humanize(value)}))
    : []
  return {
    fieldId: name,
    name,
    type,
    label,
    ...(required ? {required: true} : {}),
    ...((options.length ? options : enumOptions).length ? {options: options.length ? options : enumOptions} : {}),
    ...(typeof override?.recordType === 'string' ? {referenceCollection: override.recordType} : {}),
    ...(typeof override?.placeholder === 'string' ? {placeholder: override.placeholder} : {}),
    ...(typeof override?.helpText === 'string' ? {helpText: override.helpText} : {}),
  }
}

function schemaFieldType(schema: Record<string, unknown>): GreenfieldModuleFieldType {
  if (Array.isArray(schema.enum) && schema.enum.every(value => typeof value === 'string')) return 'singleSelect'
  if (schema.type === 'boolean') return 'boolean'
  if (schema.type === 'number' || schema.type === 'integer') return 'number'
  if (schema.type === 'string' && schema.format === 'date') return 'date'
  if (schema.type === 'string' && schema.format === 'date-time') return 'dateTime'
  if (schema.type === 'string' && (schema.format === 'uri' || schema.format === 'url')) return 'url'
  if (schema.type === 'string') return typeof schema.maxLength === 'number' && schema.maxLength > 500 ? 'multilineText' : 'text'
  if (schema.type === 'array' && asRecord(schema.items).type === 'string') return Array.isArray(asRecord(schema.items).enum) ? 'multiSelect' : 'tags'
  if (schema.type === 'object') return 'json'
  throw moduleError('VALIDATION_FAILED', `Unsupported MPS record schema field type ${String(schema.type)}`)
}

function collectFrontendFields(frontend: Record<string, unknown> | null): Map<string, Map<string, Record<string, unknown>>> {
  const out = new Map<string, Map<string, Record<string, unknown>>>()
  for (const view of arrayOfRecords(frontend?.views)) {
    const recordTypes = new Set(arrayOfRecords(view.bindings)
      .filter(binding => binding.source === 'record.detail' && typeof binding.recordType === 'string')
      .map(binding => String(binding.recordType)))
    if (recordTypes.size !== 1) continue
    const recordType = [...recordTypes][0]!
    const fields = out.get(recordType) ?? new Map<string, Record<string, unknown>>()
    visitComponents(view.root, component => {
      if (component.type !== 'field') return
      const field = asRecord(component.field)
      if (typeof field.id === 'string') fields.set(field.id, field)
    })
    out.set(recordType, fields)
  }
  return out
}

function collectQueryPolicies(frontend: Record<string, unknown> | null) {
  const out = new Map<string, {search: boolean; filter: boolean; sort: boolean; staticFilters: Set<string>}>()
  for (const view of arrayOfRecords(frontend?.views)) {
    for (const binding of arrayOfRecords(view.bindings)) {
      if (binding.source !== 'record.query' || typeof binding.recordType !== 'string') continue
      const query = asRecord(binding.query)
      const current = out.get(binding.recordType) ?? {search: false, filter: false, sort: false, staticFilters: new Set<string>()}
      current.search ||= typeof query.searchParam === 'string'
      current.filter ||= typeof query.filterParam === 'string'
      current.sort ||= typeof query.sortParam === 'string'
      for (const key of Object.keys(asRecord(query.filters))) current.staticFilters.add(key)
      out.set(binding.recordType, current)
    }
  }
  return out
}

function visitComponents(value: unknown, visit: (component: Record<string, unknown>) => void): void {
  if (!isRecord(value)) return
  visit(value)
  for (const child of Array.isArray(value.children) ? value.children : []) visitComponents(child, visit)
}

function requiredIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(value)) {
    throw moduleError('VALIDATION_FAILED', `${label} is invalid`)
  }
  return value
}

function requiredSafePath(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SAFE_PATH.test(value)) throw moduleError('VALIDATION_FAILED', `${label} is invalid`)
  return value
}

function humanize(value: string): string {
  const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replaceAll(/[-_.]+/g, ' ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asRecord(value: unknown): Record<string, any> {
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
