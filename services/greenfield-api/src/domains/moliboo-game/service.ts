import {randomUUID} from 'node:crypto'
import {sql, type Kysely, type Transaction} from 'kysely'

import type {ModulaDb} from '../../database/client.js'
import {
  ACTIVITIES,
  ACTIVITY_DAILY_COUNT_LIMIT,
  applyBuff,
  CARE_ACTIONS,
  CARE_COUNT_WINDOW_SECONDS,
  CHARACTER_ID,
  familyOf,
  friendshipBonusPct,
  friendshipLevel,
  GameRuleError,
  MAX_SAVED_OUTFITS,
  periodEndsAt,
  periodKey,
  pickSurprise,
  setCompletion,
  SLOTS,
  validateLoadout,
  type ActiveBuff,
  type BuffDefinition,
  type CatalogueItem,
} from './rules.js'

type Exec = Kysely<any> | Transaction<any>
const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

const CARE_BUFFS: Record<string, string> = {
  feed: 'moliboo.buff.well_fed',
  play: 'moliboo.buff.playful',
  rest: 'moliboo.buff.well_rested',
  groom: 'moliboo.buff.fresh_groomed',
  talk: 'moliboo.buff.chatty',
}
const CARE_XP = 5
const SKILL_XP = 10

type ItemRow = {item_id: string; name: string; slot: any; rarity: string; access: any; family: string | null; set_id: string | null; icon_key: string; palette: string[]; active: boolean}
type SetRow = {set_id: string; name: string; family: string | null; access: string; rarity: string; item_ids: string[]; icon_key: string; set_bonus_buff_id: string | null}
type QuestRow = {quest_id: string; kind: string; title: string; description: string; event_type: string; family_filter: string | null; target: number; reward: any}

function itemDto(row: ItemRow) {
  return {itemId: row.item_id, name: row.name, slot: row.slot, rarity: row.rarity, access: row.access, family: row.family, setId: row.set_id, iconKey: row.icon_key, palette: row.palette}
}

function cleanIdempotencyKey(raw: unknown): string {
  if (typeof raw !== 'string' || !/^[A-Za-z0-9._:-]{8,80}$/.test(raw)) throw new GameRuleError('VALIDATION_FAILED', 'idempotencyKey (8-80 safe characters) is required')
  return raw
}
function cleanCharacterId(raw: unknown): string {
  if (typeof raw !== 'string' || !CHARACTER_ID.test(raw) || raw.length > 96) throw new GameRuleError('VALIDATION_FAILED', 'Unknown Moliboo character id')
  return raw
}

/**
 * Server-authoritative Moliboo game systems. Ownership is recorded only from
 * evidence-backed grants (quest/achievement/collection claims, premium
 * entitlements, admin grants). Free items are usable without ownership rows.
 */
export class MolibooGameService {
  private cache: {items: Map<string, ItemRow>; sets: SetRow[]; buffs: Map<string, BuffDefinition & {name: string; description: string}>; quests: QuestRow[]} | null = null

  constructor(private readonly db: ModulaDb, private readonly options: {premiumEnabled: boolean}) {}

  private get exec(): Exec {
    return this.db as unknown as Kysely<any>
  }

  private async catalogue() {
    if (this.cache) return this.cache
    const [items, sets, buffs, quests] = await Promise.all([
      sql<ItemRow>`SELECT * FROM greenfield_moliboo_items ORDER BY sort_order, item_id`.execute(this.exec),
      sql<SetRow>`SELECT * FROM greenfield_moliboo_outfit_sets WHERE active ORDER BY sort_order, set_id`.execute(this.exec),
      sql<any>`SELECT * FROM greenfield_moliboo_buff_definitions`.execute(this.exec),
      sql<QuestRow>`SELECT * FROM greenfield_moliboo_quests WHERE active ORDER BY sort_order, quest_id`.execute(this.exec),
    ])
    this.cache = {
      items: new Map(items.rows.map(row => [row.item_id, row])),
      sets: sets.rows,
      buffs: new Map(buffs.rows.map((row: any) => [row.buff_id, {
        buffId: row.buff_id, name: row.name, description: row.description, durationSeconds: row.duration_seconds,
        stackRule: row.stack_rule, maxStacks: row.max_stacks, exclusiveGroup: row.exclusive_group, effects: row.effects,
      }])),
      quests: quests.rows,
    }
    return this.cache
  }

