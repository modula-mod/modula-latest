#!/usr/bin/env node
import {readFile} from 'node:fs/promises'

const VERSION = '0.1.0'

type CommandResult = {
  exitCode: number
  stderr?: string
  stdout?: string
}

const REQUIRED_STRING_FIELDS = [
  'moduleId',
  'name',
  'repositoryUrl',
  'packageVersion',
] as const

const OPTIONAL_STRING_ARRAY_FIELDS = [
  'functions',
  'tools',
  'widgets',
  'schemas',
] as const

const UNINSTALL_BEHAVIOURS = new Set(['retainData', 'purgeData', 'exportThenPurge'])

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

type CommandCatalogueEntry = {
  id: string
  label: string
  description: string
  risk: 'low' | 'medium' | 'high'
  confirmation: 'none' | 'preview' | 'explicit'
  permissions: string[]
  undo: string
  note?: string
}

const ATLAS_DOMAIN_STATS = [
  {
    domain: 'Shell, identity, and profile',
    count: 48,
    examples: ['Modula Shell', 'Start Launcher', 'Profile-OS', 'Feature Atlas', 'Ownership controls'],
  },
  {
    domain: 'Social, messaging, and presence',
    count: 62,
    examples: ['Social Network', 'Messaging', 'Chat Assist', 'Quiet Send', 'Merge Feeds', 'Presence'],
  },
  {
    domain: 'Modules, Registry, Marketplace, and Forge',
    count: 95,
    examples: ['Installable Modules', 'Module Registry', 'Marketplace', 'Forge', 'Sandbox', 'skill.md'],
  },
  {
    domain: 'Intelligence, commands, and automation',
    count: 88,
    examples: ['GAIA', 'AKI', 'Governor', 'Command Layer', 'Gaia Atlas', 'Automations', 'Ledger'],
  },
  {
    domain: 'Attention, privacy, and safety',
    count: 54,
    examples: ['Focus Mode', 'Glass Privacy', 'Permissions', 'Feature Control', 'Vault Chat'],
  },
  {
    domain: 'Creation, economy, NFT, and optional inventory',
    count: 72,
    examples: ['Composer Tools', 'Creator Economy', 'DIMON', 'NFT Studio', 'Gamification', 'Widgets'],
  },
  {
    domain: 'Module families (Notes, Tasks, CRM, Files, …)',
    count: 81,
    examples: ['Vault Notes', 'Tasks', 'CRM', 'Calendar', 'Files', 'Newsletter', 'Health', 'Games'],
  },
] as const

const HOST_ATLAS_ENTRY_COUNT = '500+'

const DESIGN_PRINCIPLES = [
  {
    source: 'X',
    bullets: [
      'Content-first densification: text breathes, media glows, chrome stays thin.',
      'Following / For You mode bar inspired — Modula adds Modules as a third rail.',
      'Hairline separators over heavy cards for social reading.',
      'Action-row micro-feedback with honest pending/preview states.',
      'Not a clone: no Chirp, X Blue, or X logo — Modula Teal #369CAA via tokens.',
    ],
  },
  {
    source: 'Apple',
    bullets: [
      'Liquid Glass belongs on the navigation layer (tabs, sheets), not post content.',
      'Minimize chrome on scroll inspiration — content stays the hero.',
      'Reduce Transparency must keep glass chrome readable.',
      'OLED black canvas + solid content surfaces for legibility.',
      'Surface Types map glass/glay/native/solid — engines stay deferred until ready.',
    ],
  },
  {
    source: 'Modula',
    bullets: [
      'Profile-OS is the platform; modules are capabilities; GAIA/AKI/Governor govern intelligence.',
      'See /product/design-lab and docs/design/ui-inspiration-index.md',
    ],
  },
] as const

