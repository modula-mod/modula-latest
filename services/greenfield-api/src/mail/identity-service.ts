import {createHash} from 'node:crypto'
import {sql, type Transaction} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import type {Database, MailIdentityState} from '../database/types.js'
import {uuidv7} from '../lib/uuidv7.js'

const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export const MODULA_MAIL_DOMAIN = 'modula.digital'
export const MODULA_MAIL_REGISTRY_VERSION = '2026-08-11.phase7i-f5b'

const MAIL_LOCAL_PART = /^[a-z0-9](?:[a-z0-9]|[._-](?![._-])){1,28}[a-z0-9]$|^[a-z0-9]{3}$/
const PROVIDER_MAILBOXES_REQUIRING_OPERATOR_ADOPTION = new Set(['andrei@modula.digital'])

type WriteDb = ModulaDb | Transaction<Database>

export type MailIdentitySummary = {
  mailIdentityId: string
  address: string
  localPart: string
  domain: string
  status: MailIdentityState
  provider: string | null
  providerReference: string | null
  forwarding: {
    enabled: boolean
    destination: string | null
    keepLocalCopy: boolean
  }
  quotaBytes: number | null
  storageUsedBytes: number | null
  requiresOperatorAdoption: boolean
  activatedAt: string | null
  updatedAt: string
}

export class MailIdentityService {
  constructor(private readonly db: ModulaDb) {}

  async availability(localPartInput: string): Promise<{available: boolean; localPart: string; address: string; reason: string | null}> {
    const localPart = validateMailLocalPart(localPartInput)
    const address = `${localPart}@${MODULA_MAIL_DOMAIN}`
    const [reserved, identity] = await Promise.all([
      this.db
        .selectFrom('greenfield_reserved_identifiers')
        .select('identifier')
        .where('identifier', '=', localPart)
        .where(sql<boolean>`'mail_local_part' = ANY(applies_to)`)
        .executeTakeFirst(),
      this.db
        .selectFrom('greenfield_mail_identities')
        .select(['mail_identity_id', 'state'])
        .where('address', '=', address)
        .where('released_at', 'is', null)
        .executeTakeFirst(),
    ])
    if (reserved) return {available: false, localPart, address, reason: 'reserved'}
    if (PROVIDER_MAILBOXES_REQUIRING_OPERATOR_ADOPTION.has(address)) {
      return {available: false, localPart, address, reason: 'operator_adoption_required'}
    }
    if (identity) return {available: false, localPart, address, reason: identity.state}
    return {available: true, localPart, address, reason: null}
  }

  async getForAccount(accountId: string): Promise<MailIdentitySummary | null> {
    const row = await this.db
      .selectFrom('greenfield_mail_identities')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('released_at', 'is', null)
      .executeTakeFirst()
    return row ? serializeIdentity(row) : null
  }

  async ensurePendingIdentityInTransaction(
    trx: Transaction<Database>,
    accountId: string,
    now = new Date(),
  ): Promise<MailIdentitySummary | null> {
    const account = await trx
      .selectFrom('greenfield_accounts')
      .select(['account_id', 'primary_handle'])
      .where('account_id', '=', accountId)
      .executeTakeFirst()
    if (!account) return null
    const localPart = validateMailLocalPart(account.primary_handle)
    const address = `${localPart}@${MODULA_MAIL_DOMAIN}`
    const existing = await trx
      .selectFrom('greenfield_mail_identities')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('released_at', 'is', null)
      .executeTakeFirst()
    if (existing) return serializeIdentity(existing)
    await assertMailLocalPartAllowed(trx, localPart)
    const state: MailIdentityState = PROVIDER_MAILBOXES_REQUIRING_OPERATOR_ADOPTION.has(address) ? 'adoption_required' : 'pending'
    const identityId = uuidv7()
    await trx
      .insertInto('greenfield_mail_identities')
      .values({
        mail_identity_id: identityId,
        account_id: accountId,
        contact_identity_id: null,
        local_part: localPart,
        domain: MODULA_MAIL_DOMAIN,
        address,
        state,
        provider: null,
        provider_reference: null,
        forwarding_enabled: false,
        forwarding_destination: null,
        forwarding_destination_hash: null,
        keep_local_copy: true,
        quota_bytes: null,
        storage_used_bytes: null,
        retry_count: 0,
        last_error_code: null,
        last_error_message: null,
        adopted_at: null,
        provisioned_at: null,
        activated_at: null,
        suspended_at: null,
        resumed_at: null,
        released_at: null,
        failed_at: null,
        created_at: now,
        updated_at: now,
      })
      .execute()
    await this.recordEvent(trx, {
      mailIdentityId: identityId,
      accountId,
      eventType: state === 'adoption_required' ? 'mail_identity.adoption_required' : 'mail_identity.pending',
      metadata: {address, registryVersion: MODULA_MAIL_REGISTRY_VERSION},
      createdAt: now,
    })
    const created = await trx
      .selectFrom('greenfield_mail_identities')
      .selectAll()
      .where('mail_identity_id', '=', identityId)
      .executeTakeFirstOrThrow()
    return serializeIdentity(created)
  }