  private visible(item: ItemRow): boolean {
    return item.active && (item.access !== 'premium' || this.options.premiumEnabled)
  }

  private async ownedSet(exec: Exec, accountId: string): Promise<Map<string, {source: string; acquiredAt: string}>> {
    const rows = await sql<{item_id: string; source: string; acquired_at: Date}>`
      SELECT item_id, source, acquired_at FROM greenfield_moliboo_inventory
      WHERE account_id = ${accountId} AND revoked_at IS NULL`.execute(exec)
    return new Map(rows.rows.map(r => [r.item_id, {source: r.source, acquiredAt: new Date(r.acquired_at).toISOString()}]))
  }

  private unlockQuestFor(itemId: string, quests: QuestRow[]): string | null {
    return quests.find(q => q.reward?.itemId === itemId || (q.reward?.type === 'surprise_item' && q.reward.pool?.includes(itemId)))?.quest_id ?? null
  }

  async listItems(query: {slot?: string; family?: string}) {
    const cat = await this.catalogue()
    if (query.slot && !(SLOTS as readonly string[]).includes(query.slot)) throw new GameRuleError('VALIDATION_FAILED', 'Unknown slot')
    const items = [...cat.items.values()].filter(i => this.visible(i))
      .filter(i => !query.slot || i.slot === query.slot)
      .filter(i => !query.family || i.family === query.family)
      .map(i => ({...itemDto(i), unlockQuestId: i.access === 'earnable' ? this.unlockQuestFor(i.item_id, cat.quests) : null}))
    return {slots: SLOTS, premiumEnabled: this.options.premiumEnabled, items}
  }

  async listOutfitSets(accountId: string | null) {
    const cat = await this.catalogue()
    const owned = accountId ? await this.ownedSet(this.exec, accountId) : new Map()
    const sets = cat.sets.filter(s => s.access !== 'premium' || this.options.premiumEnabled).map(s => {
      const completion = setCompletion(s.item_ids, id => cat.items.get(id)?.access === 'free' || owned.has(id))
      const bonus = s.set_bonus_buff_id ? cat.buffs.get(s.set_bonus_buff_id) : null
      return {
        setId: s.set_id, name: s.name, family: s.family, access: s.access, rarity: s.rarity, iconKey: s.icon_key,
        items: s.item_ids.map(id => cat.items.get(id)).filter(Boolean).map(i => ({...itemDto(i!), usable: i!.access === 'free' || owned.has(i!.item_id)})),
        completion: accountId ? completion : null,
        setBonus: bonus ? {buffId: bonus.buffId, name: bonus.name, description: bonus.description, effects: bonus.effects} : null,
      }
    })
    return {sets}
  }

  async inventory(accountId: string) {
    const cat = await this.catalogue()
    const owned = await this.ownedSet(this.exec, accountId)
    const entries = [...cat.items.values()].filter(i => this.visible(i) || owned.has(i.item_id)).map(i => {
      const own = owned.get(i.item_id)
      const status = own ? 'owned' : i.access === 'free' ? 'free' : i.access === 'earnable' ? 'earnable_locked' : 'premium_locked'
      return {item: itemDto(i), status, source: own?.source ?? (i.access === 'free' ? 'free_access' : null), acquiredAt: own?.acquiredAt ?? null,
        unlockQuestId: status === 'earnable_locked' ? this.unlockQuestFor(i.item_id, cat.quests) : null}
    })
    const counts = {owned: entries.filter(e => e.status === 'owned').length, free: entries.filter(e => e.status === 'free').length,
      locked: entries.filter(e => e.status.endsWith('_locked')).length}
    return {counts, entries}
  }