const FORGE_TEMPLATES = [
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
  {
    id: 'integrations-element',
    name: 'Integrations Element',
    blurb: 'Connection cards',
    description: 'Declared integration cards; no background sync until a user connects a service.',
    surfaces: ['route', 'settings', 'auto', 'widget'],
    capabilities: ['settings.section', 'automation.node', 'automation.trigger', 'integrations.element'],
    permissions: ['storage:namespaced', 'network:declared', 'automation:node'],
  },
  {
    id: 'presence-pack',
    name: 'Presence pack',
    blurb: 'Status + availability',
    description: 'Presence status surfaces for profile and Board with opt-in reminders.',
    surfaces: ['route', 'board', 'tab', 'settings', 'widget'],
    capabilities: ['board.card', 'profile.tab', 'settings.section', 'presence.pack', 'presence.status'],
    permissions: ['storage:namespaced', 'profile:read', 'board:write', 'notifications:opt-in'],
  },
  {
    id: 'theme-pack',
    name: 'Theme pack',
    blurb: 'Appearance presets',
    description: 'Theme preset package that documents token intent without changing host chrome globally.',
    surfaces: ['route', 'settings', 'tab'],
    capabilities: ['profile.tab', 'settings.section', 'theme.pack', 'theme.token'],
    permissions: ['storage:namespaced', 'profile:read'],
  },
  {
    id: 'search-extension',
    name: 'Search extension',
    blurb: 'Scoped search provider',
    description: 'Search provider and index extension for module-owned content.',
    surfaces: ['route', 'settings', 'tool'],
    capabilities: ['settings.section', 'composer.tool', 'search.provider', 'search.index', 'search.extension'],
    permissions: ['storage:namespaced', 'composer:tool'],
  },
] as const

