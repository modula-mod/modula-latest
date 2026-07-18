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

type GreenfieldToolName =
  | 'greenfield.doctor'
  | 'greenfield.manifest.validate'
  | 'greenfield.intelligence.layers'
  | 'greenfield.commands.list'
  | 'greenfield.dimon.status'
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
] as const

const reservedDimonCapabilities = [
  'value transfer',
  'creator and module rewards',
  'marketplace settlement',
  'ownership and entitlement records',
  'economic ledger entries',
  'future Greenfield account binding',
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
    name: 'greenfield.commands.list',
    description: 'List static example commands for the Greenfield preview.',
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

    case 'greenfield.commands.list':
      return jsonToolResult({
        status: 'preview',
        honesty:
          'These are catalogue examples only; this MCP server does not execute commands.',
        commands: commandCatalogue,
      })

    case 'greenfield.dimon.status':
      return jsonToolResult({
        status: 'inactive',
        phrase: 'DIMON is not active yet',
        honesty:
          'No chain, wallet, transfer, or settlement access is exposed by this preview server.',
        reservedCapabilities: reservedDimonCapabilities,
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
