import {generateKeyPairSync, randomUUID, sign} from 'node:crypto'
import pg from 'pg'
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {uuidv7} from '../src/lib/uuidv7.js'
import {
  dropAuthorizedPublicationRoles,
  provisionAuthorizedPublicationRoles,
  registerAuthorizedSigningIdentity,
  type AuthorizedPublicationRoleFixture,
} from './helpers/authorized-publication-fixture.js'
import {authorizeFirstPartyPublisherFixture} from './helpers/first-party-publisher.js'
import {
  buildCertificateStatement,
  certificateStatementHash,
  cleanCompanionName,
  deriveDna,
  generateDnaSeed,
  verifyCertificateSignature,
} from '../src/domains/moliboo-genesis/dna.js'
import {MolibooGenesisService} from '../src/domains/moliboo-genesis/service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

function configEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    MODULA_ENVIRONMENT: 'development',
    MODULA_API_HOST: '127.0.0.1',
    MODULA_API_PORT: '4023',
    MODULA_PUBLIC_API_URL: 'http://127.0.0.1:4023',
    MODULA_PUBLIC_WEB_URL: 'https://modula.digital',
    MODULA_DATABASE_URL: databaseUrl!,
    MODULA_DATABASE_MIGRATOR_URL: databaseUrl!,
    MODULA_ALLOWED_ORIGINS: 'http://localhost:8081',
    MODULA_PREVIEW_WRITES_ENABLED: 'true',
    MODULA_ATPROTO_ENABLED: 'false',
    MODULA_RATE_LIMIT_ENABLED: 'false',
    ...overrides,
  }
}

