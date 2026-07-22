export type ComposerToolSection =
  | 'Media'
  | 'Create'
  | 'Productivity'
  | 'Automation'
  | 'AI'
  | 'Modules'
  | 'Marketplace'

export type ComposerToolItem = {
  toolId: string
  manifestId?: string
  moduleId?: string
  name: string
  section: ComposerToolSection
  availability:
    | 'active'
    | 'preview'
    | 'requiresInstall'
    | 'requiresEnable'
    | 'requiresConfiguration'
    | 'unavailable'
  requiresModule?: string
  description?: string
}

export type FunctionInvocationState =
  | 'idle'
  | 'validating'
  | 'running'
  | 'queued'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type FunctionInvocationResult = {
  state: FunctionInvocationState
  jobId?: string
  message?: string
}

export interface ToolsRepository {
  listComposerTools(): Promise<ComposerToolItem[]>
  invokeFunction(functionId: string, input?: Record<string, unknown>): Promise<FunctionInvocationResult>
}
