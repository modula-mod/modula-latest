import type {ApiClient} from '@/api/client'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import type {
  ComposerToolItem,
  ComposerToolSection,
  FunctionInvocationResult,
  ToolsRepository,
} from '@/data/repositories/contracts/ToolsRepository'

const BUILTIN_TOOLS: ComposerToolItem[] = [
  {
    toolId: 'modula.tool.photo',
    manifestId: 'composer.media.photo',
    moduleId: 'module-media',
    name: 'Photo',
    section: 'Media',
    availability: 'preview',
    description: 'Local picker bridge; upload still follows composer media limits.',
  },
  {
    toolId: 'modula.tool.camera',
    manifestId: 'composer.media.camera',
    moduleId: 'module-media',
    name: 'Camera',
    section: 'Media',
    availability: 'preview',
    description: 'Camera capture surface. Native permission prompts remain explicit.',
  },
  {
    toolId: 'modula.tool.video',
    manifestId: 'composer.media.video',
    moduleId: 'module-media',
    name: 'Video',
    section: 'Media',
    availability: 'unavailable',
    requiresModule: 'Media Studio',
    description: 'Video attach preview is visible but not enabled in this build.',
  },
  {
    toolId: 'modula.tool.gif',
    manifestId: 'composer.media.gif',
    moduleId: 'module-sticker-kit',
    name: 'GIF',
    section: 'Media',
    availability: 'unavailable',
    description: 'Coming Soon. GIF search is not part of beta Composer and no remote picker is called.',
  },
  {
    toolId: 'modula.tool.file',
    manifestId: 'composer.files.attach',
    moduleId: 'module-files',
    name: 'File',
    section: 'Media',
    availability: 'unavailable',
    requiresModule: 'Files',
    description: 'File attach waits for Files module install and permission scopes.',
  },
  {
    toolId: 'modula.tool.poll',
    manifestId: 'composer.create.poll',
    moduleId: 'module-functions',
    name: 'Poll',
    section: 'Create',
    availability: 'unavailable',
    description: 'Coming Soon. Polls are not part of beta Composer and no poll is published.',
  },
  {
    toolId: 'modula.tool.link',
    manifestId: 'composer.create.link',
    moduleId: 'module-link-library',
    name: 'Link',
    section: 'Create',
    availability: 'unavailable',
    description: 'Coming Soon. Link cards are not part of beta Composer; paste a URL in the post text instead.',
  },
  {
    toolId: 'modula.tool.location',
    manifestId: 'composer.create.location',
    moduleId: 'module-places',
    name: 'Location',
    section: 'Create',
    availability: 'unavailable',
    requiresModule: 'Places',
    description: 'Location attach is blocked until a Places module and permission prompt exist.',
  },
  {
    toolId: 'modula.tool.schedule',
    manifestId: 'composer.create.schedule',
    moduleId: 'module-calendar',
    name: 'Schedule',
    section: 'Create',
    availability: 'unavailable',
    requiresModule: 'Calendar',
    description: 'Scheduled publishing preview only; no background post job is created.',
  },
  {
    toolId: 'modula.tool.contentWarning',
    manifestId: 'composer.create.content-warning',
    moduleId: 'module-moderation',
    name: 'Content warning',
    section: 'Create',
    availability: 'preview',
    description: 'Adds local content-warning metadata to the draft preview.',
  },
  {
    toolId: 'modula.tool.commentToDm',
    manifestId: 'composer.productivity.comment-to-dm',
    moduleId: 'module-crm',
    name: 'Comment to DM',
    section: 'Productivity',
    availability: 'preview',
    description: 'Creates a DM follow-up stub from social context; no message is sent.',
  },
  {
    toolId: 'modula.tool.saveToVault',
    manifestId: 'composer.productivity.save-to-vault',
    moduleId: 'digital.modula.vault-notes',
    name: 'Save to Vault',
    section: 'Productivity',
    availability: 'requiresInstall',
    requiresModule: 'Vault Notes',
    description: 'Requires Vault Notes before private note capture appears in Composer.',
  },
  {
    toolId: 'modula.tool.createTask',
    manifestId: 'composer.productivity.create-task',
    moduleId: 'digital.modula.tasks',
    name: 'Create Task',
    section: 'Productivity',
    availability: 'requiresInstall',
    requiresModule: 'Tasks',
    description: 'Requires Tasks module before a draft can become a Board action.',
  },
  {
    toolId: 'modula.tool.automation',
    manifestId: 'composer.automation.run',
    moduleId: 'module-automations',
    name: 'Automation',
    section: 'Automation',
    availability: 'unavailable',
    requiresModule: 'Automations',
    description: 'Automation launch is visible but blocked; no unattended action runs.',
  },
  {
    toolId: 'modula.tool.approval',
    manifestId: 'composer.automation.approval',
    moduleId: 'module-team-approvals',
    name: 'Request approval',
    section: 'Automation',
    availability: 'preview',
    description: 'Queues a local approval stub for team drafts.',
  },
  {
    toolId: 'modula.tool.aiRewrite',
    manifestId: 'composer.ai.rewrite',
    moduleId: 'module-agents',
    name: 'AI rewrite',
    section: 'AI',
    availability: 'unavailable',
    requiresModule: 'Agents',
    description:
      'AI rewrite is blocked until an Agents module manifest grants the composer rewrite scope. No text is sent to an AI service in this preview.',
  },
  {
    toolId: 'modula.tool.translate',
    manifestId: 'composer.ai.translate',
    moduleId: 'module-translate-lite',
    name: 'Translation',
    section: 'AI',
    availability: 'preview',
    description: 'Translation preview; no remote translation API is called by fallback.',
  },
  {
    toolId: 'modula.tool.productAttach',
    manifestId: 'composer.modules.product-attach',
    moduleId: 'module-commerce',
    name: 'Product attach',
    section: 'Modules',
    availability: 'unavailable',
    requiresModule: 'Commerce',
    description: 'Product cards require Commerce. There is no fake pricing checkout.',
  },
  {
    toolId: 'modula.tool.nftAttach',
    manifestId: 'composer.modules.nft-attach',
    moduleId: 'module-nft-entitlements',
    name: 'NFT attach blocked',
    section: 'Modules',
    availability: 'unavailable',
    requiresModule: 'NFT Entitlements',
    description:
      'NFT attach is unavailable because DIMON is inactive. Composer will not mint, verify, or attach NFT claims in this build.',
  },
  {
    toolId: 'modula.tool.marketplace',
    manifestId: 'composer.marketplace.browse',
    moduleId: 'module-marketplace',
    name: 'Browse Product Hub',
    section: 'Marketplace',
    availability: 'active',
    description: 'Open Product Hub to inspect registry modules.',
  },
]

