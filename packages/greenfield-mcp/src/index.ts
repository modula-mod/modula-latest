export const serverInfo = {
  name: 'modula-greenfield-mcp',
  version: '0.1.0',
} as const

export type JsonObject = {[key: string]: JsonValue}
export type JsonArray = JsonValue[]
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray

export type ToolDefinition = {
  name: string
  description: string
  inputSchema: JsonObject
}

export type ToolCallResult = {
  content: Array<{
    type: 'text'
    text: string
  }>
  isError?: boolean
}

type ManifestValidationResult = {
  ok: boolean
  errors: string[]
}

type FocusPreset = 'off' | 'light' | 'deep' | 'custom'

type FocusPolicyAnswers = {
  notificationsCanInterrupt: boolean
  feedVisible: boolean
  reelsVisible: boolean
  nonEssentialChatHeld: boolean
  gaiaUnsolicitedAllowed: boolean
  composerRecommendations: boolean
  dockQuieter: boolean
  boardPrioritisesWork: boolean
  modulesRestricted: boolean
  haloActive: boolean
}

type GreenfieldToolName =
  | 'greenfield.doctor'
  | 'greenfield.manifest.validate'
  | 'greenfield.atlas.summary'
  | 'greenfield.design.principles'
  | 'greenfield.intelligence.layers'
  | 'greenfield.commands.list'
  | 'greenfield.dimon.status'
  | 'greenfield.forge.templates'
  | 'greenfield.nft.status'
  | 'greenfield.focus.policy'
  | 'greenfield.privacy.levels'
  | 'greenfield.skill.template'

const intelligenceModelPhrase = 'GAIA executes · AKI verifies · Governor controls'

const layerCatalogue = [
  {name: 'GAIA', role: 'Context, interaction, and user-visible execution.'},
  {name: 'AKI', role: 'Verification, evidence, and forensic reasoning.'},
  {name: 'Governor', role: 'Goals, permissions, orchestration, and governance.'},
  {
    name: 'Circuit Memory',
    role: 'Private structured long-term memory with user controls.',
  },
  {name: 'Kaizen', role: 'Continuous product and intelligence improvement.'},
  {name: 'Foundry', role: 'Data preparation, evaluation, and gated model promotion.'},
  {name: 'Claims Graph', role: 'Evidence-backed relationships between claims.'},
  {name: 'Ledger', role: 'Auditable record of consequential actions and decisions.'},
  {name: 'Command Layer', role: 'Shared execution router between UI, AI, and modules.'},
  {name: 'Forge', role: 'Module creation, packaging, and publication workflow.'},
] as const

const commandCatalogue = [
  {
    command: 'notes.create',
    status: 'preview',
    description: 'Create a local note draft after user confirmation.',
  },
  {
    command: 'tasks.create',
    status: 'preview',
    description: 'Create a local task draft after user confirmation.',
  },
  {
    command: 'focus.start',
    status: 'preview',
    description: 'Start a focus session through the future Focus policy engine.',
  },
  {
    command: 'messaging.send',
    status: 'preview',
    description: 'Send a message only after explicit recipient and body confirmation.',
  },
  {
    command: 'module.install',
    status: 'preview',
    description: 'Install a module from a registry entry after permission review.',
  },
  {
    command: 'dimon.transfer',
    status: 'reserved',
    description: 'Reserved economic command.',
    note: 'DIMON inactive; no transfer, chain, or wallet operation is available.',
  },
  {
    command: 'dimon.asset.transfer',
    status: 'reserved',
    description: 'Reserved NFT / digital ownership transfer request.',
    note: 'DIMON inactive; Preview blocked with no mint, transfer, wallet, or chain operation.',
  },
] as const

