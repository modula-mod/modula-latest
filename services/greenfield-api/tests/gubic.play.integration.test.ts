import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import pg from 'pg'
import net, {type AddressInfo} from 'node:net'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GubicLobbyHub, type GubicLobbyEvent} from '../src/gubic/lobby-hub.js'
import {GubicPlayService} from '../src/gubic/play-service.js'

const baseDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const adminDatabaseUrl = process.env.MODULA_TEST_ADMIN_DATABASE_URL
const describeIfDb = baseDatabaseUrl && adminDatabaseUrl ? describe : describe.skip

const GAME = 'digital.modula.games.orbit-tap'
const PUBLISHER = 'pub-gubic-test'

const manifest = (overrides: Record<string, unknown> = {}) => ({
  schema: 'modula.gubic.game.v1', gameId: GAME, version: '1.0.0', title: 'Orbit Tap', genre: 'Arcade', categories: ['arcade'],
  runtime: {engine: 'html5'}, bridge: {version: 1, capabilities: ['lifecycle', 'score', 'achievements']}, network: 'none',
  achievements: [{key: 'first-star', title: 'First star', points: 10}], ageRating: '4+', monetisation: 'free', packageSizeBytes: 1000,
  ...overrides,
})

describeIfDb('GUBIC play platform (library, sessions, lobbies, achievements, submissions)', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let play: GubicPlayService
  const hub = new GubicLobbyHub()
  const suffix = Date.now().toString(36)
  const adminHandle = `gbadmin${suffix}`.slice(0, 20)
  const databaseName = `modula_gubic_${process.pid}_${Date.now()}`
  let users: Record<string, {accountId: string; accessToken: string}> = {}

  beforeAll(async () => {
    const admin = new pg.Client({connectionString: adminDatabaseUrl!})
    await admin.connect()
    await admin.query(`CREATE DATABASE "${databaseName}" OWNER modula_migrator`)
    await admin.end()
    const url = new URL(baseDatabaseUrl!)
    url.pathname = `/${databaseName}`
    Object.assign(process.env, {
      NODE_ENV: 'test', MODULA_ENVIRONMENT: 'development', MODULA_API_HOST: '127.0.0.1', MODULA_API_PORT: '4033',
      MODULA_PUBLIC_API_URL: 'http://127.0.0.1:4033', MODULA_DATABASE_URL: url.toString(), MODULA_DATABASE_MIGRATOR_URL: url.toString(),
      MODULA_ALLOWED_ORIGINS: 'https://modula.digital', MODULA_PREVIEW_WRITES_ENABLED: 'true', MODULA_INVITE_ONLY: 'true',
      MODULA_REGISTRATION_INVITE_CODES: 'test-invite', MODULA_ATPROTO_ENABLED: 'false', MODULA_RATE_LIMIT_ENABLED: 'false',
      MODULA_MEDIA_ROOT: `/tmp/modula-gubic-${process.pid}`, MODULA_GUBIC_PLAY_ENABLED: 'true', MODULA_ADMIN_HANDLES: adminHandle,
    })
    await migrateUp(url.toString())
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
    for (const name of ['host', 'guest', 'third', 'admin']) {
      const handle = name === 'admin' ? adminHandle : `gb${name}${suffix}`.slice(0, 20)
      users[name] = await createUser(handle)
    }
    const now = new Date()
    await db.insertInto('greenfield_publishers').values({publisher_id: PUBLISHER, display_name: 'GUBIC Test', website: null, status: 'verified', trust_level: 'verifiedPublisher', created_at: now, updated_at: now, verified_at: now, suspended_at: null, revoked_at: null} as any).execute()
    await db.insertInto('greenfield_publisher_owners').values({publisher_owner_id: `own-${suffix}`, publisher_id: PUBLISHER, owner_type: 'ACCOUNT', account_id: users.host.accountId, organisation_id: null, created_at: now}).execute()
    await db.insertInto('greenfield_game_catalogue_entries').values({game_id: GAME, publisher_id: PUBLISHER, origin_type: 'independent-publisher', genre: 'Arcade', runtime_category: 'html5-javascript', availability: 'available', publication_status: 'draft'} as any).execute()
    await db.insertInto('greenfield_gubic_achievements').values({game_id: GAME, achievement_key: 'first-star', title: 'First star', description: '', points: 10, hidden: false, retired: false} as any).execute()
    play = new GubicPlayService(db, loadConfig(), hub)
    // Registry publication is covered by registry suites; stub the published projection here.
    const game = {gameId: GAME, title: 'Orbit Tap', release: {version: '1.0.0'}} as any
    play.catalogue.getGame = async (id: string) => { if (id !== GAME) throw Object.assign(new Error('Published game not found'), {code: 'NOT_FOUND'}); return game }
    play.catalogue.listGames = async () => ({items: [game], nextCursor: null})
  })

  afterAll(async () => {
    delete process.env.MODULA_GUBIC_PLAY_ENABLED
    await app?.close()
    await db?.destroy()
    const admin = new pg.Client({connectionString: adminDatabaseUrl!})
    await admin.connect()
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [databaseName])
    await admin.query(`DROP DATABASE "${databaseName}"`)
    await admin.end()
  })

  it('fails closed without authentication', async () => {
    for (const url of ['/v1/gubic/library', '/v1/gubic/capabilities', '/v1/gubic/me/achievements']) {
      expect((await app.inject({method: 'GET', url})).statusCode).toBe(401)
    }
  })

  it('keeps play, lobbies and free publishing on Core and gates monetisation', async () => {
    const response = await app.inject({method: 'GET', url: '/v1/gubic/capabilities', headers: {authorization: `Bearer ${users.guest.accessToken}`}})
    expect(response.statusCode, response.body).toBe(200)
    const caps = Object.fromEntries(response.json().data.capabilities.map((c: any) => [c.id, c]))
    expect(response.json().data.tier).toBe('core')
    expect(caps.gubic_play.available).toBe(true)
    expect(caps.gubic_publish_free.available).toBe(true)
    expect(caps.gubic_lobby_size.value).toBe(8)
    expect(caps.gubic_creator_monetisation.available).toBe(false)
  })

  it('tracks sessions into the library and validates achievement unlocks', async () => {
    const session = await play.startSession(users.guest.accountId, GAME, {clientPlatform: 'ios'})
    await expect(play.startSession(users.guest.accountId, GAME, {clientPlatform: 'playstation'})).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    const first = await play.unlockAchievement(users.guest.accountId, session.sessionId, 'first-star')
    expect(first.newlyUnlocked).toBe(true)
    expect((await play.unlockAchievement(users.guest.accountId, session.sessionId, 'first-star')).newlyUnlocked).toBe(false)
    await expect(play.unlockAchievement(users.guest.accountId, session.sessionId, 'made-up')).rejects.toMatchObject({code: 'NOT_FOUND'})
    await expect(play.unlockAchievement(users.third.accountId, session.sessionId, 'first-star')).rejects.toMatchObject({code: 'NOT_FOUND'})
    const ended = await play.endSession(users.guest.accountId, session.sessionId)
    expect(ended.status).toBe('ended')
    await expect(play.unlockAchievement(users.guest.accountId, session.sessionId, 'first-star')).rejects.toMatchObject({code: 'CONFLICT'})
    const library = await play.library(users.guest.accountId)
    expect(library.items[0]).toMatchObject({gameId: GAME, playCount: 1, achievementsUnlocked: 1})
    await expect(db.deleteFrom('greenfield_gubic_achievement_unlocks').execute()).rejects.toThrow(/append-only/)
    const removed = await play.removeLibraryItem(users.guest.accountId, GAME)
    expect(removed.removed).toBe(true)
    expect((await play.myAchievements(users.guest.accountId)).items).toHaveLength(1)
  })

  it('runs a lobby: create, join by code, ready, start, with live events and plan limits', async () => {
    const events: GubicLobbyEvent[] = []
    await expect(play.createLobby(users.host.accountId, GAME, {maxPlayers: 12})).rejects.toMatchObject({code: 'FORBIDDEN'})
    const lobby = await play.createLobby(users.host.accountId, GAME, {title: 'Friday', visibility: 'invite', maxPlayers: 2})
    expect(lobby.isHost).toBe(true)
    expect(lobby.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    hub.subscribe(lobby.lobbyId, {accountId: users.host.accountId, send: event => { events.push(event) }})
    expect((await play.listLobbies(GAME)).items).toHaveLength(0)
    await expect(play.getLobby(users.guest.accountId, lobby.lobbyId)).rejects.toMatchObject({code: 'NOT_FOUND'})
    const joined = await play.joinLobby(users.guest.accountId, {joinCode: lobby.joinCode})
    expect(joined.playerCount).toBe(2)
    await expect(play.joinLobby(users.third.accountId, {joinCode: lobby.joinCode})).rejects.toMatchObject({code: 'CONFLICT'})
    await expect(play.startLobby(users.host.accountId, lobby.lobbyId)).rejects.toMatchObject({code: 'CONFLICT'})
    await play.setReady(users.guest.accountId, lobby.lobbyId, true)
    await expect(play.startLobby(users.guest.accountId, lobby.lobbyId)).rejects.toMatchObject({code: 'FORBIDDEN'})
    const started = await play.startLobby(users.host.accountId, lobby.lobbyId)
    expect(started.status).toBe('in-game')
    expect(events.map(event => event.type)).toEqual(['lobby.updated', 'lobby.updated', 'lobby.started'])
    const left = await play.leaveLobby(users.host.accountId, lobby.lobbyId)
    expect(left.lobbyClosed).toBe(true)
  })

  it('validates submissions, gates paid games and needs a published registry release to approve', async () => {
    await expect(play.submit(users.guest.accountId, {publisherId: PUBLISHER, manifest: manifest()})).rejects.toMatchObject({code: 'FORBIDDEN'})
    await expect(play.submit(users.host.accountId, {publisherId: PUBLISHER, manifest: manifest({network: 'internet'})})).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    await expect(play.submit(users.host.accountId, {publisherId: PUBLISHER, manifest: manifest({monetisation: 'paid'})})).rejects.toMatchObject({code: 'FORBIDDEN'})
    const submission = await play.submit(users.host.accountId, {publisherId: PUBLISHER, manifest: manifest()})
    expect(submission.status).toBe('submitted')
    expect((await db.selectFrom('greenfield_game_catalogue_entries').select('publication_status').where('game_id', '=', GAME).executeTakeFirstOrThrow()).publication_status).toBe('in-review')
    await expect(play.submit(users.host.accountId, {publisherId: PUBLISHER, manifest: manifest({version: '1.0.1'})})).rejects.toMatchObject({code: 'CONFLICT'})
    await expect(play.reviewQueue(users.host.accountId)).rejects.toMatchObject({code: 'FORBIDDEN'})
    expect((await play.reviewQueue(users.admin.accountId)).items.map(item => item.submissionId)).toContain(submission.submissionId)
    await expect(play.decide(users.admin.accountId, submission.submissionId, {decision: 'reject'})).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    // No trusted registry release exists in this database, so approval must fail closed.
    await expect(play.decide(users.admin.accountId, submission.submissionId, {decision: 'approve'})).rejects.toMatchObject({code: 'FORBIDDEN'})
    const rejected = await play.decide(users.admin.accountId, submission.submissionId, {decision: 'reject', reason: 'Add a pause screen'})
    expect(rejected).toMatchObject({status: 'rejected', decisionReason: 'Add a pause screen'})
  })

  it('rejects lobby socket upgrades before the handshake unless authenticated and a member', async () => {
    const lobby = await play.createLobby(users.host.accountId, GAME, {title: 'Socket', visibility: 'invite', maxPlayers: 2})
    await app.listen({host: '127.0.0.1', port: 0})
    const {port} = app.server.address() as AddressInfo
    // Raw handshake so we observe exactly what the server answers on the wire.
    const upgrade = (lobbyId: string, token?: string) => new Promise<number>((resolve, reject) => {
      const socket = net.connect(port, '127.0.0.1', () => socket.write([
        `GET /v1/gubic/lobbies/${lobbyId}/socket HTTP/1.1`, `Host: 127.0.0.1:${port}`, 'Connection: Upgrade', 'Upgrade: websocket',
        'Sec-WebSocket-Version: 13', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', ...(token ? [`Authorization: Bearer ${token}`] : []), '', '',
      ].join('\r\n')))
      let data = ''
      socket.on('data', chunk => {
        data += chunk.toString('latin1')
        const match = /^HTTP\/1\.1 (\d{3})/.exec(data)
        if (match) { socket.destroy(); resolve(Number(match[1])) }
      })
      socket.on('error', reject)
      socket.on('close', () => reject(new Error(`closed without status: ${JSON.stringify(data)}`)))
    })
    expect(await upgrade('lobby-does-not-exist')).toBe(401)
    expect(await upgrade(lobby.lobbyId)).toBe(401)
    expect(await upgrade(lobby.lobbyId, 'not-a-real-token')).toBe(401)
    expect(await upgrade('lobby-does-not-exist', users.host.accessToken)).toBe(404)
    expect(await upgrade(lobby.lobbyId, users.third.accessToken)).toBe(404)
    expect(await upgrade(lobby.lobbyId, users.host.accessToken)).toBe(101)
    let hello!: Promise<any>
    const ws = await (app as any).injectWS(`/v1/gubic/lobbies/${lobby.lobbyId}/socket`, {headers: {authorization: `Bearer ${users.host.accessToken}`}}, {
      onInit: (socket: any) => { hello = new Promise(resolve => socket.once('message', (data: Buffer) => resolve(JSON.parse(data.toString())))) },
    })
    expect(await hello).toEqual({type: 'hello', lobbyId: lobby.lobbyId})
    ws.terminate()
    await play.leaveLobby(users.host.accountId, lobby.lobbyId)
  })

  async function createUser(handle: string) {
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.invalid`
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    const register = await app.inject({method: 'POST', url: '/v1/accounts/register', payload: {email, password, handle, displayName: handle, acceptedTerms: true, inviteCode: 'test-invite'}})
    expect(register.statusCode, register.body).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    return {accountId: register.json().data.accountId as string, accessToken: session.json().data.accessToken as string}
  }
})
