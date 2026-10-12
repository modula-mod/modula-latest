import type {GreenfieldJsonSchema} from '@modula/greenfield-contracts'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {moduleError} from './module-errors.js'

const MAX_JSON_BYTES = 256_000
const MAX_DEPTH = 24
const MAX_ERRORS = 20

export function assertGovernedSchemaValue(schema: GreenfieldJsonSchema, value: unknown, direction: 'input' | 'output'): void {
  let serialized = ''
  try {
    serialized = canonicalJsonStringify(value)
  } catch {
    throw moduleError('VALIDATION_FAILED', `Function ${direction} is not canonical JSON`)
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_JSON_BYTES) throw moduleError('VALIDATION_FAILED', `Function ${direction} exceeds maximum size`)
  const errors: string[] = []
  validate(schema, value, '$', errors, 0)
  if (errors.length) throw moduleError('VALIDATION_FAILED', `Function ${direction} schema validation failed: ${errors[0]}`)
}

function validate(schema: GreenfieldJsonSchema, value: unknown, path: string, errors: string[], depth: number): void {
  if (errors.length >= MAX_ERRORS) return
  if (depth > MAX_DEPTH) {
    errors.push(`${path} exceeds maximum depth`)
    return
  }
  if (schema.const !== undefined && !sameJson(schema.const, value)) errors.push(`${path} does not match const`)
  if (schema.enum && !schema.enum.some(candidate => sameJson(candidate, value))) errors.push(`${path} is not an allowed value`)
  if (schema.type === 'null') {
    if (value !== null) errors.push(`${path} must be null`)
    return
  }
  if (schema.type === 'object' || schema.type === undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path} must be an object`)
      return
    }
    const object = value as Record<string, unknown>
    const properties = schema.properties ?? {}
    for (const key of schema.required ?? []) if (!(key in object)) errors.push(`${path}.${key} is required`)
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(object)) if (!(key in properties)) errors.push(`${path}.${key} is not permitted`)
    }
    for (const [key, child] of Object.entries(properties)) {
      if (key in object) validate(child, object[key], `${path}.${key}`, errors, depth + 1)
    }
    return
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) errors.push(`${path} must be an array`)
    else if (schema.items) value.forEach((item, index) => validate(schema.items!, item, `${path}[${index}]`, errors, depth + 1))
    return
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') errors.push(`${path} must be a string`)
    else {
      if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} is too short`)
      if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} is too long`)
    }
    return
  }
  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') errors.push(`${path} must be a boolean`)
    return
  }
  if (schema.type === 'integer' || schema.type === 'number') {
    const valid = schema.type === 'integer' ? Number.isInteger(value) : typeof value === 'number' && Number.isFinite(value)
    if (!valid) errors.push(`${path} must be ${schema.type}`)
    else {
      const number = value as number
      if (schema.minimum !== undefined && number < schema.minimum) errors.push(`${path} is below minimum`)
      if (schema.maximum !== undefined && number > schema.maximum) errors.push(`${path} is above maximum`)
    }
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  try {
    return canonicalJsonStringify(left) === canonicalJsonStringify(right)
  } catch {
    return false
  }
}
