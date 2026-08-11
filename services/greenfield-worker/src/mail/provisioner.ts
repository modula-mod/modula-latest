import {createHash, randomBytes} from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {sql, type Transaction} from 'kysely'
import type {WorkerConfig} from '../config.js'
import type {Database, ModulaWorkerDb} from '../database.js'
import {PermanentJobError, TransientJobError} from '../jobs/errors.js'

const execFileAsync = promisify(execFile)

type MailIdentityPayload = {
  requestId?: unknown
  mailIdentityId?: unknown
}

type ProviderOperationResult = {
  providerReference: string
  quotaBytes?: number | null
  storageUsedBytes?: number | null
}

type ProviderProvisionInput = {
  localPart: string
  domain: string
  address: string
  secret: string
}

type ProviderForwardInput = {
  localPart: string
  domain: string
  address: string
  enabled: boolean
  destination: string | null
  keepLocalCopy: boolean
}

type MailProviderAdapter = {
  providerId: string
  health(): Promise<{status: 'healthy' | 'disabled'; provider: string}>
  availability(input: {localPart: string; domain: string; address: string}): Promise<{available: boolean; reason: string | null}>
  provision(input: ProviderProvisionInput): Promise<ProviderOperationResult>
  adopt(input: {localPart: string; domain: string; address: string; providerReference: string}): Promise<ProviderOperationResult>
  suspend(input: {localPart: string; domain: string; address: string}): Promise<ProviderOperationResult>
  resume(input: {localPart: string; domain: string; address: string}): Promise<ProviderOperationResult>
  forward(input: ProviderForwardInput): Promise<ProviderOperationResult>
  release(input: {localPart: string; domain: string; address: string}): Promise<ProviderOperationResult>
}

export async function handleMailIdentityProvision(db: ModulaWorkerDb, config: WorkerConfig, payload: unknown): Promise<void> {
  await new ModulaMailProvisioner(db, config).provision(parseRequestId(payload))
}

export async function handleMailIdentityForward(db: ModulaWorkerDb, config: WorkerConfig, payload: unknown): Promise<void> {
  await new ModulaMailProvisioner(db, config).forward(parseRequestId(payload))
}

export class ModulaMailProvisioner {
  private readonly adapter: MailProviderAdapter

  constructor(
    private readonly db: ModulaWorkerDb,
    private readonly config: WorkerConfig,
  ) {
    this.adapter = createAdapter(config)
  }

  async health(): Promise<{status: 'healthy' | 'disabled'; provider: string}> {
    return this.adapter.health()
  }

  async availability(localPart: string): Promise<{available: boolean; reason: string | null}> {
    const address = `${localPart}@${this.config.mailDomain}`
    const existing = await this.db
      .selectFrom('greenfield_mail_identities')
      .select('mail_identity_id')
      .where('address', '=', address)
      .where('released_at', 'is', null)
      .executeTakeFirst()
    if (existing) return {available: false, reason: 'already_allocated'}
    return this.adapter.availability({localPart, domain: this.config.mailDomain, address})
  }