const atlasDomainStats = [
  {
    domain: 'Shell, identity, and profile',
    count: 5,
    examples: ['Modula Shell', 'Start Launcher', 'Profile-OS', 'Identity & SSO', 'Ownership controls'],
  },
  {
    domain: 'Social, messaging, and presence',
    count: 7,
    examples: ['Social Network', 'Messaging', 'Chat Assist', 'Quiet Send', 'Merge Feeds', 'Presence'],
  },
  {
    domain: 'Modules, Registry, Marketplace, and Forge',
    count: 10,
    examples: ['Installable Modules', 'Module Registry', 'Marketplace', 'Forge', 'Sandbox'],
  },
  {
    domain: 'Intelligence, commands, and automation',
    count: 10,
    examples: ['GAIA', 'AKI', 'Governor', 'Command Layer', 'Gaia Atlas', 'Automations'],
  },
  {
    domain: 'Attention, privacy, and safety',
    count: 6,
    examples: ['Focus Mode', 'Glass Privacy', 'Permissions', 'Feature Control'],
  },
  {
    domain: 'Creation, economy, and optional inventory',
    count: 6,
    examples: ['Composer Tools', 'Creator Economy', 'DIMON', 'Gamification', 'Widgets'],
  },
] as const

const designPrinciples = [
  {
    source: 'X',
    bullets: [
      'Public square -> protocol-independent social surfaces, not a feed clone.',
      'Creator reach -> user-owned graph, modules, and permissions instead of platform lock-in.',
    ],
  },
  {
    source: 'Apple',
    bullets: [
      'Integrated device feel -> calm host shell with accessible native surfaces.',
      'Ecosystem polish -> explicit module contracts, review gates, and user control.',
    ],
  },
] as const

const forgeTemplates = [
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
    description: 'Personal notes surfaces; package stays external.',
    surfaces: ['route', 'board', 'tab', 'widget'],
    capabilities: ['board.card', 'profile.tab', 'widget.board'],
    permissions: ['storage:namespaced', 'profile:read', 'board:write'],
  },
  {
    id: 'crm',
    name: 'CRM-shaped',
    blurb: 'Leads + automations',
    description: 'CRM foreshadow with automation nodes; not hardcoded in host.',
    surfaces: ['route', 'board', 'tab', 'settings', 'auto'],
    capabilities: ['board.card', 'profile.tab', 'settings.section', 'automation.node'],
    permissions: ['storage:namespaced', 'profile:read', 'board:write', 'contacts:read', 'automation:node'],
  },
  {
    id: 'agent',
    name: 'Agent-shaped',
    blurb: 'GAIA scopes',
    description: 'Agent package that extends GAIA with explicit scopes.',
    surfaces: ['route', 'settings', 'agent', 'tool'],
    capabilities: ['settings.section', 'composer.tool', 'agent.scope'],
    permissions: ['storage:namespaced', 'agent:scope', 'composer:tool', 'notifications:opt-in'],
  },
  {
    id: 'commerce',
    name: 'Commerce-shaped',
    blurb: 'Shop tab',
    description: 'Storefront tab foreshadow; settlements wait for DIMON.',
    surfaces: ['route', 'tab', 'settings'],
    capabilities: ['profile.tab', 'settings.section'],
    permissions: ['storage:namespaced', 'profile:read', 'network:declared'],
  },
] as const

const focusPresetMeta: Record<FocusPreset, {title: string; summary: string; haloLabel: string | null}> = {
  off: {
    title: 'Off',
    summary: 'Normal Modula. Feeds, chats, modules, and notifications operate as permitted.',
    haloLabel: null,
  },
  light: {
    title: 'Light',
    summary:
      'Lower-priority notifications bundled, feed recommendations reduced, dock quieter, Board prioritises active work.',
    haloLabel: 'Light Focus',
  },
  deep: {
    title: 'Deep',
    summary:
      'Only selected modules visible. Feed/Reels may hide. Non-urgent chats held. GAIA avoids unsolicited interruptions. Focus Halo on.',
    haloLabel: 'Deep Focus',
  },
  custom: {
    title: 'Custom',
    summary:
      'User-controlled contacts, modules, navigation, feed, chat, notifications, AI interruptions, duration, and bypass.',
    haloLabel: 'Custom Focus',
  },
}

