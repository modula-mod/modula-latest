/**
 * Pure, deterministic Moliboo game rules. Kept free of I/O so the server can
 * unit-test stacking, period keys, loadout validation and disclosed surprise
 * rewards. Everything here is cosmetic/comfort only: no rule changes
 * competitive outcomes, and premium never grants extra progression.
 */
import {createHash} from 'node:crypto'

export const SLOTS = ['headwear', 'hair', 'face', 'top', 'outerwear', 'bottom', 'footwear', 'back', 'handheld', 'aura'] as const
export type Slot = (typeof SLOTS)[number]
export type Access = 'free' | 'earnable' | 'premium'
export const CARE_ACTIONS = ['feed', 'play', 'rest', 'groom', 'talk'] as const
export type CareAction = (typeof CARE_ACTIONS)[number]
export const ACTIVITIES = ['bubble_pop', 'star_catch', 'memory_match'] as const

/** Total friendship-XP bonus from all buffs is capped; buffs never touch gameplay stats. */
export const FRIENDSHIP_BONUS_CAP_PCT = 25
/** A care action only counts toward quests once per window per character+action (no spam, no grind). */
export const CARE_COUNT_WINDOW_SECONDS = 15 * 60
/** Mini-activity completions that count toward quests per UTC day. */
export const ACTIVITY_DAILY_COUNT_LIMIT = 10
export const MAX_SAVED_OUTFITS = 24
export const CHARACTER_ID = /^moliboo\.[a-z0-9_]+\.[a-z0-9_]+$/

export class GameRuleError extends Error {
  constructor(public readonly code: 'VALIDATION_FAILED' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT', message: string, public readonly detail?: unknown) {
    super(message)
  }
}

export function familyOf(characterId: string): string | null {
  const parts = characterId.split('.')
  return parts.length === 3 ? parts[1]! : null
}

export function periodKey(kind: string, now: Date): string {
  if (kind === 'daily') return `d:${now.toISOString().slice(0, 10)}`
  if (kind === 'weekly') {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const day = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - day)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `w:${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
  }
  return 'all'
}

export function periodEndsAt(kind: string, now: Date): string | null {
  if (kind === 'daily') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString()
  if (kind === 'weekly') {
    const day = now.getUTCDay() || 7
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + (8 - day))).toISOString()
  }
  return null
}

export type BuffDefinition = {
  buffId: string
  durationSeconds: number | null
  stackRule: 'refresh' | 'stack' | 'while_equipped'
  maxStacks: number
  exclusiveGroup: string | null
  effects: Record<string, unknown>
}
export type ActiveBuff = {buffId: string; stacks: number; startedAt: Date; expiresAt: Date}

/**
 * Apply a timed buff. Rules:
 *  - refresh: duration resets to full, stacks stay 1.
 *  - stack: +1 stack up to maxStacks, duration resets.
 *  - exclusiveGroup: applying removes other active buffs in the same group.
 *  - while_equipped buffs are derived from the equipped set, never stored.
 */
export function applyBuff(active: ActiveBuff[], def: BuffDefinition, defs: Map<string, BuffDefinition>, now: Date): {upsert: ActiveBuff; remove: string[]} {
  if (def.stackRule === 'while_equipped' || !def.durationSeconds) throw new GameRuleError('VALIDATION_FAILED', 'Buff cannot be applied as a timed effect')
  const live = active.filter(b => b.expiresAt > now)
  const existing = live.find(b => b.buffId === def.buffId)
  const stacks = def.stackRule === 'stack' ? Math.min(def.maxStacks, (existing?.stacks ?? 0) + 1) : 1
  const remove = def.exclusiveGroup
    ? live.filter(b => b.buffId !== def.buffId && defs.get(b.buffId)?.exclusiveGroup === def.exclusiveGroup).map(b => b.buffId)
    : []
  return {
    upsert: {buffId: def.buffId, stacks, startedAt: existing?.startedAt ?? now, expiresAt: new Date(now.getTime() + def.durationSeconds * 1000)},
    remove,
  }
}

export function friendshipBonusPct(active: Array<{buffId: string; stacks: number}>, defs: Map<string, BuffDefinition>): number {
  let total = 0
  for (const buff of active) {
    const pct = Number(defs.get(buff.buffId)?.effects?.friendshipXpBonusPct ?? 0)
    if (Number.isFinite(pct) && pct > 0) total += pct * buff.stacks
  }
  return Math.min(FRIENDSHIP_BONUS_CAP_PCT, total)
}

export function friendshipLevel(xp: number): {level: number; xpIntoLevel: number; xpForNext: number} {
  // Gentle curve: 100, 150, 200 ... per level (goal-gradient friendly, never decays).
  let level = 1
  let remaining = Math.max(0, xp)
  let need = 100
  while (remaining >= need && level < 50) {
    remaining -= need
    level += 1
    need += 50
  }
  return {level, xpIntoLevel: remaining, xpForNext: need}
}

/** Disclosed, deterministic surprise: same account+period always yields the same item; never an owned one. */
export function pickSurprise(pool: string[], owned: Set<string>, seed: string): string | null {
  const candidates = pool.filter(id => !owned.has(id)).sort()
  if (candidates.length === 0) return null
  const digest = createHash('sha256').update(seed).digest()
  return candidates[digest.readUInt32BE(0) % candidates.length]!
}

export type CatalogueItem = {itemId: string; slot: Slot; access: Access; active: boolean}

/** Validate a loadout: known active items, at most one per slot, every item usable by this account. */
export function validateLoadout(
  itemIds: unknown,
  catalogue: Map<string, CatalogueItem>,
  owned: Set<string>,
  options: {premiumEnabled: boolean},
): string[] {
  if (!Array.isArray(itemIds)) throw new GameRuleError('VALIDATION_FAILED', 'itemIds must be an array')
  if (itemIds.length > SLOTS.length) throw new GameRuleError('VALIDATION_FAILED', 'Too many items')
  const seenSlots = new Set<string>()
  const locked: string[] = []
  const ids: string[] = []
  for (const raw of itemIds) {
    if (typeof raw !== 'string') throw new GameRuleError('VALIDATION_FAILED', 'itemIds must be strings')
    const item = catalogue.get(raw)
    if (!item || !item.active) throw new GameRuleError('VALIDATION_FAILED', `Unknown item ${raw}`)
    if (item.access === 'premium' && !options.premiumEnabled) throw new GameRuleError('VALIDATION_FAILED', `Unknown item ${raw}`)
    if (seenSlots.has(item.slot)) throw new GameRuleError('VALIDATION_FAILED', `Only one ${item.slot} item can be worn`)
    seenSlots.add(item.slot)
    if (item.access !== 'free' && !owned.has(item.itemId)) locked.push(item.itemId)
    ids.push(item.itemId)
  }
  if (locked.length) throw new GameRuleError('CONFLICT', 'Some items are not in your inventory yet', {lockedItemIds: locked})
  return ids.sort((a, b) => SLOTS.indexOf(catalogue.get(a)!.slot) - SLOTS.indexOf(catalogue.get(b)!.slot))
}

export function setCompletion(setItemIds: string[], usable: (id: string) => boolean): {owned: number; total: number; complete: boolean} {
  const owned = setItemIds.filter(usable).length
  return {owned, total: setItemIds.length, complete: owned === setItemIds.length}
}
