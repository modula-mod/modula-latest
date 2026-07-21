import {getSchema, validateRecord, type GreenfieldVisibility} from '@modula/greenfield-schema-registry'
export {getSchema}
export function validateSchemaRecord(schemaId: string, version: number, data: unknown, visibility: GreenfieldVisibility): void {
  const schema = getSchema(schemaId, version)
  if (!schema) throw Object.assign(new Error('Unknown schema'), {code: 'VALIDATION_FAILED'})
  const errors = validateRecord(schema, data, visibility)
  if (errors.length) throw Object.assign(new Error(errors.join('; ')), {code: 'VALIDATION_FAILED'})
}
