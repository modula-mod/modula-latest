import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldSupportService} from '../src/support/service.js'
import {collectPublicStatus, resetPublicStatusCache} from '../src/domains/system/status.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().replaceAll('-', '').slice(0, 10)
const accountId = `support-a-${suffix}`
const otherAccountId = `support-b-${suffix}`
const config = {mailSupportEmail: 'support@modula.digital', publicWebUrl: 'https://modula.digital', mutationsEnabled: true} as any

describeIfDb('support cases and public status (database)', () => {
  let db: ModulaDb
  let service: GreenfieldSupportService

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    service = new GreenfieldSupportService(db, config)
    const now = new Date()
    await db.insertInto('greenfield_accounts').values([
      {account_id: accountId, primary_handle: `supporta${suffix}`, status: 'active', created_at: now, updated_at: now},
      {account_id: otherAccountId, primary_handle: `supportb${suffix}`, status: 'active', created_at: now, updated_at: now},
    ]).execute()
    await db.insertInto('greenfield_auth_identities').values({identity_id: `identity-${suffix}`, account_id: accountId, kind: 'email', identifier: `support-${suffix}@example.test`, verified_at: now, metadata: {}, created_at: now, updated_at: now}).execute()
  })

  afterAll(async () => db?.destroy())

  it('opens a case once per idempotency key and queues it to the support mailbox', async () => {
    const input = {category: 'bug', subject: 'Status page is blank', message: 'Opening Help → Status shows nothing.', diagnostics: {appVersion: '1.0', token: 'never-stored'}}
    const first = await service.open(accountId, `key-${suffix}`, input)
    const again = await service.open(accountId, `key-${suffix}`, input)
    expect(again.caseId).toBe(first.caseId)
    expect(first.reference).toMatch(/^MOD-[0-9A-Z]{8}$/)
    expect(first.state).toBe('OPEN')

    const row = await db.selectFrom('greenfield_support_cases').selectAll().where('case_id', '=', first.caseId).executeTakeFirstOrThrow()
    expect(row.diagnostics).toEqual({appVersion: '1.0'})
    const mail = await db.selectFrom('greenfield_mail_jobs').selectAll().where('mail_job_id', '=', row.mail_job_id!).executeTakeFirstOrThrow()
    expect(mail.template_id).toBe('support-case')
    expect(mail.recipient_address).toBe('support@modula.digital')
    expect(mail.subject).toContain(first.reference)
    expect(mail.html_body).toContain(`mailto:support-${suffix}@example.test`)
    expect(mail.text_body).not.toContain('never-stored')

    const own = await service.list(accountId)
    expect(own.items.map(item => item.caseId)).toContain(first.caseId)
    expect((await service.list(otherAccountId)).items).toHaveLength(0)
  })

  it('limits how many cases an account can open per hour', async () => {
    for (let index = 0; index < 5; index += 1) {
      await service.open(otherAccountId, `burst-${suffix}-${index}`, {category: 'feedback', subject: `Idea ${index}`, message: 'A thoughtful suggestion.'})
    }
    await expect(service.open(otherAccountId, `burst-${suffix}-6`, {category: 'feedback', subject: 'One more', message: 'A thoughtful suggestion.'})).rejects.toMatchObject({code: 'RATE_LIMITED'})
  })

  it('measures database latency and worker heartbeat age', async () => {
    resetPublicStatusCache()
    await db.insertInto('greenfield_worker_heartbeats').values({worker_id: `worker-${suffix}`, release_sha: 'abc', started_at: new Date(), last_seen_at: new Date()})
      .onConflict(oc => oc.column('worker_id').doUpdateSet({last_seen_at: new Date()})).execute()
    const status = await collectPublicStatus(db, {commit: 'abc', builtAt: null})
    const byId = Object.fromEntries(status.components.map(component => [component.id, component]))
    expect(byId.api!.state).toBe('operational')
    expect(byId.database!.state).toBe('operational')
    expect(typeof byId.database!.latencyMs).toBe('number')
    expect(byId.worker!.state).toBe('operational')
    expect(byId.worker!.ageSeconds).toBeLessThan(5)
    expect(['operational', 'degraded', 'outage']).toContain(byId.jobs!.state)
    expect(status.release.commit).toBe('abc')
  })
})
