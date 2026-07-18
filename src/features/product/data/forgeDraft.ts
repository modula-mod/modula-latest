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

export type ForgeWorkspaceMode = 'plan' | 'build' | 'widgets' | 'preview' | 'manifest'

export const FORGE_WORKSPACE_MODES: Array<{id: ForgeWorkspaceMode; label: string; hint: string}> = [
  {id: 'plan', label: 'Plan', hint: 'Outline before canvas — Lovable/Bolt Plan Mode energy'},
  {id: 'build', label: 'Build', hint: 'Surfaces, capabilities, chat'},
  {id: 'widgets', label: 'Widgets', hint: 'Pick Board widgets and local AI affordances'},
  {id: 'preview', label: 'Preview', hint: 'Profile tab / Board / Settings mock'},
  {id: 'manifest', label: 'Manifest', hint: 'JSON + skill.md + publish readiness'},
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
  'board.widget.summary',
  'board.widget.metrics',
  'board.widget.timeline',
  'board.widget.inbox',
  'profile.tab',
  'settings.section',
  'composer.tool',
  'automation.node',
  'automation.trigger',
  'automation.action',
  'search.index',
  'search.provider',
  'agent.scope',
  'agent.action.summarise',
  'agent.action.draft-reply',
  'agent.action.extract-tasks',
  'widget.board',
  'widget.analytics',
  'widget.calendar',
  'widget.health',
  'file.viewer',
  'contacts.panel',
  'calendar.overlay',
  'newsletter.digest',
  'game.surface',
  'team.inbox',
  'monetisation.preview',
] as const

export const FORGE_PERMISSIONS = MODULE_PERMISSION_CATALOGUE.map(item => item.id)

export type ForgeWidgetOption = {
  id: string
  label: string
  description: string
  capability: string
}

export const FORGE_WIDGET_OPTIONS: ForgeWidgetOption[] = [
  {
    id: 'quick-summary',
    label: 'Quick summary',
    description: 'Compact Board card with today/next/biggest change.',
    capability: 'board.widget.summary',
  },
  {
    id: 'metrics-strip',
    label: 'Metrics strip',
    description: 'Three-number analytics card for lightweight status.',
    capability: 'board.widget.metrics',
  },
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Upcoming events, due dates, or recent module activity.',
    capability: 'board.widget.timeline',
  },
  {
    id: 'inbox-zero',
    label: 'Inbox zero',
    description: 'Team or personal inbox triage counter.',
    capability: 'board.widget.inbox',
  },
]

export type ForgeAiAction = {
  id: string
  label: string
  description: string
  capability: string
}

export const FORGE_AI_ACTIONS: ForgeAiAction[] = [
  {
    id: 'summarise',
    label: 'Read-only summarise',
    description: 'Summarise selected module data without writing changes.',
    capability: 'agent.action.summarise',
  },
  {
    id: 'draft-reply',
    label: 'Draft reply',
    description: 'Prepare a response for user approval before send.',
    capability: 'agent.action.draft-reply',
  },
  {
    id: 'extract-tasks',
    label: 'Extract tasks',
    description: 'Turn selected text or inbox items into proposed tasks.',
    capability: 'agent.action.extract-tasks',
  },
]

export type ForgeEventOption = {
  id: string
  label: string
  direction: 'emits' | 'consumes'
  description: string
}

export const FORGE_EVENT_OPTIONS: ForgeEventOption[] = [
  {
    id: 'module.installed',
    label: 'module.installed',
    direction: 'consumes',
    description: 'Hydrate defaults after Registry installation.',
  },
  {
    id: 'board.card.created',
    label: 'board.card.created',
    direction: 'emits',
    description: 'Tell the host a Board card was created locally.',
  },
  {
    id: 'profile.tab.opened',
    label: 'profile.tab.opened',
    direction: 'consumes',
    description: 'Refresh tab state when the host opens it.',
  },
  {
    id: 'automation.triggered',
    label: 'automation.triggered',
    direction: 'consumes',
    description: 'React to a user-enabled automation trigger.',
  },
  {
    id: 'task.extracted',
    label: 'task.extracted',
    direction: 'emits',
    description: 'Emit task proposals from AI extract actions.',
  },
  {
    id: 'file.attached',
    label: 'file.attached',
    direction: 'consumes',
    description: 'Receive an approved file reference from Files.',
  },
]

