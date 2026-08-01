import type {ModuleAIProductActionDefinition} from '@modula/module-standard'

export const GREENFIELD_MODULE_AI_FEATURES = [
  'summarise',
  'classify',
  'extract',
  'generate',
  'moderate',
  'schedule',
  'chat',
  'tool-call',
] as const

export const GREENFIELD_MODULE_AI_CAPABILITIES = [
  'chat',
  'text-generation',
  'streaming',
  'structured-output',
  'reasoning',
  'vision',
  'image-generation',
  'embeddings',
  'audio',
  'tool-calling',
] as const

export type GreenfieldModuleAiFeature = typeof GREENFIELD_MODULE_AI_FEATURES[number]
export type GreenfieldModuleAiCapability = typeof GREENFIELD_MODULE_AI_CAPABILITIES[number]

export type GreenfieldModuleAiDeclaration = {
  features: GreenfieldModuleAiFeature[]
  tools?: string[]
  prompts?: string[]
  requiredCapabilities?: GreenfieldModuleAiCapability[]
  dataAccess?: {
    recordScopes?: string[]
    defaultPolicy?: 'deny' | 'module-installation' | 'account-consent'
  }
  productActions?: ModuleAIProductActionDefinition[]
}

export type GreenfieldModuleAiValidationIssue = {
  path: string
  code: string
  message: string
}

const AI_FEATURES = new Set<string>(GREENFIELD_MODULE_AI_FEATURES)
const AI_CAPABILITIES = new Set<string>(GREENFIELD_MODULE_AI_CAPABILITIES)
const ALLOWED_AI_KEYS = new Set(['features', 'tools', 'prompts', 'requiredCapabilities', 'dataAccess', 'productActions'])
const PROVIDER_KEYS = new Set(['provider', 'providerId', 'providerKind', 'providerUrl', 'model', 'modelId', 'modelProvider', 'apiKey', 'providerPayload', 'providerOptions', 'openai', 'anthropic', 'google', 'ollama', 'lmStudio', 'azureOpenAI'])
const AI_CONTEXT_SOURCES = new Set(['current-record', 'selected-content', 'record-metadata', 'module-settings'])
const AI_CONTEXT_CLASSIFICATIONS = new Set(['public', 'internal', 'private', 'sensitive'])
const AI_APPLICATION_MODES = new Set(['preview-only', 'replace-selection', 'replace-document', 'insert', 'metadata-suggestion'])

export function validateGreenfieldModuleAi(
  ai: unknown,
  context: {moduleId: string},
): GreenfieldModuleAiValidationIssue[] {
  const issues: GreenfieldModuleAiValidationIssue[] = []
  const add = (path: string, code: string, message: string) => issues.push({path, code, message})
  if (ai === undefined) return issues
  if (!isRecord(ai)) {
    add('$.ai', 'INVALID_AI_DECLARATION', 'ai must be an object')
    return issues
  }
  for (const key of Object.keys(ai)) {
    if (PROVIDER_KEYS.has(key)) add(`$.ai.${key}`, 'PROVIDER_BOUND_AI_DECLARATION', 'Modules declare AI capabilities, not providers or models')
    else if (!ALLOWED_AI_KEYS.has(key)) add(`$.ai.${key}`, 'UNKNOWN_AI_PROPERTY', `Unknown AI declaration property ${key}`)
  }
  validateBoundedStringArray(ai.features, '$.ai.features', {required: true, max: 40, allowed: AI_FEATURES}, add)
  validateBoundedStringArray(ai.tools, '$.ai.tools', {required: false, max: 80, pattern: /^[a-z0-9][a-z0-9.-]*$/}, add)
  validateBoundedStringArray(ai.prompts, '$.ai.prompts', {required: false, max: 80, pattern: /^[a-z0-9][a-z0-9.-]*$/}, add)
  validateBoundedStringArray(ai.requiredCapabilities, '$.ai.requiredCapabilities', {required: false, max: 40, allowed: AI_CAPABILITIES}, add)
  validateDataAccess(ai.dataAccess, context.moduleId, add)
  validateProductActions(ai.productActions, add)
  return issues
}

