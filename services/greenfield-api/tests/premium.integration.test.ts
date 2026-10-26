import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import pg from 'pg'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {SearchRepository} from '../src/domains/search/repository.js'

const baseDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const adminDatabaseUrl = process.env.MODULA_TEST_ADMIN_DATABASE_URL
const describeIfDb = baseDatabaseUrl && adminDatabaseUrl ? describe : describe.skip

describeIfDb('Premium, Verification and public identity integration', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  const suffix = Date.now().toString(36)
  const adminHandle = `pvadmin${suffix}`.slice(0, 20)
  const databaseName = `modula_premium_${process.pid}_${Date.now()}`
  let databaseUrl = ''

  beforeAll(async () => {
    const admin = new pg.Client({connectionString: adminDatabaseUrl!})
    await admin.connect()
    await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)} OWNER modula_migrator`)
    await admin.end()
    const parsedDatabaseUrl = new URL(baseDatabaseUrl!)
    parsedDatabaseUrl.pathname = `/${databaseName}`
    databaseUrl = parsedDatabaseUrl.toString()
    Object.assign(process.env, {
      NODE_ENV: 'test', MODULA_ENVIRONMENT: 'development', MODULA_API_HOST: '127.0.0.1', MODULA_API_PORT: '4032',
      MODULA_PUBLIC_API_URL: 'http://127.0.0.1:4032', MODULA_DATABASE_URL: databaseUrl, MODULA_DATABASE_MIGRATOR_URL: databaseUrl,
      MODULA_ALLOWED_ORIGINS: 'https://modula.digital,http://localhost:8081', MODULA_PREVIEW_WRITES_ENABLED: 'true',
      MODULA_INVITE_ONLY: 'true', MODULA_REGISTRATION_INVITE_CODES: 'test-invite', MODULA_ATPROTO_ENABLED: 'false',
      MODULA_RATE_LIMIT_ENABLED: 'false', MODULA_MEDIA_ROOT: `/tmp/modula-premium-${process.pid}`,
      MODULA_PREMIUM_ENTITLEMENTS_ENABLED: 'true', MODULA_PREMIUM_QA_ASSIGNMENTS_ENABLED: 'true',
      MODULA_VERIFICATION_ENABLED: 'true', MODULA_VERIFICATION_QA_REVIEW_ENABLED: 'true', MODULA_ADMIN_HANDLES: adminHandle,
    })
    await migrateUp(databaseUrl)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    await app.ready()
  })

  afterAll(async () => {
    for (const key of ['MODULA_PREMIUM_ENTITLEMENTS_ENABLED', 'MODULA_PREMIUM_QA_ASSIGNMENTS_ENABLED', 'MODULA_VERIFICATION_ENABLED', 'MODULA_VERIFICATION_QA_REVIEW_ENABLED', 'MODULA_ADMIN_HANDLES']) delete process.env[key]
    await app?.close()
    await db?.destroy()
    const admin = new pg.Client({connectionString: adminDatabaseUrl!})
    await admin.connect()
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [databaseName])
    await admin.query(`DROP DATABASE ${quoteIdentifier(databaseName)}`)
    await admin.end()
  })

  let pool: Record<string, Awaited<ReturnType<typeof createUser>>> | null = null
  async function users() {
    if (!pool) {
      pool = {}
      for (const name of ['core', 'plus', 'horizon', 'horizonplus', 'studio', 'expired', 'revoked', 'downgraded', 'org', 'publicbody']) {
        pool[name] = await createUser(`pv${name}${suffix}`.slice(0, 20), `PV ${name}`)
      }
      pool.admin = await createUser(adminHandle, 'PV Admin')
    }
    return pool
  }

  it('fails closed without authentication and exposes no purchase operation', async () => {
    for (const url of ['/v1/premium/tiers', '/v1/me/membership', '/v1/me/entitlements', '/v1/me/verification']) {
      expect((await app.inject({method: 'GET', url})).statusCode).toBe(401)
    }
    expect((await app.inject({method: 'POST', url: '/v1/premium/apple/transactions', payload: {tier: 'studio'}})).statusCode).toBe(404)
  })

  it('defaults every account to Core and keeps existing-free capabilities available', async () => {
    const {core} = await users()
    const catalogue = await authed(core, 'GET', '/v1/premium/tiers')
    expect(catalogue.statusCode, catalogue.body).toBe(200)
    expect(catalogue.json().data).toMatchObject({catalogueVersion: 1, pricingStatus: 'provisional', purchase: {enabled: false}})
    expect(catalogue.json().data.tiers.map((tier: any) => tier.id)).toEqual(['core', 'plus', 'horizon', 'horizon_plus', 'studio'])
    expect(catalogue.json().data.tiers.every((tier: any) => tier.price === null)).toBe(true)
    const membership = (await authed(core, 'GET', '/v1/me/membership')).json().data
    expect(membership).toMatchObject({tier: 'core', subscriptionStatus: 'core', revision: 0, purchase: {enabled: false}})
    const entitlements = (await authed(core, 'GET', '/v1/me/entitlements')).json().data
    expect(entitlements.capabilities.find((item: any) => item.id === 'installed_module_allowance')).toMatchObject({available: true, reason: 'existing_free_feature'})
    expect(entitlements.capabilities.find((item: any) => item.id === 'cloud_ai')).toMatchObject({available: false, reason: 'future_feature_disabled'})
  })

  it('restricts QA assignment to operators and evaluates all tier/state fixtures per account', async () => {
    const u = await users()
    expect((await assign(u.core, u.plus.handle, {tier: 'plus'})).statusCode).toBe(403)
    await expectAssignment(u.admin, u.plus, {tier: 'plus'}, 'plus', 'active')
    await expectAssignment(u.admin, u.horizon, {tier: 'horizon'}, 'horizon', 'active')
    await expectAssignment(u.admin, u.horizonplus, {tier: 'horizon_plus'}, 'horizon_plus', 'active')
    await expectAssignment(u.admin, u.studio, {tier: 'studio'}, 'studio', 'active')
    await expectAssignment(u.admin, u.expired, {tier: 'horizon', subscriptionStatus: 'active', effectiveAt: '2026-01-01T00:00:00Z', expiresAt: '2026-01-02T00:00:00Z'}, 'core', 'expired')
    await expectAssignment(u.admin, u.revoked, {tier: 'studio', subscriptionStatus: 'revoked'}, 'core', 'revoked')
    await expectAssignment(u.admin, u.downgraded, {tier: 'core', subscriptionStatus: 'downgraded'}, 'core', 'downgraded')
    expect((await authed(u.core, 'GET', '/v1/me/membership')).json().data.tier).toBe('core')
    expect((await authed(u.studio, 'GET', '/v1/me/entitlements')).json().data.capabilities.find((item: any) => item.id === 'team_membership')).toMatchObject({available: true})
    expect((await authed(u.plus, 'GET', '/v1/me/entitlements/profile_analytics')).json().data).toMatchObject({available: true, tier: 'plus'})
  })

  it('persists badge visibility without changing membership and prevents cross-account writes', async () => {
    const {horizon, plus} = await users()
    const hidden = await authed(horizon, 'PATCH', '/v1/me/membership/badge-visibility', {visible: false})
    expect(hidden.statusCode, hidden.body).toBe(200)
    expect(hidden.json().data).toMatchObject({tier: 'horizon', badgeVisible: false})
    const profile = (await app.inject({method: 'GET', url: `/v1/profiles/${horizon.handle}`})).json().data
    expect(profile).toMatchObject({premiumTier: 'horizon', premiumBadgeVisible: false})
    expect(profile.publicIdentity.membership).toMatchObject({tier: 'horizon', badgeVisible: false, mark: null})
    expect((await authed(plus, 'GET', '/v1/me/membership')).json().data.badgeVisible).toBe(true)
  })

  it('uses an authorized verification state machine and never derives trust from Premium or a claim', async () => {
    const {horizon, plus, admin} = await users()
    const applied = await authed(horizon, 'POST', '/v1/me/verification/applications', {type: 'person', statement: 'Synthetic QA application'})
    expect(applied.statusCode, applied.body).toBe(201)
    const applicationId = applied.json().data.applications[0].applicationId
    expect(applied.json().data.status).toBe('pending')
    expect((await review(horizon, applicationId, {action: 'approve'})).statusCode).toBe(403)
    expect((await authed(plus, 'POST', `/v1/me/verification/applications/${applicationId}/appeals`, {statement: 'not mine'})).statusCode).toBe(404)
    expect((await review(admin, applicationId, {action: 'approve'})).statusCode).toBe(409)
    expect((await review(admin, applicationId, {action: 'start_review'})).json().data.status).toBe('under_review')
    expect((await review(admin, applicationId, {action: 'approve', reverificationDueAt: '2030-01-01T00:00:00Z'})).json().data.status).toBe('verified')
    const profile = (await app.inject({method: 'GET', url: `/v1/profiles/${horizon.handle}`})).json().data
    expect(profile).toMatchObject({isVerified: true, verifiedType: 'person', premiumTier: 'horizon'})
    expect(profile.publicIdentity.verification).toEqual({status: 'verified', type: 'person', mark: 'blue_identity_seal'})

    await db.updateTable('profiles').set({identity_claims: JSON.stringify([{type: 'claimed-web-identity', verified: false}])}).where('actor_id', '=', plus.actorId).execute()
    const unverifiedProfile = (await app.inject({method: 'GET', url: `/v1/profiles/${plus.handle}`})).json().data
    expect(unverifiedProfile).toMatchObject({isVerified: false, verificationStatus: 'unverified', premiumTier: 'plus'})
    const spoof = await authed(plus, 'PATCH', '/v1/profiles/me', {expectedVersion: unverifiedProfile.version, isVerified: true, verifiedType: 'public_body', premiumTier: 'studio'})
    expect(spoof.statusCode, spoof.body).toBe(200)
    expect(spoof.json().data).toMatchObject({isVerified: false, verificationStatus: 'unverified', premiumTier: 'plus'})
    const discover = (await authed(plus, 'GET', '/v1/discover')).json().data.suggestedProfiles.find((item: any) => item.handle === plus.handle)
    expect(discover.identityClaims).toEqual([])
    expect(discover.isVerified).toBe(false)
  })

  it('supports denial, appeal, pause and revocation with immutable audit history', async () => {
    const {org, admin} = await users()
    const created = await authed(org, 'POST', '/v1/me/verification/applications', {type: 'organization'})
    const applicationId = created.json().data.applications[0].applicationId
    await review(admin, applicationId, {action: 'start_review'})
    expect((await review(admin, applicationId, {action: 'deny', reason: 'Synthetic mismatch'})).json().data.status).toBe('denied')
    const appeal = await authed(org, 'POST', `/v1/me/verification/applications/${applicationId}/appeals`, {statement: 'Synthetic appeal'})
    expect(appeal.statusCode, appeal.body).toBe(201)
    const appealId = appeal.json().data.appeals[0].appeal_id
    expect((await reviewAppeal(admin, appealId, {action: 'accept', reason: 'Synthetic re-review'})).json().data.status).toBe('under_review')
    await review(admin, applicationId, {action: 'approve'})
    expect((await app.inject({method: 'GET', url: `/v1/profiles/${org.handle}`})).json().data.publicIdentity.verification.mark).toBe('ink_squircle')
    expect((await review(admin, applicationId, {action: 'pause', reason: 'Reverification required'})).json().data.status).toBe('paused')
    expect((await app.inject({method: 'GET', url: `/v1/profiles/${org.handle}`})).json().data.isVerified).toBe(false)
    await review(admin, applicationId, {action: 'resume'})
    expect((await review(admin, applicationId, {action: 'revoke', reason: 'Synthetic revocation'})).json().data.status).toBe('revoked')
    expect((await app.inject({method: 'GET', url: `/v1/profiles/${org.handle}`})).json().data.isVerified).toBe(false)
    const events = await db.selectFrom('greenfield_verification_events').selectAll().where('account_id', '=', org.accountId).orderBy('occurred_at').execute()
    expect(events.map(row => row.event_type)).toEqual(expect.arrayContaining(['application_created', 'review_start_review', 'review_deny', 'appeal_created', 'appeal_accept', 'review_approve', 'review_pause', 'review_resume', 'review_revoke']))
  })

  it('projects person, organization and public-body marks consistently into comments and chat', async () => {
    const {horizon, publicbody, admin} = await users()
    const publicApplication = await authed(publicbody, 'POST', '/v1/me/verification/applications', {type: 'public_body'})
    const publicId = publicApplication.json().data.applications[0].applicationId
    await review(admin, publicId, {action: 'start_review'})
    await review(admin, publicId, {action: 'approve'})
    const publicProfile = (await app.inject({method: 'GET', url: `/v1/profiles/${publicbody.handle}`})).json().data
    expect(publicProfile.publicIdentity.verification.mark).toBe('slate_hexagon')

    const now = new Date().toISOString()
    await new SearchRepository(db).upsertDocument({
      documentId: `profile:${publicbody.actorId}`, schemaVersion: '1.0.0', entityType: 'profile', entityId: publicbody.actorId,
      sourceVersion: 1, accountId: publicbody.accountId, ownerId: publicbody.actorId, title: `Public Body ${suffix}`,
      body: `@${publicbody.handle}`, summary: 'Synthetic public body', keywords: [publicbody.handle], tags: [],
      visibility: 'public', status: 'active', language: 'en', metadata: {handle: publicbody.handle, kind: 'organisation'},
      createdAt: now, updatedAt: now, indexedAt: now,
    })
    const search = (await authed(horizon, 'GET', `/v1/search?query=${encodeURIComponent(`Public Body ${suffix}`)}&entityTypes=profile`)).json().data.results
    expect(search[0].metadata.publicIdentity.verification.mark).toBe('slate_hexagon')

    const post = await authed(horizon, 'POST', '/v1/posts', {text: `identity projection ${suffix}`, audience: 'public', idempotencyKey: `pv-post-${suffix}`})
    expect(post.statusCode, post.body).toBe(201)
    expect(post.json().data.author).toMatchObject({isVerified: true, premiumTier: 'horizon'})
    const postId = post.json().data.id
    await authed(horizon, 'POST', `/v1/posts/${postId}/comments`, {text: 'authoritative identity'})
    const comments = (await authed(publicbody, 'GET', `/v1/posts/${postId}/comments`)).json().data.items
    expect(comments[0].author).toMatchObject({isVerified: true, premiumTier: 'horizon'})
    const started = await authed(horizon, 'POST', '/v1/conversations', {handle: publicbody.handle, text: 'First verified message'})
    expect(started.statusCode, started.body).toBe(201)
    const thread = (await authed(horizon, 'GET', `/v1/conversations/${started.json().data.conversation.id}/messages`)).json().data
    expect(thread.items[0].sender).toMatchObject({isVerified: true, premiumTier: 'horizon'})
    expect(started.json().data.conversation.participants.find((item: any) => item.handle === publicbody.handle).publicIdentity.verification.mark).toBe('slate_hexagon')
  })

  async function expectAssignment(admin: any, subject: any, payload: Record<string, unknown>, tier: string, status: string) {
    const response = await assign(admin, subject.handle, payload)
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json().data).toMatchObject({tier, subscriptionStatus: status})
  }

  async function assign(actor: any, handle: string, payload: Record<string, unknown>) {
    return authed(actor, 'PUT', `/v1/admin/qa/premium/${handle}`, payload, {'idempotency-key': `fixture-${handle}-${JSON.stringify(payload)}`})
  }
  async function review(actor: any, id: string, payload: Record<string, unknown>) { return authed(actor, 'POST', `/v1/admin/qa/verification/applications/${id}/transitions`, payload) }
  async function reviewAppeal(actor: any, id: string, payload: Record<string, unknown>) { return authed(actor, 'POST', `/v1/admin/qa/verification/appeals/${id}/transitions`, payload) }

  async function authed(actor: {accessToken: string}, method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) {
    return app.inject({method: method as any, url, headers: {authorization: `Bearer ${actor.accessToken}`, ...headers}, ...(payload === undefined ? {} : {payload})})
  }

  async function createUser(handle: string, displayName: string) {
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.invalid`
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    const register = await app.inject({method: 'POST', url: '/v1/accounts/register', payload: {email, password, handle, displayName, acceptedTerms: true, inviteCode: 'test-invite'}})
    expect(register.statusCode, register.body).toBe(201)
    const verified = await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    expect(verified.statusCode, verified.body).toBe(200)
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect([200, 201]).toContain(session.statusCode)
    const accessToken = session.json().data.accessToken
    const me = await app.inject({method: 'GET', url: '/v1/accounts/me', headers: {authorization: `Bearer ${accessToken}`}})
    const accountId = me.json().data.accountId
    const actor = await db.selectFrom('actors').innerJoin('profiles', 'profiles.actor_id', 'actors.id').select(['actors.id as actor_id']).where('actors.account_id', '=', accountId).executeTakeFirstOrThrow()
    return {accountId, actorId: actor.actor_id, handle, accessToken}
  }
})

function quoteIdentifier(value: string) { return `"${value.replaceAll('"', '""')}"` }