const focusPolicyQuestions: Array<{key: keyof FocusPolicyAnswers; label: string}> = [
  {key: 'notificationsCanInterrupt', label: 'Can notifications interrupt?'},
  {key: 'feedVisible', label: 'Is the feed fully visible?'},
  {key: 'reelsVisible', label: 'Are Reels / discovery available?'},
  {key: 'nonEssentialChatHeld', label: 'Are non-urgent chats held?'},
  {key: 'gaiaUnsolicitedAllowed', label: 'May GAIA interrupt unsolicited?'},
  {key: 'composerRecommendations', label: 'Composer recommendations on?'},
  {key: 'dockQuieter', label: 'Is the dock / drawer quieter?'},
  {key: 'boardPrioritisesWork', label: 'Does Board prioritise work?'},
  {key: 'modulesRestricted', label: 'Are modules restricted?'},
  {key: 'haloActive', label: 'Is Focus Halo active?'},
]

const glassPrivacyLevels = [
  {
    id: 'disable-sharing',
    title: '1 - Disable Sharing',
    body: 'Prevents content from being forwarded or exported through normal controls.',
    threadHint: 'Forwarding disabled in preview',
  },
  {
    id: 'protected-chat',
    title: '2 - Protected Chat',
    body: 'Stronger controls for private conversations: limited forward, tighter devices.',
    threadHint: 'Protected; limited forward (preview)',
  },
  {
    id: 'vault-chat',
    title: '3 - Vault Chat',
    body: 'Highest protection for communication and storage. Module sandbox required.',
    threadHint: 'Vault Chat; sandbox required (planned)',
  },
] as const

const reservedDimonCapabilities = [
  'value transfer',
  'creator and module rewards',
  'marketplace settlement',
  'ownership and entitlement records',
  'economic ledger entries',
  'future Greenfield account binding',
  'NFT / digital ownership asset reservations',
  'asset transfer request capability',
] as const

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'greenfield.doctor',
    description:
      'Report preview status for Greenfield contracts, DIMON, and the intelligence model.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'greenfield.manifest.validate',
    description:
      'Validate required GreenfieldModuleManifest-like fields from a JSON string or object.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        manifest: {
          oneOf: [{type: 'object'}, {type: 'string'}],
          description: 'Manifest JSON object or JSON string.',
        },
      },
      required: ['manifest'],
    },
  },
  {
    name: 'greenfield.intelligence.layers',
    description: 'List canonical Modula intelligence layers and one-line roles.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'greenfield.atlas.summary',
    description: 'Return approximate Feature Atlas domain counts without reading app source.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'greenfield.design.principles',
    description: 'Return short X / Apple remap bullets for Modula product direction.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'greenfield.commands.list',
    description: 'List static example commands for the Greenfield preview.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'greenfield.forge.templates',
    description: 'List static Forge module templates and declared surfaces.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'greenfield.dimon.status',
    description: 'Report inactive DIMON preview status and reserved capabilities.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'greenfield.nft.status',
    description: 'Report reserved NFT/ownership status without chain, wallet, or balance access.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'greenfield.focus.policy',
    description: 'Return Focus policy answers for the off, light, deep, or custom preset.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        preset: {
          type: 'string',
          enum: ['off', 'light', 'deep', 'custom'],
          description: 'Focus preset to evaluate.',
        },
      },
      required: ['preset'],
    },
  },
  {
    name: 'greenfield.privacy.levels',
    description: 'List Glass Privacy levels and preview enforcement hints.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'greenfield.skill.template',
    description: 'Return the outline of the Modula module skill.md sections.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
]

