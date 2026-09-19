import type {IntelligenceToolInputSchema} from './tool-definition.js'

export type ToolArgumentValidation =
  | {ok: true}
  | {ok: false; message: string}

/**
 * Minimal structural validator for Mission 01.
 * Rejects unknown tools' invented shapes without enabling arbitrary execution.
 */
export function validateToolArguments(
  schema: IntelligenceToolInputSchema,
  value: unknown,
): ToolArgumentValidation {
  if (schema.type === 'object' || schema.properties || schema.required) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return {ok: false, message: 'Tool arguments must be an object'}
    }

    const record = value as Record<string, unknown>
    const properties = schema.properties ?? {}
    const required = schema.required ?? []

    for (const key of required) {
      if (!(key in record) || record[key] === undefined) {
        return {ok: false, message: `Missing required argument: ${key}`}
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!(key in properties)) {
          return {ok: false, message: `Unexpected argument: ${key}`}
        }
      }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (!(key in record) || record[key] === undefined) continue
      const expected = propertySchema.type
      if (!expected) continue
      if (!matchesJsonType(record[key], expected)) {
        return {
          ok: false,
          message: `Invalid type for argument ${key}: expected ${expected}`,
        }
      }
    }
  }

  return {ok: true}
}

function matchesJsonType(
  value: unknown,
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null',
): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'null':
      return value === null
    case 'array':
      return Array.isArray(value)
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value)
    default:
      return false
  }
}
