import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldEntitlementService} from '../src/entitlements/service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Greenfield Backend V1 entitlements, usage and quotas', () => {
  let db: ModulaDb
  let service: GreenfieldEntitlementService
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
  const adminId = `commerce-admin-${suffix}`
  const accountId = `commerce-account-${suffix}`
  const productId = `example.${suffix}.product`
  const offerId = `offer.${suffix}.free`

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    const now = new Date()
    await db.insertInto('greenfield_accounts').values([
      {account_id: adminId, primary_handle: `commerceadmin${suffix}`, status: 'active', created_at: now, updated_at: now},
      {account_id: accountId, primary_handle: `commerceuser${suffix}`, status: 'active', created_at: now, updated_at: now},
    ]).execute()
    service = new GreenfieldEntitlementService(db)
  })
  afterAll(async () => db?.destroy())

  it('projects generic grants from an append-only entitlement event ledger', async () => {
    await service.upsertOffer(adminId, offerId, {productId, kind: 'FREE', displayName: 'Free capability', capabilities: ['notes.read', 'notes.write'], state: 'ACTIVE', commercialTerms: {price: 'none'}})
    const entitlement = await service.grant(adminId, {offerId, accountId, source: 'FREE', provenanceReference: `admin://${adminId}/fixture`})
    expect(entitlement).toMatchObject({productId, offerId, source: 'free', state: 'ACTIVE', capabilities: ['notes.read','notes.write']})
    expect(await service.check(accountId, productId, 'notes.write')).toMatchObject({entitled: true})
    expect((await service.listAccount(accountId, productId)).items).toHaveLength(1)
    await expect(service.grant(adminId, {offerId, accountId, source: 'APPLE', provenanceReference: 'apple://unverified'})).rejects.toMatchObject({code: 'FORBIDDEN'})
    await expect(service.grant(adminId, {offerId, accountId, source: 'APPLE', provenanceReference: 'apple://unverified'})).rejects.toThrow('APPLE_PROVIDER_NOT_CONFIGURED_OR_RECEIPT_UNVERIFIED')
    expect((await service.adapterStatus()).find(row => row.adapter === 'APPLE')?.state).toBe('NOT_CONFIGURED')
    const revoked = await service.transition(adminId, entitlement.entitlementId, {state: 'REVOKED', reasonCode: 'ADMIN_TEST_REVOKE', provenanceReference: `admin://${adminId}/revoke`})
    expect(revoked.state).toBe('REVOKED')
    expect(await service.check(accountId, productId, 'notes.write')).toMatchObject({entitled: false, entitlement: null})
    expect(await db.selectFrom('greenfield_entitlement_events').selectAll().where('entitlement_id', '=', entitlement.entitlementId).execute()).toHaveLength(2)
    expect(await db.selectFrom('greenfield_domain_events').selectAll().where('event_type', '=', 'entitlement.changed.v1').where('aggregate_id', '=', entitlement.entitlementId).execute()).toHaveLength(2)
  })

  it('records idempotent usage once and atomically rejects quota bypass', async () => {
    await service.upsertQuota(adminId, `quota-${suffix}`, {scopeType: 'ACCOUNT', scopeId: accountId, metric: 'ai.tokens', limitQuantity: 10, windowSeconds: 3600, state: 'ACTIVE'})
    const occurredAt = new Date().toISOString()
    const event = {usageEventId: `usage-${suffix}-1`, accountId, organisationId: null, productId, installationId: null, capability: 'ai.generate', metric: 'ai.tokens', quantity: 6, unit: 'tokens', idempotencyKey: `usage-key-${suffix}-1`, occurredAt, traceId: `trace-${suffix}-1`}
    expect(await service.recordUsage('service.fixture', accountId, productId, null, event)).toMatchObject({accepted: true, replay: false})
    expect(await service.recordUsage('service.fixture', accountId, productId, null, event)).toMatchObject({accepted: true, replay: true})
    await expect(service.recordUsage('service.fixture', accountId, productId, null, {...event, quantity: 7})).rejects.toMatchObject({code: 'CONFLICT'})
    await expect(service.recordUsage('service.fixture', accountId, productId, null, {...event, usageEventId: `usage-${suffix}-2`, idempotencyKey: `usage-key-${suffix}-2`, quantity: 5})).rejects.toMatchObject({code: 'FORBIDDEN'})
    expect(await db.selectFrom('greenfield_usage_events').selectAll().where('account_id', '=', accountId).execute()).toHaveLength(1)
    expect(Number((await db.selectFrom('greenfield_quota_counters').select('consumed_quantity').executeTakeFirstOrThrow()).consumed_quantity)).toBe(6)
  })
})
