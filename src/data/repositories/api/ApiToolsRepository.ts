import type {ApiClient} from '@/api/client'
import type {
  ComposerToolItem,
  ComposerToolSection,
  FunctionInvocationResult,
  ToolsRepository,
} from '@/data/repositories/contracts/ToolsRepository'

const BUILTIN_TOOLS: ComposerToolItem[] = [
  {toolId: 'modula.tool.photo', name: 'Photo', section: 'Media', availability: 'active'},
  {toolId: 'modula.tool.camera', name: 'Camera', section: 'Media', availability: 'active'},
  {toolId: 'modula.tool.poll', name: 'Poll', section: 'Create', availability: 'preview'},
  {toolId: 'modula.tool.link', name: 'Link', section: 'Create', availability: 'active'},
  {
    toolId: 'modula.tool.commentToDm',
    name: 'Comment to DM',
    section: 'Productivity',
    availability: 'preview',
  },
  {
    toolId: 'modula.tool.automation',
    name: 'Automation',
    section: 'Automation',
    availability: 'preview',
  },
  {toolId: 'modula.tool.aiAssist', name: 'AI Assist', section: 'AI', availability: 'preview'},
  {
    toolId: 'modula.tool.saveToVault',
    name: 'Save to Vault',
    section: 'Modules',
    availability: 'unavailable',
    requiresModule: 'Vault Notes',
  },
  {
    toolId: 'modula.tool.createTask',
    name: 'Create Task',
    section: 'Modules',
    availability: 'unavailable',
    requiresModule: 'Tasks',
  },
  {
    toolId: 'modula.tool.marketplace',
    name: 'Browse marketplace',
    section: 'Marketplace',
    availability: 'active',
  },
]

function sectionFor(slug: string, explicit?: string): ComposerToolSection {
  if (explicit && ['Media', 'Create', 'Productivity', 'Automation', 'AI', 'Modules', 'Marketplace'].includes(explicit)) {
    return explicit as ComposerToolSection
  }
  if (slug.includes('photo') || slug.includes('camera') || slug.includes('gif')) return 'Media'
  if (slug.includes('poll') || slug.includes('link')) return 'Create'
  if (slug.includes('automation')) return 'Automation'
  if (slug.includes('ai')) return 'AI'
  if (slug.includes('vault') || slug.includes('task')) return 'Modules'
  if (slug.includes('market')) return 'Marketplace'
  return 'Productivity'
}

function decodeTools(value: unknown): ComposerToolItem[] {
  if (!Array.isArray(value) || value.length === 0) return BUILTIN_TOOLS
  return value.map(item => {
    const row = item as Record<string, unknown>
    const slug = String(row.slug ?? row.tool_id ?? row.toolId ?? 'tool')
    const availability = String(row.availability ?? 'preview')
    return {
      toolId: slug,
      name: String(row.display_name ?? row.displayName ?? row.name ?? slug),
      section: sectionFor(slug, typeof row.section === 'string' ? row.section : undefined),
      availability: (['active', 'preview', 'unavailable'].includes(availability)
        ? availability
        : 'preview') as ComposerToolItem['availability'],
      requiresModule:
        typeof row.requiresModule === 'string'
          ? row.requiresModule
          : slug.includes('vault')
            ? 'Vault Notes'
            : slug.includes('task')
              ? 'Tasks'
              : undefined,
      description: typeof row.description === 'string' ? row.description : undefined,
    }
  })
}

export class ApiToolsRepository implements ToolsRepository {
  constructor(private readonly client: ApiClient) {}

  async listComposerTools(): Promise<ComposerToolItem[]> {
    try {
      return await this.client.get({path: '/v1/tools'}, decodeTools)
    } catch {
      return BUILTIN_TOOLS
    }
  }

  async invokeFunction(
    functionId: string,
    input: Record<string, unknown> = {},
  ): Promise<FunctionInvocationResult> {
    try {
      const result = await this.client.post(
        {
          path: `/v1/functions/${encodeURIComponent(functionId)}/invoke`,
          body: {input, installationId: input.installationId},
          authenticated: true,
        },
        value => {
          const row = (value ?? {}) as Record<string, unknown>
          if (typeof row.jobId === 'string') {
            return {state: 'queued' as const, jobId: row.jobId, message: 'Running in the background.'}
          }
          if (row.status === 'failed') {
            return {state: 'failed' as const, message: String(row.message ?? 'Function failed')}
          }
          return {state: 'completed' as const, message: 'Completed'}
        },
      )
      return result
    } catch {
      return {state: 'failed', message: 'Function unavailable'}
    }
  }
}