  async queueProvisioningForVerifiedAccount(
    trx: Transaction<Database>,
    accountId: string,
    now = new Date(),
  ): Promise<MailIdentitySummary | null> {
    const contact = await trx
      .selectFrom('greenfield_auth_identities')
      .select(['identity_id'])
      .where('account_id', '=', accountId)
      .where('kind', '=', 'email')
      .where('verified_at', 'is not', null)
      .orderBy('created_at', 'asc')
      .executeTakeFirst()
    if (!contact) return null
    const identity = await this.ensurePendingIdentityInTransaction(trx, accountId, now)
    if (!identity) return null
    const current = await trx
      .selectFrom('greenfield_mail_identities')
      .selectAll()
      .where('mail_identity_id', '=', identity.mailIdentityId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (current.state === 'active' || current.state === 'queued' || current.state === 'provisioning') {
      return serializeIdentity(current)
    }
    if (current.state === 'adoption_required') return serializeIdentity(current)
    const requestId = uuidv7()
    const idempotencyKey = `mail:provision:${current.mail_identity_id}:v1`
    await trx
      .updateTable('greenfield_mail_identities')
      .set({state: 'queued', contact_identity_id: contact.identity_id, updated_at: now})
      .where('mail_identity_id', '=', current.mail_identity_id)
      .execute()
    await trx
      .insertInto('greenfield_mail_identity_requests')
      .values({
        request_id: requestId,
        mail_identity_id: current.mail_identity_id,
        account_id: accountId,
        request_type: 'provision',
        state: 'queued',
        idempotency_key: idempotencyKey,
        provider: 'hestia',
        payload: jsonb({address: current.address, localPart: current.local_part, domain: current.domain, keepLocalCopy: true}),
        requested_by_account_id: accountId,
        service_actor: null,
        operator_intent: false,
        attempt_count: 0,
        maximum_attempts: 3,
        last_error_code: null,
        last_error_message: null,
        created_at: now,
        updated_at: now,
        completed_at: null,
        failed_at: null,
      })
      .onConflict(oc => oc.column('idempotency_key').doNothing())
      .execute()
    await trx
      .insertInto('background_jobs')
      .values({
        id: `job-mail-identity-${requestId}`,
        job_type: 'mail.identity.provision',
        payload: jsonb({requestId, mailIdentityId: current.mail_identity_id}),
        status: 'pending',
        priority: 5,
        available_at: now,
        lease_owner: null,
        lease_expires_at: null,
        attempt_count: 0,
        maximum_attempts: 3,
        last_error: null,
        created_at: now,
        updated_at: now,
        completed_at: null,
      })
      .onConflict(oc => oc.column('id').doNothing())
      .execute()
    await this.recordEvent(trx, {
      mailIdentityId: current.mail_identity_id,
      accountId,
      eventType: 'mail_identity.provisioning_queued',
      metadata: {address: current.address, requestId},
      createdAt: now,
    })
    const queued = await trx
      .selectFrom('greenfield_mail_identities')
      .selectAll()
      .where('mail_identity_id', '=', current.mail_identity_id)
      .executeTakeFirstOrThrow()
    return serializeIdentity(queued)
  }

  async updateForwarding(
    accountId: string,
    input: {enabled: boolean; destination?: string | null; keepLocalCopy?: boolean; requestedByAccountId?: string | null},
  ): Promise<MailIdentitySummary> {
    const destination = input.enabled ? normalizeEmail(input.destination ?? '') : null
    if (input.enabled && !destination) throw Object.assign(new Error('Valid forwarding destination required'), {code: 'VALIDATION_FAILED'})
    const now = new Date()
    return this.db.transaction().execute(async trx => {
      const identity = await trx
        .selectFrom('greenfield_mail_identities')
        .selectAll()
        .where('account_id', '=', accountId)
        .where('released_at', 'is', null)
        .forUpdate()
        .executeTakeFirst()
      if (!identity || identity.state !== 'active') throw Object.assign(new Error('Active Modula Mail identity required'), {code: 'NOT_FOUND'})
      const requestId = uuidv7()
      await trx
        .updateTable('greenfield_mail_identities')
        .set({
          forwarding_enabled: input.enabled,
          forwarding_destination: destination,
          forwarding_destination_hash: destination ? hashValue(destination) : null,
          keep_local_copy: input.keepLocalCopy ?? true,
          updated_at: now,
        })
        .where('mail_identity_id', '=', identity.mail_identity_id)
        .execute()
      await trx
        .insertInto('greenfield_mail_identity_requests')
        .values({
          request_id: requestId,
          mail_identity_id: identity.mail_identity_id,
          account_id: accountId,
          request_type: 'forward',
          state: 'queued',
          idempotency_key: `mail:forward:${identity.mail_identity_id}:${hashValue(`${destination ?? 'disabled'}:${input.keepLocalCopy ?? true}`)}`,
          provider: identity.provider ?? 'hestia',
          payload: jsonb({enabled: input.enabled, destination, keepLocalCopy: input.keepLocalCopy ?? true}),
          requested_by_account_id: input.requestedByAccountId ?? accountId,
          service_actor: null,
          operator_intent: false,
          attempt_count: 0,
          maximum_attempts: 3,
          last_error_code: null,
          last_error_message: null,
          created_at: now,
          updated_at: now,
          completed_at: null,
          failed_at: null,
        })
        .onConflict(oc => oc.column('idempotency_key').doNothing())
        .execute()
      await trx
        .insertInto('background_jobs')
        .values({
          id: `job-mail-forward-${requestId}`,
          job_type: 'mail.identity.forward',
          payload: jsonb({requestId, mailIdentityId: identity.mail_identity_id}),
          status: 'pending',
          priority: 5,
          available_at: now,
          lease_owner: null,
          lease_expires_at: null,
          attempt_count: 0,
          maximum_attempts: 3,
          last_error: null,
          created_at: now,
          updated_at: now,
          completed_at: null,
        })
        .onConflict(oc => oc.column('id').doNothing())
        .execute()
      await this.recordEvent(trx, {
        mailIdentityId: identity.mail_identity_id,
        accountId,
        actorAccountId: input.requestedByAccountId ?? accountId,
        eventType: 'mail_identity.forwarding_changed',
        metadata: {enabled: input.enabled, destinationSafe: destination ? maskEmail(destination) : null, keepLocalCopy: input.keepLocalCopy ?? true},
        createdAt: now,
      })
      return serializeIdentity(
        await trx
          .selectFrom('greenfield_mail_identities')
          .selectAll()
          .where('mail_identity_id', '=', identity.mail_identity_id)
          .executeTakeFirstOrThrow(),
      )
    })
  }

  async adopt(input: {
    accountId: string
    address: string
    providerReference: string
    operatorAccountId: string
    operatorIntent: boolean
  }): Promise<MailIdentitySummary> {
    if (input.operatorIntent !== true) throw Object.assign(new Error('Explicit operator adoption intent required'), {code: 'VALIDATION_FAILED'})
    const address = normalizeModulaAddress(input.address)
    const localPart = validateMailLocalPart(address.split('@')[0] ?? '')
    const now = new Date()
    return this.db.transaction().execute(async trx => {
      await assertMailLocalPartAllowed(trx, localPart, {allowOperatorAdoptionMailbox: true})
      const existing = await trx
        .selectFrom('greenfield_mail_identities')
        .selectAll()
        .where('address', '=', address)
        .where('released_at', 'is', null)
        .forUpdate()
        .executeTakeFirst()
      const identityId = existing?.mail_identity_id ?? uuidv7()
      if (existing && existing.account_id !== input.accountId) {
        throw Object.assign(new Error('Mail identity belongs to another account'), {code: 'CONFLICT'})
      }
      if (!existing) {
        await trx
          .insertInto('greenfield_mail_identities')
          .values({
            mail_identity_id: identityId,
            account_id: input.accountId,
            contact_identity_id: null,
            local_part: localPart,
            domain: MODULA_MAIL_DOMAIN,
            address,
            state: 'active',
            provider: 'hestia',
            provider_reference: input.providerReference,
            forwarding_enabled: false,
            forwarding_destination: null,
            forwarding_destination_hash: null,
            keep_local_copy: true,
            quota_bytes: null,
            storage_used_bytes: null,
            retry_count: 0,
            last_error_code: null,
            last_error_message: null,
            adopted_at: now,
            provisioned_at: null,
            activated_at: now,
            suspended_at: null,
            resumed_at: null,
            released_at: null,
            failed_at: null,
            created_at: now,
            updated_at: now,
          })
          .execute()
      } else {
        await trx
          .updateTable('greenfield_mail_identities')
          .set({
            state: 'active',
            provider: 'hestia',
            provider_reference: input.providerReference,
            adopted_at: now,
            activated_at: existing.activated_at ?? now,
            updated_at: now,
          })
          .where('mail_identity_id', '=', identityId)
          .execute()
      }
      await this.recordEvent(trx, {
        mailIdentityId: identityId,
        accountId: input.accountId,
        actorAccountId: input.operatorAccountId,
        eventType: 'mail_identity.adopted',
        metadata: {address, providerReference: input.providerReference, operatorIntent: true},
        createdAt: now,
      })
      return serializeIdentity(
        await trx
          .selectFrom('greenfield_mail_identities')
          .selectAll()
          .where('mail_identity_id', '=', identityId)
          .executeTakeFirstOrThrow(),
      )
    })
  }

  private async recordEvent(
    db: WriteDb,
    input: {
      mailIdentityId: string | null
      accountId: string | null
      eventType: string
      actorAccountId?: string | null
      serviceActor?: string | null
      metadata?: Record<string, unknown>
      createdAt?: Date
    },
  ): Promise<void> {
    await db
      .insertInto('greenfield_mail_identity_events')
      .values({
        event_id: uuidv7(),
        mail_identity_id: input.mailIdentityId,
        account_id: input.accountId,
        event_type: input.eventType,
        actor_account_id: input.actorAccountId ?? null,
        service_actor: input.serviceActor ?? null,
        metadata: jsonb(input.metadata ?? {}),
        created_at: input.createdAt ?? new Date(),
      })
      .execute()
  }
}

async function assertMailLocalPartAllowed(
  db: WriteDb,
  localPart: string,
  options: {allowOperatorAdoptionMailbox?: boolean} = {},
): Promise<void> {
  const reserved = await db
    .selectFrom('greenfield_reserved_identifiers')
    .select('identifier')
    .where('identifier', '=', localPart)
    .where(sql<boolean>`'mail_local_part' = ANY(applies_to)`)
    .executeTakeFirst()
  if (reserved) throw Object.assign(new Error('Mail local part is reserved'), {code: 'CONFLICT'})
  if (!options.allowOperatorAdoptionMailbox && PROVIDER_MAILBOXES_REQUIRING_OPERATOR_ADOPTION.has(`${localPart}@${MODULA_MAIL_DOMAIN}`)) {
    return
  }
}

function validateMailLocalPart(value: string): string {
  const localPart = value.trim().toLowerCase()
  if (!MAIL_LOCAL_PART.test(localPart) || /[._-]{2,}/.test(localPart)) {
    throw Object.assign(new Error('Valid Modula Mail local part required'), {code: 'VALIDATION_FAILED'})
  }
  return localPart
}

function normalizeModulaAddress(value: string): string {
  const address = value.trim().toLowerCase()
  if (!address.endsWith(`@${MODULA_MAIL_DOMAIN}`)) {
    throw Object.assign(new Error('Modula Mail address required'), {code: 'VALIDATION_FAILED'})
  }
  validateMailLocalPart(address.split('@')[0] ?? '')
  return address
}

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  if (email.length > 320) return null
  return email
}

function serializeIdentity(row: Database['greenfield_mail_identities']): MailIdentitySummary {
  return {
    mailIdentityId: row.mail_identity_id,
    address: row.address,
    localPart: row.local_part,
    domain: row.domain,
    status: row.state,
    provider: row.provider,
    providerReference: row.provider_reference,
    forwarding: {
      enabled: row.forwarding_enabled,
      destination: row.forwarding_destination,
      keepLocalCopy: row.keep_local_copy,
    },
    quotaBytes: row.quota_bytes,
    storageUsedBytes: row.storage_used_bytes,
    requiresOperatorAdoption: row.state === 'adoption_required',
    activatedAt: row.activated_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
  }
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function maskEmail(email: string): string {
  const [local = '', domain = 'unknown'] = email.split('@')
  return `${local.slice(0, 2)}${local.length > 2 ? '***' : '*'}@${domain}`
}
