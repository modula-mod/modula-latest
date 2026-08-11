import type {ModulaDb} from '../database/client.js'
import {verifyPassword} from '../lib/password.js'
import {displayNameFromIdentityMetadata, MailService} from '../mail/service.js'
import {GreenfieldSessionService} from '../sessions/service.js'
import {authError} from '../auth/errors.js'
import {CredentialRegistryService} from '../auth/credentials/service.js'
import {SecurityEventService} from '../auth/security-events/service.js'

export class AuthenticationService {
  constructor(
    private readonly db: ModulaDb,
    private readonly sessions: GreenfieldSessionService,
    private readonly mail?: MailService,
    private readonly credentials = new CredentialRegistryService(db),
    private readonly securityEvents = new SecurityEventService(db),
  ) {}
  async login(email: string, password: string, context?: {userAgent?: string; ipHash?: string; correlationId?: string}) {
    const identity = await this.db
      .selectFrom('greenfield_auth_identities')
      .innerJoin('greenfield_password_credentials', 'greenfield_password_credentials.account_id', 'greenfield_auth_identities.account_id')
      .innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_auth_identities.account_id')
      .select([
        'greenfield_auth_identities.account_id',
        'greenfield_auth_identities.identifier',
        'greenfield_auth_identities.metadata',
        'greenfield_password_credentials.password_hash',
        'greenfield_accounts.primary_handle',
        'greenfield_accounts.status',
      ])
      .where('greenfield_auth_identities.kind', '=', 'email')
      .where('greenfield_auth_identities.identifier', '=', email.trim().toLowerCase())
      .executeTakeFirst()
    if (!identity || !(await verifyPassword(password, identity.password_hash))) {
      throw authError('INVALID_CREDENTIALS')
    }
    if (identity.status === 'suspended') throw authError('ACCOUNT_SUSPENDED')
    if (identity.status !== 'active') throw authError('INVALID_CREDENTIALS')
    const passwordMethod = await this.credentials.findActivePasswordMethod(identity.account_id)
    if (!passwordMethod) throw authError('AUTH_METHOD_UNAVAILABLE')
    const issued = await this.sessions.issue(identity.account_id, {
      ...context,
      authenticationMethodId: passwordMethod.methodId,
      authenticationStrength: passwordMethod.strength,
      recentAuthenticationAt: new Date(),
    })
    await this.credentials.markMethodUsed(passwordMethod.methodId)
    await this.securityEvents.record({
      accountId: identity.account_id,
      sessionId: issued.sessionId,
      eventType: 'sign_in',
      methodType: 'password',
      methodId: passwordMethod.methodId,
      severity: 'notice',
      ipHash: context?.ipHash ?? null,
      userAgent: context?.userAgent ?? null,
      metadata: {},
    })
    await this.mail?.queueNewSignIn({
      accountId: identity.account_id,
      email: identity.identifier,
      displayName: displayNameFromIdentityMetadata(identity.metadata, identity.primary_handle),
      correlationId: context?.correlationId,
    })
    return issued
  }
}
