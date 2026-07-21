export type GreenfieldVisibility = 'public' | 'followers' | 'teams' | 'private' | 'system'
export type RegistrySchema = {
  id: string
  version: number
  visibility: readonly GreenfieldVisibility[]
  limits: {maxBytes: number; maxDepth: number}
  required: readonly string[]
}

const schemas: RegistrySchema[] = [
  {id: 'modula.identity.profile', version: 1, visibility: ['public', 'private'], limits: {maxBytes: 32_768, maxDepth: 8}, required: ['displayName']},
  {id: 'modula.social.post', version: 1, visibility: ['public', 'followers', 'teams', 'private'], limits: {maxBytes: 65_536, maxDepth: 12}, required: ['text']},
  {id: 'modula.extensions.tool', version: 1, visibility: ['public', 'private', 'system'], limits: {maxBytes: 65_536, maxDepth: 12}, required: ['name']},
  {id: 'modula.modules.manifest', version: 1, visibility: ['public', 'private', 'system'], limits: {maxBytes: 131_072, maxDepth: 16}, required: ['name', 'version']},
]

export function getSchema(schemaId: string, version = 1): RegistrySchema | undefined {
  return schemas.find(schema => schema.id === schemaId && schema.version === version)
}
export function listSchemas(): readonly RegistrySchema[] {
  return schemas
}
export function isVisibilityAllowed(schema: RegistrySchema, visibility: GreenfieldVisibility): boolean {
  return schema.visibility.includes(visibility)
}
export function validateRecord(schema: RegistrySchema, data: unknown, visibility: GreenfieldVisibility): string[] {
  if (!isVisibilityAllowed(schema, visibility)) return [`Visibility ${visibility} is not allowed`]
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['Record data must be an object']
  const serialized = JSON.stringify(data)
  if (new TextEncoder().encode(serialized).byteLength > schema.limits.maxBytes) return ['Record exceeds size limit']
  const depth = (value: unknown, current = 0): number =>
    value && typeof value === 'object' ? Math.max(current, ...Object.values(value as object).map(item => depth(item, current + 1))) : current
  if (depth(data) > schema.limits.maxDepth) return ['Record exceeds nesting limit']
  return schema.required.filter(key => !(key in (data as Record<string, unknown>))).map(key => `Missing required field ${key}`)
}
