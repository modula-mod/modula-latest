import {createHash, randomBytes} from 'node:crypto'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {hashPassword} from '../lib/password.js'
import {uuidv7} from '../lib/uuidv7.js'
import {displayNameFromIdentityMetadata, MailService} from '../mail/service.js'
import {CredentialRegistryService} from '../auth/credentials/service.js'
import {SecurityEventService} from '../auth/security-events/service.js'

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export class RecoveryService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
    private readonly mail?: MailService,
    private readonly credentials = new CredentialRegistryService(db),
    private readonly securityEvents = new SecurityEventService(db),
  ) {}
  async requestRecovery(email: string, options: {correlationId?: string} = {}): Promise<{requested: true; recoveryToken?: string}> {
    const normalizedEmail = email.trim().toLowerCase()
    const identity = await this.db
      .selectFrom('greenfield_auth_identities')
      .innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_auth_identities.account_id')
      .select([
        'greenfield_auth_identities.account_id',
        'greenfield_auth_identities.metadata',
        'greenfield_accounts.primary_handle',
      ])
      .where('kind', '=', 'email')
      .where('identifier', '=', normalizedEmail)
      .executeTakeFirst()
    if (!identity) return {requested: true}
    const since = new Date(Date.now() - 60 * 60_000)
    const recent = await this.db.selectFrom('greenfield_recovery_tokens').select('token_id').where('account_id', '=', identity.account_id).where('created_at', '>', since).execute()
    if (recent.length >= 3) return {requested: true}
    const token = randomBytes(32).toString('base64url'), now = new Date()
    const expiresAt = new Date(now.getTime() + 60 * 60_000)
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_recovery_tokens').values({token_id: uuidv7(), account_id: identity.account_id, token_hash: hashToken(token), expires_at: expiresAt, consumed_at: null, created_at: now}).execute()
      await this.mail?.queuePasswordReset(trx, {
        accountId: identity.account_id,
        email: normalizedEmail,
        displayName: displayNameFromIdentityMetadata(identity.metadata, identity.primary_handle),
        handle: identity.primary_handle,
        token,
        expiresAt,
        correlationId: options.correlationId,
      })
    })
    return this.config.environment === 'production' ? {requested: true} : {requested: true, recoveryToken: token}
  }
  async completeRecovery(token: string, password: string, options: {correlationId?: string} = {}): Promise<void> {
    if (password.length < 10) {
      throw Object.assign(new Error('Password must be at least 10 characters'), {code: 'VALIDATION_FAILED'})
    }
    const recovery = await this.db.selectFrom('greenfield_recovery_tokens').selectAll().where('token_hash', '=', hashToken(token)).where('consumed_at', 'is', null).executeTakeFirst()
    if (!recovery || recovery.expires_at <= new Date()) throw Object.assign(new Error('Invalid or expired recovery token'), {code: 'NOT_FOUND'})
    const identity = await this.db
      .selectFrom('greenfield_auth_identities')
      .innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_auth_identities.account_id')
      .select([
        'greenfield_auth_identities.identifier',
        'greenfield_auth_identities.metadata',
        'greenfield_accounts.primary_handle',
      ])
      .where('greenfield_auth_identities.account_id', '=', recovery.account_id)
      .where('kind', '=', 'email')
      .executeTakeFirst()
    if (!identity) throw Object.assign(new Error('Account email identity not found'), {code: 'NOT_FOUND'})
    const now = new Date(), passwordHash = await hashPassword(password)
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_recovery_tokens').set({consumed_at: now}).where('token_id', '=', recovery.token_id).execute()
      await trx.updateTable('greenfield_password_credentials').set({password_hash: passwordHash, params: {algorithm: 'argon2id'}, updated_at: now}).where('account_id', '=', recovery.account_id).execute()
      await this.credentials.forDb(trx).createPasswordMethod({
        accountId: recovery.account_id,
        verifiedAt: now,
        metadata: {algorithm: 'argon2id', source: 'password_reset'},
      })
      await trx.updateTable('greenfield_sessions').set({status: 'revoked', revoked_at: now}).where('account_id', '=', recovery.account_id).where('status', '=', 'active').execute()
      await trx.insertInto('greenfield_session_events').values({event_id: uuidv7(), session_id: null, account_id: recovery.account_id, event_type: 'recovery.completed', metadata: {}, created_at: now}).execute()
      await this.securityEvents.forDb(trx).record({
        accountId: recovery.account_id,
        eventType: 'password.reset.completed',
        methodType: 'password',
        methodId: `password-${recovery.account_id}`,
        severity: 'warning',
        metadata: {sessionsRevoked: true},
      })
      await this.mail?.queuePasswordChanged(trx, {
        accountId: recovery.account_id,
        email: identity.identifier,
        displayName: displayNameFromIdentityMetadata(identity.metadata, identity.primary_handle),
        correlationId: options.correlationId,
      })
    })
  }
}