function validateProductActions(
  value: unknown,
  add: (path: string, code: string, message: string) => void,
) {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 80) {
    add('$.ai.productActions', 'INVALID_AI_PRODUCT_ACTIONS', 'productActions must be a bounded array')
    return
  }
  value.forEach((action, index) => {
    const path = `$.ai.productActions[${index}]`
    if (!isRecord(action)) {
      add(path, 'INVALID_AI_PRODUCT_ACTION', 'AI product action must be an object')
      return
    }
    for (const key of Object.keys(action)) {
      if (PROVIDER_KEYS.has(key)) add(`${path}.${key}`, 'PROVIDER_BOUND_AI_PRODUCT_ACTION', 'AI product actions must not include provider or model fields')
    }
    validateIdentifier(action.id, `${path}.id`, add)
    validateString(action.name, `${path}.name`, 1, 120, add)
    validateString(action.description, `${path}.description`, 1, 800, add)
    validateIdentifier(action.promptId, `${path}.promptId`, add)
    validateString(action.promptVersionRange, `${path}.promptVersionRange`, 1, 80, add)
    validateString(action.inputSchema, `${path}.inputSchema`, 1, 240, add)
    validateString(action.outputSchema, `${path}.outputSchema`, 1, 240, add)
    validateBoundedStringArray(action.requiredPermissions, `${path}.requiredPermissions`, {required: true, max: 40}, add)
    validateBoundedStringArray(action.requiredCapabilities, `${path}.requiredCapabilities`, {required: true, max: 40}, add)
    validateActionContext(action.context, `${path}.context`, add)
    validateActionExecution(action.execution, `${path}.execution`, add)
    validateActionApplication(action.application, `${path}.application`, add)
  })
}

function validateActionContext(value: unknown, path: string, add: (path: string, code: string, message: string) => void) {
  if (!isRecord(value)) {
    add(path, 'INVALID_AI_PRODUCT_CONTEXT', 'AI product action context must be an object')
    return
  }
  validateEnumArray(value.sources, `${path}.sources`, AI_CONTEXT_SOURCES, add)
  validateInteger(value.maximumRecords, `${path}.maximumRecords`, 1, 20, add)
  validateInteger(value.maximumCharacters, `${path}.maximumCharacters`, 1, 200000, add)
  validateEnumArray(value.allowedClassifications, `${path}.allowedClassifications`, AI_CONTEXT_CLASSIFICATIONS, add)
}

function validateActionExecution(value: unknown, path: string, add: (path: string, code: string, message: string) => void) {
  if (!isRecord(value)) {
    add(path, 'INVALID_AI_PRODUCT_EXECUTION', 'AI product action execution must be an object')
    return
  }
  if (typeof value.streaming !== 'boolean') add(`${path}.streaming`, 'INVALID_AI_BOOLEAN', 'streaming must be boolean')
  if (typeof value.structuredOutput !== 'boolean') add(`${path}.structuredOutput`, 'INVALID_AI_BOOLEAN', 'structuredOutput must be boolean')
  validateInteger(value.maximumToolCalls, `${path}.maximumToolCalls`, 0, 8, add)
  validateInteger(value.timeoutMs, `${path}.timeoutMs`, 1000, 120000, add)
}

function validateActionApplication(value: unknown, path: string, add: (path: string, code: string, message: string) => void) {
  if (!isRecord(value)) {
    add(path, 'INVALID_AI_PRODUCT_APPLICATION', 'AI product action application must be an object')
    return
  }
  if (!AI_APPLICATION_MODES.has(String(value.mode))) add(`${path}.mode`, 'INVALID_AI_APPLICATION_MODE', 'Unsupported AI application mode')
  if (value.explicitConfirmation !== true) add(`${path}.explicitConfirmation`, 'AI_APPLICATION_CONFIRMATION_REQUIRED', 'AI product actions must require explicit confirmation')
  if (typeof value.createsRecordRevision !== 'boolean') add(`${path}.createsRecordRevision`, 'INVALID_AI_BOOLEAN', 'createsRecordRevision must be boolean')
}

