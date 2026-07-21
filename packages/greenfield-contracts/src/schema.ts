export type GreenfieldSchemaDeprecationState = 'active' | 'deprecated' | 'retired'

export type GreenfieldSchema = {
  schemaId: string
  namespace: string
  version: number
  visibilityAllowance: Array<'public' | 'followers' | 'teams' | 'private' | 'system'>
  owner: string
  deprecationState: GreenfieldSchemaDeprecationState
  migrationPath?: string
  validationLimits?: Record<string, number>
}
