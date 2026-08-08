import {createHash, randomBytes} from 'node:crypto'
import {GREENFIELD_INITIAL_COLLECTIONS} from '@modula/greenfield-protocol'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {hashPassword, verifyPassword} from '../lib/password.js'
import {uuidv7} from '../lib/uuidv7.js'
import {displayNameFromIdentityMetadata, MailService} from '../mail/service.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {assertHandleAvailable, canonicalHandle, validateHandle} from './handle.js'

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')

export type PublicAccount = {
  accountId: string
  primaryHandle: string
  status: string
  createdAt: string
  updatedAt: string
  email?: string
}

export class AccountService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
    private readonly mail?: MailService,
  ) {}

  async register(input: {
    email: string
    password: string
    handle: string
    displayName?: string
    inviteCode?: string
    acceptedTerms?: boolean
    correlationId?: string
  }) {
    const email = input.email.trim().toLowerCase()
    const displayName = (input.displayName ?? '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw Object.assign(new Error('Valid email required'), {code: 'VALIDATION_FAILED'})
    }
    if (displayName.length < 2 || displayName.length > 80) {
      throw Object.assign(new Error('Display name must be between 2 and 80 characters'), {code: 'VALIDATION_FAILED'})
    }
    if (input.password.length < 10) {
      throw Object.assign(new Error('Password must be at least 10 characters'), {code: 'VALIDATION_FAILED'})
    }
    if (input.acceptedTerms !== true) {
      throw Object.assign(new Error('Terms and privacy acknowledgement required'), {code: 'VALIDATION_FAILED'})
    }
    if (this.config.registrationMode === 'closed') {
      throw Object.assign(new Error('Registration is closed'), {code: 'FORBIDDEN'})
    }
    if (
      this.config.registrationMode === 'invite-only' &&
      !this.config.registrationInviteCodes.includes(input.inviteCode ?? '')
    ) {
      throw Object.assign(new Error('Valid invitation required'), {code: 'FORBIDDEN'})
    }

    const handle = await assertHandleAvailable(this.db, input.handle)
    const existing = await this.db
      .selectFrom('greenfield_auth_identities')
      .select('identity_id')
      .where('kind', '=', 'email')
      .where('identifier', '=', email)
      .executeTakeFirst()
    if (existing) throw Object.assign(new Error('Email is already registered'), {code: 'CONFLICT'})

    const accountId = uuidv7()
    const verificationToken = randomBytes(32).toString('base64url')
    const now = new Date()
    const verificationExpiresAt = new Date(now.getTime() + this.config.emailVerificationTtlHours * 3_600_000)
    const passwordHash = await hashPassword(input.password)

    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_accounts')
        .values({
          account_id: accountId,
          primary_handle: handle,
          status: 'pendingVerification',
          created_at: now,
          updated_at: now,
        })
        .execute()
      await trx
        .insertInto('greenfield_handles')
        .values({handle, account_id: accountId, status: 'active', created_at: now})
        .execute()
      await trx
        .insertInto('greenfield_handle_history')
        .values({history_id: uuidv7(), account_id: accountId, handle, action: 'claimed', created_at: now})
        .execute()
      await trx
        .insertInto('greenfield_auth_identities')
        .values({
          identity_id: uuidv7(),
          account_id: accountId,
          kind: 'email',
          identifier: email,
          verified_at: null,
          metadata: {
            displayName,
            agreements: {
              terms: true,
              privacy: true,
              acceptedAt: now.toISOString(),
            },
          },
          created_at: now,
          updated_at: now,
        })
        .execute()
      await trx
        .insertInto('greenfield_password_credentials')
        .values({
          account_id: accountId,
          password_hash: passwordHash,
          params: {algorithm: 'argon2id'},
          updated_at: now,
        })
        .execute()
      await trx
        .insertInto('greenfield_email_verifications')
        .values({
          verification_id: uuidv7(),
          account_id: accountId,
          token_hash: tokenHash(verificationToken),
          expires_at: verificationExpiresAt,
          consumed_at: null,
          created_at: now,
        })
        .execute()
      await this.mail?.queueVerification(trx, {
        accountId,
        email,
        displayName,
        token: verificationToken,
        expiresAt: verificationExpiresAt,
        correlationId: input.correlationId,
      })
      await new AuditRepository(trx).append(
        'account.registered',
        {handle, agreements: {terms: true, privacy: true}},
        {type: 'greenfield_account', id: accountId, actorId: null},
        {accountId},
      )
    })

    // Preview/dev may return the verification token when SMTP is not configured.
    const result: {accountId: string; primaryHandle: string; status: string; verificationToken?: string} = {
      accountId,
      primaryHandle: handle,
      status: 'pendingVerification',
    }
    if (this.config.environment !== 'production') {
      result.verificationToken = verificationToken
    }
    return result
  }

  async verifyEmail(token: string): Promise<PublicAccount> {
    const row = await this.db
      .selectFrom('greenfield_email_verifications')
      .selectAll()
      .where('token_hash', '=', tokenHash(token))
      .where('consumed_at', 'is', null)
      .executeTakeFirst()
    if (!row || row.expires_at <= new Date()) {
      throw Object.assign(new Error('Invalid or expired verification token'), {code: 'UNAUTHENTICATED'})
    }

    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_email_verifications')
        .set({consumed_at: now})
        .where('verification_id', '=', row.verification_id)
        .execute()
      await trx
        .updateTable('greenfield_accounts')
        .set({status: 'active', updated_at: now})
        .where('account_id', '=', row.account_id)
        .execute()
      await trx
        .updateTable('greenfield_auth_identities')
        .set({verified_at: now, updated_at: now})
        .where('account_id', '=', row.account_id)
        .where('kind', '=', 'email')
        .execute()
      await new AuditRepository(trx).append(
        'email.verified',
        {},
        {type: 'greenfield_account', id: row.account_id, actorId: null},
        {accountId: row.account_id},
      )

      // Create default repository + initial collections + default profile record shell.
      const repositoryId = uuidv7()
      await trx
        .insertInto('greenfield_repositories')
        .values({
          repository_id: repositoryId,
          account_id: row.account_id,
          name: 'default',
          head_hash: null,
          revision: 0,
          created_at: now,
          updated_at: now,
        })
        .execute()
      for (const collection of GREENFIELD_INITIAL_COLLECTIONS) {
        await trx
          .insertInto('greenfield_collections')
          .values({
            collection_id: uuidv7(),
            repository_id: repositoryId,
            name: collection,
            schema_id: `${collection}@1`,
            created_at: now,
          })
          .execute()
      }
      const account = await trx
        .selectFrom('greenfield_accounts')
        .select('primary_handle')
        .where('account_id', '=', row.account_id)
        .executeTakeFirstOrThrow()
      const identity = await trx
        .selectFrom('greenfield_auth_identities')
        .select('metadata')
        .where('account_id', '=', row.account_id)
        .where('kind', '=', 'email')
        .executeTakeFirst()
      const metadata = identity?.metadata as {displayName?: unknown} | null | undefined
      const displayName = typeof metadata?.displayName === 'string' && metadata.displayName.trim()
        ? metadata.displayName.trim()
        : account.primary_handle
      const actorId = `actor-${row.account_id}`
      const profileId = `profile-${row.account_id}`
      await trx
        .insertInto('actors')
        .values({
          id: actorId,
          account_id: row.account_id,
          kind: 'person',
          created_at: now,
          updated_at: now,
          deleted_at: null,
          version: 1,
        })
        .execute()
      await trx
        .insertInto('profiles')
        .values({
          id: profileId,
          actor_id: actorId,
          handle: account.primary_handle,
          display_name: displayName,
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
          focus_status_message: 'Ready in Modula',
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
      await trx
        .insertInto('greenfield_records')
        .values({
          record_id: uuidv7(),
          repository_id: repositoryId,
          collection: 'modula.identity.profile',
          schema_id: 'modula.identity.profile',
          schema_version: 1,
          visibility: 'public',
          data: {displayName, handle: account.primary_handle},
          revision: 1,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        })
        .execute()
    })

    const account = await this.getMe(row.account_id)
    if (!account) throw Object.assign(new Error('Account not found'), {code: 'NOT_FOUND'})
    return account
  }

  async resendVerification(email: string, options: {correlationId?: string} = {}): Promise<{resent: boolean}> {
    const normalizedEmail = email.trim().toLowerCase()
    const identity = await this.db
      .selectFrom('greenfield_auth_identities')
      .innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_auth_identities.account_id')
      .select([
        'greenfield_auth_identities.account_id',
        'greenfield_auth_identities.metadata',
        'greenfield_accounts.status',
        'greenfield_accounts.primary_handle',
      ])
      .where('kind', '=', 'email')
      .where('identifier', '=', normalizedEmail)
      .executeTakeFirst()
    if (!identity || identity.status !== 'pendingVerification') {
      // Do not leak account existence.
      return {resent: true}
    }
    const token = randomBytes(32).toString('base64url')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.config.emailVerificationTtlHours * 3_600_000)
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_email_verifications')
        .set({consumed_at: now})
        .where('account_id', '=', identity.account_id)
        .where('consumed_at', 'is', null)
        .execute()
      await trx
        .insertInto('greenfield_email_verifications')
        .values({
          verification_id: uuidv7(),
          account_id: identity.account_id,
          token_hash: tokenHash(token),
          expires_at: expiresAt,
          consumed_at: null,
          created_at: now,
        })
        .execute()
      await this.mail?.queueVerification(trx, {
        accountId: identity.account_id,
        email: normalizedEmail,
        displayName: displayNameFromIdentityMetadata(identity.metadata, identity.primary_handle),
        token,
        expiresAt,
        correlationId: options.correlationId,
      })
    })
    return {resent: true}
  }

  async changePassword(
    accountId: string,
    input: {currentPassword?: string; newPassword?: string},
    options: {correlationId?: string} = {},
  ): Promise<{changed: true}> {
    const currentPassword = input.currentPassword ?? ''
    const newPassword = input.newPassword ?? ''
    if (newPassword.length < 10) {
      throw Object.assign(new Error('Password must be at least 10 characters'), {code: 'VALIDATION_FAILED'})
    }
    const identity = await this.db
      .selectFrom('greenfield_auth_identities')
      .innerJoin('greenfield_password_credentials', 'greenfield_password_credentials.account_id', 'greenfield_auth_identities.account_id')
      .innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_auth_identities.account_id')
      .select([
        'greenfield_auth_identities.identifier',
        'greenfield_auth_identities.metadata',
        'greenfield_password_credentials.password_hash',
        'greenfield_accounts.primary_handle',
      ])
      .where('greenfield_auth_identities.account_id', '=', accountId)
      .where('greenfield_auth_identities.kind', '=', 'email')
      .executeTakeFirst()
    if (!identity || !(await verifyPassword(currentPassword, identity.password_hash))) {
      throw Object.assign(new Error('Current password is invalid'), {code: 'UNAUTHENTICATED'})
    }
    const now = new Date()
    const passwordHash = await hashPassword(newPassword)
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_password_credentials')
        .set({password_hash: passwordHash, params: {algorithm: 'argon2id'}, updated_at: now})
        .where('account_id', '=', accountId)
        .execute()
      await trx
        .insertInto('greenfield_session_events')
        .values({
          event_id: uuidv7(),
          session_id: null,
          account_id: accountId,
          event_type: 'password.changed',
          metadata: {},
          created_at: now,
        })
        .execute()
      await this.mail?.queuePasswordChanged(trx, {
        accountId,
        email: identity.identifier,
        displayName: displayNameFromIdentityMetadata(identity.metadata, identity.primary_handle),
        correlationId: options.correlationId,
      })
    })
    return {changed: true}
  }

  async getMe(accountId: string): Promise<PublicAccount | null> {
    const row = await this.db
      .selectFrom('greenfield_accounts')
      .selectAll()
      .where('account_id', '=', accountId)
      .executeTakeFirst()
    if (!row) return null
    const identity = await this.db
      .selectFrom('greenfield_auth_identities')
      .select('identifier')
      .where('account_id', '=', accountId)
      .where('kind', '=', 'email')
      .executeTakeFirst()
    return {
      accountId: row.account_id,
      primaryHandle: row.primary_handle,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      email: identity?.identifier,
    }
  }

  async patchMe(accountId: string, _patch: Record<string, unknown>): Promise<PublicAccount> {
    // Phase 6R: profile fields live in repository records; account row is identity authority.
    const account = await this.getMe(accountId)
    if (!account) throw Object.assign(new Error('Account not found'), {code: 'NOT_FOUND'})
    return account
  }

  async changeHandle(accountId: string, requested: string): Promise<{handle: string; accountId: string}> {
    const handle = await assertHandleAvailable(this.db, requested)
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      const account = await trx
        .selectFrom('greenfield_accounts')
        .select('primary_handle')
        .where('account_id', '=', accountId)
        .executeTakeFirstOrThrow()
      await trx
        .updateTable('greenfield_handles')
        .set({status: 'released'})
        .where('handle', '=', account.primary_handle)
        .execute()
      await trx
        .insertInto('greenfield_handles')
        .values({handle, account_id: accountId, status: 'active', created_at: now})
        .execute()
      await trx
        .updateTable('greenfield_accounts')
        .set({primary_handle: handle, updated_at: now})
        .where('account_id', '=', accountId)
        .execute()
      await trx
        .insertInto('greenfield_handle_history')
        .values({history_id: uuidv7(), account_id: accountId, handle, action: 'changed', created_at: now})
        .execute()
      await new AuditRepository(trx).append(
        'handle.changed',
        {from: account.primary_handle, to: handle},
        {type: 'greenfield_account', id: accountId, actorId: null},
        {accountId},
      )
    })
    return {handle, accountId}
  }

  async handleAvailability(requested: string): Promise<{handle: string; available: boolean; reason?: string}> {
    try {
      const handle = validateHandle(requested)
      await assertHandleAvailable(this.db, handle)
      return {handle, available: true}
    } catch (error: any) {
      return {handle: canonicalHandle(requested), available: false, reason: error?.message ?? 'unavailable'}
    }
  }

  async handleHistory(accountId: string) {
    return this.db
      .selectFrom('greenfield_handle_history')
      .select(['history_id', 'handle', 'action', 'created_at'])
      .where('account_id', '=', accountId)
      .orderBy('created_at', 'desc')
      .execute()
  }
}
