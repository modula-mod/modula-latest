import {createHash} from 'node:crypto'

/**
 * GUBIC game package manifest (`gubic.game.json`), schema `modula.gubic.game.v1`.
 *
 * The manifest is declarative data only. It never grants network access,
 * account credentials, wallet writes or inventory writes to game code; it only
 * declares which host bridge capabilities the game wants, which the native
 * host may still refuse.
 */
export const GUBIC_MANIFEST_SCHEMA = 'modula.gubic.game.v1'
export const GUBIC_BRIDGE_CAPABILITIES = [
  'lifecycle', 'score', 'achievements', 'lobby', 'player.profile', 'moliboo.avatar', 'storage.namespaced',
] as const
export const GUBIC_ENGINES = ['html5', 'phaser', 'playcanvas'] as const
export const GUBIC_LATER_ENGINES = ['mmorpg-client', 'retro-emulation'] as const
export const GUBIC_MAX_ACHIEVEMENTS = 100
export const GUBIC_MAX_ACHIEVEMENT_POINTS = 1000
export const GUBIC_MAX_PACKAGE_BYTES = 64 * 1024 * 1024
export const GUBIC_MAX_LOBBY_PLAYERS = 16

export type GubicBridgeCapability = typeof GUBIC_BRIDGE_CAPABILITIES[number]
export type GubicEngine = typeof GUBIC_ENGINES[number]
export type GubicMonetisation = 'free' | 'paid' | 'in-game-purchases'

export type GubicAchievementDeclaration = {
  key: string
  title: string
  description: string
  points: number
  hidden: boolean
}

export type GubicGameManifest = {
  schema: typeof GUBIC_MANIFEST_SCHEMA
  gameId: string
  version: string
  title: string
  summary: string
  genre: string
  categories: string[]
  runtime: {engine: GubicEngine; engineVersion: string | null; entry: 'index.html'; orientation: 'portrait' | 'landscape' | 'any'}
  bridge: {version: 1; capabilities: GubicBridgeCapability[]}
  network: 'none' | 'lobby-relay'
  multiplayer: {minPlayers: number; maxPlayers: number; mode: 'realtime-relay' | 'turn-based'} | null
  achievements: GubicAchievementDeclaration[]
  ageRating: '4+' | '9+' | '12+' | '17+'
  monetisation: GubicMonetisation
  userGeneratedContent: boolean
  packageSizeBytes: number
}

export class GubicManifestError extends Error {
  readonly code = 'VALIDATION_FAILED'
  constructor(readonly issues: string[]) {
    super(`Invalid GUBIC game manifest: ${issues.join('; ')}`)
  }
}

const GAME_ID = /^[a-z0-9]+([.-][a-z0-9]+)+$/
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/
const ACHIEVEMENT_KEY = /^[a-z0-9][a-z0-9_.-]{0,63}$/