  async provision(requestId: string): Promise<void> {
    if (this.config.mailProvisionerMode === 'disabled') {
      throw new PermanentJobError('MAIL_PROVISIONER_DISABLED', 'Modula Mail provisioner is disabled')
    }
    const request = await this.claimRequest(requestId, 'provision')
    if (!request) return
    const identity = await this.db
      .selectFrom('greenfield_mail_identities')
      .selectAll()
      .where('mail_identity_id', '=', request.mail_identity_id)
      .executeTakeFirst()
    if (!identity) throw new PermanentJobError('MAIL_IDENTITY_NOT_FOUND', 'Mail identity not found')
    if (identity.state === 'active' && identity.provider_reference) {
      await this.completeRequest(requestId, identity.mail_identity_id, identity.account_id, 'mail_identity.provision_idempotent', {
        providerReference: identity.provider_reference,
      })
      return
    }

    const secret = generateMailboxSecret()
    let result: ProviderOperationResult
    try {
      result = await this.adapter.provision({
        localPart: identity.local_part,
        domain: identity.domain,
        address: identity.address,
        secret,
      })
    } catch (error) {
      await this.failRequest(requestId, identity.mail_identity_id, identity.account_id, 'MAIL_PROVIDER_FAILURE', redactedError(error))
      throw new TransientJobError('MAIL_PROVIDER_FAILURE', redactedError(error))
    }

    const now = new Date()
    const secretHash = hashSecret(secret)
    await this.db.transaction().execute(async trx => {
      const existingCredential = await trx
        .selectFrom('greenfield_mailbox_credentials')
        .select('credential_id')
        .where('mail_identity_id', '=', identity.mail_identity_id)
        .where('credential_kind', '=', 'imap_smtp_password')
        .where('revoked_at', 'is', null)
        .executeTakeFirst()
      if (!existingCredential) {
        await trx
          .insertInto('greenfield_mailbox_credentials')
          .values({
            credential_id: `mailbox-cred-${randomBytes(16).toString('hex')}`,
            mail_identity_id: identity.mail_identity_id,
            account_id: identity.account_id,
            credential_kind: 'imap_smtp_password',
            secret_hash: secretHash,
            encrypted_secret: null,
            encryption_key_version: null,
            created_at: now,
            rotated_at: null,
            revoked_at: null,
          })
          .execute()
      }
      await trx
        .updateTable('greenfield_mail_identities')
        .set({
          state: 'active',
          provider: this.adapter.providerId,
          provider_reference: result.providerReference,
          provisioned_at: now,
          activated_at: now,
          quota_bytes: result.quotaBytes ?? identity.quota_bytes ?? this.config.mailDefaultQuotaBytes,
          storage_used_bytes: result.storageUsedBytes ?? identity.storage_used_bytes ?? 0,
          last_error_code: null,
          last_error_message: null,
          failed_at: null,
          updated_at: now,
        })
        .where('mail_identity_id', '=', identity.mail_identity_id)
        .execute()
      await trx
        .updateTable('greenfield_mail_identity_requests')
        .set({state: 'completed', completed_at: now, updated_at: now, last_error_code: null, last_error_message: null})
        .where('request_id', '=', requestId)
        .execute()
      await insertEvent(trx, {
        mailIdentityId: identity.mail_identity_id,
        accountId: identity.account_id,
        eventType: 'mail_identity.provisioned',
        serviceActor: 'modula-mail-provisioner',
        metadata: {provider: this.adapter.providerId, providerReference: result.providerReference},
        createdAt: now,
      })
    })
  }

  async adopt(_requestId: string): Promise<void> {
    throw new PermanentJobError('MAIL_ADOPTION_API_ONLY', 'Mail adoption is recorded by the Greenfield admin API')
  }

  async suspend(requestId: string): Promise<void> {
    await this.completeUnsupportedProviderRequest(requestId, 'suspend', 'mail_identity.suspend_recorded')
  }

  async resume(requestId: string): Promise<void> {
    await this.completeUnsupportedProviderRequest(requestId, 'resume', 'mail_identity.resume_recorded')
  }

  async forward(requestId: string): Promise<void> {
    if (this.config.mailProvisionerMode === 'disabled') {
      throw new PermanentJobError('MAIL_PROVISIONER_DISABLED', 'Modula Mail provisioner is disabled')
    }
    const request = await this.claimRequest(requestId, 'forward')
    if (!request) return
    const identity = await this.db
      .selectFrom('greenfield_mail_identities')
      .selectAll()
      .where('mail_identity_id', '=', request.mail_identity_id)
      .executeTakeFirst()
    if (!identity || identity.state !== 'active') throw new PermanentJobError('MAIL_IDENTITY_NOT_ACTIVE', 'Active mail identity not found')
    const payload = request.payload as {enabled?: unknown; destination?: unknown; keepLocalCopy?: unknown}
    try {
      await this.adapter.forward({
        localPart: identity.local_part,
        domain: identity.domain,
        address: identity.address,
        enabled: Boolean(payload.enabled),
        destination: typeof payload.destination === 'string' ? payload.destination : null,
        keepLocalCopy: payload.keepLocalCopy !== false,
      })
    } catch (error) {
      await this.failRequest(requestId, identity.mail_identity_id, identity.account_id, 'MAIL_PROVIDER_FAILURE', redactedError(error))
      throw new TransientJobError('MAIL_PROVIDER_FAILURE', redactedError(error))
    }
    await this.completeRequest(requestId, identity.mail_identity_id, identity.account_id, 'mail_identity.forwarding_applied', {
      enabled: Boolean(payload.enabled),
      destinationConfigured: typeof payload.destination === 'string' && payload.destination.length > 0,
      keepLocalCopy: payload.keepLocalCopy !== false,
    })
  }

  async release(requestId: string): Promise<void> {
    await this.completeUnsupportedProviderRequest(requestId, 'release', 'mail_identity.release_recorded')
  }

