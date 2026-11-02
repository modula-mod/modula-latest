import {randomInt} from 'node:crypto'
import {sql} from 'kysely'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from '../modules/module-errors.js'
import {GreenfieldGubicService} from '../modules/gubic-service.js'
import {GubicManifestError, gubicManifestDigest, validateGubicManifest} from './manifest.js'
import type {GubicLobbyHub} from './lobby-hub.js'

export const GUBIC_CAPABILITIES = [
  'gubic_play', 'gubic_publish_free', 'gubic_lobby_size', 'gubic_creator_monetisation',
  'gubic_creator_analytics', 'gubic_studio_team_publishing',
] as const
export type GubicCapabilityId = typeof GUBIC_CAPABILITIES[number]

const PLATFORMS = new Set(['ios', 'ipados', 'macos', 'web', 'android'])
const JOIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const LOBBY_TTL_MS = 2 * 60 * 60 * 1000
const SESSION_STALE_MS = 10 * 60 * 1000
const MAX_SESSION_SECONDS = 86_400
const DEFAULT_LOBBY_SIZE = 8

/**
 * Player-facing GUBIC state: library, play sessions, lobbies, achievements
 * and developer submissions. Catalogue truth comes from GreenfieldGubicService
 * and the registry; nothing here grants wallet balances or inventory.
 */
