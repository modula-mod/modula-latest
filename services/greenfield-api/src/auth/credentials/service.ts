import {sql, type Kysely, type Transaction} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import type {AuthenticationMethodType, AuthenticationStrength, Database} from '../../database/types.js'
import {uuidv7} from '../../lib/uuidv7.js'
import type {AuthenticationMethodSummary} from '../types.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>
const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export class CredentialRegistryService {
  constructor(private readonly db: Db) {}

  forDb(db: Db): CredentialRegistryService {
    return new CredentialRegistryService(db)
  }

  async listMethods(accountId: string): Promise<AuthenticationMethodSummary[]> {
    const rows = await this.db
      .selectFrom('greenfield_authentication_methods')
      .selectAll()
      .where('account_id', '=', accountId)
      .orderBy('created_at', 'asc')
      .execute()
    return rows.map(row => ({
      methodId: row.method_id,
      accountId: row.account_id,
      methodType: row.method_type,
      displayLabel: row.display_label,
      state: row.state,
      strength: row.strength,
      verifiedAt: row.verified_at,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
    }))
  }

  async findActivePasswordMethod(accountId: string): Promise<AuthenticationMethodSummary | null> {
    return this.findSingletonMethod(accountId, 'password')
  }

  async findActiveEmailOtpMethod(accountId: string): Promise<AuthenticationMethodSummary | null> {
    return this.findSingletonMethod(accountId, 'email_otp')
  }

  async createPasswordMethod(input: {accountId: string; verifiedAt: Date; metadata?: Record<string, unknown>}): Promise<string> {
    const now = input.verifiedAt
    const methodId = `password-${input.accountId}`
    const existing = await this.db
      .selectFrom('greenfield_authentication_methods')
      .select('method_id')
      .where('account_id', '=', input.accountId)
      .where('method_type', '=', 'password')
      .where('revoked_at', 'is', null)
      .executeTakeFirst()
    if (existing) {
      await this.db
        .updateTable('greenfield_authentication_methods')
        .set({
          state: 'active',
          strength: 'medium',
          verified_at: now,
          updated_at: now,
          metadata: jsonb(input.metadata ?? {algorithm: 'argon2id'}),
        })
        .where('method_id', '=', existing.method_id)
        .execute()
      return existing.method_id
    }
    await this.db
      .insertInto('greenfield_authentication_methods')
      .values({
        method_id: methodId,
        account_id: input.accountId,
        method_type: 'password',
        display_label: 'Password',
        state: 'active',
        strength: 'medium',
        verified_at: now,
        last_used_at: null,
        created_at: now,
        updated_at: now,
        revoked_at: null,
        metadata: jsonb(input.metadata ?? {algorithm: 'argon2id'}),
      })
      .execute()
    return methodId
  }

  async createEmailOtpMethod(input: {
    accountId: string
    email: string
    state: 'pending' | 'active'
    verifiedAt?: Date | null
    createdAt: Date
  }): Promise<string> {
    const methodId = `email-otp-${input.accountId}`
    const now = input.createdAt
    const existing = await this.db
      .selectFrom('greenfield_authentication_methods')
      .select('method_id')
      .where('account_id', '=', input.accountId)
      .where('method_type', '=', 'email_otp')
      .where('revoked_at', 'is', null)
      .executeTakeFirst()
    if (existing) {
      await this.db
        .updateTable('greenfield_authentication_methods')
        .set({
          state: input.state,
          verified_at: input.verifiedAt ?? null,
          updated_at: now,
          metadata: jsonb({email: input.email.trim().toLowerCase()}),
        })
        .where('method_id', '=', existing.method_id)
        .execute()
      return existing.method_id
    }
    await this.db
      .insertInto('greenfield_authentication_methods')
      .values({
        method_id: methodId,
        account_id: input.accountId,
        method_type: 'email_otp',
        display_label: 'Email code',
        state: input.state,
        strength: 'low',
        verified_at: input.verifiedAt ?? null,
        last_used_at: null,
        created_at: input.createdAt,
        updated_at: now,
        revoked_at: null,
        metadata: jsonb({email: input.email.trim().toLowerCase()}),
      })
      .execute()
    return methodId
  }

  async createTotpMethod(input: {
    accountId: string
    state: 'pending' | 'active'
    verifiedAt?: Date | null
    createdAt: Date
    metadata?: Record<string, unknown>
  }): Promise<string> {
    const methodId = `totp-${uuidv7()}`
    const now = input.createdAt
    await this.db
      .insertInto('greenfield_authentication_methods')
      .values({
        method_id: methodId,
        account_id: input.accountId,
        method_type: 'totp',
        display_label: 'Authenticator app',
        state: input.state,
        strength: input.state === 'active' ? 'strong' : 'medium',
        verified_at: input.verifiedAt ?? null,
        last_used_at: null,
        created_at: now,
        updated_at: now,
        revoked_at: null,
        metadata: jsonb(input.metadata ?? {algorithm: 'SHA1', digits: 6, periodSeconds: 30}),
      })
      .execute()
    return methodId
  }

  async createRecoveryCodeMethod(input: {
    accountId: string
    state: 'active' | 'disabled' | 'revoked'
    verifiedAt?: Date | null
    createdAt: Date
    metadata?: Record<string, unknown>
  }): Promise<string> {
    const now = input.createdAt
    const existing = await this.db
      .selectFrom('greenfield_authentication_methods')
      .select('method_id')
      .where('account_id', '=', input.accountId)
      .where('method_type', '=', 'recovery_code')
      .where('revoked_at', 'is', null)
      .executeTakeFirst()
    if (existing) {
      await this.db
        .updateTable('greenfield_authentication_methods')
        .set({
          state: input.state,
          strength: 'recovery',
          verified_at: input.verifiedAt ?? now,
          updated_at: now,
          metadata: jsonb(input.metadata ?? {}),
        })
        .where('method_id', '=', existing.method_id)
        .execute()
      return existing.method_id
    }
    const methodId = `recovery-code-${input.accountId}`
    await this.db
      .insertInto('greenfield_authentication_methods')
      .values({
        method_id: methodId,
        account_id: input.accountId,
        method_type: 'recovery_code',
        display_label: 'Recovery codes',
        state: input.state,
        strength: 'recovery',
        verified_at: input.verifiedAt ?? now,
        last_used_at: null,
        created_at: now,
        updated_at: now,
        revoked_at: null,
        metadata: jsonb(input.metadata ?? {}),
      })
      .execute()
    return methodId
  }

  async createPasskeyMethod(input: {
    accountId: string
    passkeyId: string
    label?: string | null
    verifiedAt: Date
    metadata?: Record<string, unknown>
  }): Promise<string> {
    const now = input.verifiedAt
    const methodId = `passkey-${input.passkeyId}`
    await this.db
      .insertInto('greenfield_authentication_methods')
      .values({
        method_id: methodId,
        account_id: input.accountId,
        method_type: 'passkey',
        display_label: input.label?.trim() || 'Passkey',
        state: 'active',
        strength: 'phishing_resistant',
        verified_at: now,
        last_used_at: null,
        created_at: now,
        updated_at: now,
        revoked_at: null,
        metadata: jsonb(input.metadata ?? {}),
      })
      .execute()
    return methodId
  }

  async activateEmailOtpMethod(accountId: string, verifiedAt: Date): Promise<void> {
    await this.db
      .updateTable('greenfield_authentication_methods')
      .set({
        state: 'active',
        verified_at: verifiedAt,
        updated_at: verifiedAt,
      })
      .where('account_id', '=', accountId)
      .where('method_type', '=', 'email_otp')
      .where('revoked_at', 'is', null)
      .execute()
  }

  async markMethodUsed(methodId: string, usedAt = new Date()): Promise<void> {
    await this.db
      .updateTable('greenfield_authentication_methods')
      .set({last_used_at: usedAt, updated_at: usedAt})
      .where('method_id', '=', methodId)
      .where('revoked_at', 'is', null)
      .execute()
  }

  private async findSingletonMethod(
    accountId: string,
    methodType: AuthenticationMethodType,
  ): Promise<AuthenticationMethodSummary | null> {
    const row = await this.db
      .selectFrom('greenfield_authentication_methods')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('method_type', '=', methodType)
      .where('state', '=', 'active')
      .where('revoked_at', 'is', null)
      .executeTakeFirst()
    if (!row) return null
    return {
      methodId: row.method_id,
      accountId: row.account_id,
      methodType: row.method_type,
      displayLabel: row.display_label,
      state: row.state,
      strength: row.strength as AuthenticationStrength,
      verifiedAt: row.verified_at,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
    }
  }
}
