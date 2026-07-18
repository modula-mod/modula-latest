import {MODULE_PERMISSION_CATALOGUE} from '@/features/product/data/modulePermissions'

export type ForgeCanvasNodeId =
  | 'route'
  | 'board'
  | 'tab'
  | 'settings'
  | 'tool'
  | 'auto'
  | 'agent'
  | 'widget'

export type ForgeBuilderStep = 'identity' | 'surfaces' | 'permissions' | 'manifest' | 'publish'

export type ForgeWorkspaceMode = 'plan' | 'build' | 'preview' | 'manifest'

export const FORGE_WORKSPACE_MODES: Array<{id: ForgeWorkspaceMode; label: string; hint: string}> = [
  {id: 'plan', label: 'Plan', hint: 'Outline before canvas — Lovable/Bolt Plan Mode energy'},
  {id: 'build', label: 'Build', hint: 'Surfaces, capabilities, chat'},
  {id: 'preview', label: 'Preview', hint: 'Profile tab / Board / Settings mock'},
  {id: 'manifest', label: 'Manifest', hint: 'JSON + versions + publish readiness'},
]

export const FORGE_STEPS: Array<{id: ForgeBuilderStep; label: string}> = [
  {id: 'identity', label: 'Identity'},
  {id: 'surfaces', label: 'Surfaces'},
  {id: 'permissions', label: 'Permissions'},
  {id: 'manifest', label: 'Manifest'},
  {id: 'publish', label: 'Publish'},
]

export const FORGE_CAPABILITIES = [
  'board.card',
  'profile.tab',
  'settings.section',
  'composer.tool',
  'automation.node',
  'search.provider',
  'agent.scope',
  'widget.board',
] as const

export const FORGE_PERMISSIONS = MODULE_PERMISSION_CATALOGUE.map(item => item.id)

export type ForgeTemplate = {
  id: string
  name: string
  blurb: string
  description: string
  surfaces: ForgeCanvasNodeId[]
  capabilities: string[]
  permissions: string[]
}

export const FORGE_TEMPLATES: ForgeTemplate[] = [
  {
    id: 'blank',
    name: 'Blank module',
    blurb: 'Empty canvas',
    description: 'Start from a minimal Greenfield manifest.',
    surfaces: ['route'],
    capabilities: ['board.card'],
    permissions: ['storage:namespaced', 'profile:read'],
  },
  {
    id: 'notes',
    name: 'Notes-shaped',
    blurb: 'Board + tab',
    description: 'Personal notes surfaces — package stays external (Vault Notes pattern).',
    surfaces: ['route', 'board', 'tab', 'widget'],
    capabilities: ['board.card', 'profile.tab', 'widget.board'],
    permissions: ['storage:namespaced', 'profile:read', 'board:write'],
  },
  {
    id: 'crm',
    name: 'CRM-shaped',
    blurb: 'Leads + automations',
    description: 'CRM foreshadow with automation nodes — not hardcoded in host.',
    surfaces: ['route', 'board', 'tab', 'settings', 'auto'],
    capabilities: ['board.card', 'profile.tab', 'settings.section', 'automation.node'],
    permissions: ['storage:namespaced', 'profile:read', 'board:write', 'contacts:read', 'automation:node'],
  },
  {
    id: 'agent',
    name: 'Agent-shaped',
    blurb: 'Gaia scopes',
    description: 'Agent package that extends Gaia with explicit scopes.',
    surfaces: ['route', 'settings', 'agent', 'tool'],
    capabilities: ['settings.section', 'composer.tool', 'agent.scope'],
    permissions: ['storage:namespaced', 'agent:scope', 'composer:tool', 'notifications:opt-in'],
  },
  {
    id: 'commerce',
    name: 'Commerce-shaped',
    blurb: 'Shop tab',
    description: 'Storefront tab foreshadow — settlements wait for DIMON.',
    surfaces: ['route', 'tab', 'settings'],
    capabilities: ['profile.tab', 'settings.section'],
    permissions: ['storage:namespaced', 'profile:read', 'network:declared'],
  },
]

export type ForgeVersionSnapshot = {
  id: string
  label: string
  at: string
  manifest: string
}

export type PublishChecklistItem = {
  id: string
  label: string
  ok: boolean
  detail: string
}

export function slugifyModuleName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'module'
  )
}