function sectionFor(slug: string, explicit?: string): ComposerToolSection {
  if (explicit && ['Media', 'Create', 'Productivity', 'Automation', 'AI', 'Modules', 'Marketplace'].includes(explicit)) {
    return explicit as ComposerToolSection
  }
  if (
    slug.includes('photo') ||
    slug.includes('camera') ||
    slug.includes('video') ||
    slug.includes('gif') ||
    slug.includes('file')
  ) {
    return 'Media'
  }
  if (
    slug.includes('poll') ||
    slug.includes('link') ||
    slug.includes('location') ||
    slug.includes('schedule') ||
    slug.includes('warning')
  ) {
    return 'Create'
  }
  if (slug.includes('automation')) return 'Automation'
  if (slug.includes('ai') || slug.includes('translate')) return 'AI'
  if (slug.includes('vault') || slug.includes('task') || slug.includes('product') || slug.includes('nft')) {
    return 'Modules'
  }
  if (slug.includes('market')) return 'Marketplace'
  return 'Productivity'
}

function decodeTools(value: unknown): ComposerToolItem[] {
  if (!Array.isArray(value) || value.length === 0) return []
  return value.map(item => {
    const row = item as Record<string, unknown>
    const slug = String(row.slug ?? row.tool_id ?? row.toolId ?? 'tool')
    const availability = String(row.availability ?? 'preview')
    return {
      toolId: slug,
      manifestId:
        typeof row.manifestId === 'string'
          ? row.manifestId
          : typeof row.manifest_id === 'string'
            ? row.manifest_id
            : undefined,
      moduleId:
        typeof row.moduleId === 'string'
          ? row.moduleId
          : typeof row.module_id === 'string'
            ? row.module_id
            : undefined,
      name: String(row.display_name ?? row.displayName ?? row.name ?? slug),
      section: sectionFor(slug, typeof row.section === 'string' ? row.section : undefined),
      availability: (['active', 'preview', 'requiresInstall', 'requiresEnable', 'requiresConfiguration', 'unavailable'].includes(availability)
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

function decodeContributionTools(value: unknown): ComposerToolItem[] {
  if (!Array.isArray(value) || value.length === 0) return []
  return value.map(item => {
    const row = (item ?? {}) as Record<string, unknown>
    const manifest = (row.manifest ?? {}) as Record<string, unknown>
    const toolId = String(manifest.toolId ?? manifest.actionId ?? row.id ?? row.contribution_key ?? 'module-tool')
    const moduleId = String(row.moduleId ?? row.module_id ?? manifest.moduleId ?? '')
    const available = Boolean(row.available)
    const installationStatus = String(row.installationStatus ?? row.installation_status ?? '')
    return {
      toolId,
      manifestId: String(row.id ?? toolId),
      moduleId,
      name: String(manifest.label ?? manifest.name ?? manifest.title ?? toolId),
      section: sectionFor(toolId, typeof manifest.section === 'string' ? manifest.section : undefined),
      availability: available
        ? 'active'
        : installationStatus === 'installedDisabled' || installationStatus === 'disabled'
          ? 'requiresEnable'
          : installationStatus === 'configurationRequired'
            ? 'requiresConfiguration'
            : 'requiresInstall',
      requiresModule: typeof manifest.requiresModule === 'string' ? manifest.requiresModule : moduleId,
      description: typeof manifest.description === 'string' ? manifest.description : undefined,
    }
  })
}

export class ApiToolsRepository implements ToolsRepository {
  constructor(private readonly client: ApiClient) {}

  async listComposerTools(): Promise<ComposerToolItem[]> {
    try {
      const contributions = await this.client.get(
        {path: '/v1/modules/contributions', authenticated: true, query: {surface: 'composer'}},
        decodeContributionTools,
      )
      const coreTools = await this.client.get({path: '/v1/tools'}, decodeTools)
      return mergeTools(contributions, coreTools)
    } catch {
      if (runtimeEnvironment.dataSource === 'local') return BUILTIN_TOOLS
      throw new Error('Composer tools are unavailable.')
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

function mergeTools(primary: ComposerToolItem[], fallback: ComposerToolItem[]): ComposerToolItem[] {
  const byId = new Map<string, ComposerToolItem>()
  for (const item of fallback) byId.set(item.toolId, item)
  for (const item of primary) byId.set(item.toolId, item)
  return Array.from(byId.values())
}