  private async claimRequest(requestId: string, requestType: string) {
    const now = new Date()
    const updated = await sql<{
      request_id: string
      mail_identity_id: string
      account_id: string
      request_type: string
      payload: unknown
    }>`
      UPDATE greenfield_mail_identity_requests
      SET state = 'leased', attempt_count = attempt_count + 1, updated_at = ${now}
      WHERE request_id = ${requestId}
        AND request_type = ${requestType}
        AND state IN ('queued', 'failed')
      RETURNING request_id, mail_identity_id, account_id, request_type, payload
    `.execute(this.db)
    const request = updated.rows[0]
    if (request) {
      if (requestType === 'provision') {
        await this.db
          .updateTable('greenfield_mail_identities')
          .set({state: 'provisioning', updated_at: now})
          .where('mail_identity_id', '=', request.mail_identity_id)
          .where('state', 'in', ['queued', 'pending', 'failed'])
          .execute()
      } else {
        await this.db
          .updateTable('greenfield_mail_identities')
          .set({updated_at: now})
          .where('mail_identity_id', '=', request.mail_identity_id)
          .where('state', '=', 'active')
          .execute()
      }
      return request
    }
    const existing = await this.db
      .selectFrom('greenfield_mail_identity_requests')
      .select(['request_id', 'state'])
      .where('request_id', '=', requestId)
      .executeTakeFirst()
    if (!existing) throw new PermanentJobError('MAIL_REQUEST_NOT_FOUND', 'Mail identity request not found')
    if (existing.state === 'completed' || existing.state === 'cancelled') return null
    return null
  }

  private async completeRequest(
    requestId: string,
    mailIdentityId: string,
    accountId: string,
    eventType: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_mail_identity_requests')
        .set({state: 'completed', completed_at: now, updated_at: now, last_error_code: null, last_error_message: null})
        .where('request_id', '=', requestId)
        .execute()
      await insertEvent(trx, {
        mailIdentityId,
        accountId,
        eventType,
        serviceActor: 'modula-mail-provisioner',
        metadata,
        createdAt: now,
      })
    })
  }

  private async failRequest(
    requestId: string,
    mailIdentityId: string,
    accountId: string,
    code: string,
    message: string,
  ): Promise<void> {
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_mail_identity_requests')
        .set({state: 'failed', last_error_code: code, last_error_message: message, failed_at: now, updated_at: now})
        .where('request_id', '=', requestId)
        .execute()
      await trx
        .updateTable('greenfield_mail_identities')
        .set({state: 'failed', retry_count: sql<number>`retry_count + 1`, last_error_code: code, last_error_message: message, failed_at: now, updated_at: now})
        .where('mail_identity_id', '=', mailIdentityId)
        .execute()
      await insertEvent(trx, {
        mailIdentityId,
        accountId,
        eventType: 'mail_identity.provision_failed',
        serviceActor: 'modula-mail-provisioner',
        metadata: {code, message},
        createdAt: now,
      })
    })
  }

  private async completeUnsupportedProviderRequest(requestId: string, requestType: string, eventType: string): Promise<void> {
    const request = await this.claimRequest(requestId, requestType)
    if (!request) return
    await this.completeRequest(requestId, request.mail_identity_id, request.account_id, eventType, {requestType})
  }
}

class DryRunMailProviderAdapter implements MailProviderAdapter {
  readonly providerId = 'dry-run-hestia'

  async health() {
    return {status: 'healthy' as const, provider: this.providerId}
  }

  async availability() {
    return {available: true, reason: null}
  }

  async provision(input: ProviderProvisionInput): Promise<ProviderOperationResult> {
    return {providerReference: `dry-run-hestia:${input.address}`, storageUsedBytes: 0}
  }

  async adopt(input: {providerReference: string}): Promise<ProviderOperationResult> {
    return {providerReference: input.providerReference}
  }

  async suspend(input: {address: string}): Promise<ProviderOperationResult> {
    return {providerReference: `dry-run-hestia:${input.address}`}
  }

  async resume(input: {address: string}): Promise<ProviderOperationResult> {
    return {providerReference: `dry-run-hestia:${input.address}`}
  }

  async forward(input: ProviderForwardInput): Promise<ProviderOperationResult> {
    return {providerReference: `dry-run-hestia:${input.address}:forward:${input.enabled ? 'enabled' : 'disabled'}`}
  }

  async release(input: {address: string}): Promise<ProviderOperationResult> {
    return {providerReference: `dry-run-hestia:${input.address}:released`}
  }
}

class HestiaMailProviderAdapter implements MailProviderAdapter {
  readonly providerId = 'hestia'

