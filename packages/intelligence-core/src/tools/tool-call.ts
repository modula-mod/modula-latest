export type IntelligenceToolCall = {
  id: string
  toolId: string
  arguments: unknown
}

export type IntelligenceToolValidationResult =
  | {ok: true; toolId: string; arguments: unknown}
  | {
      ok: false
      code: 'TOOL_NOT_FOUND' | 'TOOL_ARGUMENTS_INVALID' | 'TOOL_PERMISSION_DENIED'
      message: string
    }
