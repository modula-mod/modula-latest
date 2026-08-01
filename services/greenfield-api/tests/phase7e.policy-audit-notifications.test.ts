import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {AuditRepository, sanitizeAuditMetadata} from '../src/domains/audit/repository.js'
import {NotificationPreferencesService} from '../src/domains/notifications/preferences.js'
import {GreenfieldPolicyEngine} from '../src/domains/policy/index.js'
import {PostRepository} from '../src/domains/posts/repository.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Phase 7E policy, audit and notification foundations', () => {
  let db: ModulaDb
  let ownerAccountId = ''
  let ownerActorId = ''
  let otherAccountId = ''
  let otherActorId = ''

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    const suffix = Date.now().toString(36)
    ownerAccountId = `policy-owner-${suffix}`
    ownerActorId = `policy-owner-actor-${suffix}`
    otherAccountId = `policy-other-${suffix}`
    otherActorId = `policy-other-actor-${suffix}`
    await seedProfileAccount(db, ownerAccountId, ownerActorId, `polowner${suffix}`.slice(0, 24))
    await seedProfileAccount(db, otherAccountId, otherActorId, `polother${suffix}`.slice(0, 24))
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('returns stable policy denial codes and audits denied decisions', async () => {
    const now = new Date()
    const requestPrefix = `req-policy-${randomUUID()}`
    const postId = `post-policy-private-${randomUUID()}`
    await db
      .insertInto('posts')
      .values({
        id: postId,
        author_actor_id: ownerActorId,
        kind: 'text',
        text: 'private policy probe',
        feed: 'following',
        audience: 'private',
        reply_permission: 'everyone',
        idempotency_key: null,
        link_domain: null,
        link_title: null,
        link_description: null,
        link_image: null,
        module_name: null,
        module_action_label: null,
        module_status: null,
        glow_colour: null,
        like_count: 0,
        reaction_count: 0,
        quote_count: 0,
        reply_count: 0,
        repost_count: 0,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version: 1,
      })
      .execute()

    const posts = new PostRepository(db)
    expect(await posts.getById(postId, ownerActorId)).toBeTruthy()
    expect(await posts.getById(postId, otherActorId)).toBeNull()

    const policy = new GreenfieldPolicyEngine(db)
    const aiDenied = await policy.evaluateAndAudit({
      actorId: otherActorId,
      action: 'ai.context.build',
      resource: {type: 'post', id: postId},
      requestContext: {requestId: `${requestPrefix}-ai`, correlationId: `${requestPrefix}-ai`},
    })
    expect(aiDenied).toMatchObject({
      allowed: false,
      code: 'AI_CONTEXT_NOT_ALLOWED',
      auditRequired: true,
    })
    expect(aiDenied.obligations).toContain('require-AI-consent')

    const connectionDenied = await policy.evaluateAndAudit({
      actorId: ownerActorId,
      accountId: ownerAccountId,
      action: 'connection.use',
      connectionId: 'connection-policy-degraded',
      currentState: 'degraded',
      requestContext: {requestId: `${requestPrefix}-connection`},
    })
    expect(connectionDenied).toMatchObject({allowed: false, code: 'CONNECTION_NOT_HEALTHY'})
    expect(connectionDenied.obligations).toContain('require-connection-healthy')

    const dimonDenied = await policy.evaluateAndAudit({
      actorId: ownerActorId,
      accountId: ownerAccountId,
      action: 'dimon.transaction.submit',
      currentState: 'prepared',
      requestContext: {requestId: `${requestPrefix}-dimon`},
    })
    expect(dimonDenied).toMatchObject({allowed: false, code: 'TRANSACTION_CONFIRMATION_REQUIRED'})
    expect(dimonDenied.obligations).toContain('require-confirmation')

    const deniedRows = await db
      .selectFrom('greenfield_policy_decision_audit')
      .select(['code', 'allowed', 'request_id'])
      .where('allowed', '=', false)
      .where('request_id', 'in', [`${requestPrefix}-ai`, `${requestPrefix}-connection`, `${requestPrefix}-dimon`])
      .execute()
    expect(deniedRows.map(row => row.code).sort()).toEqual([
      'AI_CONTEXT_NOT_ALLOWED',
      'CONNECTION_NOT_HEALTHY',
      'TRANSACTION_CONFIRMATION_REQUIRED',
    ])
  })

  it('sanitises audit metadata and records append-oriented audit fields', async () => {
    const auditRequestId = `req-policy-audit-${randomUUID()}`
    const sanitised = sanitizeAuditMetadata({
      accessToken: 'secret-token',
      noteContent: 'private note '.repeat(40),
      nested: {refresh_token: 'secret-refresh'},
    }) as Record<string, unknown>
    expect(sanitised.accessToken).toBe('[redacted:secret]')
    expect(sanitised.noteContent).toBe('[redacted:private-content]')
    expect(JSON.stringify(sanitised)).not.toContain('secret-token')

    await new AuditRepository(db).append(
      'ai.context.used',
      {accessToken: 'secret-token', prompt: 'private prompt '.repeat(40), sourceCount: 2},
      {type: 'note', id: 'note-policy-audit', actorId: ownerActorId},
      {
        accountId: ownerAccountId,
        result: 'denied',
        requestId: auditRequestId,
        correlationId: auditRequestId,
        ipClassification: 'private',
        userAgentClassification: 'browser',
      },
    )

    const row = await db
      .selectFrom('audit_events')
      .selectAll()
      .where('request_id', '=', auditRequestId)
      .executeTakeFirstOrThrow()
    expect(row.audit_id).toBeTruthy()
    expect(row.action).toBe('ai.context.used')
    expect(row.result).toBe('denied')
    expect(row.account_id).toBe(ownerAccountId)
    expect(row.ip_classification).toBe('private')
    expect(row.user_agent_classification).toBe('browser')
    expect(JSON.stringify(row.metadata)).not.toContain('secret-token')
    expect(JSON.stringify(row.metadata)).not.toContain('private prompt private prompt')
  })

  it('stores expanded notification channel, category, digest and module preferences', async () => {
    const service = new NotificationPreferencesService(db)
    const initial = await service.get(ownerAccountId)
    const updated = await service.patch(ownerAccountId, {
      expectedVersion: initial.version,
      emailEnabled: true,
      webPushEnabled: true,
      frequency: 'hourly',
      digestMode: true,
      quietHours: {enabled: true, start: '22:00', end: '07:00', timezone: 'Europe/London'},
      channelPreferences: {'in-app': true, email: true, 'web-push': false},
      categoryPreferences: {AI: true, connector: true, automation: false},
      modulePreferences: {
        'modula.vault-notes': {enabled: true, frequency: 'daily', channels: ['in-app', 'email']},
      },
      connectorFailureEnabled: true,
      aiCompletionEnabled: true,
      automationFailureEnabled: false,
      dimonTransactionConfirmationEnabled: true,
    })

    expect(updated.emailEnabled).toBe(true)
    expect(updated.webPushEnabled).toBe(true)
    expect(updated.frequency).toBe('hourly')
    expect(updated.digestMode).toBe(true)
    expect(updated.quietHours?.timezone).toBe('Europe/London')
    expect(updated.categoryPreferences?.automation).toBe(false)
    expect(updated.modulePreferences?.['modula.vault-notes']?.frequency).toBe('daily')

    const audit = await db
      .selectFrom('audit_events')
      .select(['event_type', 'actor_id', 'metadata'])
      .where('event_type', '=', 'notification.preferences.updated')
      .where('actor_id', '=', ownerActorId)
      .orderBy('created_at', 'desc')
      .executeTakeFirstOrThrow()
    expect(audit.event_type).toBe('notification.preferences.updated')
    expect(JSON.stringify(audit.metadata)).toContain('automationFailureEnabled')
  })
})

function configureTestEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4022'
  process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4022'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
}

async function seedProfileAccount(db: ModulaDb, accountId: string, actorId: string, handle: string): Promise<void> {
  const now = new Date()
  await db
    .insertInto('greenfield_accounts')
    .values({
      account_id: accountId,
      primary_handle: handle,
      status: 'active',
      created_at: now,
      updated_at: now,
    })
    .execute()
  await db
    .insertInto('actors')
    .values({
      id: actorId,
      account_id: accountId,
      kind: 'person',
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    })
    .execute()
  await db
    .insertInto('profiles')
    .values({
      id: `profile-${actorId}`,
      actor_id: actorId,
      handle,
      display_name: 'Phase 7E Policy',
      kind: 'person',
      bio: '',
      avatar_url: null,
      cover_url: null,
      cover_colour: null,
      pronouns: null,
      location_label: null,
      location_visibility: null,
      website_label: null,
      website_url: null,
      website_domain: null,
      website_visibility: null,
      focus_status_id: 'available',
      focus_status_label: 'Available',
      focus_status_message: '',
      focus_status_updated_at: now,
      visibility: 'public',
      module_count: 0,
      featured_module_ids: [],
      identity_claims: [],
      joined_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    })
    .execute()
}
