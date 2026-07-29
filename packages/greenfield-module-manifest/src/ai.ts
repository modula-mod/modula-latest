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
}

export type GreenfieldModuleAiValidationIssue = {
  path: string
  code: string
  message: string
}

const AI_FEATURES = new Set<string>(GREENFIELD_MODULE_AI_FEATURES)
const AI_CAPABILITIES = new Set<string>(GREENFIELD_MODULE_AI_CAPABILITIES)
const ALLOWED_AI_KEYS = new Set(['features', 'tools', 'prompts', 'requiredCapabilities', 'dataAccess'])
const PROVIDER_KEYS = new Set(['provider', 'providerId', 'providerKind', 'model', 'modelId', 'modelProvider', 'openai', 'anthropic', 'google', 'ollama', 'lmStudio', 'azureOpenAI'])

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
  return issues
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
