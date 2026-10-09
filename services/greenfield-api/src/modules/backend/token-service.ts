import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto'
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
  targetProductId: string
  targetInstallationId: string
  serviceId: string
  actionId: string
  scope: {
    accountId: string
    productId: string
    installationId: string
    resourceType?: string
    resourceIds?: string[]
    operations: string[]
  }
  jti: string
  traceId: string
}

export type ExtensionInvocationScope = {
  type: 'installation' | 'resource' | 'action'
  ref: string | null
}

export type ResolvedServiceAssertion = {
  issuer: string
  subject: string
  consumerProductId: string
  consumerInstallationId: string
  targetServiceId: string
  targetProductId: string
  targetInstallationId: string
  actionId: string
  accountId: string
  actorId: string | null
  capabilities: string[]
  scope: ExtensionServiceClaims['scope']
  audience: string
  jti: string
  requestId: string
  traceId: string
  issuedAt: Date
  expiresAt: Date
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
    traceId?: string
    extensionInvocation?: {
      consumerProductId: string
      targetProductId: string
      targetInstallationId: string
      actionId: string
      serviceId: string
      scope: ExtensionInvocationScope
    }
  }): Promise<IssuedModuleBackendToken> {
    if (input.context.permissionReviewRequired) throw moduleError('PERMISSION_REVIEW_REQUIRED', 'Module permission review is required')
    if (input.backend.authentication?.tokenExchangeRequired !== true) throw moduleError('FORBIDDEN', 'Module backend token exchange is required')
    const nowSeconds = Math.floor(Date.now() / 1000)
    const ttl = Math.min(input.backend.authentication?.tokenTtlSeconds ?? 900, 900)
    const jti = input.extensionInvocation ? `extension-assertion:${uuidv7()}` : null
    const requestId = input.requestId ?? jti ?? `module-session-request:${uuidv7()}`
    const traceId = input.traceId ?? requestId
    const extensionClaims: Partial<ExtensionServiceClaims> = input.extensionInvocation ? {
      consumer: input.extensionInvocation.consumerProductId,
      target: input.extensionInvocation.serviceId,
      targetProductId: input.extensionInvocation.targetProductId,
      targetInstallationId: input.extensionInvocation.targetInstallationId,
      serviceId: input.extensionInvocation.serviceId,
      actionId: input.extensionInvocation.actionId,
      scope: {
        accountId: input.context.accountId,
        productId: input.extensionInvocation.targetProductId,
        installationId: input.extensionInvocation.targetInstallationId,
        ...(input.extensionInvocation.scope.type === 'resource' && input.extensionInvocation.scope.ref ? {
          resourceType: 'moduleRecord',
          resourceIds: [input.extensionInvocation.scope.ref],
        } : {}),
        operations: Array.from(new Set([...input.permissions, ...input.capabilities, input.extensionInvocation.actionId])).sort(),
      },
      jti: jti!,
      traceId,
    } : {}
    const claims: ModuleSessionClaims & Partial<ExtensionServiceClaims> = {
      issuer: this.config.publicApiUrl,
      audience: input.backend.authentication?.audience ?? `modula-module:${input.context.moduleId}`,
      subject: input.extensionInvocation ? 'service.greenfield.gateway' : input.actorId,
      accountId: input.context.accountId,
      actorId: input.actorId,
      installationId: input.context.installationId,
      moduleId: input.context.moduleId,
      permissions: Array.from(new Set(input.permissions)).sort(),
      capabilities: Array.from(new Set(input.capabilities)).sort(),
      sessionId: `module-session:${uuidv7()}`,
      issuedAt: nowSeconds,
      expiresAt: nowSeconds + ttl,
      requestId,
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
          request_id: claims.requestId!,
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

  async resolveServiceAssertion(rawToken: string, expectedTargetProductId?: string): Promise<ResolvedServiceAssertion | null> {
    if (!rawToken || rawToken.length < 16 || rawToken.length > 4096) return null
    const tokenHash = sha256(rawToken)
    const [session, assertion] = await Promise.all([
      this.db.selectFrom('module_backend_sessions').selectAll().where('token_hash', '=', tokenHash).executeTakeFirst(),
      this.db.selectFrom('greenfield_extension_service_assertions').selectAll().where('token_hash', '=', tokenHash).executeTakeFirst(),
    ])
    if (!session || !assertion || session.revoked_at || assertion.revoked_at || assertion.consumed_at) return null
    const now = Date.now()
    if (session.expires_at.getTime() <= now || assertion.expires_at.getTime() <= now) return null
    const claims = this.verify(rawToken) as (ModuleSessionClaims & Partial<ExtensionServiceClaims>) | null
    if (!claims || !hasServiceAssertionClaims(claims)) return null
    if (claims.issuer !== this.config.publicApiUrl || claims.audience !== session.audience) return null
    if (claims.sessionId !== session.session_id || claims.installationId !== assertion.consumer_installation_id) return null
    if (claims.moduleId !== session.module_id || claims.actorId !== session.actor_id || claims.subject !== 'service.greenfield.gateway') return null
    if (claims.accountId !== assertion.account_id || claims.consumer !== assertion.consumer_product_id) return null
    if (claims.target !== assertion.service_id || claims.serviceId !== assertion.service_id) return null
    if (claims.targetProductId !== assertion.target_product_id || claims.targetInstallationId !== assertion.target_installation_id) return null
    if (claims.actionId !== assertion.action_id || claims.jti !== assertion.jti) return null
    if (claims.requestId !== assertion.request_id || claims.scope.accountId !== assertion.account_id) return null
    if (claims.scope.productId !== assertion.target_product_id || claims.scope.installationId !== assertion.target_installation_id) return null
    if (expectedTargetProductId && claims.targetProductId !== expectedTargetProductId) return null
    const capabilities = arrayOfStrings(assertion.capabilities)
    const permissions = arrayOfStrings(session.permissions)
    if (!sameStrings(permissions, claims.permissions) || !sameStrings(capabilities, claims.capabilities) || !sameStrings(capabilities, arrayOfStrings(session.capabilities))) return null
    if (!sameStrings(claims.scope.operations, [...new Set([...permissions, ...capabilities, assertion.action_id])])) return null
    if (!scopeMatchesAssertion(claims.scope, assertion.scope_type, assertion.scope_ref)) return null
    if (claims.issuedAt * 1000 !== assertion.issued_at.getTime() || claims.expiresAt * 1000 !== assertion.expires_at.getTime()) return null
    const consumed = await this.db
      .updateTable('greenfield_extension_service_assertions')
      .set({consumed_at: new Date()})
      .where('assertion_id', '=', assertion.assertion_id)
      .where('consumed_at', 'is', null)
      .returning('assertion_id')
      .executeTakeFirst()
    if (!consumed) return null
    return {
      issuer: claims.issuer,
      subject: claims.subject,
      consumerProductId: claims.consumer,
      consumerInstallationId: assertion.consumer_installation_id,
      targetServiceId: claims.target,
      targetProductId: claims.targetProductId,
      targetInstallationId: claims.targetInstallationId,
      actionId: claims.actionId,
      accountId: claims.accountId,
      actorId: session.actor_id,
      capabilities,
      scope: claims.scope,
      audience: claims.audience,
      jti: claims.jti,
      requestId: claims.requestId,
      traceId: claims.traceId,
      issuedAt: assertion.issued_at,
      expiresAt: assertion.expires_at,
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
    const actualSignature = Buffer.from(signature ?? '', 'utf8')
    const expectedSignature = Buffer.from(expected, 'utf8')
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null
    try {
      const header = JSON.parse(Buffer.from(encodedHeader!, 'base64url').toString('utf8')) as Record<string, unknown>
      if (header.alg !== 'HS256' || header.typ !== 'modula-module-session+jwt' || header.kid !== 'greenfield-module-token-v1') return null
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

function sameStrings(left: string[], right: string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
}

function hasServiceAssertionClaims(claims: ModuleSessionClaims & Partial<ExtensionServiceClaims>): claims is ModuleSessionClaims & ExtensionServiceClaims {
  return Boolean(
    claims.consumer &&
    claims.target &&
    claims.targetProductId &&
    claims.targetInstallationId &&
    claims.serviceId &&
    claims.actionId &&
    claims.jti &&
    claims.traceId &&
    claims.requestId &&
    claims.scope &&
    claims.scope.accountId &&
    claims.scope.productId &&
    claims.scope.installationId &&
    Array.isArray(claims.scope.operations),
  )
}

function scopeMatchesAssertion(scope: ExtensionServiceClaims['scope'], scopeType: ExtensionInvocationScope['type'], scopeRef: string | null): boolean {
  if (scopeType === 'resource') {
    return Boolean(scopeRef && scope.resourceType === 'moduleRecord' && sameStrings(scope.resourceIds ?? [], [scopeRef]))
  }
  return !scope.resourceType && (scope.resourceIds?.length ?? 0) === 0
}
