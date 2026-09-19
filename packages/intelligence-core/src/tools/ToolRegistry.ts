import {IntelligenceError} from '../contracts/errors.js'
import type {IntelligenceToolDefinition} from './tool-definition.js'
import type {IntelligenceToolCall, IntelligenceToolValidationResult} from './tool-call.js'
import {validateToolArguments} from './tool-validation.js'

const TOOL_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/

export class IntelligenceToolRegistry {
  private readonly tools = new Map<string, IntelligenceToolDefinition>()

  register(tool: IntelligenceToolDefinition): void {
    if (!tool.id || !TOOL_ID_PATTERN.test(tool.id)) {
      throw new IntelligenceError('INVALID_REQUEST', `Invalid tool ID: ${tool.id}`)
    }
    if (this.tools.has(tool.id)) {
      throw new IntelligenceError('DUPLICATE_TOOL', `Tool already registered: ${tool.id}`, {
        toolId: tool.id,
      })
    }
    this.tools.set(tool.id, Object.freeze({...tool}))
  }

  unregister(id: string): boolean {
    return this.tools.delete(id)
  }

  get(id: string): IntelligenceToolDefinition | undefined {
    return this.tools.get(id)
  }

  list(): readonly IntelligenceToolDefinition[] {
    return [...this.tools.values()]
  }

  /**
   * Validate a model-proposed tool call. Unknown tools, bad args, and missing
   * permissions are rejected. Execution is never performed here.
   */
  validateCall(
    call: IntelligenceToolCall,
    grantedPermissions: readonly string[] = [],
  ): IntelligenceToolValidationResult {
    const tool = this.tools.get(call.toolId)
    if (!tool) {
      return {
        ok: false,
        code: 'TOOL_NOT_FOUND',
        message: `Unknown tool: ${call.toolId}`,
      }
    }

    if (tool.permission && !grantedPermissions.includes(tool.permission)) {
      return {
        ok: false,
        code: 'TOOL_PERMISSION_DENIED',
        message: `Missing permission for tool: ${tool.id}`,
      }
    }

    const argsResult = validateToolArguments(tool.inputSchema, call.arguments)
    if (!argsResult.ok) {
      return {
        ok: false,
        code: 'TOOL_ARGUMENTS_INVALID',
        message: argsResult.message,
      }
    }

    return {ok: true, toolId: tool.id, arguments: call.arguments}
  }
}