export function callGreenfieldTool(name: string, args: unknown = {}): ToolCallResult {
  switch (name as GreenfieldToolName) {
    case 'greenfield.doctor':
      return jsonToolResult({
        ok: true,
        phase: {
          current: 'Phase A/B craft with Phase C/D preview surfaces',
          summary:
            'Greenfield is represented as contracts, manifests, and architecture previews; production runtime capabilities remain gated.',
        },
        contracts: {
          status: 'preview',
          summary:
            'Greenfield contracts define module, command, and capability shapes; this MCP server does not publish packages or touch a chain.',
        },
        dimon: {
          status: 'inactive',
          summary: 'DIMON is not active yet',
        },
        intelligence: {
          status: 'preview',
          model: intelligenceModelPhrase,
        },
      })

    case 'greenfield.manifest.validate':
      return jsonToolResult(validateManifestArgument(args))

    case 'greenfield.intelligence.layers':
      return jsonToolResult({
        model: intelligenceModelPhrase,
        layers: layerCatalogue,
      })

    case 'greenfield.atlas.summary': {
      const total = atlasDomainStats.reduce((sum, item) => sum + item.count, 0)
      return jsonToolResult({
        status: 'static-summary',
        source:
          'Package-local summary mirroring Feature Atlas domains; the MCP package does not import app source.',
        approximate: true,
        totalDomains: atlasDomainStats.length,
        totalEntries: total,
        domains: atlasDomainStats,
        honesty:
          'Schematic only. No live graph runtime, telemetry, user data, chain RPC, or network calls.',
      })
    }

    case 'greenfield.design.principles':
      return jsonToolResult({
        status: 'static-guidance',
        principles: designPrinciples,
        honesty:
          'Static product guidance only. No publishing, wallet action, network call, or chain RPC.',
      })

    case 'greenfield.commands.list':
      return jsonToolResult({
        status: 'preview',
        honesty:
          'These are catalogue examples only; this MCP server does not execute commands.',
        commands: commandCatalogue,
      })

    case 'greenfield.forge.templates':
      return jsonToolResult({
        status: 'preview',
        templates: forgeTemplates,
        honesty:
          'Templates seed local draft thinking only. This server does not publish packages, install modules, run untrusted code, or settle commerce.',
      })

    case 'greenfield.dimon.status':
      return jsonToolResult({
        status: 'inactive',
        phrase: 'DIMON is not active yet',
        honesty:
          'No chain, wallet, transfer, or settlement access is exposed by this preview server.',
        reservedCapabilities: reservedDimonCapabilities,
      })

    case 'greenfield.nft.status':
      return jsonToolResult({
        status: 'reserved',
        phrase: 'DIMON is not active yet',
        summary:
          'NFT ownership and entitlement records are reserved for a future ownership layer.',
        blockedActions: ['mint request', 'transfer request', 'settlement'],
        honesty:
          'No chain RPC, wallet connection, balance lookup, funded-looking wallet address, floor price, minting, transfer, or settlement is exposed by this preview server.',
        databaseBoundary:
          'ADR-006: PostgreSQL is the primary application database. Blockchain is not the app database.',
      })

    case 'greenfield.focus.policy':
      return focusPolicyTool(args)

    case 'greenfield.privacy.levels':
      return jsonToolResult({
        status: 'preview',
        levels: glassPrivacyLevels,
        honesty:
          'Selection can persist locally in the app. Enforcement remains preview/planned and is not cryptographic, chain, or wallet protection.',
      })

    case 'greenfield.skill.template':
      return jsonToolResult({
        template: 'skill.md',
        purpose:
          'Machine-readable capability declaration for GAIA, AKI, and the Governor.',
        sections: [
          'Identity',
          'What it does',
          'Commands exposed',
          'Data types owned',
          'Inputs / outputs',
          'Surfaces',
          'AI-accessible actions',
          'Permissions required',
          'Network destinations',
          'Risk & confirmation',
          'Events',
          'Audit / Ledger',
          'Compatibility',
        ],
      })

    default:
      return jsonToolResult(
        {
          ok: false,
          error: `Unknown tool: ${name}`,
        },
        true,
      )
  }
}