describe('Moliboo Genesis pure logic', () => {
  it('derives deterministic DNA from a seed', () => {
    const seed = generateDnaSeed()
    expect(seed).toMatch(/^[0-9a-f]{64}$/)
    const first = deriveDna(seed)
    const second = deriveDna(seed)
    expect(second).toEqual(first)
    expect(first.temperament.curiosity).toBeGreaterThanOrEqual(0)
    expect(first.temperament.curiosity).toBeLessThanOrEqual(100)
    expect(first.aptitudes).toHaveLength(2)
    expect(new Set(first.aptitudes).size).toBe(2)
    expect(first.lineage).toEqual({family: 'Unique lineage', origin: 'Modula Genesis', generation: 1, kind: 'personal'})
  })

  it('derives different DNA from different seeds', () => {
    const a = deriveDna(generateDnaSeed())
    const b = deriveDna(generateDnaSeed())
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  it('hashes the certificate over immutable fields only', () => {
    const statement = buildCertificateStatement({
      certificateRegistryId: 'MLB-CERT-11111111-1111-4111-8111-111111111111',
      instanceRegistryId: 'MLB-GEN-22222222-2222-4222-8222-222222222222',
      instanceId: '33333333-3333-4333-8333-333333333333',
      origin: 'Modula Genesis',
      born: '2026-11-28T14:00:00.000Z',
    })
    // The statement carries no name, wardrobe or personality: changing
    // those can never invalidate the certificate.
    expect(Object.keys(statement).sort()).toEqual([
      'bond', 'born', 'certificateRegistryId', 'instanceId', 'instanceRegistryId',
      'origin', 'transferStatus', 'type',
    ])
    expect(certificateStatementHash(statement)).toBe(certificateStatementHash(statement))
    expect(certificateStatementHash(statement)).toMatch(/^[0-9a-f]{64}$/)
    const moved = buildCertificateStatement({...statement, born: '2026-11-29T14:00:00.000Z'})
    expect(certificateStatementHash(moved)).not.toBe(certificateStatementHash(statement))
  })

  it('verifies Ed25519 signatures over the canonical statement', () => {
    const {publicKey, privateKey} = generateKeyPairSync('ed25519')
    const statement = buildCertificateStatement({
      certificateRegistryId: 'MLB-CERT-11111111-1111-4111-8111-111111111111',
      instanceRegistryId: 'MLB-GEN-22222222-2222-4222-8222-222222222222',
      instanceId: '33333333-3333-4333-8333-333333333333',
      origin: 'Modula Genesis',
      born: '2026-11-28T14:00:00.000Z',
    })
    const signature = sign(null, Buffer.from(canonicalJsonStringify(statement), 'utf8'), privateKey).toString('base64url')
    const pem = publicKey.export({type: 'spki', format: 'pem'}).toString()
    expect(signature).toMatch(/^[A-Za-z0-9_-]{86}$/)
    expect(verifyCertificateSignature({statement, signature, publicKeyPem: pem})).toBe(true)
    const tampered = buildCertificateStatement({...statement, born: '2026-11-29T14:00:00.000Z'})
    expect(verifyCertificateSignature({statement: tampered, signature, publicKeyPem: pem})).toBe(false)
    const {publicKey: otherPublic} = generateKeyPairSync('ed25519')
    expect(verifyCertificateSignature({
      statement,
      signature,
      publicKeyPem: otherPublic.export({type: 'spki', format: 'pem'}).toString(),
    })).toBe(false)
    expect(verifyCertificateSignature({statement, signature: 'not-a-signature', publicKeyPem: pem})).toBe(false)
    expect(verifyCertificateSignature({statement, signature, publicKeyPem: 'not a pem'})).toBe(false)
  })

  it('validates companion names', () => {
    expect(cleanCompanionName('  Nebbi  ')).toBe('Nebbi')
    expect(() => cleanCompanionName('')).toThrow(/between 1 and 80/)
    expect(() => cleanCompanionName('x'.repeat(81))).toThrow(/between 1 and 80/)
    expect(() => cleanCompanionName('bad\nname')).toThrow(/control characters/)
    expect(() => cleanCompanionName(undefined)).toThrow(/required/)
  })
})

describeIfDb('Moliboo Genesis integration', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let genesis: MolibooGenesisService
  let adminPool: pg.Pool
  let authorityFixture: AuthorizedPublicationRoleFixture
  // Test signing keys, registered through the fixed database authority
  // (never by raw INSERT: the 094 integrity guard forbids that).
  let signingKey: {keyId: string; privateKey: ReturnType<typeof generateKeyPairSync>['privateKey']; publicKeyPem: string}
  let otherSigningKey: {keyId: string; privateKey: ReturnType<typeof generateKeyPairSync>['privateKey']; publicKeyPem: string}

  async function latestMailCode(accountId: string, templateId: string): Promise<string> {
    const row = await db
      .selectFrom('greenfield_mail_jobs')
      .select(['text_body'])
      .where('recipient_account_id', '=', accountId)
      .where('template_id', '=', templateId)
      .orderBy('created_at', 'desc')
      .executeTakeFirstOrThrow()
    const match = String(row.text_body).match(/\b\d{6,8}\b/)
    if (!match) throw new Error(`No OTP code found for ${templateId}`)
    return match[0]
  }

  async function createVerifiedAccount(prefix: string) {
    const suffix = `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.slice(0, 20)
    const email = `${suffix}@example.com`
    // Handles are capped at 20 characters, so the unique part must fit
    // inside the cap: a short prefix plus the full timestamp + random tail.
    const handle = (`g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`).slice(0, 20)
    const password = 'secure-pass-word-1'
    const register = await app.inject({
      method: 'POST',
      url: '/v1/accounts/register',
      payload: {email, password, handle, displayName: `${prefix} User`, acceptedTerms: true, inviteCode: 'test-invite'},
    })
    expect(register.statusCode).toBe(201)
    const accountId = register.json().data.accountId
    const verificationCode = await latestMailCode(accountId, 'verification-code')
    const verify = await app.inject({
      method: 'POST',
      url: '/v1/accounts/verify-email',
      payload: {challengeId: register.json().data.verificationChallengeId, code: verificationCode},
    })
    expect(verify.statusCode).toBe(200)
    const login = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect(login.statusCode).toBe(200)
    return {accountId, email, handle, accessToken: login.json().data.accessToken as string}
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4023'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4023'
    process.env.MODULA_PUBLIC_WEB_URL = 'https://modula.digital'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    genesis = new MolibooGenesisService(db)
    await app.ready()
    adminPool = new pg.Pool({connectionString: process.env.MODULA_TEST_ADMIN_DATABASE_URL!})
    authorityFixture = await provisionAuthorizedPublicationRoles({
      adminPool,
      targetDatabaseUrl: databaseUrl!,
      targetDb: db,
      suffix: randomUUID(),
    })
    const registerTestKey = async (purpose: 'PUBLISHER' | 'MODULA_FIRST_PARTY', publisherId: string) => {
      const {publicKey, privateKey} = generateKeyPairSync('ed25519')
      const publicKeyPem = publicKey.export({type: 'spki', format: 'pem'}).toString()
      const keyId = `genesis-test-key-${uuidv7()}`
      await registerAuthorizedSigningIdentity({
        authorityUrl: authorityFixture.urls.signingIdentityAuthority,
        publisherId,
        signingKeyId: keyId,
        publicKeyPem,
        providerKeyRef: `test/genesis-${uuidv7()}`,
        purpose,
        provider: 'DISPOSABLE_TEST',
      })
      return {keyId, privateKey, publicKeyPem}
    }
    signingKey = await registerTestKey('PUBLISHER', 'modula')
    // applySignature only requires an ACTIVE registered key; purpose is
    // not under test here, so both fixtures use PUBLISHER. The active
    // identity is unique per (publisher, purpose), so the wrong-key
    // fixture registers under its own fixture publisher.
    await authorizeFirstPartyPublisherFixture(db, 'genesis-test', 'Genesis Test Publisher', 'genesis-test')
    otherSigningKey = await registerTestKey('PUBLISHER', 'genesis-test')
  }, 120_000)

  beforeEach(async () => {
    await db.deleteFrom('greenfield_auth_rate_limits').execute()
  })

  afterAll(async () => {
    if (authorityFixture) await dropAuthorizedPublicationRoles(adminPool, authorityFixture).catch(() => undefined)
    await app?.close()
    await db?.destroy()
    await adminPool?.end()
  })

  it('births a companion at registration', async () => {
    const account = await createVerifiedAccount('genesis-birth-')
    const res = await app.inject({
      method: 'GET', url: '/v1/me/moliboo/genesis',
      headers: {authorization: `Bearer ${account.accessToken}`},
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.registryId).toMatch(/^MLB-GEN-[0-9a-f-]{36}$/)
    expect(data.name).toBeNull()
    expect(data.origin).toBe('Modula Genesis')
    expect(data.bond).toBe('Original')
    expect(data.transferStatus).toBe('non-transferable')
    expect(data.certificate.registryId).toMatch(/^MLB-CERT-[0-9a-f-]{36}$/)
    expect(data.certificate.signatureState).toBe('unsigned')
    expect(data.certificate.bornAt).toBe(data.bornAt)
    expect(data.dna.appearance.body).toBeTruthy()
    expect(data.dna.aptitudes).toHaveLength(2)
    // Born at registration, not by this GET: the reveal is not "new".
    expect(data.reveal.isNew).toBe(false)
    expect(data.reveal.certificateRegistryId).toBe(data.certificate.registryId)
  })

  it('is idempotent under concurrent births', async () => {
    const account = await createVerifiedAccount('genesis-race-')
    // Remove the registration-time birth so the race is real (scoped to
    // this account's instance only; other tests' rows are untouched).
    const instance = await db.selectFrom('greenfield_moliboo_genesis_instances')
      .select(['instance_id']).where('account_id', '=', account.accountId).executeTakeFirstOrThrow()
    await db.deleteFrom('greenfield_moliboo_genesis_certificates').where('instance_id', '=', instance.instance_id).execute()
    await db.deleteFrom('greenfield_moliboo_genesis_dna').where('instance_id', '=', instance.instance_id).execute()
    await db.deleteFrom('greenfield_moliboo_genesis_instances').where('account_id', '=', account.accountId).execute()
    const results = await Promise.all(
      Array.from({length: 5}, () => genesis.ensureGenesisForAccount(account.accountId)),
    )
    const instanceIds = new Set(results.map(result => result.companion.instanceId))
    expect(instanceIds.size).toBe(1)
    expect(results.filter(result => result.created).length).toBe(1)
    const instances = await db.selectFrom('greenfield_moliboo_genesis_instances')
      .select(['instance_id']).where('account_id', '=', account.accountId).execute()
    expect(instances).toHaveLength(1)
    const certificates = await db.selectFrom('greenfield_moliboo_genesis_certificates')
      .select(['certificate_id']).where('instance_id', '=', results[0]!.companion.instanceId).execute()
    expect(certificates).toHaveLength(1)
  })

  it('backfills accounts born before Genesis shipped', async () => {
    const accountId = uuidv7()
    const now = new Date()
    await db.insertInto('greenfield_accounts').values({
      account_id: accountId, primary_handle: 'genesislegacy', status: 'active', created_at: now, updated_at: now,
    }).execute()
    expect(await genesis.getGenesisForAccount(accountId)).toBeNull()
    const {companion, created} = await genesis.ensureGenesisForAccount(accountId)
    expect(created).toBe(true)
    expect(companion.registryId).toMatch(/^MLB-GEN-/)
    expect(await genesis.getGenesisForAccount(accountId)).not.toBeNull()
  })

  it('naming never invalidates the certificate', async () => {
    const account = await createVerifiedAccount('genesis-name-')
    const headers = {authorization: `Bearer ${account.accessToken}`}
    const before = await app.inject({method: 'GET', url: '/v1/me/moliboo/genesis', headers})
    const hashBefore = before.json().data.certificate.hash
    const named = await app.inject({
      method: 'POST', url: '/v1/me/moliboo/genesis/name', headers, payload: {name: '  Nebbi  '},
    })
    expect(named.statusCode).toBe(200)
    expect(named.json().data.name).toBe('Nebbi')
    expect(named.json().data.certificate.hash).toBe(hashBefore)
    const verify = await app.inject({
      method: 'GET', url: `/v1/moliboos/certificates/${before.json().data.certificate.registryId}`,
    })
    expect(verify.statusCode).toBe(200)
    expect(verify.json().data.verification.recordValid).toBe(true)
    expect(verify.json().data.verification.signatureStatus).toBe('unsigned-awaiting-signature')
    expect(verify.json().data.verification.verified).toBe(false)
  })

  it('rejects bad names', async () => {
    const account = await createVerifiedAccount('genesis-badname-')
    const headers = {authorization: `Bearer ${account.accessToken}`}
    for (const payload of [{name: ''}, {name: '   '}, {name: 'x'.repeat(81)}, {name: null}, {name: {}}]) {
      const res = await app.inject({method: 'POST', url: '/v1/me/moliboo/genesis/name', headers, payload})
      expect(res.statusCode).toBe(400)
    }
    // Fastify's default Ajv coerces a JSON number to a string before the
    // handler runs, so 42 names the companion "42" — framework-wide
    // behaviour, not a Genesis special case.
    const coerced = await app.inject({
      method: 'POST', url: '/v1/me/moliboo/genesis/name', headers, payload: {name: 42},
    })
    expect(coerced.statusCode).toBe(200)
    expect(coerced.json().data.name).toBe('42')
  })

  it('requires auth for owner endpoints', async () => {
    expect((await app.inject({method: 'GET', url: '/v1/me/moliboo/genesis'})).statusCode).toBe(401)
    expect((await app.inject({method: 'GET', url: '/v1/me/moliboo/certificates'})).statusCode).toBe(401)
    expect((await app.inject({method: 'POST', url: '/v1/me/moliboo/genesis/name', payload: {name: 'X'}})).statusCode).toBe(401)
  })

  it('lists my certificates', async () => {
    const account = await createVerifiedAccount('genesis-list-')
    const res = await app.inject({
      method: 'GET', url: '/v1/me/moliboo/certificates',
      headers: {authorization: `Bearer ${account.accessToken}`},
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.certificates).toHaveLength(1)
    expect(res.json().data.certificates[0].type).toBe('origin')
  })

  it('verifies a certificate publicly without leaking private facts', async () => {
    const account = await createVerifiedAccount('genesis-pub-')
    const headers = {authorization: `Bearer ${account.accessToken}`}
    await app.inject({method: 'POST', url: '/v1/me/moliboo/genesis/name', headers, payload: {name: 'SecretName'}})
    const mine = await app.inject({method: 'GET', url: '/v1/me/moliboo/genesis', headers})
    const registryId = mine.json().data.certificate.registryId as string
    const res = await app.inject({method: 'GET', url: `/v1/moliboos/certificates/${registryId}`})
    expect(res.statusCode).toBe(200)
    const body = JSON.stringify(res.json())
    expect(body).not.toContain(account.accountId)
    expect(body).not.toContain('SecretName')
    expect(res.json().data.certificate.registryId).toBe(registryId)
    expect(res.json().data.verification.recordValid).toBe(true)
  })

  it('404s unknown certificates and 400s malformed ids', async () => {
    const unknown = await app.inject({
      method: 'GET', url: '/v1/moliboos/certificates/MLB-CERT-99999999-9999-4999-8999-999999999999',
    })
    expect(unknown.statusCode).toBe(404)
    const malformed = await app.inject({method: 'GET', url: '/v1/moliboos/certificates/not-a-certificate'})
    expect(malformed.statusCode).toBe(400)
  })

  it('applies an offline signature and then verifies as signed', async () => {
    const account = await createVerifiedAccount('genesis-sign-')
    const mine = await app.inject({
      method: 'GET', url: '/v1/me/moliboo/genesis',
      headers: {authorization: `Bearer ${account.accessToken}`},
    })
    const companion = mine.json().data
    const statement = buildCertificateStatement({
      certificateRegistryId: companion.certificate.registryId,
      instanceRegistryId: companion.registryId,
      instanceId: companion.instanceId,
      origin: 'Modula Genesis',
      born: companion.certificate.bornAt,
    })
    const signature = sign(null, Buffer.from(canonicalJsonStringify(statement), 'utf8'), signingKey.privateKey).toString('base64url')
    const applied = await genesis.applySignature({
      certificateRegistryId: companion.certificate.registryId, signature, keyId: signingKey.keyId,
    })
    expect(applied.signatureState).toBe('signed')
    const verified = await app.inject({
      method: 'GET', url: `/v1/moliboos/certificates/${companion.certificate.registryId}`,
    })
    expect(verified.json().data.verification.signatureStatus).toBe('signed')
    expect(verified.json().data.verification.signatureValid).toBe(true)
    expect(verified.json().data.verification.verified).toBe(true)
    await expect(genesis.applySignature({
      certificateRegistryId: companion.certificate.registryId, signature, keyId: signingKey.keyId,
    })).rejects.toMatchObject({code: 'CONFLICT'})
    await expect(genesis.applySignature({
      certificateRegistryId: 'MLB-CERT-99999999-9999-4999-8999-999999999999',
      signature, keyId: signingKey.keyId,
    })).rejects.toMatchObject({code: 'NOT_FOUND'})
  })

  it('rejects a signature that does not match the statement', async () => {
    const account = await createVerifiedAccount('genesis-badsig-')
    const mine = await app.inject({
      method: 'GET', url: '/v1/me/moliboo/genesis',
      headers: {authorization: `Bearer ${account.accessToken}`},
    })
    const companion = mine.json().data
    const statement = buildCertificateStatement({
      certificateRegistryId: companion.certificate.registryId,
      instanceRegistryId: companion.registryId,
      instanceId: companion.instanceId,
      origin: 'Modula Genesis',
      born: companion.certificate.bornAt,
    })
    // Signed with the right key but presented as the other key: must fail.
    const signature = sign(null, Buffer.from(canonicalJsonStringify(statement), 'utf8'), signingKey.privateKey).toString('base64url')
    await expect(genesis.applySignature({
      certificateRegistryId: companion.certificate.registryId, signature, keyId: otherSigningKey.keyId,
    })).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    // The certificate must still be unsigned after the failed attempt.
    const verified = await app.inject({
      method: 'GET', url: `/v1/moliboos/certificates/${companion.certificate.registryId}`,
    })
    expect(verified.json().data.verification.signatureStatus).toBe('unsigned-awaiting-signature')
  })

  it('rejects the admin signature route without admin capability', async () => {
    const account = await createVerifiedAccount('genesis-admin-')
    const mine = await app.inject({
      method: 'GET', url: '/v1/me/moliboo/genesis',
      headers: {authorization: `Bearer ${account.accessToken}`},
    })
    const registryId = mine.json().data.certificate.registryId as string
    const noAuth = await app.inject({
      method: 'POST', url: `/v1/admin/moliboo/certificates/${registryId}/signature`,
      payload: {signature: 'A'.repeat(86), keyId: 'x'},
    })
    expect(noAuth.statusCode).toBe(401)
    const asUser = await app.inject({
      method: 'POST', url: `/v1/admin/moliboo/certificates/${registryId}/signature`,
      headers: {authorization: `Bearer ${account.accessToken}`},
      payload: {signature: 'A'.repeat(86), keyId: 'x'},
    })
    expect(asUser.statusCode).toBe(403)
  })

  it('seeds exactly the confirmed First-100 characters', async () => {
    const rows = await db.selectFrom('greenfield_moliboo_characters')
      .select(['character_number', 'character_key', 'display_name', 'family_id', 'series', 'wearable'])
      .where('character_number', '<=', 100)
      .orderBy('character_number', 'asc')
      .execute()
    expect(rows).toHaveLength(16)
    expect(rows[0]).toMatchObject({character_number: 1, character_key: 'pip', display_name: 'Pip', family_id: 'originals', series: 1, wearable: true})
    expect(rows[1]).toMatchObject({character_number: 86, character_key: 'dozi', display_name: 'Dozi', family_id: 'dreamers'})
    expect(rows[15]).toMatchObject({character_number: 100, character_key: 'somna', display_name: 'Somna', family_id: 'dreamers'})
    const numbers = new Set(rows.map(row => row.character_number))
    for (let n = 2; n <= 85; n += 1) expect(numbers.has(n)).toBe(false)
    const version = await db.selectFrom('schema_metadata').select('value').where('key', '=', 'schema_version').executeTakeFirstOrThrow()
    expect(version.value).toBe('100')
  })
})
