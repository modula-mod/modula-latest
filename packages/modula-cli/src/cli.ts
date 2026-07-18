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

const HELP_TEXT = `Modula CLI

Usage:
  modula help
  modula doctor
  modula mcp info
  modula module validate <path-to-modula.module.json>
  modula module init [--write]
  modula intelligence layers
  modula commands list
  modula focus presets
  modula dimon status
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

  if (first === 'mcp' && second === 'info') {
    return ok(mcpInfoText())
  }

  if (first === 'module' && second === 'validate') {
    return validateManifest(third)
  }

  if (first === 'module' && second === 'init') {
    return ok(moduleInitText(args.includes('--write')))
  }

  if (first === 'intelligence' && second === 'layers') {
    return ok(intelligenceLayersText())
  }

  if (first === 'commands' && second === 'list') {
    return ok(commandsListText())
  }

  if (first === 'focus' && second === 'presets') {
    return ok(focusPresetsText())
  }

  if (first === 'dimon' && second === 'status') {
    return ok('DIMON is not active yet\n')
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
  This workspace does not currently ship a packaged Greenfield MCP server.
  The Modula CLI does not start or fake an MCP process.

Local run pattern when the MCP package lands:
  1. Build the MCP server package from the workspace root.
  2. Configure your MCP client to launch that package with pnpm --filter.
  3. Keep the server on local contracts; do not use it to publish packages or
     perform blockchain, wallet, balance, or RPC actions.

Current authoring inputs:
  - packages/greenfield-contracts
  - docs/architecture/module-standards.md
  - templates/modula-module/
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
  return `Command catalogue sample

module.validateManifest:
  Validate a modula.module.json file before Registry or host review.

focus.setPreset:
  Apply Off, Light, Deep, or Custom attention policy presets.

gaia.preparePlan:
  Draft a user-visible plan. Consequential actions require confirmation.

governor.requestApproval:
  Route higher-risk actions through approval and audit policy.

This is a sample catalogue, not a live execution router.
`
}

function focusPresetsText(): string {
  return `Focus presets

Off:
  No focus filtering.

Light:
  Reduce non-urgent interruptions.

Deep:
  Prioritize current work and suppress low-priority surfaces.

Custom:
  User-defined attention policy for modules, commands, and notifications.
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