export class GubicPlayService {
  readonly catalogue: GreenfieldGubicService

  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
    private readonly hub: GubicLobbyHub,
    private readonly qaCapabilityEvaluation = config.environment !== 'production',
  ) {
    this.catalogue = new GreenfieldGubicService(db, config)
  }

  // MARK: Premium capabilities (server-authoritative, per the Premium plan)

  async capabilities(accountId: string) {
    const now = new Date()
    const membership = await this.db.selectFrom('greenfield_premium_memberships').selectAll()
      .where('account_id', '=', accountId).executeTakeFirst()
    const active = Boolean(membership && membership.subscription_status === 'active' && membership.effective_at <= now
      && (!membership.expires_at || membership.expires_at > now))
    const tier = active && membership ? membership.tier_id : 'core'
    const catalogue = await this.db.selectFrom('greenfield_premium_catalogue_versions').select('catalogue_version')
      .where('status', '=', 'active').executeTakeFirst()
    const version = catalogue?.catalogue_version ?? 1
    const [tiers, rows] = await Promise.all([
      this.db.selectFrom('greenfield_premium_tiers').select(['tier_id', 'rank']).where('catalogue_version', '=', version).execute(),
      this.db.selectFrom('greenfield_premium_capabilities').selectAll().where('catalogue_version', '=', version)
        .where('capability_id', 'in', [...GUBIC_CAPABILITIES]).execute(),
    ])
    const rank = tiers.find(row => row.tier_id === tier)?.rank ?? 0
    const byId = new Map(rows.map(row => [row.capability_id, row]))
    return {
      schemaVersion: 1,
      tier,
      purchase: {enabled: false, reason: 'premium_purchase_disabled'},
      capabilities: GUBIC_CAPABILITIES.map(id => {
        const row = byId.get(id)
        if (!row) return {id, available: false, value: null, minimumRank: null, reason: 'capability_not_configured'}
        const available = row.availability_mode === 'existing_free'
          || (row.availability_mode === 'qa_only' && this.qaCapabilityEvaluation && rank >= row.minimum_rank)
        const values = row.value_by_tier && typeof row.value_by_tier === 'object' ? row.value_by_tier as Record<string, unknown> : {}
        return {
          id, available, value: values[tier] ?? null, minimumRank: row.minimum_rank,
          reason: available
            ? row.availability_mode === 'existing_free' ? 'free_feature' : 'membership_entitlement'
            : row.availability_mode === 'future_disabled' ? 'future_feature_disabled' : 'tier_or_environment_not_eligible',
        }
      }),
    }
  }

  private async capability(accountId: string, id: GubicCapabilityId) {
    return (await this.capabilities(accountId)).capabilities.find(item => item.id === id)!
  }

  // MARK: Library

  async library(accountId: string) {
    const rows = await this.db.selectFrom('greenfield_gubic_library_items').selectAll()
      .where('account_id', '=', accountId)
      .orderBy(sql`last_played_at DESC NULLS LAST`).orderBy('game_id').execute()
    const published = new Map((await this.catalogue.listGames({limit: 100})).items.map(game => [game.gameId, game]))
    const achievementCounts = await this.db.selectFrom('greenfield_gubic_achievement_unlocks')
      .select(['game_id', sql<number>`count(*)::int`.as('count')])
      .where('account_id', '=', accountId).groupBy('game_id').execute()
    const unlocked = new Map(achievementCounts.map(row => [row.game_id, Number(row.count)]))
    return {
      items: rows.map(row => ({
        gameId: row.game_id,
        addedAt: row.added_at.toISOString(),
        hidden: row.hidden,
        favourite: row.favourite,
        lastPlayedAt: row.last_played_at?.toISOString() ?? null,
        playCount: row.play_count,
        totalPlaySeconds: Number(row.total_play_seconds),
        achievementsUnlocked: unlocked.get(row.game_id) ?? 0,
        game: published.get(row.game_id) ?? null,
      })),
    }
  }

  async upsertLibraryItem(accountId: string, gameId: string, input: {favourite?: unknown; hidden?: unknown}) {
    await this.requirePublishedGame(gameId)
    const favourite = typeof input.favourite === 'boolean' ? input.favourite : undefined
    const hidden = typeof input.hidden === 'boolean' ? input.hidden : undefined
    const now = new Date()
    await this.db.insertInto('greenfield_gubic_library_items').values({
      account_id: accountId, game_id: gameId, added_at: now, updated_at: now,
      favourite: favourite ?? false, hidden: hidden ?? false, play_count: 0, total_play_seconds: 0,
    }).onConflict(oc => oc.columns(['account_id', 'game_id']).doUpdateSet({
      ...(favourite === undefined ? {} : {favourite}),
      ...(hidden === undefined ? {} : {hidden}),
      updated_at: now,
    })).execute()
    return (await this.library(accountId)).items.find(item => item.gameId === gameId)
  }

  async removeLibraryItem(accountId: string, gameId: string) {
    const active = await this.db.selectFrom('greenfield_gubic_play_sessions').select('session_id')
      .where('account_id', '=', accountId).where('game_id', '=', gameId).where('status', '=', 'active').executeTakeFirst()
    if (active) throw moduleError('CONFLICT', 'End the active play session before removing the game')
    await this.db.deleteFrom('greenfield_gubic_library_items').where('account_id', '=', accountId).where('game_id', '=', gameId).execute()
    // Achievements are identity history and are intentionally kept.
    return {gameId, removed: true}
  }

  // MARK: Play sessions

  async startSession(accountId: string, gameId: string, input: {clientPlatform?: unknown; releaseVersion?: unknown; lobbyId?: unknown}) {
    const game = await this.requirePublishedGame(gameId)
    const platform = String(input.clientPlatform ?? '')
    if (!PLATFORMS.has(platform)) throw moduleError('VALIDATION_FAILED', 'clientPlatform is invalid')
    const releaseVersion = typeof input.releaseVersion === 'string' && input.releaseVersion.length <= 64 ? input.releaseVersion : game.release.version
    let lobbyId: string | null = null
    if (input.lobbyId != null) {
      lobbyId = String(input.lobbyId)
      const member = await this.activeMember(lobbyId, accountId)
      if (!member) throw moduleError('FORBIDDEN', 'Join the lobby before starting a lobby session')
    }
    const now = new Date()
    return this.db.transaction().execute(async trx => {
      // A stale or abandoned session for the same game is closed first.
      const existing = await trx.selectFrom('greenfield_gubic_play_sessions').selectAll()
        .where('account_id', '=', accountId).where('game_id', '=', gameId).where('status', '=', 'active').forUpdate().executeTakeFirst()
      if (existing) await this.closeSession(trx, existing, 'abandoned', now)
      const sessionId = uuidv7()
      await trx.insertInto('greenfield_gubic_play_sessions').values({
        session_id: sessionId, account_id: accountId, game_id: gameId, release_version: releaseVersion,
        lobby_id: lobbyId, client_platform: platform as any, status: 'active', started_at: now, last_heartbeat_at: now,
      }).execute()
      await trx.insertInto('greenfield_gubic_library_items').values({
        account_id: accountId, game_id: gameId, added_at: now, updated_at: now, last_played_at: now, play_count: 1, favourite: false, hidden: false, total_play_seconds: 0,
      }).onConflict(oc => oc.columns(['account_id', 'game_id']).doUpdateSet({
        last_played_at: now, play_count: sql`greenfield_gubic_library_items.play_count + 1`, hidden: false, updated_at: now,
      })).execute()
      return {sessionId, gameId, releaseVersion, lobbyId, startedAt: now.toISOString(), status: 'active' as const}
    })
  }

  async heartbeat(accountId: string, sessionId: string) {
    const session = await this.ownedSession(accountId, sessionId)
    if (session.status !== 'active') throw moduleError('CONFLICT', 'Play session has ended')
    const now = new Date()
    await this.db.updateTable('greenfield_gubic_play_sessions').set({last_heartbeat_at: now})
      .where('session_id', '=', sessionId).execute()
    return {sessionId, status: 'active', lastHeartbeatAt: now.toISOString()}
  }

  async endSession(accountId: string, sessionId: string) {
    const now = new Date()
    return this.db.transaction().execute(async trx => {
      const session = await trx.selectFrom('greenfield_gubic_play_sessions').selectAll()
        .where('session_id', '=', sessionId).forUpdate().executeTakeFirst()
      if (!session || session.account_id !== accountId) throw moduleError('NOT_FOUND', 'Play session not found')
      if (session.status !== 'active') {
        return {sessionId, status: session.status, durationSeconds: session.duration_seconds ?? 0}
      }
      const duration = await this.closeSession(trx, session, 'ended', now)
      return {sessionId, status: 'ended' as const, durationSeconds: duration}
    })
  }

  private async closeSession(trx: any, session: {session_id: string; account_id: string; game_id: string; started_at: Date; last_heartbeat_at: Date}, status: 'ended' | 'abandoned', now: Date) {
    // Abandoned sessions only count time up to the last heartbeat.
    const until = status === 'abandoned' || now.getTime() - session.last_heartbeat_at.getTime() > SESSION_STALE_MS ? session.last_heartbeat_at : now
    const duration = Math.max(0, Math.min(MAX_SESSION_SECONDS, Math.round((until.getTime() - session.started_at.getTime()) / 1000)))
    await trx.updateTable('greenfield_gubic_play_sessions').set({status, ended_at: now, duration_seconds: duration})
      .where('session_id', '=', session.session_id).execute()
    await trx.updateTable('greenfield_gubic_library_items').set({
      total_play_seconds: sql`greenfield_gubic_library_items.total_play_seconds + ${duration}`, updated_at: now,
    }).where('account_id', '=', session.account_id).where('game_id', '=', session.game_id).execute()
    return duration
  }

  // MARK: Lobbies

  async listLobbies(gameId: string) {
    await this.requirePublishedGame(gameId)
    const now = new Date()
    const lobbies = await this.db.selectFrom('greenfield_gubic_lobbies').selectAll()
      .where('game_id', '=', gameId).where('visibility', '=', 'public').where('status', '=', 'open')
      .where('expires_at', '>', now).orderBy('created_at', 'desc').limit(50).execute()
    return {items: await Promise.all(lobbies.map(lobby => this.presentLobby(lobby, null)))}
  }

  async createLobby(accountId: string, gameId: string, input: {title?: unknown; visibility?: unknown; maxPlayers?: unknown}) {
    await this.requirePublishedGame(gameId)
    const title = typeof input.title === 'string' && input.title.trim() ? input.title.trim().slice(0, 80) : 'Open lobby'
    const visibility = input.visibility === 'invite' ? 'invite' : input.visibility === 'public' || input.visibility == null ? 'public' : invalid('visibility must be public or invite')
    const sizeCapability = await this.capability(accountId, 'gubic_lobby_size')
    const allowed = typeof sizeCapability.value === 'number' ? sizeCapability.value : DEFAULT_LOBBY_SIZE
    const maxPlayers = input.maxPlayers == null ? Math.min(4, allowed) : Number(input.maxPlayers)
    if (!Number.isInteger(maxPlayers) || maxPlayers < 2) invalid('maxPlayers must be at least 2')
    if (maxPlayers > allowed) {
      throw moduleError('FORBIDDEN', `Your plan allows lobbies of up to ${allowed} players`)
    }
    const already = await this.db.selectFrom('greenfield_gubic_lobby_members as member')
      .innerJoin('greenfield_gubic_lobbies as lobby', 'lobby.lobby_id', 'member.lobby_id')
      .select('lobby.lobby_id').where('member.account_id', '=', accountId).where('member.role', '=', 'host')
      .where('member.left_at', 'is', null).where('lobby.status', '!=', 'closed').where('lobby.expires_at', '>', new Date())
      .executeTakeFirst()
    if (already) throw moduleError('CONFLICT', 'You are already hosting a lobby')
    const now = new Date()
    const lobbyId = uuidv7()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const joinCode = Array.from({length: 6}, () => JOIN_ALPHABET[randomInt(JOIN_ALPHABET.length)]).join('')
      try {
        await this.db.transaction().execute(async trx => {
          await trx.insertInto('greenfield_gubic_lobbies').values({
            lobby_id: lobbyId, game_id: gameId, host_account_id: accountId, title, visibility, join_code: joinCode,
            max_players: maxPlayers, status: 'open', revision: 1, created_at: now, updated_at: now,
            expires_at: new Date(now.getTime() + LOBBY_TTL_MS),
          }).execute()
          await trx.insertInto('greenfield_gubic_lobby_members').values({
            lobby_id: lobbyId, account_id: accountId, role: 'host', ready: false, joined_at: now,
          }).execute()
        })
        return this.getLobby(accountId, lobbyId)
      } catch (error: any) {
        if (error?.code === '23505' && String(error?.constraint ?? '').includes('join_code')) continue
        throw error
      }
    }
    throw moduleError('CONFLICT', 'Could not allocate a lobby code; try again')
  }

  async getLobby(accountId: string | null, lobbyId: string) {
    const lobby = await this.db.selectFrom('greenfield_gubic_lobbies').selectAll().where('lobby_id', '=', lobbyId).executeTakeFirst()
    if (!lobby) throw moduleError('NOT_FOUND', 'Lobby not found')
    const member = accountId ? await this.activeMember(lobbyId, accountId) : null
    if (lobby.visibility === 'invite' && !member) throw moduleError('NOT_FOUND', 'Lobby not found')
    return this.presentLobby(lobby, member ? accountId : null)
  }

  async joinLobby(accountId: string, input: {lobbyId?: string; joinCode?: unknown}) {
    const now = new Date()
    const result = await this.db.transaction().execute(async trx => {
      let query = trx.selectFrom('greenfield_gubic_lobbies').selectAll()
      if (input.lobbyId) query = query.where('lobby_id', '=', input.lobbyId)
      else if (typeof input.joinCode === 'string' && /^[A-HJ-NP-Z2-9]{6}$/.test(input.joinCode.toUpperCase())) query = query.where('join_code', '=', input.joinCode.toUpperCase())
      else invalid('lobbyId or a 6 character joinCode is required')
      const lobby = await query.forUpdate().executeTakeFirst()
      if (!lobby) throw moduleError('NOT_FOUND', 'Lobby not found')
      // Invite lobbies are only reachable by code.
      if (lobby.visibility === 'invite' && input.lobbyId && !input.joinCode) throw moduleError('NOT_FOUND', 'Lobby not found')
      if (lobby.status !== 'open' || lobby.expires_at <= now) throw moduleError('CONFLICT', 'Lobby is not accepting players')
      const existing = await trx.selectFrom('greenfield_gubic_lobby_members').selectAll()
        .where('lobby_id', '=', lobby.lobby_id).where('account_id', '=', accountId).executeTakeFirst()
      if (existing && !existing.left_at) return lobby
      const count = await trx.selectFrom('greenfield_gubic_lobby_members').select(sql<number>`count(*)::int`.as('count'))
        .where('lobby_id', '=', lobby.lobby_id).where('left_at', 'is', null).executeTakeFirstOrThrow()
      if (Number(count.count) >= lobby.max_players) throw moduleError('CONFLICT', 'Lobby is full')
      if (existing) {
        await trx.updateTable('greenfield_gubic_lobby_members').set({left_at: null, ready: false, joined_at: now})
          .where('lobby_id', '=', lobby.lobby_id).where('account_id', '=', accountId).execute()
      } else {
        await trx.insertInto('greenfield_gubic_lobby_members').values({lobby_id: lobby.lobby_id, account_id: accountId, role: 'player', ready: false, joined_at: now}).execute()
      }
      return this.bump(trx, lobby.lobby_id, now)
    })
    this.hub.publish({type: 'lobby.updated', lobbyId: result.lobby_id, revision: result.revision})
    return this.getLobby(accountId, result.lobby_id)
  }

  async leaveLobby(accountId: string, lobbyId: string) {
    const now = new Date()
    const outcome = await this.db.transaction().execute(async trx => {
      const lobby = await trx.selectFrom('greenfield_gubic_lobbies').selectAll().where('lobby_id', '=', lobbyId).forUpdate().executeTakeFirst()
      if (!lobby) throw moduleError('NOT_FOUND', 'Lobby not found')
      const member = await trx.selectFrom('greenfield_gubic_lobby_members').selectAll()
        .where('lobby_id', '=', lobbyId).where('account_id', '=', accountId).where('left_at', 'is', null).executeTakeFirst()
      if (!member) throw moduleError('NOT_FOUND', 'You are not in this lobby')
      await trx.updateTable('greenfield_gubic_lobby_members').set({left_at: now, ready: false})
        .where('lobby_id', '=', lobbyId).where('account_id', '=', accountId).execute()
      if (member.role === 'host') {
        // Host leaving closes the lobby; no silent host transfer.
        await trx.updateTable('greenfield_gubic_lobbies').set({status: 'closed', updated_at: now, revision: lobby.revision + 1})
          .where('lobby_id', '=', lobbyId).execute()
        await trx.updateTable('greenfield_gubic_lobby_members').set({left_at: now, ready: false})
          .where('lobby_id', '=', lobbyId).where('left_at', 'is', null).execute()
        return {closed: true, revision: lobby.revision + 1}
      }
      const bumped = await this.bump(trx, lobbyId, now)
      return {closed: false, revision: bumped.revision}
    })
    this.hub.publish(outcome.closed ? {type: 'lobby.closed', lobbyId} : {type: 'lobby.updated', lobbyId, revision: outcome.revision})
    return {lobbyId, left: true, lobbyClosed: outcome.closed}
  }

  async setReady(accountId: string, lobbyId: string, ready: unknown) {
    if (typeof ready !== 'boolean') invalid('ready must be boolean')
    const now = new Date()
    const bumped = await this.db.transaction().execute(async trx => {
      const lobby = await trx.selectFrom('greenfield_gubic_lobbies').selectAll().where('lobby_id', '=', lobbyId).forUpdate().executeTakeFirst()
      if (!lobby || lobby.status !== 'open') throw moduleError('CONFLICT', 'Lobby is not open')
      const updated = await trx.updateTable('greenfield_gubic_lobby_members').set({ready: ready as boolean})
        .where('lobby_id', '=', lobbyId).where('account_id', '=', accountId).where('left_at', 'is', null).executeTakeFirst()
      if (!Number(updated.numUpdatedRows)) throw moduleError('NOT_FOUND', 'You are not in this lobby')
      return this.bump(trx, lobbyId, now)
    })
    this.hub.publish({type: 'lobby.updated', lobbyId, revision: bumped.revision})
    return this.getLobby(accountId, lobbyId)
  }

  async startLobby(accountId: string, lobbyId: string) {
    const now = new Date()
    const revision = await this.db.transaction().execute(async trx => {
      const lobby = await trx.selectFrom('greenfield_gubic_lobbies').selectAll().where('lobby_id', '=', lobbyId).forUpdate().executeTakeFirst()
      if (!lobby) throw moduleError('NOT_FOUND', 'Lobby not found')
      if (lobby.host_account_id !== accountId) throw moduleError('FORBIDDEN', 'Only the host can start the game')
      if (lobby.status !== 'open') throw moduleError('CONFLICT', 'Lobby is not open')
      const members = await trx.selectFrom('greenfield_gubic_lobby_members').selectAll()
        .where('lobby_id', '=', lobbyId).where('left_at', 'is', null).execute()
      if (members.length < 2) throw moduleError('CONFLICT', 'At least two players are needed')
      if (members.some(member => member.role !== 'host' && !member.ready)) throw moduleError('CONFLICT', 'Every player must be ready')
      await trx.updateTable('greenfield_gubic_lobbies').set({status: 'in-game', revision: lobby.revision + 1, updated_at: now})
        .where('lobby_id', '=', lobbyId).execute()
      return lobby.revision + 1
    })
    this.hub.publish({type: 'lobby.started', lobbyId, revision})
    return this.getLobby(accountId, lobbyId)
  }

  async isActiveMember(lobbyId: string, accountId: string) {
    return Boolean(await this.activeMember(lobbyId, accountId))
  }

  private async activeMember(lobbyId: string, accountId: string) {
    return this.db.selectFrom('greenfield_gubic_lobby_members').selectAll()
      .where('lobby_id', '=', lobbyId).where('account_id', '=', accountId).where('left_at', 'is', null).executeTakeFirst()
  }

  private async bump(trx: any, lobbyId: string, now: Date) {
    return trx.updateTable('greenfield_gubic_lobbies').set({revision: sql`revision + 1`, updated_at: now})
      .where('lobby_id', '=', lobbyId).returning(['lobby_id', 'revision']).executeTakeFirstOrThrow() as Promise<{lobby_id: string; revision: number}>
  }

  private async presentLobby(lobby: any, viewerAccountId: string | null) {
    const members = await this.db.selectFrom('greenfield_gubic_lobby_members as member')
      .innerJoin('greenfield_accounts as account', 'account.account_id', 'member.account_id')
      .select(['member.account_id', 'member.role', 'member.ready', 'member.joined_at', 'account.primary_handle'])
      .where('member.lobby_id', '=', lobby.lobby_id).where('member.left_at', 'is', null)
      .orderBy('member.joined_at').execute()
    return {
      lobbyId: lobby.lobby_id,
      gameId: lobby.game_id,
      title: lobby.title,
      visibility: lobby.visibility,
      status: lobby.expires_at <= new Date() && lobby.status === 'open' ? 'closed' : lobby.status,
      maxPlayers: lobby.max_players,
      playerCount: members.length,
      revision: lobby.revision,
      // The join code is only shown to members; it is the invite secret.
      joinCode: viewerAccountId ? lobby.join_code : null,
      isHost: viewerAccountId === lobby.host_account_id,
      createdAt: lobby.created_at.toISOString(),
      expiresAt: lobby.expires_at.toISOString(),
      members: members.map(member => ({
        handle: member.primary_handle, role: member.role, ready: member.ready, joinedAt: member.joined_at.toISOString(),
        isYou: member.account_id === viewerAccountId,
      })),
    }
  }

  // MARK: Achievements

  async gameAchievements(accountId: string | null, gameId: string) {
    await this.requirePublishedGame(gameId)
    const [definitions, unlocks] = await Promise.all([
      this.db.selectFrom('greenfield_gubic_achievements').selectAll().where('game_id', '=', gameId).where('retired', '=', false)
        .orderBy('created_at').orderBy('achievement_key').execute(),
      accountId ? this.db.selectFrom('greenfield_gubic_achievement_unlocks').selectAll()
        .where('account_id', '=', accountId).where('game_id', '=', gameId).execute() : Promise.resolve([]),
    ])
    const unlockedAt = new Map(unlocks.map(row => [row.achievement_key, row.unlocked_at.toISOString()]))
    return {
      gameId,
      totalPoints: definitions.reduce((sum, row) => sum + row.points, 0),
      earnedPoints: definitions.reduce((sum, row) => sum + (unlockedAt.has(row.achievement_key) ? row.points : 0), 0),
      items: definitions.map(row => {
        const unlocked = unlockedAt.get(row.achievement_key) ?? null
        const concealed = row.hidden && !unlocked
        return {
          key: row.achievement_key,
          title: concealed ? 'Hidden achievement' : row.title,
          description: concealed ? '' : row.description,
          points: row.points,
          hidden: row.hidden,
          unlockedAt: unlocked,
        }
      }),
    }
  }

  async myAchievements(accountId: string) {
    const rows = await this.db.selectFrom('greenfield_gubic_achievement_unlocks as unlock')
      .innerJoin('greenfield_gubic_achievements as achievement', join => join
        .onRef('achievement.game_id', '=', 'unlock.game_id').onRef('achievement.achievement_key', '=', 'unlock.achievement_key'))
      .select(['unlock.game_id', 'unlock.achievement_key', 'unlock.unlocked_at', 'achievement.title', 'achievement.points'])
      .where('unlock.account_id', '=', accountId).orderBy('unlock.unlocked_at', 'desc').limit(200).execute()
    return {
      totalPoints: rows.reduce((sum, row) => sum + row.points, 0),
      items: rows.map(row => ({gameId: row.game_id, key: row.achievement_key, title: row.title, points: row.points, unlockedAt: row.unlocked_at.toISOString()})),
    }
  }

  /** Game code reports an unlock through the host bridge; the server validates session, game and definition. */
  async unlockAchievement(accountId: string, sessionId: string, key: string) {
    const session = await this.ownedSession(accountId, sessionId)
    if (session.status !== 'active') throw moduleError('CONFLICT', 'Play session has ended')
    const definition = await this.db.selectFrom('greenfield_gubic_achievements').selectAll()
      .where('game_id', '=', session.game_id).where('achievement_key', '=', key).where('retired', '=', false).executeTakeFirst()
    if (!definition) throw moduleError('NOT_FOUND', 'Achievement is not declared by this game')
    const count = await this.db.selectFrom('greenfield_gubic_achievement_unlocks').select(sql<number>`count(*)::int`.as('count'))
      .where('session_id', '=', sessionId).executeTakeFirstOrThrow()
    if (Number(count.count) >= 50) throw moduleError('CONFLICT', 'Too many achievements in one session')
    const inserted = await this.db.insertInto('greenfield_gubic_achievement_unlocks').values({
      account_id: accountId, game_id: session.game_id, achievement_key: key, session_id: sessionId, unlocked_at: new Date(),
    }).onConflict(oc => oc.columns(['account_id', 'game_id', 'achievement_key']).doNothing()).executeTakeFirst()
    const row = await this.db.selectFrom('greenfield_gubic_achievement_unlocks').select('unlocked_at')
      .where('account_id', '=', accountId).where('game_id', '=', session.game_id).where('achievement_key', '=', key).executeTakeFirstOrThrow()
    return {
      gameId: session.game_id, key, title: definition.title, points: definition.points,
      newlyUnlocked: Number(inserted.numInsertedOrUpdatedRows ?? 0) > 0,
      unlockedAt: row.unlocked_at.toISOString(),
    }
  }

  // MARK: Developer submissions

  async submit(accountId: string, input: {publisherId?: unknown; manifest?: unknown}) {
    const publisherId = typeof input.publisherId === 'string' ? input.publisherId : invalid('publisherId is required')
    await this.requirePublisherAccess(accountId, publisherId)
    let manifest
    try { manifest = validateGubicManifest(input.manifest) } catch (error) {
      if (error instanceof GubicManifestError) throw moduleError('VALIDATION_FAILED', error.message)
      throw error
    }
    const publish = await this.capability(accountId, 'gubic_publish_free')
    if (!publish.available) throw moduleError('FORBIDDEN', 'Game publishing is not available for this account')
    if (manifest.monetisation !== 'free') {
      const monetisation = await this.capability(accountId, 'gubic_creator_monetisation')
      if (!monetisation.available) throw moduleError('FORBIDDEN', 'Paid games and in-game purchases need Modula Horizon Plus; free games can be published on every plan')
    }
    const entry = await this.catalogue.catalogueEntry(manifest.gameId)
    if (entry && entry.publisher_id !== publisherId) throw moduleError('FORBIDDEN', 'Another publisher owns this game id')
    const open = await this.db.selectFrom('greenfield_gubic_submissions').select('submission_id')
      .where('game_id', '=', manifest.gameId).where('status', 'in', ['submitted', 'in-review']).executeTakeFirst()
    if (open) throw moduleError('CONFLICT', 'This game already has a submission awaiting review')
    const now = new Date()
    const submissionId = uuidv7()
    try {
      await this.db.transaction().execute(async trx => {
        await trx.insertInto('greenfield_gubic_submissions').values({
          submission_id: submissionId, game_id: manifest.gameId, publisher_id: publisherId, submitted_by_account_id: accountId,
          version: manifest.version, manifest: sql`${JSON.stringify(manifest)}::jsonb`, manifest_sha256: gubicManifestDigest(manifest),
          monetisation: manifest.monetisation, status: 'submitted', created_at: now, updated_at: now,
        }).execute()
        if (entry && ['draft', 'rejected'].includes(entry.publication_status)) {
          await trx.updateTable('greenfield_game_catalogue_entries').set({publication_status: 'in-review', updated_by_account_id: accountId, updated_at: now})
            .where('game_id', '=', manifest.gameId).execute()
          await trx.insertInto('greenfield_game_catalogue_events').values({
            event_id: uuidv7(), game_id: manifest.gameId, publisher_id: publisherId, event_type: 'submitted',
            actor_account_id: accountId, previous_status: entry.publication_status, publication_status: 'in-review',
            evidence: sql`${JSON.stringify({submissionId, version: manifest.version})}::jsonb`, occurred_at: now,
          }).execute()
        }
      })
    } catch (error: any) {
      if (error?.code === '23505') throw moduleError('CONFLICT', 'This version has already been submitted')
      throw error
    }
    return this.submission(submissionId)
  }

  async listSubmissions(accountId: string, publisherId: string) {
    await this.requirePublisherAccess(accountId, publisherId)
    const rows = await this.db.selectFrom('greenfield_gubic_submissions').selectAll()
      .where('publisher_id', '=', publisherId).orderBy('created_at', 'desc').limit(100).execute()
    return {items: rows.map(presentSubmission)}
  }

  async withdraw(accountId: string, submissionId: string) {
    const row = await this.submissionRow(submissionId)
    await this.requirePublisherAccess(accountId, row.publisher_id)
    if (!['submitted', 'in-review'].includes(row.status)) throw moduleError('CONFLICT', 'Only pending submissions can be withdrawn')
    await this.db.updateTable('greenfield_gubic_submissions').set({status: 'withdrawn', updated_at: new Date()})
      .where('submission_id', '=', submissionId).execute()
    return this.submission(submissionId)
  }

  async reviewQueue(accountId: string) {
    await this.requireAdmin(accountId)
    const rows = await this.db.selectFrom('greenfield_gubic_submissions').selectAll()
      .where('status', 'in', ['submitted', 'in-review']).orderBy('created_at').limit(100).execute()
    return {items: rows.map(presentSubmission)}
  }

  async decide(accountId: string, submissionId: string, input: {decision?: unknown; reason?: unknown}) {
    await this.requireAdmin(accountId)
    const row = await this.submissionRow(submissionId)
    if (!['submitted', 'in-review'].includes(row.status)) throw moduleError('CONFLICT', 'Submission is not awaiting review')
    const reason = typeof input.reason === 'string' ? input.reason.slice(0, 1000) : null
    const now = new Date()
    if (input.decision === 'reject') {
      if (!reason) invalid('A rejection needs a reason for the developer')
      await this.db.updateTable('greenfield_gubic_submissions').set({status: 'rejected', reviewer_account_id: accountId, decision_reason: reason, decided_at: now, updated_at: now})
        .where('submission_id', '=', submissionId).execute()
      const entry = await this.catalogue.catalogueEntry(row.game_id)
      if (entry && entry.publication_status === 'in-review') {
        await this.catalogue.reviewCatalogueEntry(accountId, row.game_id, {publicationStatus: 'rejected', reason})
      }
      return this.submission(submissionId)
    }
    if (input.decision !== 'approve') invalid('decision must be approve or reject')
    const entry = await this.catalogue.catalogueEntry(row.game_id)
    if (!entry) throw moduleError('CONFLICT', 'Register the game in the catalogue and publish a signed registry release before approval')
    // Publishing re-checks registry trust and publisher ownership.
    await this.catalogue.reviewCatalogueEntry(accountId, row.game_id, {publicationStatus: 'published', availability: 'available', reason: reason ?? 'GUBIC submission approved'})
    const manifest = validateGubicManifest(row.manifest)
    await this.db.transaction().execute(async trx => {
      for (const achievement of manifest.achievements) {
        await trx.insertInto('greenfield_gubic_achievements').values({
          game_id: row.game_id, achievement_key: achievement.key, title: achievement.title, description: achievement.description,
          points: achievement.points, hidden: achievement.hidden, retired: false, created_at: now, updated_at: now,
        }).onConflict(oc => oc.columns(['game_id', 'achievement_key']).doUpdateSet({
          title: achievement.title, description: achievement.description, points: achievement.points,
          hidden: achievement.hidden, retired: false, updated_at: now,
        })).execute()
      }
      const keys = manifest.achievements.map(achievement => achievement.key)
      // Removed achievements retire; earned unlocks are never deleted.
      let retire = trx.updateTable('greenfield_gubic_achievements').set({retired: true, updated_at: now}).where('game_id', '=', row.game_id)
      if (keys.length) retire = retire.where('achievement_key', 'not in', keys)
      await retire.execute()
      await trx.updateTable('greenfield_gubic_submissions').set({status: 'approved', reviewer_account_id: accountId, decision_reason: reason, decided_at: now, updated_at: now})
        .where('submission_id', '=', submissionId).execute()
    })
    return this.submission(submissionId)
  }

  private async submission(submissionId: string) {
    return presentSubmission(await this.submissionRow(submissionId))
  }

  private async submissionRow(submissionId: string) {
    const row = await this.db.selectFrom('greenfield_gubic_submissions').selectAll().where('submission_id', '=', submissionId).executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'Submission not found')
    return row
  }

  // MARK: Guards

  private async requirePublishedGame(gameId: string) {
    return this.catalogue.getGame(gameId)
  }

  private async ownedSession(accountId: string, sessionId: string) {
    const session = await this.db.selectFrom('greenfield_gubic_play_sessions').selectAll().where('session_id', '=', sessionId).executeTakeFirst()
    if (!session || session.account_id !== accountId) throw moduleError('NOT_FOUND', 'Play session not found')
    return session
  }

  private async requirePublisherAccess(accountId: string, publisherId: string) {
    const owners = await this.db.selectFrom('greenfield_publisher_owners').selectAll().where('publisher_id', '=', publisherId).execute()
    if (owners.some(owner => owner.account_id === accountId)) return
    const organisationIds = owners.flatMap(owner => owner.organisation_id ? [owner.organisation_id] : [])
    if (organisationIds.length) {
      const membership = await this.db.selectFrom('greenfield_developer_organisation_memberships').select('membership_id')
        .where('account_id', '=', accountId).where('organisation_id', 'in', organisationIds)
        .where('state', '=', 'ACTIVE').where('role', 'in', ['OWNER', 'ADMIN', 'DEVELOPER', 'RELEASE_MANAGER']).executeTakeFirst()
      if (membership) return
    }
    throw moduleError('FORBIDDEN', 'Publisher access is required')
  }

  private async requireAdmin(accountId: string) {
    const account = await this.db.selectFrom('greenfield_accounts').select('primary_handle').where('account_id', '=', accountId).executeTakeFirst()
    if (!account || !this.config.adminHandles.includes(account.primary_handle.toLowerCase())) throw moduleError('FORBIDDEN', 'GUBIC review requires an operator')
  }
}

function presentSubmission(row: any) {
  const manifest = row.manifest as Record<string, any>
  return {
    submissionId: row.submission_id,
    gameId: row.game_id,
    publisherId: row.publisher_id,
    version: row.version,
    title: manifest?.title ?? row.game_id,
    monetisation: row.monetisation,
    status: row.status,
    manifestSha256: row.manifest_sha256,
    decisionReason: row.decision_reason,
    createdAt: row.created_at.toISOString(),
    decidedAt: row.decided_at?.toISOString() ?? null,
  }
}

function invalid(message: string): never {
  throw moduleError('VALIDATION_FAILED', message)
}
