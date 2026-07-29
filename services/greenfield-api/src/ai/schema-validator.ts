import type {GreenfieldAIJsonSchema} from '@modula/greenfield-contracts'
import {ProviderExecutionError} from './providers/contract.js'

const MAX_JSON_BYTES = 128_000
const MAX_JSON_DEPTH = 24
const MAX_OBJECT_KEYS = 512

export type SchemaValidationResult = {
  valid: boolean
  errors: string[]
}

export function validateStructuredOutput(schema: GreenfieldAIJsonSchema, value: unknown): SchemaValidationResult {
  const errors: string[] = []
  const serialized = safeStringify(value)
  if (serialized.length > MAX_JSON_BYTES) errors.push('structured output exceeds maximum size')
  if (jsonDepth(value) > MAX_JSON_DEPTH) errors.push('structured output exceeds maximum depth')
  if (objectKeyCount(value) > MAX_OBJECT_KEYS) errors.push('structured output exceeds maximum key count')
  validateAgainstSchema(schema, value, '$', errors)
  return {valid: errors.length === 0, errors}
}

export function parseAndValidateStructuredOutput(schema: GreenfieldAIJsonSchema, text: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ProviderExecutionError('AI_STRUCTURED_OUTPUT_INVALID', 'Structured output is not valid JSON', false)
  }
  const result = validateStructuredOutput(schema, parsed)
  if (!result.valid) {
    throw new ProviderExecutionError('AI_STRUCTURED_OUTPUT_INVALID', `Structured output failed schema validation: ${result.errors[0] ?? 'invalid'}`, false)
  }
  return parsed as Record<string, unknown>
}

export function assertValidJsonSchema(schema: GreenfieldAIJsonSchema): void {
  if (Object.keys(schema).length === 0) return
  if (schema.type !== undefined && schema.type !== 'object') {
    throw new ProviderExecutionError('AI_STRUCTURED_OUTPUT_INVALID', 'Structured output schema must describe an object', false)
  }
  if (schema.required !== undefined && !Array.isArray(schema.required)) {
    throw new ProviderExecutionError('AI_STRUCTURED_OUTPUT_INVALID', 'Structured output schema required field must be an array', false)
  }
  if (jsonDepth(schema) > 18) {
    throw new ProviderExecutionError('AI_STRUCTURED_OUTPUT_INVALID', 'Structured output schema exceeds maximum depth', false)
  }
}

function validateAgainstSchema(schema: GreenfieldAIJsonSchema, value: unknown, path: string, errors: string[]): void {
  if (errors.length > 20) return
  const type = schema.type
  if (type === 'object' || type === undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path} must be an object`)
      return
    }
    const object = value as Record<string, unknown>
    for (const required of arrayOfStrings(schema.required)) {
      if (!(required in object)) errors.push(`${path}.${required} is required`)
    }
    const properties = schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
      ? schema.properties as Record<string, GreenfieldAIJsonSchema>
      : {}
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(object)) {
        if (!(key in properties)) errors.push(`${path}.${key} is not permitted`)
      }
    }
    for (const [key, child] of Object.entries(properties)) {
      if (key in object) validateAgainstSchema(child, object[key], `${path}.${key}`, errors)
    }
    return
  }
  if (type === 'string' && typeof value !== 'string') errors.push(`${path} must be a string`)
  else if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) errors.push(`${path} must be a number`)
  else if (type === 'integer' && (!Number.isInteger(value))) errors.push(`${path} must be an integer`)
  else if (type === 'boolean' && typeof value !== 'boolean') errors.push(`${path} must be a boolean`)
  else if (type === 'array' && !Array.isArray(value)) errors.push(`${path} must be an array`)
  else if (type === 'array' && Array.isArray(value) && schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)) {
    value.forEach((item, index) => validateAgainstSchema(schema.items as GreenfieldAIJsonSchema, item, `${path}[${index}]`, errors))
  }
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function jsonDepth(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  if (Array.isArray(value)) return 1 + Math.max(0, ...value.map(jsonDepth))
  return 1 + Math.max(0, ...Object.values(value as Record<string, unknown>).map(jsonDepth))
}

function objectKeyCount(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + objectKeyCount(item), 0)
  return Object.entries(value as Record<string, unknown>).reduce((sum, [, child]) => sum + 1 + objectKeyCount(child), 0)
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return 'null'
  }
}