  async listSavedOutfits(accountId: string) {
    const rows = await sql<any>`SELECT * FROM greenfield_moliboo_user_outfits WHERE account_id = ${accountId} ORDER BY updated_at DESC, outfit_id`.execute(this.exec)
    return {outfits: rows.rows.map(r => this.outfitDto(r)), limit: MAX_SAVED_OUTFITS}
  }

  private outfitDto(r: any) {
    return {outfitId: r.outfit_id, name: r.name, characterId: r.character_id, itemIds: r.item_ids, revision: r.revision,
      createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString()}
  }

  private cleanName(raw: unknown): string {
    if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > 40) throw new GameRuleError('VALIDATION_FAILED', 'Outfit name must be 1-40 characters')
    return raw.trim()
  }

  private async validated(exec: Exec, accountId: string, itemIds: unknown): Promise<string[]> {
    const cat = await this.catalogue()
    const owned = await this.ownedSet(exec, accountId)
    const asCatalogue = new Map<string, CatalogueItem>([...cat.items.values()].map(i => [i.item_id, {itemId: i.item_id, slot: i.slot, access: i.access, active: i.active}]))
    return validateLoadout(itemIds, asCatalogue, new Set(owned.keys()), {premiumEnabled: this.options.premiumEnabled})
  }

  async saveOutfit(accountId: string, body: {name?: unknown; characterId?: unknown; itemIds?: unknown; idempotencyKey?: unknown}) {
    const name = this.cleanName(body.name)
    const characterId = body.characterId == null ? null : cleanCharacterId(body.characterId)
    return this.db.transaction().execute(async trx => {
      const t = trx as unknown as Transaction<any>
      const itemIds = await this.validated(t, accountId, body.itemIds)
      if (itemIds.length === 0) throw new GameRuleError('VALIDATION_FAILED', 'An outfit needs at least one item')
      const count = await sql<{n: number}>`SELECT count(*)::int AS n FROM greenfield_moliboo_user_outfits WHERE account_id = ${accountId}`.execute(t)
      if ((count.rows[0]?.n ?? 0) >= MAX_SAVED_OUTFITS) throw new GameRuleError('CONFLICT', `You can save up to ${MAX_SAVED_OUTFITS} outfits`)
      const outfitId = `mof_${randomUUID()}`
      const row = await sql<any>`INSERT INTO greenfield_moliboo_user_outfits (outfit_id, account_id, name, character_id, item_ids)
        VALUES (${outfitId}, ${accountId}, ${name}, ${characterId}, ${jsonb(itemIds)}) RETURNING *`.execute(t)
      const progress = await this.recordEvent(t, accountId, 'outfit_saved', characterId, {outfitId}, `outfit:${outfitId}`)
      return {outfit: this.outfitDto(row.rows[0]), questProgress: progress}
    })
  }

  async updateOutfit(accountId: string, outfitId: string, body: {name?: unknown; itemIds?: unknown; revision?: unknown}) {
    return this.db.transaction().execute(async trx => {
      const t = trx as unknown as Transaction<any>
      const current = await sql<any>`SELECT * FROM greenfield_moliboo_user_outfits WHERE outfit_id = ${outfitId} AND account_id = ${accountId} FOR UPDATE`.execute(t)
      const row = current.rows[0]
      if (!row) throw new GameRuleError('NOT_FOUND', 'Outfit not found')
      if (body.revision !== undefined && body.revision !== row.revision) throw new GameRuleError('CONFLICT', 'Outfit changed on another device', {currentRevision: row.revision})
      const name = body.name === undefined ? row.name : this.cleanName(body.name)
      const itemIds = body.itemIds === undefined ? row.item_ids : await this.validated(t, accountId, body.itemIds)
      const updated = await sql<any>`UPDATE greenfield_moliboo_user_outfits SET name = ${name}, item_ids = ${jsonb(itemIds)},
        revision = revision + 1, updated_at = NOW() WHERE outfit_id = ${outfitId} RETURNING *`.execute(t)
      return {outfit: this.outfitDto(updated.rows[0])}
    })
  }

  async deleteOutfit(accountId: string, outfitId: string) {
    const res = await sql`DELETE FROM greenfield_moliboo_user_outfits WHERE outfit_id = ${outfitId} AND account_id = ${accountId}`.execute(this.exec)
    if (!Number(res.numAffectedRows ?? 0)) throw new GameRuleError('NOT_FOUND', 'Outfit not found')
    return {ok: true}
  }

  async equip(accountId: string, rawCharacterId: unknown, body: {setId?: unknown; outfitId?: unknown; itemIds?: unknown; idempotencyKey?: unknown}) {
    const characterId = cleanCharacterId(rawCharacterId)
    const cat = await this.catalogue()
    return this.db.transaction().execute(async trx => {
      const t = trx as unknown as Transaction<any>
      let itemIds: unknown = body.itemIds
      let sourceSetId: string | null = null
      let sourceOutfitId: string | null = null
      if (typeof body.setId === 'string') {
        const set = cat.sets.find(s => s.set_id === body.setId)
        if (!set || (set.access === 'premium' && !this.options.premiumEnabled)) throw new GameRuleError('NOT_FOUND', 'Outfit set not found')
        itemIds = set.item_ids
        sourceSetId = set.set_id
      } else if (typeof body.outfitId === 'string') {
        const saved = await sql<any>`SELECT item_ids FROM greenfield_moliboo_user_outfits WHERE outfit_id = ${body.outfitId} AND account_id = ${accountId}`.execute(t)
        if (!saved.rows[0]) throw new GameRuleError('NOT_FOUND', 'Outfit not found')
        itemIds = saved.rows[0].item_ids
        sourceOutfitId = body.outfitId
      }
      const ids = await this.validated(t, accountId, itemIds)
      await sql`INSERT INTO greenfield_moliboo_equipped (account_id, character_id, item_ids, source_set_id, source_outfit_id)
        VALUES (${accountId}, ${characterId}, ${jsonb(ids)}, ${sourceSetId}, ${sourceOutfitId})
        ON CONFLICT (account_id, character_id) DO UPDATE SET item_ids = EXCLUDED.item_ids, source_set_id = EXCLUDED.source_set_id,
          source_outfit_id = EXCLUDED.source_outfit_id, revision = greenfield_moliboo_equipped.revision + 1, updated_at = NOW()`.execute(t)
      const key = typeof body.idempotencyKey === 'string' ? cleanIdempotencyKey(body.idempotencyKey) : null
      const questProgress = await this.recordEvent(t, accountId, 'equip', characterId, {itemIds: ids, sourceSetId}, key)
      return {state: await this.characterState(accountId, characterId, t), questProgress}
    })
  }

  async characterState(accountId: string, rawCharacterId: unknown, exec: Exec = this.exec) {
    const characterId = cleanCharacterId(rawCharacterId)
    const cat = await this.catalogue()
    const now = new Date()
    const [equipped, skill, buffs, friendship, lastSkill] = await Promise.all([
      sql<any>`SELECT * FROM greenfield_moliboo_equipped WHERE account_id = ${accountId} AND character_id = ${characterId}`.execute(exec),
      sql<any>`SELECT * FROM greenfield_moliboo_skills WHERE character_id = ${characterId}`.execute(exec),
      sql<any>`SELECT * FROM greenfield_moliboo_active_buffs WHERE account_id = ${accountId} AND character_id = ${characterId} AND expires_at > NOW() ORDER BY expires_at`.execute(exec),
      sql<any>`SELECT xp FROM greenfield_moliboo_friendship WHERE account_id = ${accountId} AND character_id = ${characterId}`.execute(exec),
      sql<any>`SELECT occurred_at FROM greenfield_moliboo_events WHERE account_id = ${accountId} AND character_id = ${characterId} AND event_type = 'skill_use' ORDER BY occurred_at DESC LIMIT 1`.execute(exec),
    ])
    const eq = equipped.rows[0]
    const itemIds: string[] = eq?.item_ids ?? []
    const slots: Record<string, unknown> = {}
    for (const id of itemIds) {
      const item = cat.items.get(id)
      if (item) slots[item.slot] = itemDto(item)
    }
    const completeSet = cat.sets.find(s => s.item_ids.every(id => itemIds.includes(id)))
    const timed = buffs.rows.map((b: any) => {
      const def = cat.buffs.get(b.buff_id)
      return {buffId: b.buff_id, name: def?.name, description: def?.description, stacks: b.stacks, maxStacks: def?.maxStacks ?? 1,
        source: b.source, startedAt: new Date(b.started_at).toISOString(), expiresAt: new Date(b.expires_at).toISOString(), effects: def?.effects ?? {}}
    })
    const setBuffDef = completeSet?.set_bonus_buff_id ? cat.buffs.get(completeSet.set_bonus_buff_id) : null
    const allBuffs = setBuffDef
      ? [...timed, {buffId: setBuffDef.buffId, name: setBuffDef.name, description: setBuffDef.description, stacks: 1, maxStacks: 1, source: 'set_bonus', startedAt: null, expiresAt: null, effects: setBuffDef.effects}]
      : timed
    const s = skill.rows[0]
    const lastUsed = lastSkill.rows[0] ? new Date(lastSkill.rows[0].occurred_at) : null
    const availableAt = s && lastUsed ? new Date(lastUsed.getTime() + s.cooldown_seconds * 1000) : null
    const xp = friendship.rows[0]?.xp ?? 0
    return {
      characterId,
      equipped: {itemIds, slots, sourceSetId: eq?.source_set_id ?? null, sourceOutfitId: eq?.source_outfit_id ?? null, revision: eq?.revision ?? 0},
      outfitSet: {characterId, slots: SLOTS.map(slot => ({slot, itemId: itemIds.find(id => cat.items.get(id)?.slot === slot) ?? null}))},
      setBonus: completeSet ? {setId: completeSet.set_id, name: completeSet.name, buffId: completeSet.set_bonus_buff_id} : null,
      skill: s ? {skillId: s.skill_id, name: s.name, description: s.description, cooldownSeconds: s.cooldown_seconds, grantsBuffId: s.grants_buff_id,
        lastUsedAt: lastUsed?.toISOString() ?? null, availableAt: availableAt && availableAt > now ? availableAt.toISOString() : null,
        ready: !availableAt || availableAt <= now} : null,
      buffs: allBuffs,
      friendship: {xp, ...friendshipLevel(xp), bonusPct: friendshipBonusPct(timed, cat.buffs)},
    }
  }

  private async grantBuff(t: Exec, accountId: string, characterId: string, buffId: string, source: string) {
    const cat = await this.catalogue()
    const def = cat.buffs.get(buffId)
    if (!def) return null
    const current = await sql<any>`SELECT buff_id, stacks, started_at, expires_at FROM greenfield_moliboo_active_buffs
      WHERE account_id = ${accountId} AND character_id = ${characterId} FOR UPDATE`.execute(t)
    const active: ActiveBuff[] = current.rows.map((r: any) => ({buffId: r.buff_id, stacks: r.stacks, startedAt: new Date(r.started_at), expiresAt: new Date(r.expires_at)}))
    const {upsert, remove} = applyBuff(active, def, cat.buffs, new Date())
    await sql`DELETE FROM greenfield_moliboo_active_buffs WHERE account_id = ${accountId} AND character_id = ${characterId}
      AND (expires_at <= NOW() OR buff_id = ANY(${remove}::text[]))`.execute(t)
    await sql`INSERT INTO greenfield_moliboo_active_buffs (account_id, character_id, buff_id, stacks, source, started_at, expires_at)
      VALUES (${accountId}, ${characterId}, ${buffId}, ${upsert.stacks}, ${source}, ${upsert.startedAt}, ${upsert.expiresAt})
      ON CONFLICT (account_id, character_id, buff_id) DO UPDATE SET stacks = EXCLUDED.stacks, source = EXCLUDED.source, expires_at = EXCLUDED.expires_at`.execute(t)
    return {buffId, stacks: upsert.stacks, expiresAt: upsert.expiresAt.toISOString(), removed: remove}
  }

  private async addFriendship(t: Exec, accountId: string, characterId: string, base: number): Promise<number> {
    const cat = await this.catalogue()
    const buffs = await sql<any>`SELECT buff_id, stacks FROM greenfield_moliboo_active_buffs WHERE account_id = ${accountId} AND character_id = ${characterId} AND expires_at > NOW()`.execute(t)
    const amount = Math.round(base * (1 + friendshipBonusPct(buffs.rows.map((b: any) => ({buffId: b.buff_id, stacks: b.stacks})), cat.buffs) / 100))
    await sql`INSERT INTO greenfield_moliboo_friendship (account_id, character_id, xp) VALUES (${accountId}, ${characterId}, ${amount})
      ON CONFLICT (account_id, character_id) DO UPDATE SET xp = greenfield_moliboo_friendship.xp + EXCLUDED.xp, updated_at = NOW()`.execute(t)
    return amount
  }

  /** Idempotent event write + quest progress. Returns null progress when the idempotency key was already used. */
  private async recordEvent(t: Exec, accountId: string, eventType: string, characterId: string | null, detail: object, idempotencyKey: string | null, counts = true) {
    const inserted = await sql<any>`INSERT INTO greenfield_moliboo_events (event_id, account_id, event_type, character_id, detail, idempotency_key)
      VALUES (${`mev_${randomUUID()}`}, ${accountId}, ${eventType}, ${characterId}, ${jsonb({...detail, counted: counts})}, ${idempotencyKey})
      ON CONFLICT (account_id, idempotency_key) DO NOTHING RETURNING event_id`.execute(t)
    if (!inserted.rows[0]) return null
    if (!counts) return []
    const cat = await this.catalogue()
    const now = new Date()
    const family = characterId ? familyOf(characterId) : null
    const touched = []
    for (const q of cat.quests.filter(q => q.event_type === eventType && (!q.family_filter || q.family_filter === family))) {
      const pk = periodKey(q.kind, now)
      const row = await sql<any>`INSERT INTO greenfield_moliboo_quest_progress (account_id, quest_id, period_key, progress)
        VALUES (${accountId}, ${q.quest_id}, ${pk}, 1)
        ON CONFLICT (account_id, quest_id, period_key) DO UPDATE SET progress = LEAST(${q.target}, greenfield_moliboo_quest_progress.progress + 1)
        RETURNING progress, completed_at`.execute(t)
      const progress = row.rows[0].progress
      if (progress >= q.target && !row.rows[0].completed_at) {
        await sql`UPDATE greenfield_moliboo_quest_progress SET completed_at = NOW() WHERE account_id = ${accountId} AND quest_id = ${q.quest_id} AND period_key = ${pk}`.execute(t)
      }
      touched.push({questId: q.quest_id, progress, target: q.target, completed: progress >= q.target})
    }
    return touched
  }

  async care(accountId: string, rawCharacterId: unknown, body: {action?: unknown; idempotencyKey?: unknown}) {
    const characterId = cleanCharacterId(rawCharacterId)
    if (typeof body.action !== 'string' || !(CARE_ACTIONS as readonly string[]).includes(body.action)) throw new GameRuleError('VALIDATION_FAILED', `action must be one of ${CARE_ACTIONS.join(', ')}`)
    const action = body.action
    const key = cleanIdempotencyKey(body.idempotencyKey)
    return this.db.transaction().execute(async trx => {
      const t = trx as unknown as Transaction<any>
      const recent = await sql<any>`SELECT 1 FROM greenfield_moliboo_events WHERE account_id = ${accountId} AND character_id = ${characterId}
        AND event_type = 'care' AND detail->>'action' = ${action} AND (detail->>'counted')::boolean
        AND occurred_at > NOW() - make_interval(secs => ${CARE_COUNT_WINDOW_SECONDS}) LIMIT 1`.execute(t)
      const counts = recent.rows.length === 0
      const questProgress = await this.recordEvent(t, accountId, 'care', characterId, {action}, `care:${key}`, counts)
      if (questProgress === null) return {replayed: true, counted: false, state: await this.characterState(accountId, characterId, t)}
      const buff = counts ? await this.grantBuff(t, accountId, characterId, CARE_BUFFS[action]!, `care:${action}`) : null
      const xp = counts ? await this.addFriendship(t, accountId, characterId, CARE_XP) : 0
      return {replayed: false, counted: counts, buff, friendshipXpGained: xp, questProgress, state: await this.characterState(accountId, characterId, t)}
    })
  }

  async useSkill(accountId: string, rawCharacterId: unknown, skillId: string, body: {idempotencyKey?: unknown}) {
    const characterId = cleanCharacterId(rawCharacterId)
    const key = cleanIdempotencyKey(body.idempotencyKey)
    return this.db.transaction().execute(async trx => {
      const t = trx as unknown as Transaction<any>
      const skill = (await sql<any>`SELECT * FROM greenfield_moliboo_skills WHERE skill_id = ${skillId} AND character_id = ${characterId}`.execute(t)).rows[0]
      if (!skill) throw new GameRuleError('NOT_FOUND', 'This Moliboo does not have that skill')
      const replay = await sql<any>`SELECT 1 FROM greenfield_moliboo_events WHERE account_id = ${accountId} AND idempotency_key = ${`skill:${key}`}`.execute(t)
      if (replay.rows[0]) return {replayed: true, state: await this.characterState(accountId, characterId, t)}
      const last = await sql<any>`SELECT occurred_at FROM greenfield_moliboo_events WHERE account_id = ${accountId} AND character_id = ${characterId}
        AND event_type = 'skill_use' AND occurred_at > NOW() - make_interval(secs => ${skill.cooldown_seconds}) ORDER BY occurred_at DESC LIMIT 1`.execute(t)
      if (last.rows[0]) {
        const availableAt = new Date(new Date(last.rows[0].occurred_at).getTime() + skill.cooldown_seconds * 1000).toISOString()
        throw new GameRuleError('CONFLICT', 'Skill is resting', {availableAt})
      }
      const questProgress = await this.recordEvent(t, accountId, 'skill_use', characterId, {skillId}, `skill:${key}`)
      const buff = skill.grants_buff_id ? await this.grantBuff(t, accountId, characterId, skill.grants_buff_id, `skill:${skillId}`) : null
      const xp = await this.addFriendship(t, accountId, characterId, SKILL_XP)
      return {replayed: false, animation: 'signature', buff, friendshipXpGained: xp, questProgress, state: await this.characterState(accountId, characterId, t)}
    })
  }

  async completeActivity(accountId: string, body: {activityId?: unknown; characterId?: unknown; idempotencyKey?: unknown}) {
    if (typeof body.activityId !== 'string' || !(ACTIVITIES as readonly string[]).includes(body.activityId)) throw new GameRuleError('VALIDATION_FAILED', 'Unknown activity')
    const activityId = body.activityId
    const characterId = body.characterId == null ? null : cleanCharacterId(body.characterId)
    const key = cleanIdempotencyKey(body.idempotencyKey)
    return this.db.transaction().execute(async trx => {
      const t = trx as unknown as Transaction<any>
      const today = await sql<{n: number}>`SELECT count(*)::int AS n FROM greenfield_moliboo_events WHERE account_id = ${accountId}
        AND event_type = 'activity_complete' AND (detail->>'counted')::boolean AND occurred_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`.execute(t)
      const counts = (today.rows[0]?.n ?? 0) < ACTIVITY_DAILY_COUNT_LIMIT
      const questProgress = await this.recordEvent(t, accountId, 'activity_complete', characterId, {activityId}, `activity:${key}`, counts)
      if (questProgress === null) return {replayed: true, counted: false}
      const xp = counts && characterId ? await this.addFriendship(t, accountId, characterId, CARE_XP) : 0
      return {replayed: false, counted: counts, friendshipXpGained: xp, questProgress}
    })
  }

  async quests(accountId: string) {
    const cat = await this.catalogue()
    const now = new Date()
    const rows = await sql<any>`SELECT * FROM greenfield_moliboo_quest_progress WHERE account_id = ${accountId}`.execute(this.exec)
    const byKey = new Map(rows.rows.map((r: any) => [`${r.quest_id}|${r.period_key}`, r]))
    const quests = cat.quests.map(q => {
      const pk = periodKey(q.kind, now)
      const p: any = byKey.get(`${q.quest_id}|${pk}`)
      const reward = q.reward?.type === 'item' ? {...q.reward, item: cat.items.get(q.reward.itemId) ? itemDto(cat.items.get(q.reward.itemId)!) : null}
        : q.reward?.type === 'surprise_item' ? {...q.reward, poolItems: (q.reward.pool as string[]).map(id => cat.items.get(id)).filter(Boolean).map(i => itemDto(i!))}
        : q.reward
      return {questId: q.quest_id, kind: q.kind, title: q.title, description: q.description, eventType: q.event_type, familyFilter: q.family_filter,
        target: q.target, progress: p?.progress ?? 0, completed: Boolean(p?.completed_at), claimed: Boolean(p?.claimed_at), rewardGrant: p?.reward_grant ?? null,
        periodKey: pk, resetsAt: periodEndsAt(q.kind, now), reward}
    })
    return {quests, rules: {streaksRequired: false, missedDaysPenalty: false, rewardsDisclosed: true, careCountWindowSeconds: CARE_COUNT_WINDOW_SECONDS, activityDailyCountLimit: ACTIVITY_DAILY_COUNT_LIMIT}}
  }

  async claimQuest(accountId: string, questId: string, body: {characterId?: unknown}) {
    const cat = await this.catalogue()
    const q = cat.quests.find(x => x.quest_id === questId)
    if (!q) throw new GameRuleError('NOT_FOUND', 'Quest not found')
    const pk = periodKey(q.kind, new Date())
    return this.db.transaction().execute(async trx => {
      const t = trx as unknown as Transaction<any>
      const p = (await sql<any>`SELECT * FROM greenfield_moliboo_quest_progress WHERE account_id = ${accountId} AND quest_id = ${questId} AND period_key = ${pk} FOR UPDATE`.execute(t)).rows[0]
      if (!p || p.progress < q.target) throw new GameRuleError('CONFLICT', 'Quest is not complete yet', {progress: p?.progress ?? 0, target: q.target})
      if (p.claimed_at) return {replayed: true, grant: p.reward_grant}
      const source = q.kind === 'achievement' ? 'achievement' : q.kind === 'collection' ? 'collection' : 'quest'
      let grant: any
      const owned = await this.ownedSet(t, accountId)
      if (q.reward.type === 'item' || q.reward.type === 'surprise_item') {
        const itemId = q.reward.type === 'item' ? q.reward.itemId : pickSurprise(q.reward.pool, new Set(owned.keys()), `${accountId}|${questId}|${pk}`)
        if (itemId && !owned.has(itemId)) {
          await sql`INSERT INTO greenfield_moliboo_inventory (account_id, item_id, source, source_ref) VALUES (${accountId}, ${itemId}, ${source}, ${`${questId}|${pk}`})
            ON CONFLICT (account_id, item_id) DO NOTHING`.execute(t)
          grant = {type: 'item', itemId}
        } else {
          grant = {type: 'already_owned', itemId}
        }
      }
      if (q.reward.type === 'friendship_xp' || grant?.type === 'already_owned' || (q.reward.type === 'surprise_item' && !grant?.itemId)) {
        const characterId = cleanCharacterId(body.characterId)
        const amount = await this.addFriendship(t, accountId, characterId, Number(q.reward.amount ?? 25))
        grant = {...(grant ?? {}), type: grant?.type ?? 'friendship_xp', friendshipXp: amount, characterId}
      }
      await sql`UPDATE greenfield_moliboo_quest_progress SET claimed_at = NOW(), reward_grant = ${jsonb(grant)}
        WHERE account_id = ${accountId} AND quest_id = ${questId} AND period_key = ${pk}`.execute(t)
      return {replayed: false, grant}
    })
  }
}