const COMMAND_CATALOGUE: CommandCatalogueEntry[] = [
  {
    id: 'module.validateManifest',
    label: 'Validate module manifest',
    description: 'Validate a modula.module.json file before Registry or host review.',
    risk: 'low',
    confirmation: 'none',
    permissions: [],
    undo: 'No side effects',
  },
  {
    id: 'module.init',
    label: 'Copy module template instructions',
    description: 'Print instructions for copying templates/modula-module into an external repo.',
    risk: 'low',
    confirmation: 'none',
    permissions: [],
    undo: 'No files written by preview CLI',
  },
  {
    id: 'atlas.stats',
    label: 'Atlas domain stats',
    description: 'Print approximate Feature Atlas domain counts.',
    risk: 'low',
    confirmation: 'none',
    permissions: [],
    undo: 'No side effects',
  },
  {
    id: 'atlas.count',
    label: 'Atlas entry count',
    description: 'Print the static host Feature Atlas entry-count statement.',
    risk: 'low',
    confirmation: 'none',
    permissions: [],
    undo: 'No side effects',
  },
  {
    id: 'design.principles',
    label: 'Design principles',
    description: 'Print short X / Apple remap bullets for Modula product direction.',
    risk: 'low',
    confirmation: 'none',
    permissions: [],
    undo: 'No side effects',
  },
  {
    id: 'forge.templates',
    label: 'List Forge templates',
    description: 'Show static Forge module templates and their declared surfaces.',
    risk: 'low',
    confirmation: 'none',
    permissions: [],
    undo: 'No side effects',
  },
  {
    id: 'notes.create',
    label: 'Create note',
    description: 'Create a private note from context or chat.',
    risk: 'low',
    confirmation: 'preview',
    permissions: ['storage:namespaced'],
    undo: 'Delete draft note',
  },
  {
    id: 'tasks.create',
    label: 'Create task',
    description: 'Turn a conversation or post into a task.',
    risk: 'low',
    confirmation: 'preview',
    permissions: ['storage:namespaced', 'board:write'],
    undo: 'Archive task',
  },
  {
    id: 'crm.contact.update',
    label: 'Update CRM contact',
    description: 'Update a lead or contact field.',
    risk: 'medium',
    confirmation: 'explicit',
    permissions: ['contacts:read', 'storage:namespaced'],
    undo: 'Revert field change',
  },
  {
    id: 'messaging.send',
    label: 'Send message',
    description: 'Send a DM or team message.',
    risk: 'high',
    confirmation: 'explicit',
    permissions: ['network:declared'],
    undo: 'Not always reversible; soft recall where supported',
  },
  {
    id: 'focus.start',
    label: 'Start Focus',
    description: 'Begin Light, Deep, or Custom Focus session.',
    risk: 'low',
    confirmation: 'preview',
    permissions: [],
    undo: 'focus.stop',
  },
  {
    id: 'focus.stop',
    label: 'Stop Focus',
    description: 'End the active Focus session.',
    risk: 'low',
    confirmation: 'none',
    permissions: [],
    undo: 'Restore previous session if scheduled',
  },
  {
    id: 'privacy.setLevel',
    label: 'Set Glass Privacy',
    description: 'Disable Sharing / Protected Chat / Vault Chat.',
    risk: 'medium',
    confirmation: 'explicit',
    permissions: [],
    undo: 'Restore previous level',
  },
  {
    id: 'board.addWidget',
    label: 'Add Board widget',
    description: 'Place a module widget on Board.',
    risk: 'low',
    confirmation: 'preview',
    permissions: ['board:write'],
    undo: 'Remove widget',
  },
  {
    id: 'module.install',
    label: 'Install module',
    description: 'Install from Registry after AKI scan.',
    risk: 'high',
    confirmation: 'explicit',
    permissions: ['network:declared'],
    undo: 'module.disable / uninstall',
  },
  {
    id: 'module.disable',
    label: 'Disable module',
    description: 'Disable without purge.',
    risk: 'medium',
    confirmation: 'explicit',
    permissions: [],
    undo: 'Re-enable',
  },
  {
    id: 'dimon.transfer',
    label: 'DIMON transfer',
    description: 'Reserved; DIMON is not active yet.',
    risk: 'high',
    confirmation: 'explicit',
    permissions: ['dimon:transaction:request'],
    undo: 'Blocked while DIMON inactive',
    note: 'No chain, wallet, balance, or RPC operation exists in this CLI.',
  },
  {
    id: 'dimon.asset.transfer',
    label: 'DIMON asset transfer',
    description: 'Reserved NFT / digital ownership transfer request. DIMON is not active yet.',
    risk: 'high',
    confirmation: 'explicit',
    permissions: ['dimon:asset:transfer:request'],
    undo: 'Blocked while DIMON inactive',
    note: 'Preview blocked; no mint, transfer, wallet, or chain operation is available.',
  },
]

