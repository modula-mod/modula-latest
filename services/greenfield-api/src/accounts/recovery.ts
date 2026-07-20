import {createHash, randomBytes} from 'node:crypto'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {hashPassword} from '../lib/password.js'
import {uuidv7} from '../lib/uuidv7.js'

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export class RecoveryService {
  constructor(private readonly db: ModulaDb, private readonly config: AppConfig) {}
  async requestRecovery(email: string): Promise<{requested: true; recoveryToken?: string}> {
    const identity = await this.db.selectFrom('greenfield_auth_identities').select('account_id').where('kind', '=', 'email').where('identifier', '=', email.trim().toLowerCase()).executeTakeFirst()
    if (!identity) return {requested: true}
    const since = new Date(Date.now() - 60 * 60_000)
    const recent = await this.db.selectFrom('greenfield_recovery_tokens').select('token_id').where('account_id', '=', identity.account_id).where('created_at', '>', since).execute()
    if (recent.length >= 3) return {requested: true}
    const token = randomBytes(32).toString('base64url'), now = new Date()
    await this.db.insertInto('greenfield_recovery_tokens').values({token_id: uuidv7(), account_id: identity.account_id, token_hash: hashToken(token), expires_at: new Date(now.getTime() + 60 * 60_000), consumed_at: null, created_at: now}).execute()
    return this.config.environment === 'production' ? {requested: true} : {requested: true, recoveryToken: token}
  }
  async completeRecovery(token: string, password: string): Promise<void> {
    const recovery = await this.db.selectFrom('greenfield_recovery_tokens').selectAll().where('token_hash', '=', hashToken(token)).where('consumed_at', 'is', null).executeTakeFirst()
    if (!recovery || recovery.expires_at <= new Date()) throw Object.assign(new Error('Invalid or expired recovery token'), {code: 'NOT_FOUND'})
    const now = new Date(), passwordHash = await hashPassword(password)
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_recovery_tokens').set({consumed_at: now}).where('token_id', '=', recovery.token_id).execute()
      await trx.updateTable('greenfield_password_credentials').set({password_hash: passwordHash, params: {algorithm: 'argon2id'}, updated_at: now}).where('account_id', '=', recovery.account_id).execute()
      await trx.updateTable('greenfield_sessions').set({status: 'revoked', revoked_at: now}).where('account_id', '=', recovery.account_id).where('status', '=', 'active').execute()
      await trx.insertInto('greenfield_session_events').values({event_id: uuidv7(), session_id: null, account_id: recovery.account_id, event_type: 'recovery.completed', metadata: {}, created_at: now}).execute()
    })
  }
}
