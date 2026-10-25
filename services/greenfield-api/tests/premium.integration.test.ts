import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {createTestChain, notificationPayload, renewalPayload, transactionPayload} from './helpers/storekit-test-chain.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Modula Premium: entitlements, App Store Sandbox and verification', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  const chain = createTestChain({label: 'Premium Integration'})
  const runSuffix = Date.now().toString(36)
  const adminHandle = `pqadm${runSuffix}`.slice(0, 20)

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4032'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4032'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    process.env.MODULA_MEDIA_ROOT = `/tmp/modula-premium-${process.pid}`
    process.env.MODULA_PREMIUM_ENTITLEMENTS_ENABLED = 'true'
    process.env.MODULA_APPLE_BUNDLE_ID = 'digital.modula.app.native'
    process.env.MODULA_APPLE_ONLINE_CHECKS = 'false'
    process.env.MODULA_APPLE_QA_ROOT_CERT_PATH = chain.rootPemPath
    process.env.MODULA_PREMIUM_QA_ADMIN_ENABLED = 'true'
    process.env.MODULA_ADMIN_HANDLES = adminHandle
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    await app.ready()
  })

  afterAll(async () => {
    for (const key of ['MODULA_PREMIUM_ENTITLEMENTS_ENABLED', 'MODULA_APPLE_BUNDLE_ID', 'MODULA_APPLE_ONLINE_CHECKS', 'MODULA_APPLE_QA_ROOT_CERT_PATH', 'MODULA_PREMIUM_QA_ADMIN_ENABLED', 'MODULA_ADMIN_HANDLES']) delete process.env[key]
    await app?.close()
    await db?.destroy()
  })

  let pool: Record<string, Awaited<ReturnType<typeof createVerifiedUser>>> | null = null
  async function users() {
    if (!pool) {
      pool = {
        alpha: await createVerifiedUser(`pqa${runSuffix}`.slice(0, 20), 'Premium Alpha'),
        beta: await createVerifiedUser(`pqb${runSuffix}`.slice(0, 20), 'Premium Beta'),
        admin: await createVerifiedUser(adminHandle, 'Premium Admin'),
      }
    }
    return pool
  }

  const originalTransactionId = `2000009${Math.floor(Math.random() * 1e9)}`

  it('requires authentication for /v1/me/entitlements and transactions', async () => {
    expect((await app.inject({method: 'GET', url: '/v1/me/entitlements'})).statusCode).toBe(401)
    expect((await app.inject({method: 'POST', url: '/v1/premium/apple/transactions', payload: {signedTransaction: 'x'}})).statusCode).toBe(401)
  })

  it('starts every account on Core with an appAccountToken and no badges', async () => {
    const {alpha} = await users()
    const me = await authed(alpha.accessToken, 'GET', '/v1/me/entitlements')
    expect(me.statusCode, me.body).toBe(200)
    const data = me.json().data
    expect(data).toMatchObject({tier: 'core', tierName: 'Modula Core', isPremium: false, status: 'none', memberSince: null, verification: null, subscriptions: []})
    expect(data.badges).toEqual({premiumTier: null, premiumSince: null, verifiedType: null, isVerified: false})
    expect(data.appAccountToken).toMatch(/^[0-9a-f-]{36}$/)
    const profile = await app.inject({method: 'GET', url: `/v1/profiles/${alpha.handle}`})
    expect(profile.json().data).toMatchObject({premiumTier: null, premiumSince: null, verifiedType: null, isVerified: false})
  })

  it('rejects transactions bound to another account token, tampered or for the wrong environment', async () => {
    const {alpha} = await users()
    const wrongToken = chain.signJws(transactionPayload({originalTransactionId, appAccountToken: randomUUID()}))
    expect((await authed(alpha.accessToken, 'POST', '/v1/premium/apple/transactions', {signedTransaction: wrongToken})).statusCode).toBe(403)
    const token = await appAccountToken(alpha.accessToken)
    const missingToken = chain.signJws(transactionPayload({originalTransactionId}))
    expect((await authed(alpha.accessToken, 'POST', '/v1/premium/apple/transactions', {signedTransaction: missingToken})).statusCode).toBe(403)
    const production = chain.signJws(transactionPayload({originalTransactionId, appAccountToken: token, environment: 'Production'}))
    const prodRes = await authed(alpha.accessToken, 'POST', '/v1/premium/apple/transactions', {signedTransaction: production})
    expect(prodRes.statusCode).toBe(400)
    expect(prodRes.json().error.message).toBe('INVALID_ENVIRONMENT')
    const [h, , s] = chain.signJws(transactionPayload({originalTransactionId, appAccountToken: token})).split('.')
    const forged = Buffer.from(JSON.stringify(transactionPayload({originalTransactionId, appAccountToken: token, productId: 'digital.modula.premium.studio.yearly'}))).toString('base64url')
    const tampered = await authed(alpha.accessToken, 'POST', '/v1/premium/apple/transactions', {signedTransaction: `${h}.${forged}.${s}`})
    expect(tampered.statusCode).toBe(400)
    expect(tampered.json().error.message).toBe('VERIFICATION_FAILURE')
    const unknownProduct = chain.signJws(transactionPayload({originalTransactionId, appAccountToken: token, productId: 'digital.modula.premium.gold.monthly'}))
    expect((await authed(alpha.accessToken, 'POST', '/v1/premium/apple/transactions', {signedTransaction: unknownProduct})).statusCode).toBe(400)
    const rows = await db.selectFrom('greenfield_premium_entitlements').select('entitlement_id').where('original_transaction_id', '=', originalTransactionId).execute()
    expect(rows).toHaveLength(0)
  })

  it('upserts Horizon from a verified Sandbox transaction and embeds badges in profile, post, comment and message authors', async () => {
    const {alpha, beta} = await users()
    const token = await appAccountToken(alpha.accessToken)
    const jws = chain.signJws(transactionPayload({originalTransactionId, appAccountToken: token}))
    const applied = await authed(alpha.accessToken, 'POST', '/v1/premium/apple/transactions', {signedTransaction: jws})
    expect(applied.statusCode, applied.body).toBe(200)
    expect(applied.json().data).toMatchObject({tier: 'horizon', tierName: 'Modula Horizon', isPremium: true, status: 'active', source: 'apple', environment: 'Sandbox', productId: 'digital.modula.premium.horizon.monthly', originalTransactionId})
    expect(applied.json().data.memberSince).toBeTruthy()
    // Idempotent replay of the same JWS.
    expect((await authed(alpha.accessToken, 'POST', '/v1/premium/apple/transactions', {jwsRepresentation: jws})).json().data.subscriptions).toHaveLength(1)

    const profile = (await app.inject({method: 'GET', url: `/v1/profiles/${alpha.handle}`})).json().data
    expect(profile.premiumTier).toBe('horizon')
    expect(profile.premiumSince).toBe(applied.json().data.memberSince)
    expect(profile.isVerified).toBe(false)

    const post = await authed(alpha.accessToken, 'POST', '/v1/posts', {text: `premium author ${runSuffix}`, audience: 'public', idempotencyKey: `premium-post-${runSuffix}`})
    expect(post.statusCode, post.body).toBe(201)
    const postId = post.json().data.id
    const feed = await app.inject({method: 'GET', url: `/v1/profiles/${alpha.handle}/posts`})
    const feedItem = feed.json().data.items.find((item: any) => item.id === postId)
    expect(feedItem.author.premiumTier).toBe('horizon')

    const comment = await authed(alpha.accessToken, 'POST', `/v1/posts/${postId}/comments`, {text: 'premium comment'})
    expect(comment.statusCode, comment.body).toBe(201)
    const comments = await authed(beta.accessToken, 'GET', `/v1/posts/${postId}/comments`)
    const listed = (comments.json().data.items ?? comments.json().data).find((item: any) => item.author?.handle === alpha.handle)
    expect(listed.author).toMatchObject({premiumTier: 'horizon', verifiedType: null, isVerified: false})

    const started = await authed(alpha.accessToken, 'POST', '/v1/conversations', {handle: beta.handle, text: 'Hi from Horizon'})
    expect(started.statusCode, started.body).toBe(201)
    const conversationId = started.json().data.conversation.id
    const messages = await authed(alpha.accessToken, 'GET', `/v1/conversations/${conversationId}/messages`)
    expect(messages.json().data.items[0].sender).toMatchObject({handle: alpha.handle, premiumTier: 'horizon', isVerified: false})
  })

  it('refuses to bind one App Store subscription to two Modula accounts', async () => {
    const {beta} = await users()
    const token = await appAccountToken(beta.accessToken)
    const res = await authed(beta.accessToken, 'POST', '/v1/premium/apple/transactions', {signedTransaction: chain.signJws(transactionPayload({originalTransactionId, appAccountToken: token}))})
    expect(res.statusCode).toBe(409)
  })

  it('walks grace -> billing retry -> renew -> refund via Notifications V2, keeping data and tenure', async () => {
    const {alpha} = await users()
    const token = await appAccountToken(alpha.accessToken)
    const tx = (overrides: Record<string, unknown> = {}) => transactionPayload({originalTransactionId, appAccountToken: token, ...overrides})
    const before = await counts(alpha.actorId)
    const memberSince = (await authed(alpha.accessToken, 'GET', '/v1/me/entitlements')).json().data.memberSince
    const send = (signedPayload: string) => app.inject({method: 'POST', url: '/v1/premium/apple/notifications', payload: {signedPayload}})

    const grace = notificationPayload(chain, {notificationType: 'DID_FAIL_TO_RENEW', subtype: 'GRACE_PERIOD', transaction: tx(), renewal: renewalPayload({originalTransactionId, gracePeriodExpiresDate: Date.now() + 6 * 86_400_000})})
    const graceRes = await send(grace)
    expect(graceRes.statusCode, graceRes.body).toBe(200)
    expect(graceRes.json().data).toMatchObject({accepted: true, replay: false, status: 'grace'})
    expect((await send(grace)).json().data).toMatchObject({accepted: true, replay: true})
    expect(await tier(alpha.handle)).toBe('horizon')

    expect((await send(notificationPayload(chain, {notificationType: 'GRACE_PERIOD_EXPIRED', transaction: tx()}))).json().data.status).toBe('billing_retry')
    expect(await tier(alpha.handle)).toBeNull()
    expect((await authed(alpha.accessToken, 'GET', '/v1/me/entitlements')).json().data).toMatchObject({tier: 'core', status: 'billing_retry', memberSince})

    expect((await send(notificationPayload(chain, {notificationType: 'DID_RENEW', transaction: tx({transactionId: `${originalTransactionId}2`, productId: 'digital.modula.premium.horizon_plus.monthly'})}))).json().data.status).toBe('active')
    expect(await tier(alpha.handle)).toBe('horizon_plus')

    expect((await send(notificationPayload(chain, {notificationType: 'REFUND', transaction: tx({revocationDate: Date.now(), revocationReason: 0})}))).json().data.status).toBe('revoked')
    expect(await tier(alpha.handle)).toBeNull()
    const after = (await authed(alpha.accessToken, 'GET', '/v1/me/entitlements')).json().data
    expect(after).toMatchObject({tier: 'core', isPremium: false, status: 'revoked', memberSince})
    expect(after.subscriptions).toHaveLength(1)
    expect(await counts(alpha.actorId)).toEqual(before)
  })

  it('applies EXPIRED and ignores out-of-order (older) notifications', async () => {
    const {beta} = await users()
    const token = await appAccountToken(beta.accessToken)
    const betaOriginal = `2000008${Math.floor(Math.random() * 1e9)}`
    const tx = (overrides: Record<string, unknown> = {}) => transactionPayload({originalTransactionId: betaOriginal, appAccountToken: token, productId: 'digital.modula.premium.plus.yearly', ...overrides})
    const send = (signedPayload: string) => app.inject({method: 'POST', url: '/v1/premium/apple/notifications', payload: {signedPayload}})
    // The newer EXPIRED is signed later than the replayed DID_RENEW below, so the renewal is stale.
    // First contact arrives by webhook only (no client post), matched through appAccountToken.
    expect((await send(notificationPayload(chain, {notificationType: 'SUBSCRIBED', subtype: 'INITIAL_BUY', transaction: tx()}))).json().data.status).toBe('active')
    expect(await tier(beta.handle)).toBe('plus')
    expect((await send(notificationPayload(chain, {notificationType: 'EXPIRED', subtype: 'VOLUNTARY', transaction: tx({expiresDate: Date.now() - 1000}), signedDate: Date.now() + 20 * 60_000}))).json().data.status).toBe('expired')
    const stale = await send(notificationPayload(chain, {notificationType: 'DID_RENEW', transaction: tx(), signedDate: Date.now()}))
    expect(stale.statusCode, stale.body).toBe(200)
    expect(stale.json().data).toMatchObject({accepted: true, applied: false, status: 'expired'})
    expect(await tier(beta.handle)).toBeNull()
  })

  it('rejects tampered and wrong-environment notifications, and acknowledges unknown subscribers', async () => {
    const send = (signedPayload: string) => app.inject({method: 'POST', url: '/v1/premium/apple/notifications', payload: {signedPayload}})
    const valid = notificationPayload(chain, {notificationType: 'DID_RENEW', transaction: transactionPayload({appAccountToken: randomUUID()})})
    const [h, b, s] = valid.split('.')
    const forgedBody = Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(b, 'base64url').toString()), notificationType: 'REFUND'})).toString('base64url')
    expect((await send(`${h}.${forgedBody}.${s}`)).statusCode).toBe(400)
    expect((await send(notificationPayload(chain, {notificationType: 'DID_RENEW', transaction: transactionPayload(), environment: 'Production'}))).statusCode).toBe(400)
    expect((await app.inject({method: 'POST', url: '/v1/premium/apple/notifications', payload: {}})).statusCode).toBe(400)
    const unknown = await send(valid)
    expect(unknown.statusCode).toBe(200)
    expect(unknown.json().data).toMatchObject({accepted: true, applied: false})
  })

  it('keeps verification admin-only, separate from billing and visible in payloads', async () => {
    const {alpha, beta, admin} = await users()
    expect((await authed(beta.accessToken, 'PUT', `/v1/admin/verifications/${alpha.handle}`, {verifiedType: 'person'})).statusCode).toBe(403)
    expect((await authed(admin.accessToken, 'PUT', `/v1/admin/verifications/${alpha.handle}`, {verifiedType: 'gold'})).statusCode).toBe(400)
    const set = await authed(admin.accessToken, 'PUT', `/v1/admin/verifications/${alpha.handle}`, {verifiedType: 'person', reason: 'QA'})
    expect(set.statusCode, set.body).toBe(200)
    expect(set.json().data.badges).toMatchObject({verifiedType: 'person', isVerified: true, premiumTier: null})
    const profile = (await app.inject({method: 'GET', url: `/v1/profiles/${alpha.handle}`})).json().data
    expect(profile).toMatchObject({verifiedType: 'person', isVerified: true})
    // Billing activity does not touch verification.
    const token = await appAccountToken(alpha.accessToken)
    const second = `2000007${Math.floor(Math.random() * 1e9)}`
    await authed(alpha.accessToken, 'POST', '/v1/premium/apple/transactions', {signedTransaction: chain.signJws(transactionPayload({originalTransactionId: second, appAccountToken: token, productId: 'digital.modula.premium.studio.monthly'}))})
    await app.inject({method: 'POST', url: '/v1/premium/apple/notifications', payload: {signedPayload: notificationPayload(chain, {notificationType: 'REVOKE', transaction: transactionPayload({originalTransactionId: second, appAccountToken: token, productId: 'digital.modula.premium.studio.monthly', revocationDate: Date.now()})})}})
    const verification = await db.selectFrom('greenfield_verifications').selectAll().where('actor_id', '=', alpha.actorId).executeTakeFirstOrThrow()
    expect(verification).toMatchObject({verified_type: 'person', state: 'verified'})
    const revoke = await authed(admin.accessToken, 'PUT', `/v1/admin/verifications/${alpha.handle}`, {verifiedType: null})
    expect(revoke.json().data.badges).toMatchObject({verifiedType: null, isVerified: false})
  })

  async function tier(handle: string) {
    return (await app.inject({method: 'GET', url: `/v1/profiles/${handle}`})).json().data.premiumTier
  }

  async function appAccountToken(accessToken: string) {
    return (await authed(accessToken, 'GET', '/v1/me/entitlements')).json().data.appAccountToken as string
  }

  async function counts(actorId: string) {
    const [posts, comments, members, messages, entitlements] = await Promise.all([
      db.selectFrom('posts').select(db.fn.countAll<number>().as('n')).where('author_actor_id', '=', actorId).executeTakeFirstOrThrow(),
      db.selectFrom('greenfield_comments').select(db.fn.countAll<number>().as('n')).where('author_actor_id', '=', actorId).executeTakeFirstOrThrow(),
      db.selectFrom('greenfield_premium_members').select(db.fn.countAll<number>().as('n')).where('actor_id', '=', actorId).executeTakeFirstOrThrow(),
      db.selectFrom('greenfield_conversation_messages').select(db.fn.countAll<number>().as('n')).where('sender_actor_id', '=', actorId).executeTakeFirstOrThrow(),
      db.selectFrom('greenfield_premium_entitlements').select(db.fn.countAll<number>().as('n')).where('actor_id', '=', actorId).executeTakeFirstOrThrow(),
    ])
    return {posts: Number(posts.n), comments: Number(comments.n), members: Number(members.n), messages: Number(messages.n), entitlements: Number(entitlements.n)}
  }

  async function authed(accessToken: string, method: string, url: string, payload?: unknown) {
    return app.inject({method: method as any, url, headers: {authorization: `Bearer ${accessToken}`}, ...(payload === undefined ? {} : {payload})})
  }

  async function createVerifiedUser(handle: string, displayName: string) {
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.com`
    const register = await app.inject({method: 'POST', url: '/v1/accounts/register', payload: {email, password, handle, displayName, acceptedTerms: true, inviteCode: 'test-invite'}})
    expect(register.statusCode, register.body).toBe(201)
    const verified = await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    expect(verified.statusCode).toBe(200)
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect([200, 201]).toContain(session.statusCode)
    const accessToken = session.json().data.accessToken
    const me = await app.inject({method: 'GET', url: '/v1/accounts/me', headers: {authorization: `Bearer ${accessToken}`}})
    expect(me.statusCode).toBe(200)
    const accountId = me.json().data.accountId
    const profile = await db.selectFrom('actors').innerJoin('profiles', 'profiles.actor_id', 'actors.id').select(['profiles.id as profile_id', 'actors.id as actor_id']).where('actors.account_id', '=', accountId).executeTakeFirstOrThrow()
    return {accountId, actorId: profile.actor_id, profileId: profile.profile_id, handle, accessToken}
  }
})
