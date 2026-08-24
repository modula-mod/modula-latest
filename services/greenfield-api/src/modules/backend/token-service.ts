import {createHash, createHmac, randomBytes} from 'node:crypto'
import {sql} from 'kysely'
import type {ModuleBackendDefinition, ModuleSessionClaims} from '@modula/greenfield-module-manifest'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import {uuidv7} from '../../lib/uuidv7.js'
import {moduleError} from '../module-errors.js'
import type {GreenfieldModuleRuntimeContext} from '../runtime-access.js'
import {ModuleBackendRepository} from './repository.js'

export type IssuedModuleBackendToken = {
  token: string
  claims: ModuleSessionClaims & Partial<ExtensionServiceClaims>
  expiresAt: Date
}

export type ExtensionServiceClaims = {
  consumer: string
  target: string
  actionId: string
  scope: {type: 'installation' | 'resource' | 'action'; ref: string | null}
  jti: string
}

export type ResolvedModuleBackendToken = {
  sessionId: string
  installationId: string
  moduleId: string
  accountId: string
  actorId: string | null
  permissions: string[]
  capabilities: string[]
  expiresAt: Date
}

export class ModuleBackendTokenService {
  private readonly repository: ModuleBackendRepository

  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {
    this.repository = new ModuleBackendRepository(db)
  }

  async issue(input: {
    context: GreenfieldModuleRuntimeContext
    backend: ModuleBackendDefinition
    actorId: string
    permissions: string[]
    capabilities: string[]
    requestId?: string
    extensionInvocation?: {
      consumerProductId: string
      targetProductId: string
      targetInstallationId: string
      actionId: string
      serviceId: string
      scope: ExtensionServiceClaims['scope']
    }
  }): Promise<IssuedModuleBackendToken> {
    if (input.backend.authentication?.tokenExchangeRequired !== true) throw moduleError('FORBIDDEN', 'Module backend token exchange is required')
    const nowSeconds = Math.floor(Date.now() / 1000)
    const ttl = Math.min(input.backend.authentication?.tokenTtlSeconds ?? 900, 900)
    const extensionClaims: Partial<ExtensionServiceClaims> = input.extensionInvocation ? {
      consumer: input.extensionInvocation.consumerProductId,
      target: input.extensionInvocation.targetProductId,
      actionId: input.extensionInvocation.actionId,
      scope: input.extensionInvocation.scope,
      jti: `extension-assertion:${uuidv7()}`,
    } : {}
    const claims: ModuleSessionClaims & Partial<ExtensionServiceClaims> = {
      issuer: this.config.publicApiUrl,
      audience: input.backend.authentication?.audience ?? `modula-module:${input.context.moduleId}`,
      subject: input.actorId,
      accountId: input.context.accountId,
      actorId: input.actorId,
      installationId: input.context.installationId,
      moduleId: input.context.moduleId,
      permissions: Array.from(new Set(input.permissions)).sort(),
      capabilities: Array.from(new Set(input.capabilities)).sort(),
      sessionId: `module-session:${uuidv7()}`,
      issuedAt: nowSeconds,
      expiresAt: nowSeconds + ttl,
      requestId: input.requestId,
      ...extensionClaims,
    }
    const token = this.sign(claims)
    await this.repository.recordSession({context: input.context, claims, token, requestId: input.requestId})
    if (input.extensionInvocation && claims.jti) {
      await this.db
        .insertInto('greenfield_extension_service_assertions')
        .values({
          assertion_id: `extension-service-assertion:${uuidv7()}`,
          jti: claims.jti,
          account_id: input.context.accountId,
          consumer_installation_id: input.context.installationId,
          consumer_product_id: input.extensionInvocation.consumerProductId,
          target_installation_id: input.extensionInvocation.targetInstallationId,
          target_product_id: input.extensionInvocation.targetProductId,
          service_id: input.extensionInvocation.serviceId,
          action_id: input.extensionInvocation.actionId,
          capabilities: sql`${JSON.stringify(Array.from(new Set(input.capabilities)).sort())}::jsonb`,
          scope_type: input.extensionInvocation.scope.type,
          scope_ref: input.extensionInvocation.scope.ref,
          token_hash: sha256(token),
          raw_user_bearer_forwarded: false,
          request_id: input.requestId ?? claims.jti,
          issued_at: new Date(claims.issuedAt * 1000),
          expires_at: new Date(claims.expiresAt * 1000),
          consumed_at: null,
          revoked_at: null,
          created_at: new Date(),
        })
        .execute()
    }
    return {token, claims, expiresAt: new Date(claims.expiresAt * 1000)}
  }

  async resolve(rawToken: string): Promise<ResolvedModuleBackendToken | null> {
    if (!rawToken || rawToken.length < 16 || rawToken.length > 4096) return null
    const row = await this.db
      .selectFrom('module_backend_sessions')
      .selectAll()
      .where('token_hash', '=', sha256(rawToken))
      .executeTakeFirst()
    if (!row || row.revoked_at || row.expires_at.getTime() <= Date.now()) return null
    const claims = this.verify(rawToken)
    if (!claims || claims.sessionId !== row.session_id || claims.moduleId !== row.module_id || claims.installationId !== row.installation_id) return null
    return {
      sessionId: row.session_id,
      installationId: row.installation_id,
      moduleId: row.module_id,
      accountId: row.account_id,
      actorId: row.actor_id,
      permissions: arrayOfStrings(row.permissions),
      capabilities: arrayOfStrings(row.capabilities),
      expiresAt: row.expires_at,
    }
  }

  private sign(claims: ModuleSessionClaims & Partial<ExtensionServiceClaims>): string {
    const header = {alg: 'HS256', typ: 'modula-module-session+jwt', kid: 'greenfield-module-token-v1'}
    const encodedHeader = base64url(JSON.stringify(header))
    const encodedClaims = base64url(JSON.stringify(claims))
    const signature = createHmac('sha256', signingKey(this.config)).update(`${encodedHeader}.${encodedClaims}`).digest('base64url')
    return `${encodedHeader}.${encodedClaims}.${signature}.${randomBytes(8).toString('base64url')}`
  }

  private verify(token: string): ModuleSessionClaims | null {
    const parts = token.split('.')
    if (parts.length !== 4) return null
    const [encodedHeader, encodedClaims, signature] = parts
    const expected = createHmac('sha256', signingKey(this.config)).update(`${encodedHeader}.${encodedClaims}`).digest('base64url')
    if (signature !== expected) return null
    try {
      return JSON.parse(Buffer.from(encodedClaims!, 'base64url').toString('utf8')) as ModuleSessionClaims
    } catch {
      return null
    }
  }
}

function signingKey(config: AppConfig): string {
  if (config.checkpointSigningKey) return config.checkpointSigningKey
  if (config.sessionPepper) return config.sessionPepper
  if (config.environment === 'production') throw moduleError('CAPABILITY_DISABLED', 'Module backend token signing key is not configured')
  return 'development-module-backend-token-signing-key'
}

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