export function buildForgeManifestPreview(input: {
  name: string
  description: string
  capabilities: string[]
  permissions: string[]
  surfaces: ForgeCanvasNodeId[]
  repositoryUrl: string
}): string {
  const slug = slugifyModuleName(input.name)
  const moduleId = `digital.modula.${slug}`
  const profileTabs = input.surfaces.includes('tab')
    ? [{tabId: `${slug}-tab`, title: input.name, route: `/modules/${moduleId}`}]
    : []
  const boardSurfaces = input.surfaces.includes('board')
    ? [{surfaceId: `${slug}-board`, title: `${input.name} card`}]
    : []
  const routes = input.surfaces.includes('route')
    ? [{path: `/modules/${moduleId}`, title: input.name}]
    : []
  const settings = input.surfaces.includes('settings')
    ? [
        {
          settingsId: `${slug}-settings`,
          title: `${input.name} settings`,
          route: `/settings/extensions/${moduleId}`,
        },
      ]
    : []

  const manifest = {
    moduleId,
    name: input.name.trim() || 'My Module',
    description: input.description.trim() || 'Draft module from Forge Preview',
    repositoryUrl: input.repositoryUrl.trim() || `https://github.com/modula-mod/${slug}`,
    packageVersion: '0.0.0-preview',
    hostCompatibility: {minimumHostVersion: '0.1.0'},
    routes,
    profileTabs,
    boardSurfaces,
    settings,
    functions: input.surfaces.includes('tool') ? [`${slug}.tool`] : [],
    tools: input.surfaces.includes('tool') ? [`composer.${slug}`] : [],
    widgets: input.surfaces.includes('widget') ? [`board.${slug}`] : [],
    capabilities: input.capabilities,
    permissions: input.permissions,
    uninstallBehaviour: 'exportThenPurge',
  }

  return JSON.stringify(manifest, null, 2)
}

export function buildPublishChecklist(input: {
  name: string
  description: string
  permissions: string[]
  surfaces: ForgeCanvasNodeId[]
  repositoryUrl: string
}): PublishChecklistItem[] {
  return [
    {
      id: 'name',
      label: 'Module name',
      ok: Boolean(input.name.trim()),
      detail: input.name.trim() ? input.name.trim() : 'Required',
    },
    {
      id: 'desc',
      label: 'Description',
      ok: input.description.trim().length >= 12,
      detail: input.description.trim().length >= 12 ? 'Ready' : 'Add a short purpose',
    },
    {
      id: 'repo',
      label: 'Repository URL',
      ok: input.repositoryUrl.includes('http'),
      detail: 'External package home',
    },
    {
      id: 'surface',
      label: 'At least one surface',
      ok: input.surfaces.length > 0,
      detail: `${input.surfaces.length} selected`,
    },
    {
      id: 'perms',
      label: 'Permissions declared',
      ok: input.permissions.length > 0,
      detail: `${input.permissions.length} permissions`,
    },
    {
      id: 'storage',
      label: 'Namespaced storage',
      ok: input.permissions.includes('storage:namespaced'),
      detail: 'Recommended for most modules',
    },
    {
      id: 'sandbox',
      label: 'Sandbox runtime',
      ok: false,
      detail: 'Inactive — Registry install required',
    },
    {
      id: 'publish',
      label: 'Package publish',
      ok: false,
      detail: 'Preview only — nothing is shipped from this build',
    },
  ]
}

export function forgeChatReply(prompt: string, context: {name: string; surfaces: string[]}): string {
  const q = prompt.trim().toLowerCase()
  if (!q) return 'Describe a surface, permission, or template — Preview replies only (not a model).'
  if (q.includes('plan') || q.includes('outline')) {
    return `Plan Preview for “${context.name}”: 1) Identity 2) Surfaces [${context.surfaces.join(', ') || 'none'}] 3) Least-privilege permissions 4) Manifest review 5) Publish readiness (sandbox later).`
  }
  if (q.includes('permission') || q.includes('security')) {
    return 'Permissions Preview: prefer storage:namespaced + explicit user-visible purpose. High-risk scopes (contacts, files, agents) need owner defaults and clear uninstall behaviour.'
  }
  if (q.includes('publish') || q.includes('deploy')) {
    return 'Publish is blocked in this build. Pipeline: Forge draft → SDK package → Fusion → Registry → Marketplace (sandboxed).'
  }
  if (q.includes('agent')) {
    return 'Agent-shaped modules declare agent.scope and never silently read private modules. Open Agents studio to draft scoped packages.'
  }
  if (q.includes('template')) {
    return 'Templates: Blank, Notes-shaped, CRM-shaped, Agent-shaped, Commerce-shaped. They only seed local draft state.'
  }
  return `Preview (not a model): For “${context.name}”, I’d map “${prompt.trim()}” onto surfaces [${context.surfaces.join(', ') || 'none'}], then ask you to approve permissions before any Registry install.`
}