export type ForgeTestTarget = {
  id: string
  label: string
  description: string
}

export const FORGE_TEST_TARGETS: ForgeTestTarget[] = [
  {id: 'ios', label: 'iOS', description: 'Local Preview checklist only'},
  {id: 'android', label: 'Android', description: 'Local Preview checklist only'},
  {id: 'web', label: 'Web', description: 'Local Preview checklist only'},
]

export type ForgeMonetisationOption = {
  id: 'free' | 'one-time' | 'subscription'
  label: string
  description: string
  checkoutEnabled: boolean
}

export const FORGE_MONETISATION_OPTIONS: ForgeMonetisationOption[] = [
  {
    id: 'free',
    label: 'Free',
    description: 'No checkout. Registry pricing remains unset.',
    checkoutEnabled: true,
  },
  {
    id: 'one-time',
    label: 'One-time',
    description: 'DIMON is not active yet. Paid checkout cannot complete.',
    checkoutEnabled: false,
  },
  {
    id: 'subscription',
    label: 'Subscription',
    description: 'DIMON is not active yet. Paid checkout cannot complete.',
    checkoutEnabled: false,
  },
]

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
    id: 'vault-notes',
    name: 'Vault Notes',
    blurb: 'Private notes + Board',
    description: 'Namespaced private notes with a profile tab and Board summary widget.',
    surfaces: ['route', 'board', 'tab', 'settings', 'widget'],
    capabilities: ['board.card', 'profile.tab', 'settings.section', 'widget.board', 'board.widget.summary'],
    permissions: ['storage:namespaced', 'profile:read', 'board:write'],
  },
  {
    id: 'tasks',
    name: 'Tasks',
    blurb: 'Tasks + automations',
    description: 'Task capture, Board timeline, optional notifications, and automation nodes.',
    surfaces: ['route', 'board', 'settings', 'auto', 'widget'],
    capabilities: [
      'board.card',
      'settings.section',
      'automation.node',
      'automation.trigger',
      'widget.board',
      'board.widget.timeline',
    ],
    permissions: ['storage:namespaced', 'board:write', 'notifications:opt-in', 'automation:node'],
  },
  {
    id: 'crm',
    name: 'CRM',
    blurb: 'Leads + automations',
    description: 'Contact panel, profile tab, lead Board card, and declared workflow automations.',
    surfaces: ['route', 'board', 'tab', 'settings', 'auto', 'widget'],
    capabilities: [
      'board.card',
      'profile.tab',
      'settings.section',
      'automation.node',
      'contacts.panel',
      'board.widget.inbox',
    ],
    permissions: ['storage:namespaced', 'profile:read', 'board:write', 'contacts:read', 'automation:node'],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    blurb: 'Events + reminders',
    description: 'Calendar overlay with Board timeline and opt-in reminder notifications.',
    surfaces: ['route', 'board', 'tab', 'settings', 'widget'],
    capabilities: ['board.card', 'profile.tab', 'settings.section', 'calendar.overlay', 'board.widget.timeline'],
    permissions: ['storage:namespaced', 'profile:read', 'board:write', 'notifications:opt-in'],
  },
  {
    id: 'files',
    name: 'Files',
    blurb: 'Files surface',
    description: 'File viewer route with declared network and explicit file grants.',
    surfaces: ['route', 'board', 'settings', 'tool'],
    capabilities: ['board.card', 'settings.section', 'composer.tool', 'file.viewer', 'search.provider'],
    permissions: ['storage:namespaced', 'files:read', 'network:declared', 'composer:tool'],
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    blurb: 'Digest composer',
    description: 'Newsletter digest surface with composer helper and declared network delivery.',
    surfaces: ['route', 'tab', 'settings', 'tool', 'widget'],
    capabilities: [
      'profile.tab',
      'settings.section',
      'composer.tool',
      'newsletter.digest',
      'widget.board',
    ],
    permissions: ['storage:namespaced', 'profile:read', 'composer:tool', 'network:declared'],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    blurb: 'Metrics widgets',
    description: 'Read-only analytics route with Board metrics and declared data source.',
    surfaces: ['route', 'board', 'settings', 'widget'],
    capabilities: ['board.card', 'settings.section', 'widget.analytics', 'board.widget.metrics', 'search.index'],
    permissions: ['storage:namespaced', 'profile:read', 'board:write', 'network:declared'],
  },
  {
    id: 'health-agent',
    name: 'Health Agent',
    blurb: 'GAIA-scoped helper',
    description: 'Wellbeing check-in with explicit GAIA scope, AKI review, and opt-in reminders.',
    surfaces: ['route', 'board', 'settings', 'agent', 'widget'],
    capabilities: [
      'board.card',
      'settings.section',
      'agent.scope',
      'agent.action.summarise',
      'widget.health',
    ],
    permissions: ['storage:namespaced', 'agent:scope', 'board:write', 'notifications:opt-in'],
  },
  {
    id: 'game-stub',
    name: 'Game stub',
    blurb: 'Playable surface',
    description: 'Tiny game route with Board score card; runtime remains a preview stub.',
    surfaces: ['route', 'board', 'tab', 'settings'],
    capabilities: ['board.card', 'profile.tab', 'settings.section', 'game.surface'],
    permissions: ['storage:namespaced', 'profile:read', 'board:write'],
  },
  {
    id: 'widget-pack',
    name: 'Widget pack',
    blurb: 'Board widgets',
    description: 'Multiple Board widgets with no independent app route beyond settings.',
    surfaces: ['board', 'settings', 'widget'],
    capabilities: [
      'board.card',
      'settings.section',
      'widget.board',
      'board.widget.summary',
      'board.widget.metrics',
      'board.widget.timeline',
    ],
    permissions: ['storage:namespaced', 'board:write'],
  },
  {
    id: 'team-inbox',
    name: 'Team inbox',
    blurb: 'Shared triage',
    description: 'Team inbox surface with contact grants, declared network, and Board triage widget.',
    surfaces: ['route', 'board', 'settings', 'auto', 'agent', 'widget'],
    capabilities: [
      'board.card',
      'settings.section',
      'automation.node',
      'team.inbox',
      'agent.action.draft-reply',
      'board.widget.inbox',
    ],
    permissions: [
      'storage:namespaced',
      'board:write',
      'contacts:read',
      'network:declared',
      'automation:node',
      'agent:scope',
    ],
  },
  {
    id: 'automations-pack',
    name: 'Automations pack',
    blurb: 'Trigger/action nodes',
    description: 'Pack of automation nodes with explicit user enablement and no silent execution.',
    surfaces: ['route', 'settings', 'auto', 'agent'],
    capabilities: [
      'settings.section',
      'automation.node',
      'automation.trigger',
      'automation.action',
      'agent.action.extract-tasks',
    ],
    permissions: ['storage:namespaced', 'automation:node', 'agent:scope', 'notifications:opt-in'],
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
  widgets?: string[]
  aiActions?: string[]
  events?: string[]
  testTargets?: string[]
  monetisation?: ForgeMonetisationOption['id']
}): string {
  const slug = slugifyModuleName(input.name)
  const moduleId = `digital.modula.${slug}`
  const widgets = input.widgets ?? []
  const aiActions = input.aiActions ?? []
  const events = input.events ?? []
  const testTargets = input.testTargets ?? []
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
    widgets: input.surfaces.includes('widget')
      ? (widgets.length ? widgets : ['quick-summary']).map(widgetId => `board.${slug}.${widgetId}`)
      : [],
    aiActions: aiActions.map(actionId => `gaia.${slug}.${actionId}`),
    events,
    testMatrix: testTargets.map(targetId => ({target: targetId, status: 'local-preview-only'})),
    monetisation: {
      plan: input.monetisation ?? 'free',
      checkout: input.monetisation === 'free' || !input.monetisation ? 'not-required' : 'disabled-dimon-inactive',
    },
    capabilities: input.capabilities,
    permissions: input.permissions,
    uninstallBehaviour: 'exportThenPurge',
  }

  return JSON.stringify(manifest, null, 2)
}

