import type {ModulaDb} from '../database/client.js'
import {verifyPassword} from '../lib/password.js'
import {GreenfieldSessionService} from '../sessions/service.js'

export class AuthenticationService {
  constructor(private readonly db: ModulaDb, private readonly sessions: GreenfieldSessionService) {}
  async login(email: string, password: string, context?: {userAgent?: string; ipHash?: string}) {
    const identity = await this.db.selectFrom('greenfield_auth_identities').innerJoin('greenfield_password_credentials', 'greenfield_password_credentials.account_id', 'greenfield_auth_identities.account_id').innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_auth_identities.account_id').select(['greenfield_auth_identities.account_id', 'greenfield_password_credentials.password_hash', 'greenfield_accounts.status']).where('greenfield_auth_identities.kind', '=', 'email').where('greenfield_auth_identities.identifier', '=', email.trim().toLowerCase()).executeTakeFirst()
    if (!identity || identity.status !== 'active' || !(await verifyPassword(password, identity.password_hash))) {
      throw Object.assign(new Error('Invalid credentials'), {code: 'UNAUTHENTICATED'})
    }
    return this.sessions.issue(identity.account_id, context)
  }
}