function validateDataAccess(
  value: unknown,
  moduleId: string,
  add: (path: string, code: string, message: string) => void,
) {
  if (value === undefined) return
  if (!isRecord(value)) {
    add('$.ai.dataAccess', 'INVALID_AI_DATA_ACCESS', 'ai.dataAccess must be an object')
    return
  }
  for (const key of Object.keys(value)) {
    if (key !== 'recordScopes' && key !== 'defaultPolicy') add(`$.ai.dataAccess.${key}`, 'UNKNOWN_AI_DATA_ACCESS_PROPERTY', `Unknown AI dataAccess property ${key}`)
  }
  if (value.defaultPolicy !== undefined && !['deny', 'module-installation', 'account-consent'].includes(String(value.defaultPolicy))) {
    add('$.ai.dataAccess.defaultPolicy', 'INVALID_AI_DATA_POLICY', 'Unsupported AI data access policy')
  }
  if (value.recordScopes !== undefined) {
    if (!Array.isArray(value.recordScopes) || value.recordScopes.length > 80) {
      add('$.ai.dataAccess.recordScopes', 'INVALID_AI_RECORD_SCOPES', 'recordScopes must be a bounded array')
    } else {
      value.recordScopes.forEach((scope, index) => {
        if (typeof scope !== 'string' || !scope.startsWith(`${moduleId}.`)) {
          add(`$.ai.dataAccess.recordScopes[${index}]`, 'AI_RECORD_SCOPE_OUTSIDE_NAMESPACE', 'AI record scopes must stay in the module namespace')
        }
      })
    }
  }
}

function validateBoundedStringArray(
  value: unknown,
  path: string,
  options: {required: boolean; max: number; allowed?: Set<string>; pattern?: RegExp},
  add: (path: string, code: string, message: string) => void,
) {
  if (value === undefined) {
    if (options.required) add(path, 'MISSING_AI_FEATURES', 'AI declarations require at least one feature')
    return
  }
  if (!Array.isArray(value) || value.length < (options.required ? 1 : 0) || value.length > options.max) {
    add(path, 'INVALID_AI_ARRAY', `${path} must be a bounded string array`)
    return
  }
  const seen = new Set<string>()
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.length < 1 || item.length > 160) {
      add(`${path}[${index}]`, 'INVALID_AI_STRING', 'AI declaration entries must be bounded strings')
      return
    }
    if (seen.has(item)) add(`${path}[${index}]`, 'DUPLICATE_AI_DECLARATION_ENTRY', 'AI declaration entries must be unique')
    seen.add(item)
    if (options.allowed && !options.allowed.has(item)) add(`${path}[${index}]`, 'UNSUPPORTED_AI_DECLARATION_ENTRY', `Unsupported AI declaration entry ${item}`)
    if (options.pattern && !options.pattern.test(item)) add(`${path}[${index}]`, 'INVALID_AI_IDENTIFIER', 'AI identifiers must be lowercase dotted identifiers')
  })
}

function validateIdentifier(value: unknown, path: string, add: (path: string, code: string, message: string) => void) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9.-]*$/.test(value) || value.length > 220) {
    add(path, 'INVALID_AI_IDENTIFIER', 'AI identifiers must be lowercase dotted identifiers')
  }
}

function validateString(value: unknown, path: string, min: number, max: number, add: (path: string, code: string, message: string) => void) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    add(path, 'INVALID_AI_STRING', `${path} must be a string between ${min} and ${max} characters`)
  }
}

function validateInteger(value: unknown, path: string, min: number, max: number, add: (path: string, code: string, message: string) => void) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    add(path, 'INVALID_AI_INTEGER', `${path} must be an integer between ${min} and ${max}`)
  }
}

function validateEnumArray(value: unknown, path: string, allowed: Set<string>, add: (path: string, code: string, message: string) => void) {
  if (!Array.isArray(value) || value.length < 1 || value.length > allowed.size) {
    add(path, 'INVALID_AI_ARRAY', `${path} must be a non-empty bounded array`)
    return
  }
  const seen = new Set<string>()
  value.forEach((item, index) => {
    if (typeof item !== 'string' || !allowed.has(item)) add(`${path}[${index}]`, 'UNSUPPORTED_AI_DECLARATION_ENTRY', `Unsupported AI declaration entry ${String(item)}`)
    if (typeof item === 'string' && seen.has(item)) add(`${path}[${index}]`, 'DUPLICATE_AI_DECLARATION_ENTRY', 'AI declaration entries must be unique')
    if (typeof item === 'string') seen.add(item)
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