export type ForgeRiskSummary = {
  score: number
  label: string
  detail: string
}

export function buildForgeRiskSummary(permissions: string[]): ForgeRiskSummary {
  const weights = {low: 1, medium: 3, high: 6}
  const selected = MODULE_PERMISSION_CATALOGUE.filter(item => permissions.includes(item.id))
  const score = selected.reduce((total, item) => total + weights[item.risk], 0)
  const highCount = selected.filter(item => item.risk === 'high').length
  const mediumCount = selected.filter(item => item.risk === 'medium').length
  if (highCount > 0 || score >= 10) {
    return {
      score,
      label: 'Sensitive',
      detail: `${highCount} high-risk and ${mediumCount} review permission(s). Require explicit owner review.`,
    }
  }
  if (mediumCount > 0 || score >= 4) {
    return {
      score,
      label: 'Needs review',
      detail: `${mediumCount} permission(s) need review before Registry submission.`,
    }
  }
  return {
    score,
    label: 'Low risk',
    detail: selected.length ? 'Only low-risk permissions selected.' : 'No permissions selected yet.',
  }
}

export function buildForgeSkillPreview(input: {
  name: string
  description: string
  capabilities: string[]
  permissions: string[]
  surfaces: ForgeCanvasNodeId[]
  widgets: string[]
  aiActions: string[]
  events: string[]
  monetisation: ForgeMonetisationOption['id']
}): string {
  const name = input.name.trim() || 'My Module'
  const slug = slugifyModuleName(name)
  const selectedWidgets = FORGE_WIDGET_OPTIONS.filter(item => input.widgets.includes(item.id))
  const selectedAiActions = FORGE_AI_ACTIONS.filter(item => input.aiActions.includes(item.id))
  const selectedEvents = FORGE_EVENT_OPTIONS.filter(item => input.events.includes(item.id))
  const monetisation = FORGE_MONETISATION_OPTIONS.find(item => item.id === input.monetisation)
  const list = (items: string[]) => (items.length ? items.map(item => `- ${item}`).join('\n') : '- none selected')

  return `---
name: ${slug}
description: ${input.description.trim() || 'Draft module from Forge Preview'}
---

# ${name}

## Surfaces
${list(input.surfaces)}

## Capabilities
${list(input.capabilities)}

## Permissions
${list(input.permissions)}

## Board widgets
${list(selectedWidgets.map(item => `${item.label} (${item.capability})`))}

## AI actions
${list(selectedAiActions.map(item => `${item.label} (${item.capability})`))}

AI actions require explicit GAIA scopes and AKI verification before execution.

## Events
${list(selectedEvents.map(item => `${item.direction}: ${item.label}`))}

## Monetisation
- ${monetisation?.label ?? 'Free'}
- ${monetisation?.description ?? 'No checkout. Registry pricing remains unset.'}

## Preview boundary
- No codegen execution from Forge Builder.
- No publish success is simulated.
- Sandbox inactive until Registry install/runtime is available.`
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
  if (q.includes('ai') || q.includes('summarise') || q.includes('draft reply') || q.includes('tasks')) {
    return 'AI actions Preview: summarise, draft reply, and extract tasks are local toggles here. Real execution needs GAIA scopes, AKI verification, and Governor control.'
  }
  if (q.includes('template')) {
    return 'Templates include Vault Notes, Tasks, CRM, Calendar, Files, Newsletter, Analytics, Health Agent, Game stub, Widget pack, Team inbox, and Automations pack. They only seed local draft state.'
  }
  return `Preview (not a model): For “${context.name}”, I’d map “${prompt.trim()}” onto surfaces [${context.surfaces.join(', ') || 'none'}], then ask you to approve permissions before any Registry install.`
}