const FOCUS_PRESET_META: Record<FocusPreset, {title: string; summary: string; haloLabel: string | null}> = {
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

const FOCUS_POLICY_QUESTIONS: Array<{key: keyof FocusPolicyAnswers; label: string}> = [
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

const GLASS_PRIVACY_LEVELS = [
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

const HELP_TEXT = `Modula CLI

Usage:
  modula help
  modula doctor
  modula atlas stats
  modula atlas count
  modula design principles
  modula mcp info
  modula module validate <path-to-modula.module.json>
  modula module init [--write]
  modula forge templates
  modula intelligence layers
  modula commands list
  modula commands search <q>
  modula focus presets
  modula focus policy <off|light|deep|custom>
  modula privacy levels
  modula dimon status
  modula nft status
  modula verify phase6s
  modula version

This CLI is intentionally local and informational. It does not publish packages,
report wallet balances, or call blockchain RPC endpoints.
`

export async function run(args: string[]): Promise<CommandResult> {
  args = normalizeArgs(args)

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    return ok(HELP_TEXT)
  }

  const [first, second, third] = args

  if (first === 'doctor') {
    return ok(await doctorText())
  }

  if (first === 'atlas' && second === 'stats') {
    return ok(atlasStatsText())
  }

  if (first === 'atlas' && second === 'count') {
    return ok(atlasCountText())
  }

  if (first === 'design' && second === 'principles') {
    return ok(designPrinciplesText())
  }

  if (first === 'mcp' && second === 'info') {
    return ok(mcpInfoText())
  }

  if (first === 'module' && second === 'validate') {
    return validateManifest(third)
  }

  if (first === 'module' && second === 'init') {
    return ok(moduleInitText(args.includes('--write')))
  }

  if (first === 'forge' && second === 'templates') {
    return ok(forgeTemplatesText())
  }

  if (first === 'intelligence' && second === 'layers') {
    return ok(intelligenceLayersText())
  }

  if (first === 'commands' && second === 'list') {
    return ok(commandsListText())
  }

  if (first === 'commands' && second === 'search') {
    return searchCommands(args.slice(2).join(' '))
  }

  if (first === 'focus' && second === 'presets') {
    return ok(focusPresetsText())
  }

  if (first === 'focus' && second === 'policy') {
    return focusPolicyCommand(third)
  }

  if (first === 'privacy' && second === 'levels') {
    return ok(privacyLevelsText())
  }

  if (first === 'dimon' && second === 'status') {
    return ok('DIMON is not active yet\n')
  }

  if (first === 'nft' && second === 'status') {
    return ok(nftStatusText())
  }

  if (first === 'verify' && second === 'phase6s') {
    return ok(verifyPhase6sText())
  }

  if (first === 'version' || first === '--version' || first === '-v') {
    return ok(`@modula/modula-cli ${VERSION}\n`)
  }

  return {
    exitCode: 1,
    stderr: `Unknown command: ${args.join(' ')}\n\n${HELP_TEXT}`,
  }
}

function ok(stdout: string): CommandResult {
  return {exitCode: 0, stdout}
}

function normalizeArgs(args: string[]): string[] {
  if (args[0] === '--') {
    return args.slice(1)
  }

  return args
}

async function doctorText(): Promise<string> {
  const contractPackages = [
    ['@modula/greenfield-contracts', '../../greenfield-contracts/package.json'],
    ['@modula/greenfield-protocol', '../../greenfield-protocol/package.json'],
    ['@modula/dimon-contracts', '../../dimon-contracts/package.json'],
  ] as const

  const packageChecks = await Promise.all(
    contractPackages.map(async ([name, relativePath]) => {
      const exists = await canRead(new URL(relativePath, import.meta.url))
      return `${exists ? '[x]' : '[ ]'} ${name} package ${exists ? 'found' : 'missing'}`
    }),
  )

  return `Greenfield host readiness checklist

Contracts:
${packageChecks.map((line) => `  ${line}`).join('\n')}

DIMON:
  [x] DIMON is not active yet
  [x] No wallet balances, transfers, mining, staking, or blockchain RPC checks

Intelligence model:
  [x] GAIA executes
  [x] AKI verifies
  [x] AGI Governor controls

Startup boundary:
  [x] Host remains launchable with zero optional modules
  [x] Modules register through manifests and public contracts
`
}

async function canRead(path: URL): Promise<boolean> {
  try {
    await readFile(path, 'utf8')
    return true
  } catch {
    return false
  }
}

function mcpInfoText(): string {
  return `Greenfield MCP

Status:
  This workspace ships @modula/greenfield-mcp as a local preview server.
  The Modula CLI does not start or fake an MCP process.

Local run pattern:
  1. pnpm --filter @modula/greenfield-mcp build
  2. pnpm --filter @modula/greenfield-mcp start
  3. Keep the server on local contracts; do not use it to publish packages or
     perform blockchain, wallet, balance, or RPC actions.

Current authoring inputs:
  - packages/greenfield-contracts
  - docs/architecture/module-standards.md
  - templates/modula-module/
`
}

function atlasStatsText(): string {
  const total = ATLAS_DOMAIN_STATS.reduce((sum, item) => sum + item.count, 0)

  return `Feature Atlas domain stats

Source:
  Static package-local summary mirroring the product Feature Atlas.
  Approximate counts only; this CLI does not import app source.

Approximate domains: ${ATLAS_DOMAIN_STATS.length}
Approximate entries: ${total}

${ATLAS_DOMAIN_STATS.map(
  (item) => `${item.domain}: ${item.count}
  examples: ${item.examples.join(', ')}`,
).join('\n\n')}

Honesty:
  Schematic only. No live graph runtime, telemetry, user data, or network calls.
`
}

function atlasCountText(): string {
  return `Feature Atlas count

Host atlas: ${HOST_ATLAS_ENTRY_COUNT} entries (static)

Boundary:
  Package-local statement only. No app source import, telemetry, user data,
  network call, wallet action, or chain RPC.
`
}

function designPrinciplesText(): string {
  return `Modula design principles

${DESIGN_PRINCIPLES.map(
  (group) => `${group.source} remap:
${group.bullets.map((bullet) => `  - ${bullet}`).join('\n')}`,
).join('\n\n')}

Boundary:
  Static product guidance only. No publishing, wallet action, network call, or chain RPC.
`
}

async function validateManifest(manifestPath: string | undefined): Promise<CommandResult> {
  if (!manifestPath) {
    return {
      exitCode: 1,
      stderr: 'Missing manifest path. Usage: modula module validate <path-to-modula.module.json>\n',
    }
  }

  let source: string
  try {
    source = await readFile(manifestPath, 'utf8')
  } catch (error) {
    return {
      exitCode: 1,
      stderr: `Unable to read manifest: ${formatError(error)}\n`,
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch (error) {
    return {
      exitCode: 1,
      stderr: `Invalid JSON: ${formatError(error)}\n`,
    }
  }

  const errors = validateManifestShape(parsed)
  if (errors.length > 0) {
    return {
      exitCode: 1,
      stderr: `Invalid Modula module manifest: ${manifestPath}\n${errors
        .map((error) => `  - ${error}`)
        .join('\n')}\n`,
    }
  }

  const manifest = parsed as Record<string, unknown>
  return ok(`Valid Modula module manifest
  path: ${manifestPath}
  moduleId: ${manifest.moduleId}
  name: ${manifest.name}
  packageVersion: ${manifest.packageVersion}
`)
}

function validateManifestShape(value: unknown): string[] {
  const errors: string[] = []

  if (!isRecord(value)) {
    return ['manifest must be a JSON object']
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    requireNonEmptyString(value, field, errors)
  }

  if (!isRecord(value.hostCompatibility)) {
    errors.push('hostCompatibility must be an object')
  } else {
    requireNonEmptyString(value.hostCompatibility, 'minimumHostVersion', errors, 'hostCompatibility.')
    optionalString(value.hostCompatibility, 'maximumHostVersion', errors, 'hostCompatibility.')
  }

  requireStringArray(value, 'capabilities', errors)
  requireStringArray(value, 'permissions', errors)

  if (typeof value.uninstallBehaviour !== 'string' || !UNINSTALL_BEHAVIOURS.has(value.uninstallBehaviour)) {
    errors.push('uninstallBehaviour must be one of retainData, purgeData, exportThenPurge')
  }

  optionalString(value, 'description', errors)

  for (const field of OPTIONAL_STRING_ARRAY_FIELDS) {
    optionalStringArray(value, field, errors)
  }

  optionalContributionArray(value, 'routes', ['path', 'title'], errors, ['capability'])
  optionalContributionArray(value, 'profileTabs', ['tabId', 'title', 'route'], errors)
  optionalContributionArray(value, 'boardSurfaces', ['surfaceId', 'title'], errors)
  optionalContributionArray(value, 'settings', ['settingsId', 'title', 'route'], errors)
  optionalMigrationMetadata(value, errors)

  return errors
}

function requireNonEmptyString(
  record: Record<string, unknown>,
  field: string,
  errors: string[],
  prefix = '',
): void {
  if (typeof record[field] !== 'string' || record[field].trim().length === 0) {
    errors.push(`${prefix}${field} must be a non-empty string`)
  }
}

function optionalString(
  record: Record<string, unknown>,
  field: string,
  errors: string[],
  prefix = '',
): void {
  if (record[field] !== undefined && typeof record[field] !== 'string') {
    errors.push(`${prefix}${field} must be a string when provided`)
  }
}

function requireStringArray(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (!Array.isArray(record[field])) {
    errors.push(`${field} must be an array of strings`)
    return
  }

  validateStringArray(record[field], field, errors)
}

function optionalStringArray(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (record[field] === undefined) {
    return
  }

  if (!Array.isArray(record[field])) {
    errors.push(`${field} must be an array of strings when provided`)
    return
  }

  validateStringArray(record[field], field, errors)
}

function validateStringArray(value: unknown[], field: string, errors: string[]): void {
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      errors.push(`${field}[${index}] must be a non-empty string`)
    }
  })
}

function optionalContributionArray(
  record: Record<string, unknown>,
  field: string,
  requiredFields: string[],
  errors: string[],
  optionalFields: string[] = [],
): void {
  const value = record[field]
  if (value === undefined) {
    return
  }

  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array when provided`)
    return
  }

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`${field}[${index}] must be an object`)
      return
    }

    for (const requiredField of requiredFields) {
      requireNonEmptyString(item, requiredField, errors, `${field}[${index}].`)
    }

    for (const optionalField of optionalFields) {
      optionalString(item, optionalField, errors, `${field}[${index}].`)
    }
  })
}

function optionalMigrationMetadata(record: Record<string, unknown>, errors: string[]): void {
  const value = record.migrationMetadata
  if (value === undefined) {
    return
  }

  if (!isRecord(value)) {
    errors.push('migrationMetadata must be an object of string values when provided')
    return
  }

  for (const [key, metadataValue] of Object.entries(value)) {
    if (typeof metadataValue !== 'string') {
      errors.push(`migrationMetadata.${key} must be a string`)
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function moduleInitText(writeRequested: boolean): string {
  const templatePath = new URL('../../../templates/modula-module/', import.meta.url).pathname
  const writeNote = writeRequested
    ? 'The --write flag was received, but this preview CLI still only prints copy instructions.'
    : 'No files were written.'

  return `Create a Modula module

${writeNote}

Copy the module template into a separate external module repository:
  cp -R ${templatePath} <your-module-repo>

Then update:
  - modula.module.json
  - skill.md
  - README.md

Keep modules outside the host app and depend only on public contracts.
`
}

function forgeTemplatesText(): string {
  return `Forge templates

${FORGE_TEMPLATES.map(
  (template) => `${template.name} (${template.id})
  ${template.blurb}
  ${template.description}
  surfaces: ${template.surfaces.join(', ')}
  capabilities: ${template.capabilities.join(', ')}
  permissions: ${template.permissions.join(', ')}`,
).join('\n\n')}

These templates seed local draft thinking only. Forge does not publish packages,
install modules, run untrusted code, or settle commerce from this CLI.
`
}

function intelligenceLayersText(): string {
  return `Modula intelligence layers

GAIA:
  Executes user-facing plans through permitted commands and modules.

AKI:
  Verifies claims, evidence, recipients, permissions, and risk before action.

AGI Governor:
  Controls goals, approval modes, orchestration, and governance above agents.
`
}

function commandsListText(): string {
  return `Command catalogue

${COMMAND_CATALOGUE.map(formatCommandEntry).join('\n\n')}

Use:
  modula commands search <q>

This is a static catalogue, not a live execution router.
`
}

function searchCommands(query: string): CommandResult {
  const trimmed = query.trim()
  if (!trimmed) {
    return {
      exitCode: 1,
      stderr: 'Missing search query. Usage: modula commands search <q>\n',
    }
  }

  const needle = trimmed.toLowerCase()
  const matches = COMMAND_CATALOGUE.filter((command) => {
    const haystack = [
      command.id,
      command.label,
      command.description,
      command.risk,
      command.confirmation,
      command.permissions.join(' '),
      command.undo,
      command.note ?? '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(needle)
  })

  if (matches.length === 0) {
    return ok(`Command search: ${trimmed}

No matching commands in the static preview catalogue.
`)
  }

  return ok(`Command search: ${trimmed}

${matches.map(formatCommandEntry).join('\n\n')}

Matches are informational only. The CLI does not execute commands.
`)
}

function formatCommandEntry(command: CommandCatalogueEntry): string {
  const permissions = command.permissions.length > 0 ? command.permissions.join(', ') : 'none'
  const note = command.note ? `\n  note: ${command.note}` : ''

  return `${command.id}: ${command.label}
  ${command.description}
  risk: ${command.risk}
  confirmation: ${command.confirmation}
  permissions: ${permissions}
  undo: ${command.undo}${note}`
}

function focusPresetsText(): string {
  return `Focus presets

${(Object.keys(FOCUS_PRESET_META) as FocusPreset[]).map((preset) => {
  const meta = FOCUS_PRESET_META[preset]
  return `${meta.title} (${preset}):
  ${meta.summary}
  halo: ${meta.haloLabel ?? 'none'}`
}).join('\n\n')}

Use:
  modula focus policy <off|light|deep|custom>
`
}

function focusPolicyCommand(preset: string | undefined): CommandResult {
  if (!isFocusPreset(preset)) {
    return {
      exitCode: 1,
      stderr: 'Invalid focus preset. Usage: modula focus policy <off|light|deep|custom>\n',
    }
  }

  const meta = FOCUS_PRESET_META[preset]
  const policy = evaluateFocusPolicy(preset)

  return ok(`Focus policy: ${meta.title}

${meta.summary}

Policy answers:
${FOCUS_POLICY_QUESTIONS.map((row) => `  ${row.label} ${policy[row.key] ? 'Yes' : 'No'}`).join('\n')}

Preview only. Production enforcement depends on FocusPolicyEngine surface adapters.
`)
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

function isFocusPreset(value: string | undefined): value is FocusPreset {
  return value === 'off' || value === 'light' || value === 'deep' || value === 'custom'
}

function privacyLevelsText(): string {
  return `Glass Privacy levels

${GLASS_PRIVACY_LEVELS.map(
  (level) => `${level.title} (${level.id})
  ${level.body}
  thread hint: ${level.threadHint}`,
).join('\n\n')}

Selection can persist locally in the app. Enforcement remains preview/planned and
must not be represented as cryptographic, chain, or wallet protection.
`
}

function nftStatusText(): string {
  return `NFT / digital ownership status

DIMON is not active yet
NFT ownership and entitlement records are reserved for a future ownership layer.
Mint and transfer requests are Preview blocked.

No chain RPC, wallet connection, balance lookup, funded-looking wallet address,
floor price, minting, transfer, or settlement is available through this CLI.

ADR-006: PostgreSQL is the primary application database. Blockchain is not the
app database.
`
}

function verifyPhase6sText(): string {
  return `Phase 6s social frontend verification

Run from the workspace root when you want the full frontend check:
  pnpm verify:phase6s-social-frontend

This command prints the instruction only; it does not shell out or mutate the
working tree.
`
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

const result = await run(process.argv.slice(2))

if (result.stdout) {
  process.stdout.write(result.stdout)
}

if (result.stderr) {
  process.stderr.write(result.stderr)
}

process.exitCode = result.exitCode
