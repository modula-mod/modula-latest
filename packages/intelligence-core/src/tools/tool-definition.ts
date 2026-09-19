/**
 * Tools are Modula-owned capabilities exposed to intelligence providers.
 * Models propose tool calls; Modula validates, authorizes, and executes.
 * Never eval(), shell, SQL, filesystem, or arbitrary native bridges.
 */
export type IntelligenceToolExecutionMode = 'read' | 'write'

export type IntelligenceToolDefinition = {
  id: string
  description: string
  /**
   * Minimal JSON-Schema-like object for Mission 01 validation.
   * Full JSON Schema engines are deferred; required/type checks are enforced.
   */
  inputSchema: IntelligenceToolInputSchema
  permission?: string
  execution: IntelligenceToolExecutionMode
}

export type IntelligenceToolInputSchema = {
  type?: 'object'
  required?: readonly string[]
  properties?: Readonly<Record<string, IntelligenceToolPropertySchema>>
  additionalProperties?: boolean
}

export type IntelligenceToolPropertySchema = {
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'
  description?: string
}
