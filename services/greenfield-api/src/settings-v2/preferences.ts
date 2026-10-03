/**
 * App preferences that follow a member across devices. Every key is listed here
 * with its type and default; anything else is rejected, never stored.
 */
type BooleanRule = {kind: 'boolean'; default: boolean}
type EnumRule = {kind: 'enum'; values: readonly string[]; default: string}
type TimeZoneRule = {kind: 'timeZone'; default: string}
type Rule = BooleanRule | EnumRule | TimeZoneRule

export const APP_PREFERENCE_RULES = {
  'feed.defaultMode': {kind: 'enum', values: ['following', 'for-you', 'modules'], default: 'following'},
  'feed.mediaOnly': {kind: 'boolean', default: false},
  'feed.hideModulePosts': {kind: 'boolean', default: false},
  'feed.showReplies': {kind: 'boolean', default: true},
  'digests.weekly': {kind: 'boolean', default: false},
  'digests.morning': {kind: 'boolean', default: false},
  'digests.timeZone': {kind: 'timeZone', default: 'UTC'},
  'time.use24h': {kind: 'boolean', default: false},
  'time.relative': {kind: 'boolean', default: true},
  'units.distance': {kind: 'enum', values: ['metric', 'imperial'], default: 'metric'},
  'units.temperature': {kind: 'enum', values: ['c', 'f'], default: 'c'},
} as const satisfies Record<string, Rule>

export type AppPreferenceKey = keyof typeof APP_PREFERENCE_RULES
export type AppPreferences = Record<AppPreferenceKey, boolean | string>

export const APP_PREFERENCE_KEYS = Object.keys(APP_PREFERENCE_RULES) as AppPreferenceKey[]

export function defaultAppPreferences(): AppPreferences {
  return Object.fromEntries(APP_PREFERENCE_KEYS.map(key => [key, APP_PREFERENCE_RULES[key].default])) as AppPreferences
}

export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(value)) return false
  try {
    new Intl.DateTimeFormat('en-GB', {timeZone: value})
    return true
  } catch {
    return false
  }
}

/** Validates a partial update. Unknown keys or wrong types fail the whole patch. */
export function validateAppPreferencePatch(input: unknown): Partial<AppPreferences> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Preferences must be an object', 'preferences')
  const source = (input as Record<string, unknown>).preferences ?? input
  if (!source || typeof source !== 'object' || Array.isArray(source)) invalid('Preferences must be an object', 'preferences')
  const entries = Object.entries(source as Record<string, unknown>)
  if (entries.length === 0) invalid('Nothing to update', 'preferences')
  if (entries.length > APP_PREFERENCE_KEYS.length) invalid('Too many preferences', 'preferences')
  const out: Partial<AppPreferences> = {}
  for (const [key, value] of entries) {
    const rule = (APP_PREFERENCE_RULES as Record<string, Rule>)[key]
    if (!rule) invalid(`Unknown preference ${key.slice(0, 60)}`, key.slice(0, 60))
    if (rule.kind === 'boolean') {
      if (typeof value !== 'boolean') invalid(`${key} must be true or false`, key)
    } else if (rule.kind === 'enum') {
      if (typeof value !== 'string' || !rule.values.includes(value)) invalid(`${key} must be one of ${rule.values.join(', ')}`, key)
    } else if (typeof value !== 'string' || !isValidTimeZone(value)) {
      invalid(`${key} must be an IANA time zone`, key)
    }
    out[key as AppPreferenceKey] = value as boolean | string
  }
  return out
}

/** Stored JSON may predate a key or hold a value from an older rule: fall back to defaults. */
export function resolveAppPreferences(stored: unknown): AppPreferences {
  const resolved = defaultAppPreferences()
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return resolved
  for (const key of APP_PREFERENCE_KEYS) {
    const value = (stored as Record<string, unknown>)[key]
    if (value === undefined) continue
    try {
      Object.assign(resolved, validateAppPreferencePatch({[key]: value}))
    } catch {
      // keep the default
    }
  }
  return resolved
}

function invalid(message: string, field: string): never {
  throw Object.assign(new Error(message), {code: 'VALIDATION_FAILED', field})
}