function focusPolicyTool(args: unknown): ToolCallResult {
  const argsObject = isRecord(args) ? args : {}
  const preset = argsObject.preset

  if (!isFocusPreset(preset)) {
    return jsonToolResult(
      {
        ok: false,
        error: 'greenfield.focus.policy requires preset: off, light, deep, or custom',
      },
      true,
    )
  }

  const meta = focusPresetMeta[preset]
  const answers = evaluateFocusPolicy(preset)

  return jsonToolResult({
    ok: true,
    preset,
    title: meta.title,
    summary: meta.summary,
    haloLabel: meta.haloLabel,
    answers,
    questions: focusPolicyQuestions.map((question) => ({
      ...question,
      answer: answers[question.key],
    })),
    honesty:
      'Preview only. Production enforcement depends on FocusPolicyEngine surface adapters.',
  })
}

function evaluateFocusPolicy(preset: FocusPreset): FocusPolicyAnswers {
  switch (preset) {
    case 'off':
      return {
        notificationsCanInterrupt: true,
        feedVisible: true,
        reelsVisible: true,
        nonEssentialChatHeld: false,
        gaiaUnsolicitedAllowed: true,
        composerRecommendations: true,
        dockQuieter: false,
        boardPrioritisesWork: false,
        modulesRestricted: false,
        haloActive: false,
      }
    case 'light':
      return {
        notificationsCanInterrupt: false,
        feedVisible: true,
        reelsVisible: true,
        nonEssentialChatHeld: false,
        gaiaUnsolicitedAllowed: true,
        composerRecommendations: true,
        dockQuieter: true,
        boardPrioritisesWork: true,
        modulesRestricted: false,
        haloActive: true,
      }
    case 'deep':
      return {
        notificationsCanInterrupt: false,
        feedVisible: false,
        reelsVisible: false,
        nonEssentialChatHeld: true,
        gaiaUnsolicitedAllowed: false,
        composerRecommendations: false,
        dockQuieter: true,
        boardPrioritisesWork: true,
        modulesRestricted: true,
        haloActive: true,
      }
    case 'custom':
      return {
        notificationsCanInterrupt: false,
        feedVisible: true,
        reelsVisible: false,
        nonEssentialChatHeld: true,
        gaiaUnsolicitedAllowed: false,
        composerRecommendations: false,
        dockQuieter: true,
        boardPrioritisesWork: true,
        modulesRestricted: true,
        haloActive: true,
      }
  }
}

function isFocusPreset(value: unknown): value is FocusPreset {
  return value === 'off' || value === 'light' || value === 'deep' || value === 'custom'
}

function validateManifestArgument(args: unknown): ManifestValidationResult {
  const errors: string[] = []
  const argsObject = isRecord(args) ? args : {}
  const rawManifest =
    'manifest' in argsObject ? argsObject.manifest : args

  let manifest: unknown = rawManifest

  if (typeof rawManifest === 'string') {
    try {
      manifest = JSON.parse(rawManifest)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'invalid JSON'
      return {ok: false, errors: [`manifest must be valid JSON: ${message}`]}
    }
  }

  if (!isRecord(manifest)) {
    return {ok: false, errors: ['manifest must be a JSON object']}
  }

  requireString(manifest, 'moduleId', errors)
  requireString(manifest, 'name', errors)
  requireString(manifest, 'packageVersion', errors)

  if (!isRecord(manifest.hostCompatibility)) {
    errors.push('hostCompatibility must be an object')
  } else {
    requireString(
      manifest.hostCompatibility,
      'minimumHostVersion',
      errors,
      'hostCompatibility.minimumHostVersion',
    )
  }

  if (!Array.isArray(manifest.permissions)) {
    errors.push('permissions must be an array')
  }

  requireString(manifest, 'uninstallBehaviour', errors)

  return {
    ok: errors.length === 0,
    errors,
  }
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
  label = key,
): void {
  const value = record[key]

  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${label} must be a non-empty string`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function jsonToolResult(value: unknown, isError = false): ToolCallResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2),
      },
    ],
    ...(isError ? {isError: true} : {}),
  }
}
