import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'
import {isoBase64URL} from '@simplewebauthn/server/helpers'
import {sql, type Kysely, type Transaction} from 'kysely'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {uuidv7} from '../../lib/uuidv7.js'
import {authError} from '../errors.js'
import {ChallengeService} from '../challenges/service.js'
import {CredentialRegistryService} from '../credentials/service.js'
import {SecurityEventService} from '../security-events/service.js'
import {passkeyRelyingPartyConfig} from './rp.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>
const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

const PASSKEY_CHALLENGE_TTL_SECONDS = 5 * 60

export type PasskeyRegistrationOptions = {
  challengeId: string
  expiresAt: string
  rp: {name: string; id: string}
  options: PublicKeyCredentialCreationOptionsJSON
}

export type PasskeyAuthenticationOptions = {
  challengeId: string
  expiresAt: string
  rp: {name: string; id: string}
  options: PublicKeyCredentialRequestOptionsJSON
}

export type VerifiedPasskeyAuthentication = {
  accountId: string
  methodId: string
  passkeyId: string
}

export class PasskeyService {
  private readonly challenges: ChallengeService
  private readonly credentials: CredentialRegistryService
  private readonly securityEvents: SecurityEventService

  constructor(
    private readonly db: Db,
    private readonly config: Pick<AppConfig, 'publicWebUrl' | 'publicApiUrl' | 'allowedOrigins' | 'sessionPepper'>,
    services: {
      challenges?: ChallengeService
      credentials?: CredentialRegistryService
      securityEvents?: SecurityEventService
    } = {},
  ) {
    this.challenges = services.challenges ?? new ChallengeService(db, config)
    this.credentials = services.credentials ?? new CredentialRegistryService(db)
    this.securityEvents = services.securityEvents ?? new SecurityEventService(db)
  }

  forDb(db: Db): PasskeyService {
    return new PasskeyService(db, this.config, {
      challenges: this.challenges.forDb(db),
      credentials: this.credentials.forDb(db),
      securityEvents: this.securityEvents.forDb(db),
    })
  }

  async beginRegistration(accountId: string, input: {label?: string | null} = {}): Promise<PasskeyRegistrationOptions> {
    const account = await this.accountForPasskey(accountId)
    if (!account) throw authError('UNAUTHENTICATED')
    const rp = passkeyRelyingPartyConfig(this.config)
    const existing = await this.listActivePasskeyCredentials(accountId)
    const challenge = await this.challenges.create({
      purpose: 'passkey_registration',
      accountId,
      deliveryChannel: 'webauthn',
      ttlSeconds: PASSKEY_CHALLENGE_TTL_SECONDS,
      attemptLimit: 5,
      supersedeExisting: true,
      metadata: {label: input.label?.trim() || 'Passkey', rpID: rp.rpID},
    })
    const options = await generateRegistrationOptions({
      rpName: rp.rpName,
      rpID: rp.rpID,
      userName: account.primary_handle,
      userID: Buffer.from(account.account_id, 'utf8'),
      userDisplayName: displayNameFromMetadata(account.metadata, account.primary_handle),
      challenge: isoBase64URL.toBuffer(challenge.challenge),
      attestationType: 'none',
      excludeCredentials: existing.map(credential => ({id: credential.credential_id, transports: credential.transports})),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      preferredAuthenticatorType: 'localDevice',
      timeout: PASSKEY_CHALLENGE_TTL_SECONDS * 1000,
    })
    return {
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt.toISOString(),
      rp: {name: rp.rpName, id: rp.rpID},
      options,
    }
  }