/** Validates and normalises a manifest. Throws `GubicManifestError` listing every issue. */
export function validateGubicManifest(input: unknown): GubicGameManifest {
  const issues: string[] = []
  const m = isRecord(input) ? input : {}
  if (!isRecord(input)) issues.push('manifest must be an object')
  if (m.schema !== GUBIC_MANIFEST_SCHEMA) issues.push(`schema must be ${GUBIC_MANIFEST_SCHEMA}`)
  const gameId = str(m.gameId)
  if (!gameId || !GAME_ID.test(gameId) || gameId.length > 120) issues.push('gameId must be a reverse-DNS style id such as digital.modula.games.orbit')
  const version = str(m.version)
  if (!version || !SEMVER.test(version)) issues.push('version must be semver')
  const title = bounded(m.title, 1, 80, 'title', issues)
  const summary = str(m.summary) ?? ''
  if (summary.length > 280) issues.push('summary must be at most 280 characters')
  const genre = bounded(m.genre, 1, 80, 'genre', issues)
  const categories = Array.isArray(m.categories) ? [...new Set(m.categories.map(value => str(value)).filter((v): v is string => Boolean(v)))].sort() : []
  if (!categories.length || categories.length > 20 || categories.some(value => value.length > 80)) issues.push('one to twenty categories of at most 80 characters are required')

  const runtime = isRecord(m.runtime) ? m.runtime : {}
  const engine = str(runtime.engine)
  if ((GUBIC_LATER_ENGINES as readonly string[]).includes(engine ?? '')) {
    issues.push(`runtime.engine ${engine} is planned for a later phase and is not accepted yet`)
  } else if (!(GUBIC_ENGINES as readonly string[]).includes(engine ?? '')) {
    issues.push(`runtime.engine must be one of ${GUBIC_ENGINES.join(', ')}`)
  }
  if ((runtime.entry ?? 'index.html') !== 'index.html') issues.push('runtime.entry must be index.html')
  const orientation = runtime.orientation ?? 'any'
  if (!['portrait', 'landscape', 'any'].includes(String(orientation))) issues.push('runtime.orientation must be portrait, landscape or any')

  const bridge = isRecord(m.bridge) ? m.bridge : {}
  if (bridge.version !== 1) issues.push('bridge.version must be 1')
  const capabilities = Array.isArray(bridge.capabilities) ? [...new Set(bridge.capabilities.map(String))] : []
  for (const capability of capabilities) {
    if (!(GUBIC_BRIDGE_CAPABILITIES as readonly string[]).includes(capability)) issues.push(`unknown bridge capability ${capability}`)
  }
  if (!capabilities.includes('lifecycle')) issues.push('bridge.capabilities must include lifecycle')

  const network = m.network ?? 'none'
  if (network !== 'none' && network !== 'lobby-relay') issues.push('network must be none or lobby-relay; games never get open internet access')

  let multiplayer: GubicGameManifest['multiplayer'] = null
  if (m.multiplayer != null) {
    const mp = isRecord(m.multiplayer) ? m.multiplayer : {}
    const min = Number(mp.minPlayers), max = Number(mp.maxPlayers)
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 2 || max < min || max > GUBIC_MAX_LOBBY_PLAYERS) {
      issues.push(`multiplayer players must satisfy 2 <= minPlayers <= maxPlayers <= ${GUBIC_MAX_LOBBY_PLAYERS}`)
    }
    if (mp.mode !== 'realtime-relay' && mp.mode !== 'turn-based') issues.push('multiplayer.mode must be realtime-relay or turn-based')
    if (network !== 'lobby-relay') issues.push('multiplayer games must declare network lobby-relay')
    if (!capabilities.includes('lobby')) issues.push('multiplayer games must request the lobby bridge capability')
    multiplayer = {minPlayers: min, maxPlayers: max, mode: mp.mode === 'turn-based' ? 'turn-based' : 'realtime-relay'}
  } else if (network === 'lobby-relay') {
    issues.push('network lobby-relay requires a multiplayer declaration')
  }

  const achievements: GubicAchievementDeclaration[] = []
  if (m.achievements != null && !Array.isArray(m.achievements)) issues.push('achievements must be an array')
  const declared = Array.isArray(m.achievements) ? m.achievements : []
  if (declared.length > GUBIC_MAX_ACHIEVEMENTS) issues.push(`at most ${GUBIC_MAX_ACHIEVEMENTS} achievements`)
  const keys = new Set<string>()
  for (const [index, raw] of declared.entries()) {
    const a = isRecord(raw) ? raw : {}
    const key = str(a.key)
    if (!key || !ACHIEVEMENT_KEY.test(key)) { issues.push(`achievements[${index}].key is invalid`); continue }
    if (keys.has(key)) { issues.push(`duplicate achievement key ${key}`); continue }
    keys.add(key)
    const points = a.points == null ? 10 : Number(a.points)
    if (!Number.isInteger(points) || points < 0 || points > 100) issues.push(`achievements[${index}].points must be 0-100`)
    const aTitle = bounded(a.title, 1, 80, `achievements[${index}].title`, issues)
    const description = str(a.description) ?? ''
    if (description.length > 280) issues.push(`achievements[${index}].description is too long`)
    achievements.push({key, title: aTitle, description, points, hidden: a.hidden === true})
  }
  if (achievements.length && !capabilities.includes('achievements')) issues.push('declared achievements require the achievements bridge capability')
  if (achievements.reduce((sum, a) => sum + a.points, 0) > GUBIC_MAX_ACHIEVEMENT_POINTS) issues.push(`achievement points must total at most ${GUBIC_MAX_ACHIEVEMENT_POINTS}`)

  const ageRating = m.ageRating
  if (!['4+', '9+', '12+', '17+'].includes(String(ageRating))) issues.push('ageRating must be 4+, 9+, 12+ or 17+')
  const monetisation = m.monetisation ?? 'free'
  if (!['free', 'paid', 'in-game-purchases'].includes(String(monetisation))) issues.push('monetisation must be free, paid or in-game-purchases')
  const packageSizeBytes = Number(m.packageSizeBytes)
  if (!Number.isSafeInteger(packageSizeBytes) || packageSizeBytes <= 0 || packageSizeBytes > GUBIC_MAX_PACKAGE_BYTES) {
    issues.push(`packageSizeBytes must be between 1 and ${GUBIC_MAX_PACKAGE_BYTES}`)
  }
  if (issues.length) throw new GubicManifestError(issues)
  return {
    schema: GUBIC_MANIFEST_SCHEMA,
    gameId: gameId!, version: version!, title, summary, genre, categories,
    runtime: {engine: engine as GubicEngine, engineVersion: str(runtime.engineVersion), entry: 'index.html', orientation: orientation as 'portrait' | 'landscape' | 'any'},
    bridge: {version: 1, capabilities: capabilities.sort() as GubicBridgeCapability[]},
    network: network as 'none' | 'lobby-relay',
    multiplayer,
    achievements,
    ageRating: ageRating as GubicGameManifest['ageRating'],
    monetisation: monetisation as GubicMonetisation,
    userGeneratedContent: m.userGeneratedContent === true,
    packageSizeBytes,
  }
}

/** Stable digest of a normalised manifest (sorted keys). */
export function gubicManifestDigest(manifest: GubicGameManifest): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex')
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  return JSON.stringify(value ?? null)
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function bounded(value: unknown, min: number, max: number, field: string, issues: string[]): string {
  const parsed = str(value)
  if (!parsed || parsed.length < min || parsed.length > max) {
    issues.push(`${field} must be ${min}-${max} characters`)
    return ''
  }
  return parsed
}
