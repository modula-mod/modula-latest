import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {AccountService} from '../src/accounts/service.js'
import {MailService} from '../src/mail/service.js'
import {ProfileWriteService} from '../src/domains/profiles/writes.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Phase 7L profile update persistence', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let accounts: AccountService
  let profileWrites: ProfileWriteService

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    const config = loadConfig()
    const created = await createServer(config)
    app = created.app
    db = created.db
    accounts = new AccountService(db, config, new MailService(db, config))
    profileWrites = new ProfileWriteService(db)
    await app.ready()
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('persists profile editor fields through the authenticated route and keeps handles in sync', async () => {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 10)
    const handle = `p7lprofile${suffix}`.slice(0, 20)
    const nextHandle = `${handle}x`
    const owner = await createVerifiedUser(handle, `phase7l-profile-${suffix}@example.com`, 'Phase 7L Profile User')

    const patch = await authed(owner.accessToken, 'PATCH', '/v1/profiles/me', {
      handle: nextHandle,
      displayName: `Phase 7L Profile ${suffix}`,
      bio: `Persistent profile proof ${suffix}`,
      pronouns: 'they/them',
      location: {label: 'London', visibility: 'public'},
      website: {
        label: 'Website',
        url: `https://example.com/${suffix}`,
        domain: 'example.com',
        visibility: 'public',
      },
      focusStatus: {id: 'busy', label: 'Busy', message: 'Limited responses'},
    })
    expect(patch.statusCode, patch.body).toBe(200)
    const updated = patch.json().data

    expect(updated.handle).toBe(nextHandle)
    expect(updated.displayName).toBe(`Phase 7L Profile ${suffix}`)
    expect(updated.bio).toBe(`Persistent profile proof ${suffix}`)
    expect(updated.pronouns).toBe('they/them')
    expect(updated.location).toEqual({label: 'London', visibility: 'public'})
    expect(updated.website?.domain).toBe('example.com')
    expect(updated.focusStatus.label).toBe('Busy')

    const account = await db
      .selectFrom('greenfield_accounts')
      .select('primary_handle')
      .where('account_id', '=', owner.accountId)
      .executeTakeFirstOrThrow()
    expect(account.primary_handle).toBe(nextHandle)

    const currentAccount = await authed(owner.accessToken, 'GET', '/v1/accounts/me')
    expect(currentAccount.statusCode).toBe(200)
    expect(currentAccount.json().data.primaryHandle).toBe(nextHandle)

    const publicProfile = await authed(owner.accessToken, 'GET', `/v1/profiles/${nextHandle}`)
    expect(publicProfile.statusCode).toBe(200)
    expect(publicProfile.json().data).toMatchObject({
      handle: nextHandle,
      displayName: `Phase 7L Profile ${suffix}`,
    })
    const staleProfile = await authed(owner.accessToken, 'GET', `/v1/profiles/${handle}`)
    expect(staleProfile.statusCode).toBe(404)
  })

  it('persists profile editor fields through the service contract', async () => {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 10)
    const handle = `p7lprofsvc${suffix}`.slice(0, 20)
    const nextHandle = `${handle}x`
    const owner = await createVerifiedUser(handle, `phase7l-profile-service-${suffix}@example.com`, 'Phase 7L Profile Service')

    await accounts.changeHandle(owner.accountId, nextHandle)
    const updated = await profileWrites.updateMe(owner.actorId, {
      displayName: `Phase 7L Profile Service ${suffix}`,
      bio: `Persistent profile service proof ${suffix}`,
      pronouns: 'they/them',
      location: {label: 'London', visibility: 'public'},
      website: {
        label: 'Website',
        url: `https://example.com/${suffix}`,
        domain: 'example.com',
        visibility: 'public',
      },
      focusStatus: {id: 'busy', label: 'Busy', message: 'Limited responses'},
    })

    expect(updated).toMatchObject({
      handle: nextHandle,
      displayName: `Phase 7L Profile Service ${suffix}`,
      bio: `Persistent profile service proof ${suffix}`,
      pronouns: 'they/them',
      location: {label: 'London', visibility: 'public'},
    })
    expect(updated.website?.domain).toBe('example.com')
    expect(updated.focusStatus.label).toBe('Busy')
  })

  it('rejects local or internal profile media URLs', async () => {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 10)
    const handle = `p7lprofmedia${suffix}`.slice(0, 20)
    const owner = await createVerifiedUser(handle, `phase7l-profile-media-${suffix}@example.com`, 'Phase 7L Profile Media')

    for (const avatarUri of ['file:///tmp/avatar.png', 'http://localhost/avatar.png', 'https://127.0.0.1/avatar.png']) {
      const patch = await authed(owner.accessToken, 'PATCH', '/v1/profiles/me', {avatarUri})
      expect(patch.statusCode, patch.body).toBe(400)
      expect(patch.json().error.code).toBe('VALIDATION_FAILED')
    }
  })

  async function createVerifiedUser(handle: string, email: string, displayName: string) {
    const password = `Phase7L-${handle}-password`
    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, displayName, acceptedTerms: true},
    })
    expect(register.statusCode).toBe(201)
    const verificationToken = register.json().data.verificationToken
    expect(verificationToken).toBeTruthy()
    const verified = await app.inject({
      method: 'POST',
      url: '/v1/accounts/verify-email',
      payload: {token: verificationToken},
    })
    expect(verified.statusCode).toBe(200)
    const session = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {email, password},
    })
    expect([200, 201]).toContain(session.statusCode)
    const accessToken = session.json().data.accessToken
    const me = await app.inject({
      method: 'GET',
      url: '/v1/accounts/me',
      headers: {authorization: `Bearer ${accessToken}`},
    })
    expect(me.statusCode).toBe(200)
    const profile = await db
      .selectFrom('actors')
      .innerJoin('profiles', 'profiles.actor_id', 'actors.id')
      .select(['actors.id as actor_id', 'profiles.id as profile_id'])
      .where('actors.account_id', '=', me.json().data.accountId)
      .executeTakeFirstOrThrow()
    return {
      accountId: me.json().data.accountId as string,
      actorId: profile.actor_id,
      profileId: profile.profile_id,
      accessToken: accessToken as string,
    }
  }

  async function authed(accessToken: string, method: string, url: string, payload?: unknown) {
    return app.inject({
      method: method as any,
      url,
      headers: {authorization: `Bearer ${accessToken}`},
      ...(payload === undefined ? {} : {payload}),
    })
  }
})

function configureTestEnv() {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4026'
  process.env.MODULA_PUBLIC_API_URL = process.env.MODULA_PUBLIC_API_URL ?? 'http://127.0.0.1:4022'
  process.env.MODULA_ALLOWED_ORIGINS =
    process.env.MODULA_ALLOWED_ORIGINS ?? 'http://127.0.0.1:4174,http://localhost:4174'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
  process.env.MODULA_REGISTRATION_MODE = 'open'
  delete process.env.MODULA_REGISTRATION_INVITE_CODES
  process.env.MODULA_INVITE_ONLY = 'false'
  process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
}