  async verifyRegistration(input: {
    accountId: string
    challengeId: string
    response: RegistrationResponseJSON
    label?: string | null
    sessionId?: string | null
    ipHash?: string | null
    userAgent?: string | null
  }): Promise<{registered: true; passkeyId: string; methodId: string}> {
    const rp = passkeyRelyingPartyConfig(this.config)
    const challengeRow = await this.db
      .selectFrom('greenfield_auth_challenges')
      .select(['challenge_id', 'account_id', 'purpose', 'state', 'expires_at'])
      .where('challenge_id', '=', input.challengeId)
      .executeTakeFirst()
    if (!challengeRow || challengeRow.purpose !== 'passkey_registration' || challengeRow.account_id !== input.accountId) {
      throw authError('CHALLENGE_INVALID')
    }
    if (challengeRow.state === 'consumed') throw authError('CHALLENGE_REPLAYED')
    if (challengeRow.state !== 'pending') throw authError('CHALLENGE_INVALID')
    if (challengeRow.expires_at <= new Date()) throw authError('CHALLENGE_EXPIRED')
    const challengeValue = clientDataChallenge(input.response.response.clientDataJSON)
    const verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: challenge =>
        this.challenges.matchesOpaque({
          challengeId: input.challengeId,
          challenge,
          purpose: 'passkey_registration',
          accountId: input.accountId,
        }),
      expectedOrigin: rp.expectedOrigins,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
    }).catch(() => ({verified: false as const}))

    if (!verification.verified) throw authError('CHALLENGE_INVALID')
    await this.challenges.consumeOpaque({
      challengeId: input.challengeId,
      challenge: challengeValue,
      purpose: 'passkey_registration',
      accountId: input.accountId,
    })
    const credential = verification.registrationInfo.credential
    const existing = await this.db
      .selectFrom('greenfield_passkeys')
      .select('passkey_id')
      .where('credential_id', '=', credential.id)
      .executeTakeFirst()
    if (existing) throw authError('CONFLICT')

    const now = new Date()
    const passkeyId = uuidv7()
    const label = input.label?.trim() || 'Passkey'
    let methodId = ''
    await this.db.transaction().execute(async trx => {
      methodId = await this.credentials.forDb(trx).createPasskeyMethod({
        accountId: input.accountId,
        passkeyId,
        label,
        verifiedAt: now,
        metadata: {
          credentialDeviceType: verification.registrationInfo.credentialDeviceType,
          credentialBackedUp: verification.registrationInfo.credentialBackedUp,
          aaguid: verification.registrationInfo.aaguid,
          rpID: verification.registrationInfo.rpID ?? rp.rpID,
        },
      })
      await trx
        .insertInto('greenfield_passkeys')
        .values({
          passkey_id: passkeyId,
          account_id: input.accountId,
          credential_id: credential.id,
          public_key: Buffer.from(credential.publicKey),
          counter: credential.counter,
          transports: jsonb(credential.transports ?? input.response.response.transports ?? []),
          created_at: now,
          last_used_at: null,
          method_id: methodId,
          algorithm: String(input.response.response.publicKeyAlgorithm ?? ''),
          backup_eligible: verification.registrationInfo.credentialDeviceType === 'multiDevice',
          backup_state: verification.registrationInfo.credentialBackedUp,
          label,
          revoked_at: null,
        })
        .execute()
      await trx
        .insertInto('greenfield_auth_identities')
        .values({
          identity_id: uuidv7(),
          account_id: input.accountId,
          kind: 'passkey',
          identifier: credential.id,
          verified_at: now,
          metadata: jsonb({passkeyId, methodId, label}),
          created_at: now,
          updated_at: now,
        })
        .onConflict(oc => oc.columns(['kind', 'identifier']).doNothing())
        .execute()
      await this.securityEvents.forDb(trx).record({
        accountId: input.accountId,
        sessionId: input.sessionId ?? null,
        eventType: 'passkey.added',
        methodType: 'passkey',
        methodId,
        severity: 'notice',
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ?? null,
        metadata: {passkeyId, label},
        createdAt: now,
      })
    })
    return {registered: true, passkeyId, methodId}
  }

  async beginAuthentication(input: {email?: string | null; ipHash?: string | null} = {}): Promise<PasskeyAuthenticationOptions> {
    const normalizedEmail = input.email?.trim().toLowerCase() || null
    const account = normalizedEmail ? await this.accountForEmail(normalizedEmail) : null
    const passkeys = account ? await this.listActivePasskeyCredentials(account.account_id) : []
    const rp = passkeyRelyingPartyConfig(this.config)
    const challenge = await this.challenges.create({
      purpose: 'passkey_authentication',
      accountId: account?.account_id ?? null,
      subjectIdentifier: normalizedEmail,
      deliveryChannel: 'webauthn',
      ttlSeconds: PASSKEY_CHALLENGE_TTL_SECONDS,
      attemptLimit: 5,
      supersedeExisting: true,
      rateLimitKeys: [
        ...(normalizedEmail ? [`email:${normalizedEmail}`] : []),
        ...(input.ipHash ? [`ip:${input.ipHash}`] : []),
      ],
      metadata: {rpID: rp.rpID, allowCredentialCount: passkeys.length},
    })
    const options = await generateAuthenticationOptions({
      rpID: rp.rpID,
      challenge: isoBase64URL.toBuffer(challenge.challenge),
      userVerification: 'required',
      allowCredentials: passkeys.length
        ? passkeys.map(credential => ({id: credential.credential_id, transports: credential.transports}))
        : undefined,
      timeout: PASSKEY_CHALLENGE_TTL_SECONDS * 1000,
    })
    return {
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt.toISOString(),
      rp: {name: rp.rpName, id: rp.rpID},
      options,
    }
  }

  async verifyAuthentication(input: {
    challengeId: string
    response: AuthenticationResponseJSON
    sessionId?: string | null
    ipHash?: string | null
    userAgent?: string | null
  }): Promise<VerifiedPasskeyAuthentication> {
    const rp = passkeyRelyingPartyConfig(this.config)
    const passkey = await this.db
      .selectFrom('greenfield_passkeys')
      .selectAll()
      .where('credential_id', '=', input.response.id)
      .executeTakeFirst()
    if (!passkey || passkey.revoked_at) throw authError('PASSKEY_NOT_FOUND')
    const challenge = await this.db
      .selectFrom('greenfield_auth_challenges')
      .select(['challenge_id', 'account_id', 'purpose', 'state', 'expires_at'])
      .where('challenge_id', '=', input.challengeId)
      .executeTakeFirst()
    if (!challenge || challenge.purpose !== 'passkey_authentication') throw authError('CHALLENGE_INVALID')
    if (challenge.account_id && challenge.account_id !== passkey.account_id) throw authError('CHALLENGE_INVALID')
    if (challenge.state === 'consumed') throw authError('CHALLENGE_REPLAYED')
    if (challenge.state !== 'pending') throw authError('CHALLENGE_INVALID')
    if (challenge.expires_at <= new Date()) throw authError('CHALLENGE_EXPIRED')

    const challengeValue = clientDataChallenge(input.response.response.clientDataJSON)
    const verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: value =>
        this.challenges.matchesOpaque({
          challengeId: input.challengeId,
          challenge: value,
          purpose: 'passkey_authentication',
        }),
      expectedOrigin: rp.expectedOrigins,
      expectedRPID: rp.rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: new Uint8Array(passkey.public_key),
        counter: Number(passkey.counter),
        transports: transportsFromDb(passkey.transports),
      },
      requireUserVerification: true,
    }).catch(() => ({verified: false as const}))
    if (!verification.verified) throw authError('INVALID_CREDENTIALS')
    await this.challenges.consumeOpaque({
      challengeId: input.challengeId,
      challenge: challengeValue,
      purpose: 'passkey_authentication',
    })
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_passkeys')
        .set({
          counter: verification.authenticationInfo.newCounter,
          last_used_at: now,
          backup_eligible: verification.authenticationInfo.credentialDeviceType === 'multiDevice',
          backup_state: verification.authenticationInfo.credentialBackedUp,
        })
        .where('passkey_id', '=', passkey.passkey_id)
        .execute()
      if (passkey.method_id) await this.credentials.forDb(trx).markMethodUsed(passkey.method_id, now)
      await this.securityEvents.forDb(trx).record({
        accountId: passkey.account_id,
        sessionId: input.sessionId ?? null,
        eventType: 'passkey.used',
        methodType: 'passkey',
        methodId: passkey.method_id,
        severity: 'notice',
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ?? null,
        metadata: {passkeyId: passkey.passkey_id},
        createdAt: now,
      })
    })
    return {accountId: passkey.account_id, methodId: passkey.method_id ?? `passkey-${passkey.passkey_id}`, passkeyId: passkey.passkey_id}
  }

  async list(accountId: string) {
    const rows = await this.db
      .selectFrom('greenfield_passkeys')
      .select([
        'passkey_id',
        'credential_id',
        'transports',
        'created_at',
        'last_used_at',
        'algorithm',
        'backup_eligible',
        'backup_state',
        'label',
        'revoked_at',
      ])
      .where('account_id', '=', accountId)
      .orderBy('created_at', 'desc')
      .execute()
    return rows.map(row => ({
      passkeyId: row.passkey_id,
      credentialId: row.credential_id,
      transports: transportsFromDb(row.transports),
      createdAt: row.created_at.toISOString(),
      lastUsedAt: row.last_used_at?.toISOString() ?? null,
      algorithm: row.algorithm,
      backupEligible: row.backup_eligible,
      backupState: row.backup_state,
      label: row.label,
      revokedAt: row.revoked_at?.toISOString() ?? null,
    }))
  }

  async revoke(accountId: string, passkeyId: string, input: {sessionId?: string | null} = {}): Promise<{revoked: true}> {
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      const passkey = await trx
        .selectFrom('greenfield_passkeys')
        .select(['passkey_id', 'method_id'])
        .where('account_id', '=', accountId)
        .where('passkey_id', '=', passkeyId)
        .where('revoked_at', 'is', null)
        .forUpdate()
        .executeTakeFirst()
      if (!passkey) throw authError('PASSKEY_NOT_FOUND')
      await trx
        .updateTable('greenfield_passkeys')
        .set({revoked_at: now})
        .where('passkey_id', '=', passkey.passkey_id)
        .execute()
      if (passkey.method_id) {
        await trx
          .updateTable('greenfield_authentication_methods')
          .set({state: 'revoked', revoked_at: now, updated_at: now})
          .where('method_id', '=', passkey.method_id)
          .execute()
      }
      await this.securityEvents.forDb(trx).record({
        accountId,
        sessionId: input.sessionId ?? null,
        eventType: 'passkey.removed',
        methodType: 'passkey',
        methodId: passkey.method_id,
        severity: 'warning',
        metadata: {passkeyId},
        createdAt: now,
      })
    })
    return {revoked: true}
  }

  private async accountForPasskey(accountId: string) {
    return this.db
      .selectFrom('greenfield_accounts')
      .leftJoin('greenfield_auth_identities', join =>
        join
          .onRef('greenfield_auth_identities.account_id', '=', 'greenfield_accounts.account_id')
          .on('greenfield_auth_identities.kind', '=', 'email'),
      )
      .select([
        'greenfield_accounts.account_id',
        'greenfield_accounts.primary_handle',
        'greenfield_accounts.status',
        'greenfield_auth_identities.metadata',
      ])
      .where('greenfield_accounts.account_id', '=', accountId)
      .where('greenfield_accounts.status', '=', 'active')
      .executeTakeFirst()
  }

  private async accountForEmail(email: string): Promise<{account_id: string} | null> {
    const row = await this.db
      .selectFrom('greenfield_auth_identities')
      .innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_auth_identities.account_id')
      .select(['greenfield_auth_identities.account_id'])
      .where('greenfield_auth_identities.kind', '=', 'email')
      .where('greenfield_auth_identities.identifier', '=', email)
      .where('greenfield_auth_identities.verified_at', 'is not', null)
      .where('greenfield_accounts.status', '=', 'active')
      .executeTakeFirst()
    return row ?? null
  }

  private async listActivePasskeyCredentials(accountId: string): Promise<Array<{credential_id: string; transports?: AuthenticatorTransportFuture[]}>> {
    const rows = await this.db
      .selectFrom('greenfield_passkeys')
      .select(['credential_id', 'transports'])
      .where('account_id', '=', accountId)
      .where('revoked_at', 'is', null)
      .execute()
    return rows.map(row => ({credential_id: row.credential_id, transports: transportsFromDb(row.transports)}))
  }
}

function clientDataChallenge(clientDataJSON: string): string {
  const parsed = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8')) as {challenge?: unknown}
  if (typeof parsed.challenge !== 'string') throw authError('CHALLENGE_INVALID')
  return parsed.challenge
}

function transportsFromDb(value: unknown): AuthenticatorTransportFuture[] | undefined {
  if (!Array.isArray(value)) return undefined
  const transports = value.filter((item): item is AuthenticatorTransportFuture => typeof item === 'string')
  return transports.length ? transports : undefined
}

function displayNameFromMetadata(metadata: unknown, fallback: string): string {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const displayName = (metadata as Record<string, unknown>).displayName
    if (typeof displayName === 'string' && displayName.trim()) return displayName.trim()
  }
  return fallback
}