  constructor(private readonly config: WorkerConfig) {}

  async health() {
    await this.hestia('v-list-mail-domain', [this.user(), this.config.mailDomain])
    return {status: 'healthy' as const, provider: this.providerId}
  }

  async availability(input: {localPart: string; domain: string}) {
    const result = await this.hestia('v-list-mail-account', [this.user(), input.domain, input.localPart], {allowFailure: true})
    return result.ok ? {available: false, reason: 'provider_exists'} : {available: true, reason: null}
  }

  async provision(input: ProviderProvisionInput): Promise<ProviderOperationResult> {
    await this.hestia('v-add-mail-account', [this.user(), input.domain, input.localPart, input.secret])
    return {providerReference: `hestia:${this.user()}:${input.domain}:${input.localPart}`, storageUsedBytes: 0}
  }

  async adopt(input: {localPart: string; domain: string; providerReference: string}): Promise<ProviderOperationResult> {
    await this.hestia('v-list-mail-account', [this.user(), input.domain, input.localPart])
    return {providerReference: input.providerReference}
  }

  async suspend(input: {localPart: string; domain: string; address: string}): Promise<ProviderOperationResult> {
    await this.hestia('v-suspend-mail-account', [this.user(), input.domain, input.localPart])
    return {providerReference: `hestia:${this.user()}:${input.domain}:${input.localPart}`}
  }

  async resume(input: {localPart: string; domain: string; address: string}): Promise<ProviderOperationResult> {
    await this.hestia('v-unsuspend-mail-account', [this.user(), input.domain, input.localPart])
    return {providerReference: `hestia:${this.user()}:${input.domain}:${input.localPart}`}
  }

  async forward(input: ProviderForwardInput): Promise<ProviderOperationResult> {
    if (input.enabled && input.destination) {
      await this.hestia('v-add-mail-account-forward', [this.user(), input.domain, input.localPart, input.destination])
    } else {
      await this.hestia('v-delete-mail-account-forward', [this.user(), input.domain, input.localPart], {allowFailure: true})
    }
    return {providerReference: `hestia:${this.user()}:${input.domain}:${input.localPart}`}
  }

  async release(input: {localPart: string; domain: string; address: string}): Promise<ProviderOperationResult> {
    await this.hestia('v-delete-mail-account', [this.user(), input.domain, input.localPart])
    return {providerReference: `hestia:${this.user()}:${input.domain}:${input.localPart}:released`}
  }

  private user(): string {
    if (!this.config.mailHestiaUser) throw new Error('MODULA_MAIL_HESTIA_USER is required for Hestia provisioning')
    return this.config.mailHestiaUser
  }

  private async hestia(command: string, args: string[], options: {allowFailure?: boolean} = {}): Promise<{ok: boolean}> {
    const bin = `/usr/local/hestia/bin/${command}`
    try {
      await execFileAsync(bin, args, {timeout: this.config.mailProvisionerCommandTimeoutMs, maxBuffer: 128_000})
      return {ok: true}
    } catch (error) {
      if (options.allowFailure) return {ok: false}
      throw error
    }
  }
}

function createAdapter(config: WorkerConfig): MailProviderAdapter {
  if (config.mailProvisionerMode === 'hestia') return new HestiaMailProviderAdapter(config)
  return new DryRunMailProviderAdapter()
}

function parseRequestId(payload: unknown): string {
  const requestId = (payload as MailIdentityPayload | null)?.requestId
  if (typeof requestId !== 'string' || !requestId) {
    throw new PermanentJobError('VALIDATION_FAILED', 'mail identity payload missing requestId')
  }
  return requestId
}

async function insertEvent(
  db: ModulaWorkerDb | Transaction<Database>,
  input: {
    mailIdentityId: string | null
    accountId: string | null
    eventType: string
    serviceActor: string
    metadata: Record<string, unknown>
    createdAt: Date
  },
): Promise<void> {
  await db
    .insertInto('greenfield_mail_identity_events')
    .values({
      event_id: `mail-event-${randomBytes(16).toString('hex')}`,
      mail_identity_id: input.mailIdentityId,
      account_id: input.accountId,
      event_type: input.eventType,
      actor_account_id: null,
      service_actor: input.serviceActor,
      metadata: sql<unknown>`${JSON.stringify(input.metadata)}::jsonb`,
      created_at: input.createdAt,
    })
    .execute()
}

function generateMailboxSecret(): string {
  return randomBytes(32).toString('base64url')
}

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function redactedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/[A-Za-z0-9_-]{16,}/g, '[redacted]')
}
