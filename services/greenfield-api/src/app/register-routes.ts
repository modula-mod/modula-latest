import {
  ADMIN_SESSION_CAPABILITIES,
  PHASE6_PREVIEW_CAPABILITIES,
  PREVIEW_ACTOR_CAPABILITIES,
  isModulaHandle,
  type AtmosphereFeedMode,
  type CreatePostInput,
  type CreateReportInput,
  type ModerationActionType,
  type ReportStatus,
  type SearchType,
  type UpdatePostInput,
} from '@modula/api-contracts'
import {createHash} from 'node:crypto'
import {MODULA_PROTOCOL_VERSION} from '@modula/protocol-contracts'
import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {AtprotoService} from '../bridges/atproto/service.js'
import {RecoveryService} from '../accounts/recovery.js'
import {AccountService} from '../accounts/service.js'
import {AuthenticationService} from '../authentication/service.js'
import {ExtensionRegistry} from '../extensions/extension-registry.js'
import {InstallationService} from '../extensions/installation-service.js'
import {FunctionService} from '../functions/service.js'
import {GreenfieldSessionService} from '../sessions/service.js'
import {GreenfieldEventReplayService} from '../events/index.js'
import {RepositoryService} from '../repositories/service.js'
import {RecordService} from '../records/service.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {BoardLayoutService} from '../domains/board/service.js'
import {DiscoveryRepository} from '../domains/discovery/repository.js'
import {ModerationRepository} from '../domains/moderation/repository.js'
import {PostMediaStorage} from '../domains/media/post-media-storage.js'
import {NotificationPreferencesService} from '../domains/notifications/preferences.js'
import {NotificationRepository} from '../domains/notifications/repository.js'
import {retryReactionNotificationDeadLetter} from '../domains/notifications/reaction-dead-letter-retry.js'
import {GreenfieldPolicyEngine} from '../domains/policy/index.js'
import {PostRepository} from '../domains/posts/repository.js'
import {PostWriteService} from '../domains/posts/writes.js'
import {ReactionService} from '../domains/reactions/service.js'
import {PostShareService, type PostShareChannel} from '../domains/shares/service.js'
import {ProfileRepository} from '../domains/profiles/repository.js'
import {ProfileWriteService} from '../domains/profiles/writes.js'
import {GreenfieldSearchService} from '../domains/search/index.js'
import {GreenfieldEngineRegistryService} from '../domains/engines/service.js'
import {checkReadiness} from '../domains/system/health.js'
import {
  GreenfieldConnectorProviderRegistry,
  TrustedConnectorAdapterRegistry,
  loadGreenfieldConnectorProviderDefinitions,
} from '../connectors/index.js'
import {ConnectorCredentialService} from '../domains/connectors/credentials/index.js'
import {ConnectorConnectionService} from '../domains/connectors/connections/index.js'
import {ConnectorOAuthStateService} from '../domains/connectors/oauth-state/index.js'
import {displayNameFromIdentityMetadata, MailService} from '../mail/service.js'
import {MailIdentityService} from '../mail/identity-service.js'
import {attachAuth, attachGreenfieldAccountAuth, requireAuth, requireCapability} from '../security/auth-context.js'
import {SessionService} from '../security/session.js'
import {assertSafeHttpsUrl, isBlockedIp} from '../security/ssrf.js'
import {TotpService} from '../auth/mfa/totp.js'
import {RecoveryCodeService} from '../auth/mfa/recovery-codes.js'
import {PasskeyService} from '../auth/passkeys/service.js'
import {AppleAuthenticationService} from '../auth/apple/service.js'
import {evaluateStepUpRequirement, type SensitiveAuthAction} from '../auth/step-up/policy.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {decodeCursor, parseLimit, toCursorPage} from '../transport/pagination.js'
import {registerModuleRoutes} from '../modules/routes/index.js'
import {registerAiRoutes} from '../ai/index.js'
import {registerPhase6sRoutes} from './register-phase6s-routes.js'
import {registerPhase7fStoriesRoutes} from './register-phase7f-stories-routes.js'
import {registerPushRoutes} from './register-push-routes.js'
import {registerMessagingRoutes} from './register-messaging-routes.js'
import {registerMolibooGameRoutes} from './register-moliboo-game-routes.js'
import {registerPremiumRoutes} from '../premium/routes.js'
import type {PremiumAppleVerifier} from '../premium/apple-verifier.js'
import {setPublicIdentityProjectionEnabled} from '../premium/badges.js'
import {sendBrowserVisibleMedia} from './media-response.js'
import {registerBackendFabricRoutes} from '../backend-fabric/routes.js'
import {registerDeveloperRoutes} from '../developers/routes.js'
import {registerPublisherConsoleRoutes, type PublisherConsoleTestOptions} from '../publisher/routes.js'
import {registerGubicPlayRoutes} from '../gubic/routes.js'
import {registerEntitlementRoutes} from '../entitlements/routes.js'
import {registerAccountDataRoutes} from '../account-data/routes.js'
import {registerSupportRoutes} from '../support/routes.js'
import {registerSettingsV2Routes} from '../settings-v2/routes.js'
import {registerProviderRoutes} from '../providers/routes.js'
import {registerIntelligenceRoutes} from '../intelligence/index.js'
import {registerAttachmentRoutes} from './register-attachment-routes.js'
import {registerComposerRoutes} from './register-composer-routes.js'
import {registerCommunitiesRoutes} from './register-communities-routes.js'
import {registerCollectionsDraftsRoutes} from './register-collections-drafts-routes.js'
import {registerMolibooRoutes} from './register-moliboo-routes.js'

function sendError(reply: any, code: any, message: string, requestId: string) {
  return reply.code(statusForError(code)).send(failureEnvelope(code, message, requestId))
}

function mapDomainError(reply: any, error: any, requestId: string, fallback: string) {
  const code = error?.code
  if (
    code === 'VALIDATION_FAILED' ||
    code === 'NOT_FOUND' ||
    code === 'FORBIDDEN' ||
    code === 'CONFLICT' ||
    code === 'UNAUTHENTICATED' ||
    code === 'INVALID_CREDENTIALS' ||
    code === 'CHALLENGE_EXPIRED' ||
    code === 'CHALLENGE_INVALID' ||
    code === 'CHALLENGE_REPLAYED' ||
    code === 'RATE_LIMITED' ||
    code === 'STEP_UP_REQUIRED' ||
    code === 'PASSKEY_NOT_FOUND' ||
    code === 'AUTH_METHOD_UNAVAILABLE' ||
    code === 'ACCOUNT_SUSPENDED' ||
    code === 'CAPABILITY_DISABLED'
  ) {
    return sendError(reply, code, error.message ?? fallback, requestId)
  }
  return sendError(reply, 'SERVER_ERROR', fallback, requestId)
}

function bodyString(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return ''
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function requestIpHash(request: {ip?: string}, config: AppConfig): string | undefined {
  const ip = request.ip?.trim()
  if (!ip) return undefined
  return createHash('sha256').update(`${config.sessionPepper ?? ''}:ip:${ip}`).digest('hex')
}

function releaseIdentity(config: AppConfig) {
  const releaseSha = process.env.MODULA_RELEASE_SHA ?? 'unknown'
  const workerReleaseSha = process.env.MODULA_WORKER_RELEASE_SHA ?? releaseSha
  const mailProvisionerReleaseSha = process.env.MODULA_MAIL_PROVISIONER_RELEASE_SHA ?? workerReleaseSha
  const mailProvisionerMode =
    process.env.MODULA_MAIL_PROVISIONER_MODE ?? (config.environment === 'production' ? 'disabled' : 'dry-run')

  return {
    app: 'modula',
    service: 'greenfield-api',
    version: '0.1.0',
    phase: 'phase7i-f5b',
    commit: releaseSha,
    builtAt: process.env.MODULA_RELEASE_BUILT_AT ?? null,
    releaseId: process.env.MODULA_RELEASE_ID ?? releaseSha,
    expectedMigration: process.env.MODULA_EXPECTED_MIGRATION ?? null,
    environment: config.environment,
    apiOrigin: config.publicApiUrl,
    worker: {
      service: 'greenfield-worker',
      expectedCommit: workerReleaseSha,
    },
    mailProvisioner: {
      service: 'modula-mail-provisioner',
      expectedCommit: mailProvisionerReleaseSha,
      mode: mailProvisionerMode,
    },
  }
}

export async function registerRoutes(app: FastifyInstance, db: ModulaDb, config: AppConfig, options: {publisherConsole?: PublisherConsoleTestOptions, premiumAppleVerifier?: PremiumAppleVerifier | null} = {}) {
  app.addContentTypeParser('application/octet-stream', (request, payload, done) => done(null, payload))
  const profiles = new ProfileRepository(db)
  const posts = new PostRepository(db, config.publicApiUrl)
  const discovery = new DiscoveryRepository(db, config.publicApiUrl)
  const sessions = new SessionService(db, config)
  const postWrites = new PostWriteService(db, config)
  const reactions = new ReactionService(db)
  const postShares = new PostShareService(db)
  const postMediaStorage = new PostMediaStorage(config)
  const profileWrites = new ProfileWriteService(db)
  const moderation = new ModerationRepository(db)
  const notifications = new NotificationRepository(db)
  const notificationPreferences = new NotificationPreferencesService(db)
  const policies = new GreenfieldPolicyEngine(db)
  const search = new GreenfieldSearchService(db, config)
  const engines = new GreenfieldEngineRegistryService(db)
  const boardLayouts = new BoardLayoutService(db)
  const atproto = new AtprotoService(db, config)
  const greenfieldSessions = new GreenfieldSessionService(db, config)
  const eventReplays = new GreenfieldEventReplayService(db)
  const mail = new MailService(db, config)
  const mailIdentities = new MailIdentityService(db)
  const accounts = new AccountService(db, config, mail)
  const recovery = new RecoveryService(db, config, mail)
  const authentication = new AuthenticationService(db, config, greenfieldSessions, mail)
  const totp = new TotpService(db, config)
  const recoveryCodes = new RecoveryCodeService(db, config)
  const passkeys = new PasskeyService(db, config)
  const appleAuthentication = new AppleAuthenticationService(db, config, greenfieldSessions)
  const repositories = new RepositoryService(db)
  const records = new RecordService(db)
  const extensions = new ExtensionRegistry(db)
  const installations = new InstallationService(db)
  const functions = new FunctionService(db)
  const connectorProviders = new GreenfieldConnectorProviderRegistry()
  connectorProviders.registerMany(loadGreenfieldConnectorProviderDefinitions())
  const connectorAdapters = new TrustedConnectorAdapterRegistry()
  const connectorCredentials = new ConnectorCredentialService(db, config)
  const connectorConnections = new ConnectorConnectionService(db, connectorProviders)
  const connectorOAuthStates = new ConnectorOAuthStateService(db, config, connectorProviders)

  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/v1/atproto') && !config.atprotoEnabled) {
      return reply
        .code(statusForError('CAPABILITY_DISABLED'))
        .send(failureEnvelope('CAPABILITY_DISABLED', 'AT Protocol bridge is disabled', request.id))
    }
    await attachAuth(request, sessions)
    await attachGreenfieldAccountAuth(request, {
      resolveAccess: token => greenfieldSessions.resolveAccess(token),
      resolveActorForAccount: async accountId => {
        const actor = await db
          .selectFrom('actors')
          .innerJoin('profiles', 'profiles.actor_id', 'actors.id')
          .select(['actors.id as actorId', 'profiles.handle as handle'])
          .where('actors.account_id', '=', accountId)
          .where('actors.deleted_at', 'is', null)
          .where('profiles.deleted_at', 'is', null)
          .orderBy('actors.created_at', 'asc')
          .executeTakeFirst()
        if (!actor) return null
        return {actorId: actor.actorId, handle: actor.handle ?? null}
      },
      adminHandles: config.adminHandles,
    })
  })

  const healthConfig = config.rateLimitEnabled ? {config: {rateLimit: {max: 120, timeWindow: '1 minute'}}} : {}
  const feedConfig = config.rateLimitEnabled ? {config: {rateLimit: {max: 60, timeWindow: '1 minute'}}} : {}
  const profileConfig = config.rateLimitEnabled ? {config: {rateLimit: {max: 120, timeWindow: '1 minute'}}} : {}
  const writeConfig = config.rateLimitEnabled ? {config: {rateLimit: {max: 30, timeWindow: '1 minute'}}} : {}
  const profileIdWriteConfig = {
    ...writeConfig,
    schema: {params: {type: 'object', additionalProperties: false, required: ['profileId'], properties: {profileId: {type: 'string', minLength: 1, maxLength: 200}}}},
  }
  const followRequestListConfig = {
    ...profileConfig,
    schema: {querystring: {type: 'object', additionalProperties: false, properties: {limit: {type: 'integer', minimum: 1, maximum: 100}, cursor: {type: 'string', minLength: 1, maxLength: 200}}}},
  }
  const followRequestActionConfig = {
    ...writeConfig,
    schema: {params: {type: 'object', additionalProperties: false, required: ['requestId'], properties: {requestId: {type: 'string', format: 'uuid'}}}},
  }
  const reactionDeadLetterRetryConfig = {
    ...writeConfig,
    schema: {
      params: {type: 'object', additionalProperties: false, required: ['jobId'], properties: {jobId: {type: 'string', minLength: 1, maxLength: 200, pattern: '^[A-Za-z0-9._:-]+$'}}},
      body: {type: 'object', additionalProperties: false, properties: {reason: {type: 'string', minLength: 1, maxLength: 500, pattern: '\\S'}}},
    },
  }

  const mutationsAllowed = config.mutationsEnabled
  await registerAttachmentRoutes(app, db, config, {writeConfig, feedConfig, mutationsAllowed})
  await registerComposerRoutes(app, db, {feedConfig, publicApiUrl: config.publicApiUrl})
  await registerCommunitiesRoutes(app, db, config, {profileConfig, writeConfig, mutationsAllowed})
  await registerCollectionsDraftsRoutes(app, db, config, {profileConfig, writeConfig, mutationsAllowed})

  app.get('/version.json', healthConfig, async (_request, reply) => {
    return reply.header('Cache-Control', 'no-store').send(releaseIdentity(config))
  })

  app.get('/v1/version', healthConfig, async (request, reply) => {
    return reply.header('Cache-Control', 'no-store').send(successEnvelope(releaseIdentity(config), request.id))
  })

  app.get('/v1/health/live', healthConfig, async (request, reply) => {
    return reply.send(successEnvelope({status: 'live'}, request.id))
  })

  app.get('/v1/health/ready', healthConfig, async (request, reply) => {
    try {
      const ready = await checkReadiness(db, config)
      if (!ready.ok) {
        return sendError(reply, 'SERVER_ERROR', `API not ready: ${ready.reason}`, request.id)
      }
      return reply.send(successEnvelope({status: 'ready'}, request.id))
    } catch {
      return sendError(reply, 'SERVER_ERROR', 'API not ready', request.id)
    }
  })

  app.get('/v1/meta', healthConfig, async (request, reply) => {
    const environment = config.environment === 'development' ? 'preview' : config.environment
    const capabilities = {
      ...PHASE6_PREVIEW_CAPABILITIES,
      authentication: true,
      appleAuthentication: appleAuthentication.status().configured,
      mutations: mutationsAllowed,
      greenfieldAccounts: true,
      greenfieldSessions: true,
      greenfieldRepositories: true,
      greenfieldExtensions: true,
      greenfieldModuleRegistry: config.moduleRegistryEnabled,
      greenfieldModuleInstallation: config.moduleInstallationEnabled,
      greenfieldModuleDeclarativeContributions: config.moduleDeclarativeContributionsEnabled,
      greenfieldModuleFirstPartyExecution: config.moduleFirstPartyExecutionEnabled,
      greenfieldModuleRemoteFunctions: config.moduleRemoteFunctionsEnabled,
      greenfieldModuleCommunityExecution: config.moduleCommunityExecutionEnabled,
      greenfieldModuleGithubSync: config.moduleGithubSyncEnabled,
      greenfieldVaultNotesReference: config.vaultNotesReferenceEnabled,
      greenfieldDimon: config.dimonEnabled,
      greenfieldAiGateway: config.aiGatewayEnabled,
      modulaMail: true,
      inviteOnly: config.inviteOnly,
      atproto: config.atprotoEnabled,
      atprotoOAuth: config.atprotoEnabled,
      atprotoPublishing: config.atprotoEnabled,
      atprotoImport: config.atprotoEnabled,
      pdsPilot: config.pdsPilotEnabled,
      atprotoBridgeOptional: true,
    }
    return reply.send(
      successEnvelope(
        {
          apiVersion: 'v1' as const,
          protocolVersion: MODULA_PROTOCOL_VERSION,
          backend: 'greenfield',
          environment,
          minimumClientVersion: config.minimumClientVersion,
          registration: {
            mode: config.registrationMode,
            emailVerificationRequired: true,
          },
          authentication: {
            apple: appleAuthentication.status(),
          },
          capabilities,
          engines: await engines.publicTopology(),
        },
        request.id,
      ),
    )
  })

  app.get('/oauth/atproto/web-client-metadata.json', async (_request, reply) => {
    return reply.type('application/json').code(200).send(atproto.webClientMetadata())
  })

  app.get('/oauth/atproto/native-client-metadata.json', async (_request, reply) => {
    return reply.type('application/json').code(200).send(atproto.nativeClientMetadata())
  })

  app.post('/v1/auth/preview/session', writeConfig, async (request, reply) => {
    if (!(config.environment === 'development' || config.environment === 'preview' || config.nodeEnv === 'test')) {
      return sendError(reply, 'FORBIDDEN', 'Preview session mint is disabled', request.id)
    }
    if (!mutationsAllowed && config.environment === 'preview') {
      return sendError(reply, 'CAPABILITY_DISABLED', 'Preview writes are disabled', request.id)
    }
    const body = request.body as {handle?: string}
    const handle = body?.handle?.trim()
    if (!handle || !isModulaHandle(handle)) {
      return sendError(reply, 'VALIDATION_FAILED', 'Valid handle required', request.id)
    }
    const profile = await profiles.getByHandle(handle)
    if (!profile) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
    const actor = await db
      .selectFrom('profiles')
      .select('actor_id')
      .where('id', '=', profile.id)
      .executeTakeFirstOrThrow()
    const isAdminHandle = config.adminHandles.includes(handle.toLowerCase())
    const grantedCapabilities = isAdminHandle
      ? Array.from(new Set([...PREVIEW_ACTOR_CAPABILITIES, ...ADMIN_SESSION_CAPABILITIES]))
      : PREVIEW_ACTOR_CAPABILITIES
    const created = await sessions.createSession(actor.actor_id, grantedCapabilities)
    return reply.send(
      successEnvelope(
        {
          accessToken: created.token,
          session: created.session,
        },
        request.id,
      ),
    )
  })

  const requireGreenfieldAuth = async (request: any, reply: any) => {
    const header = request.headers.authorization
    const resolved = header?.startsWith('Bearer ')
      ? await greenfieldSessions.resolveAccess(header.slice(7).trim())
      : null
    if (!resolved) {
      sendError(reply, 'UNAUTHENTICATED', 'Authentication required', request.id)
      return null
    }
    return resolved
  }

  const requireStepUp = (action: SensitiveAuthAction, auth: Awaited<ReturnType<typeof requireGreenfieldAuth>>, reply: any, requestId: string) => {
    if (!auth) return false
    const evaluation = evaluateStepUpRequirement(action, {
      recentAuthenticationAt: auth.recentAuthenticationAt,
      authenticationStrength: auth.authenticationStrength,
    })
    if (!evaluation.allowed) {
      sendError(reply, 'STEP_UP_REQUIRED', 'Recent stronger authentication required', requestId)
      return false
    }
    return true
  }

  const accountPrimaryEmail = async (accountId: string) => {
    return db
      .selectFrom('greenfield_auth_identities')
      .innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_auth_identities.account_id')
      .select([
        'greenfield_auth_identities.identifier',
        'greenfield_auth_identities.metadata',
        'greenfield_accounts.primary_handle',
      ])
      .where('greenfield_auth_identities.account_id', '=', accountId)
      .where('greenfield_auth_identities.kind', '=', 'email')
      .where('greenfield_auth_identities.verified_at', 'is not', null)
      .orderBy('greenfield_auth_identities.created_at', 'asc')
      .executeTakeFirst()
  }

  const resolveSearchActorContext = async (request: any) => {
    const header = request.headers.authorization
    const resolved = header?.startsWith('Bearer ')
      ? await greenfieldSessions.resolveAccess(header.slice(7).trim())
      : null
    let greenfieldActorId: string | null = null
    if (resolved?.accountId) {
      const actor = await db
        .selectFrom('actors')
        .select('id')
        .where('account_id', '=', resolved.accountId)
        .where('deleted_at', 'is', null)
        .orderBy('created_at', 'asc')
        .executeTakeFirst()
      greenfieldActorId = actor?.id ?? null
    }
    return {
      actorId: greenfieldActorId ?? request.auth?.actorId ?? null,
      accountId: resolved?.accountId ?? null,
      capabilities: request.auth?.capabilities ? Array.from(request.auth.capabilities).map(String) : [],
      requestId: request.id,
      correlationId: request.id,
    }
  }

  const authWriteConfig = config.rateLimitEnabled
    ? {config: {rateLimit: {max: 10, timeWindow: '1 minute'}}}
    : {}

  app.post('/v1/accounts/register', authWriteConfig, async (request, reply) => {
    try {
      const body = ((request.body as any) ?? {}) as Record<string, unknown>
      return reply.code(201).send(
        successEnvelope(
          await accounts.register({
            ...body,
            email: bodyString(body, 'email'),
            password: bodyString(body, 'password'),
            handle: bodyString(body, 'handle'),
            displayName: bodyString(body, 'displayName'),
            inviteCode: bodyString(body, 'inviteCode'),
            correlationId: request.id,
            ipHash: requestIpHash(request, config),
          } as any),
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Registration failed')
    }
  })
  app.post('/v1/accounts/verify-email', authWriteConfig, async (request, reply) => {
    try {
      const token = bodyString(request.body, 'token')
      const account = token
        ? await accounts.verifyEmail(token)
        : await accounts.verifyEmailCode({
            challengeId: bodyString(request.body, 'challengeId'),
            code: bodyString(request.body, 'code'),
          })
      return reply.send(successEnvelope({verified: true, account}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Verification failed')
    }
  })
  app.post('/v1/accounts/resend-verification', authWriteConfig, async (request, reply) => {
    try {
      return reply.send(
        successEnvelope(
          await accounts.resendVerification((request.body as any).email ?? '', {
            correlationId: request.id,
            ipHash: requestIpHash(request, config),
          }),
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Resend failed')
    }
  })
  app.post('/v1/accounts/forgot-password', authWriteConfig, async (request, reply) => {
    try {
      return reply.send(successEnvelope(await recovery.requestRecovery((request.body as any).email ?? '', {correlationId: request.id}), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Recovery request failed')
    }
  })
  app.post('/v1/accounts/reset-password', authWriteConfig, async (request, reply) => {
    try {
      const body = ((request.body as any) ?? {}) as {token?: string; newPassword?: string}
      await recovery.completeRecovery(body.token ?? '', body.newPassword ?? '', {correlationId: request.id})
      return reply.send(successEnvelope({reset: true}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Password reset failed')
    }
  })
  app.get('/v1/accounts/handles/:handle/availability', profileConfig, async (request, reply) => {
    const {handle} = request.params as {handle: string}
    return reply.send(successEnvelope(await accounts.handleAvailability(handle), request.id))
  })
  app.get('/v1/accounts/mail-local-parts/:localPart/availability', profileConfig, async (request, reply) => {
    try {
      const {localPart} = request.params as {localPart: string}
      return reply.send(successEnvelope(await mailIdentities.availability(localPart), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Modula Mail availability lookup failed')
    }
  })
  app.get('/v1/accounts/me', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    return reply.send(successEnvelope(await accounts.getMe(auth.accountId), request.id))
  })
  app.get('/v1/accounts/me/modula-mail', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    return reply.send(successEnvelope(await mailIdentities.getForAccount(auth.accountId), request.id))
  })
  app.post('/v1/accounts/me/modula-mail/provision', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const result = await db.transaction().execute(trx => mailIdentities.queueProvisioningForVerifiedAccount(trx, auth.accountId))
      return reply.code(202).send(successEnvelope(result, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Modula Mail provisioning request failed')
    }
  })
  app.post('/v1/accounts/me/modula-mail/forwarding', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    if (!requireStepUp('change_mail_forwarding', auth, reply, request.id)) return
    try {
      const body = ((request.body as any) ?? {}) as {enabled?: boolean; destination?: string | null; keepLocalCopy?: boolean}
      const result = await mailIdentities.updateForwarding(auth.accountId, {
        enabled: Boolean(body.enabled),
        destination: body.destination ?? null,
        keepLocalCopy: body.keepLocalCopy ?? true,
        requestedByAccountId: auth.accountId,
      })
      const email = await accountPrimaryEmail(auth.accountId)
      if (email) {
        await mail.queueMailForwardingChanged({
          accountId: auth.accountId,
          email: email.identifier,
          displayName: displayNameFromIdentityMetadata(email.metadata, email.primary_handle),
          correlationId: request.id,
        })
      }
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Modula Mail forwarding update failed')
    }
  })
  app.patch('/v1/accounts/me', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await accounts.patchMe(auth.accountId, (request.body as any) ?? {}), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Account update failed')
    }
  })
  app.post('/v1/accounts/me/handle', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(
        successEnvelope(await accounts.changeHandle(auth.accountId, (request.body as any).handle ?? ''), request.id),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Handle change failed')
    }
  })
  app.post('/v1/accounts/me/password', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const body = ((request.body as any) ?? {}) as {currentPassword?: string; newPassword?: string}
      const changed = await accounts.changePassword(auth.accountId, body, {correlationId: request.id})
      await greenfieldSessions.revokeOtherSessions(auth.accountId, auth.sessionId)
      return reply.send(successEnvelope(changed, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Password change failed')
    }
  })

  await registerModuleRoutes(app, db, config, greenfieldSessions, {profileConfig, writeConfig})
  await registerIntelligenceRoutes(app, db, greenfieldSessions, {profileConfig, writeConfig}, config)
  await registerBackendFabricRoutes(app, db, config)
  await registerAiRoutes(app, db, config, greenfieldSessions, {profileConfig, writeConfig})
  app.get('/v1/accounts/:accountId/handle-history', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    const {accountId} = request.params as {accountId: string}
    if (accountId !== auth.accountId && accountId !== 'me') {
      return sendError(reply, 'FORBIDDEN', 'Handle history is private', request.id)
    }
    return reply.send(successEnvelope(await accounts.handleHistory(auth.accountId), request.id))
  })
  app.get('/v1/accounts/me/sessions', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    return reply.send(successEnvelope(await greenfieldSessions.listSessions(auth.accountId), request.id))
  })
  app.delete('/v1/accounts/me/sessions', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    if (!requireStepUp('revoke_all_sessions', auth, reply, request.id)) return
    await greenfieldSessions.revokeAllForAccount(auth.accountId)
    return reply.send(successEnvelope({revoked: true}, request.id))
  })

  app.post('/v1/auth/totp/enroll', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    if (!requireStepUp('enable_totp', auth, reply, request.id)) return
    try {
      return reply.send(
        successEnvelope(
          await totp.beginEnrollment(auth.accountId, {label: bodyString(request.body, 'label')}),
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'TOTP enrollment failed')
    }
  })
  app.post('/v1/auth/totp/verify', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const result = await totp.verifyEnrollment({
        accountId: auth.accountId,
        challengeId: bodyString(request.body, 'challengeId'),
        code: bodyString(request.body, 'code'),
        sessionId: auth.sessionId,
        ipHash: requestIpHash(request, config) ?? null,
        userAgent: request.headers['user-agent'],
      })
      const email = await accountPrimaryEmail(auth.accountId)
      if (email) {
        await mail.queueAuthenticatorEnabled({
          accountId: auth.accountId,
          email: email.identifier,
          displayName: displayNameFromIdentityMetadata(email.metadata, email.primary_handle),
          correlationId: request.id,
        })
      }
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'TOTP verification failed')
    }
  })
  app.post('/v1/auth/totp/disable', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    if (!requireStepUp('disable_totp', auth, reply, request.id)) return
    try {
      const result = await totp.disable({
        accountId: auth.accountId,
        sessionId: auth.sessionId,
        ipHash: requestIpHash(request, config) ?? null,
        userAgent: request.headers['user-agent'],
      })
      const email = await accountPrimaryEmail(auth.accountId)
      if (email) {
        await mail.queueAuthenticatorDisabled({
          accountId: auth.accountId,
          email: email.identifier,
          displayName: displayNameFromIdentityMetadata(email.metadata, email.primary_handle),
          correlationId: request.id,
        })
      }
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'TOTP disable failed')
    }
  })
  app.post('/v1/auth/step-up/totp', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const result = await totp.verifyActiveTotp({
        accountId: auth.accountId,
        code: bodyString(request.body, 'code'),
        sessionId: auth.sessionId,
        ipHash: requestIpHash(request, config) ?? null,
        userAgent: request.headers['user-agent'],
      })
      await greenfieldSessions.markRecentlyAuthenticated(auth.sessionId, auth.accountId, {
        authenticationMethodId: result.methodId,
        authenticationStrength: 'strong',
      })
      return reply.send(successEnvelope({stepUp: true, authenticationStrength: 'strong'}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Step-up failed')
    }
  })
  app.get('/v1/auth/passkeys', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    return reply.send(successEnvelope(await passkeys.list(auth.accountId), request.id))
  })

  app.get('/v1/auth/apple/status', healthConfig, async (request, reply) => {
    return reply.send(successEnvelope(appleAuthentication.status(), request.id))
  })
  app.post('/v1/auth/apple/link/options', authWriteConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    if (!requireStepUp('link_external_identity', auth, reply, request.id)) return
    try {
      return reply.send(successEnvelope(await appleAuthentication.beginLink(auth.accountId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Apple linking failed')
    }
  })
  app.post('/v1/auth/apple/link', authWriteConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    if (!requireStepUp('link_external_identity', auth, reply, request.id)) return
    try {
      return reply.send(
        successEnvelope(
          await appleAuthentication.completeLink({
            accountId: auth.accountId,
            challengeId: bodyString(request.body, 'challengeId'),
            nonce: bodyString(request.body, 'nonce'),
            idToken: bodyString(request.body, 'idToken'),
            sessionId: auth.sessionId,
            ipHash: requestIpHash(request, config) ?? null,
            userAgent: request.headers['user-agent'],
          }),
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Apple linking failed')
    }
  })
  app.post('/v1/auth/passkeys/registration/options', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    if (!requireStepUp('add_passkey', auth, reply, request.id)) return
    try {
      return reply.send(
        successEnvelope(
          await passkeys.beginRegistration(auth.accountId, {label: bodyString(request.body, 'label')}),
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Passkey registration failed')
    }
  })
  app.post('/v1/auth/passkeys/registration/verify', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const body = ((request.body as any) ?? {}) as {challengeId?: string; response?: any; label?: string}
      const result = await passkeys.verifyRegistration({
        accountId: auth.accountId,
        challengeId: body.challengeId ?? '',
        response: body.response,
        label: body.label ?? null,
        sessionId: auth.sessionId,
        ipHash: requestIpHash(request, config) ?? null,
        userAgent: request.headers['user-agent'],
      })
      const email = await accountPrimaryEmail(auth.accountId)
      if (email) {
        await mail.queuePasskeyAdded({
          accountId: auth.accountId,
          email: email.identifier,
          displayName: displayNameFromIdentityMetadata(email.metadata, email.primary_handle),
          correlationId: request.id,
        })
      }
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Passkey verification failed')
    }
  })
  app.delete('/v1/auth/passkeys/:passkeyId', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    if (!requireStepUp('remove_passkey', auth, reply, request.id)) return
    try {
      const {passkeyId} = request.params as {passkeyId: string}
      const result = await passkeys.revoke(auth.accountId, passkeyId, {sessionId: auth.sessionId})
      const email = await accountPrimaryEmail(auth.accountId)
      if (email) {
        await mail.queuePasskeyRemoved({
          accountId: auth.accountId,
          email: email.identifier,
          displayName: displayNameFromIdentityMetadata(email.metadata, email.primary_handle),
          correlationId: request.id,
        })
      }
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Passkey removal failed')
    }
  })
  app.get('/v1/auth/recovery-codes', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    return reply.send(successEnvelope(await recoveryCodes.remaining(auth.accountId), request.id))
  })
  app.post('/v1/auth/recovery-codes/regenerate', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    if (!requireStepUp('regenerate_recovery_codes', auth, reply, request.id)) return
    try {
      return reply.send(
        successEnvelope(
          await recoveryCodes.regenerate(auth.accountId, {sessionId: auth.sessionId, reason: 'manual'}),
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Recovery-code regeneration failed')
    }
  })

  app.post('/v1/sessions', authWriteConfig, async (request, reply) => {
    try {
      const issued = await authentication.login(bodyString(request.body, 'email'), bodyString(request.body, 'password'), {
        userAgent: request.headers['user-agent'],
        correlationId: request.id,
      })
      return reply.send(
        successEnvelope(
          {
            accessToken: issued.accessToken,
            refreshToken: issued.refreshToken,
            sessionId: issued.sessionId,
            accessExpiresAt: issued.accessExpiresAt.toISOString(),
            refreshExpiresAt: issued.refreshExpiresAt.toISOString(),
          },
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Sign-in failed')
    }
  })
  app.post('/v1/sessions/email-code/request', authWriteConfig, async (request, reply) => {
    try {
      return reply.send(
        successEnvelope(
          await authentication.requestEmailLoginCode(bodyString(request.body, 'email'), {
            ipHash: requestIpHash(request, config),
            correlationId: request.id,
          }),
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Email code request failed')
    }
  })
  app.post('/v1/sessions/email-code', authWriteConfig, async (request, reply) => {
    try {
      const issued = await authentication.loginWithEmailCode(
        bodyString(request.body, 'email'),
        bodyString(request.body, 'challengeId'),
        bodyString(request.body, 'code'),
        {
          userAgent: request.headers['user-agent'],
          ipHash: requestIpHash(request, config),
          correlationId: request.id,
        },
      )
      return reply.send(
        successEnvelope(
          {
            accessToken: issued.accessToken,
            refreshToken: issued.refreshToken,
            sessionId: issued.sessionId,
            accessExpiresAt: issued.accessExpiresAt.toISOString(),
            refreshExpiresAt: issued.refreshExpiresAt.toISOString(),
          },
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Email code sign-in failed')
    }
  })
  app.post('/v1/sessions/recovery-code', authWriteConfig, async (request, reply) => {
    try {
      const issued = await authentication.loginWithRecoveryCode(
        bodyString(request.body, 'email'),
        bodyString(request.body, 'code'),
        {
          userAgent: request.headers['user-agent'],
          ipHash: requestIpHash(request, config),
          correlationId: request.id,
        },
      )
      return reply.send(
        successEnvelope(
          {
            accessToken: issued.accessToken,
            refreshToken: issued.refreshToken,
            sessionId: issued.sessionId,
            accessExpiresAt: issued.accessExpiresAt.toISOString(),
            refreshExpiresAt: issued.refreshExpiresAt.toISOString(),
            recoveryCodesRemaining: issued.recoveryCodesRemaining,
          },
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Recovery-code sign-in failed')
    }
  })
  app.post('/v1/sessions/passkey/options', authWriteConfig, async (request, reply) => {
    try {
      return reply.send(
        successEnvelope(
          await passkeys.beginAuthentication({
            email: bodyString(request.body, 'email') || null,
            ipHash: requestIpHash(request, config),
          }),
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Passkey authentication failed')
    }
  })
  app.post('/v1/sessions/passkey', authWriteConfig, async (request, reply) => {
    try {
      const body = ((request.body as any) ?? {}) as {challengeId?: string; response?: any}
      const verified = await passkeys.verifyAuthentication({
        challengeId: body.challengeId ?? '',
        response: body.response,
        ipHash: requestIpHash(request, config) ?? null,
        userAgent: request.headers['user-agent'],
      })
      const issued = await greenfieldSessions.issue(verified.accountId, {
        userAgent: request.headers['user-agent'],
        ipHash: requestIpHash(request, config),
        authenticationMethodId: verified.methodId,
        authenticationStrength: 'phishing_resistant',
        recentAuthenticationAt: new Date(),
      })
      const email = await accountPrimaryEmail(verified.accountId)
      if (email) {
        await mail.queueNewSignIn({
          accountId: verified.accountId,
          email: email.identifier,
          displayName: displayNameFromIdentityMetadata(email.metadata, email.primary_handle),
          correlationId: request.id,
        })
      }
      return reply.send(
        successEnvelope(
          {
            accessToken: issued.accessToken,
            refreshToken: issued.refreshToken,
            sessionId: issued.sessionId,
            accessExpiresAt: issued.accessExpiresAt.toISOString(),
            refreshExpiresAt: issued.refreshExpiresAt.toISOString(),
          },
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Passkey sign-in failed')
    }
  })
  app.post('/v1/sessions/apple/options', authWriteConfig, async (request, reply) => {
    try {
      return reply.send(
        successEnvelope(
          await appleAuthentication.beginAuthentication({ipHash: requestIpHash(request, config) ?? null}),
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Apple sign-in failed')
    }
  })
  app.post('/v1/sessions/apple', authWriteConfig, async (request, reply) => {
    try {
      const issued = await appleAuthentication.completeAuthentication({
        challengeId: bodyString(request.body, 'challengeId'),
        nonce: bodyString(request.body, 'nonce'),
        idToken: bodyString(request.body, 'idToken'),
        userAgent: request.headers['user-agent'],
        ipHash: requestIpHash(request, config) ?? null,
        clientName: bodyString(request.body, 'clientName').slice(0, 120) || null,
        platform: bodyString(request.body, 'platform').slice(0, 80) || null,
      })
      const email = await accountPrimaryEmail(issued.accountId)
      if (email) {
        await mail.queueNewSignIn({
          accountId: issued.accountId,
          email: email.identifier,
          displayName: displayNameFromIdentityMetadata(email.metadata, email.primary_handle),
          correlationId: request.id,
        })
      }
      return reply.send(
        successEnvelope(
          {
            accessToken: issued.accessToken,
            refreshToken: issued.refreshToken,
            sessionId: issued.sessionId,
            accessExpiresAt: issued.accessExpiresAt.toISOString(),
            refreshExpiresAt: issued.refreshExpiresAt.toISOString(),
          },
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Apple sign-in failed')
    }
  })
  app.post('/v1/sessions/refresh', authWriteConfig, async (request, reply) => {
    try {
      const issued = await greenfieldSessions.refresh((request.body as any).refreshToken)
      return reply.send(
        successEnvelope(
          {
            accessToken: issued.accessToken,
            refreshToken: issued.refreshToken,
            sessionId: issued.sessionId,
            accessExpiresAt: issued.accessExpiresAt.toISOString(),
            refreshExpiresAt: issued.refreshExpiresAt.toISOString(),
          },
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Refresh failed')
    }
  })
  app.delete('/v1/sessions/current', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    await greenfieldSessions.revokeSession(auth.sessionId, auth.accountId)
    return reply.send(successEnvelope({revoked: true}, request.id))
  })
  app.delete('/v1/sessions/:sessionId', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    const {sessionId} = request.params as {sessionId: string}
    await greenfieldSessions.revokeSession(sessionId, auth.accountId)
    return reply.send(successEnvelope({revoked: true}, request.id))
  })

  app.get('/v1/board/layout', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await boardLayouts.get(auth.accountId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Board layout lookup failed')
    }
  })

  app.patch('/v1/board/layout', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await boardLayouts.patch(auth.accountId, (request.body as any) ?? {}), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Board layout update failed')
    }
  })

  app.get('/v1/repositories/me', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await repositories.getMe(auth.accountId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Repository lookup failed')
    }
  })
  app.get('/v1/repositories/me/records', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    const collection = typeof (request.query as any).collection === 'string' ? (request.query as any).collection : undefined
    return reply.send(successEnvelope(await records.listForAccount(auth.accountId, collection), request.id))
  })
  app.get('/v1/repositories/me/records/:recordId', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    const {recordId} = request.params as {recordId: string}
    const record = await records.getForAccount(auth.accountId, recordId)
    if (!record) return sendError(reply, 'NOT_FOUND', 'Record not found', request.id)
    return reply.send(successEnvelope(record, request.id))
  })
  app.post('/v1/repositories/me/records', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const body = request.body as any
      const record = await records.mutate({
        accountId: auth.accountId,
        collection: body.collection,
        schemaId: body.schemaId,
        schemaVersion: body.schemaVersion,
        visibility: body.visibility ?? 'private',
        data: body.data ?? {},
        operation: 'create',
      })
      return reply.code(201).send(successEnvelope(record, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Record create failed')
    }
  })
  app.patch('/v1/repositories/me/records/:recordId', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const body = request.body as any
      const {recordId} = request.params as {recordId: string}
      const existing = await records.getForAccount(auth.accountId, recordId)
      if (!existing) return sendError(reply, 'NOT_FOUND', 'Record not found', request.id)
      const record = await records.mutate({
        accountId: auth.accountId,
        recordId,
        collection: existing.collection,
        schemaId: body.schemaId ?? existing.schema_id,
        schemaVersion: body.schemaVersion ?? existing.schema_version,
        visibility: body.visibility ?? existing.visibility,
        data: body.data ?? existing.data,
        expectedRevision: body.expectedRevision,
        operation: 'update',
      })
      return reply.send(successEnvelope(record, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Record update failed')
    }
  })
  app.delete('/v1/repositories/me/records/:recordId', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {recordId} = request.params as {recordId: string}
      const existing = await records.getForAccount(auth.accountId, recordId)
      if (!existing) return sendError(reply, 'NOT_FOUND', 'Record not found', request.id)
      const record = await records.mutate({
        accountId: auth.accountId,
        recordId,
        collection: existing.collection,
        schemaId: existing.schema_id,
        schemaVersion: existing.schema_version,
        visibility: existing.visibility,
        data: existing.data,
        expectedRevision: (request.body as any)?.expectedRevision,
        operation: 'delete',
      })
      return reply.send(successEnvelope(record, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Record delete failed')
    }
  })
  app.post('/v1/repositories/me/exports', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.code(201).send(successEnvelope(await repositories.createExport(auth.accountId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Export failed')
    }
  })
  app.get('/v1/repositories/me/exports/:exportId', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {exportId} = request.params as {exportId: string}
      return reply.send(successEnvelope(await repositories.getExport(auth.accountId, exportId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Export lookup failed')
    }
  })

  app.get('/v1/extensions', profileConfig, async (request, reply) => {
    return reply.send(successEnvelope(await extensions.listPublished(), request.id))
  })
  app.get('/v1/extensions/catalogue', profileConfig, async (request, reply) => {
    const {ExtensionLifecycleService} = await import('../extensions/lifecycle-service.js')
    const lifecycle = new ExtensionLifecycleService(db)
    return reply.send(successEnvelope(await lifecycle.listCatalogue(), request.id))
  })
  app.get('/v1/extensions/:extensionId', profileConfig, async (request, reply) => {
    const {extensionId} = request.params as {extensionId: string}
    const items = await extensions.listPublished()
    const match = items.find((item: any) => item.slug === extensionId || item.extension_id === extensionId)
    if (!match) return sendError(reply, 'NOT_FOUND', 'Extension not found', request.id)
    return reply.send(successEnvelope(match, request.id))
  })
  app.get('/v1/extensions/installed', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    return reply.send(successEnvelope(await installations.listInstalled(auth.accountId), request.id))
  })
  app.post('/v1/extensions/:extensionId/install', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {extensionId} = request.params as {extensionId: string}
      return reply
        .code(201)
        .send(successEnvelope(await installations.install(auth.accountId, extensionId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Install failed')
    }
  })
  app.delete('/v1/extensions/:extensionId/install', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {extensionId} = request.params as {extensionId: string}
      return reply.send(successEnvelope(await installations.uninstall(auth.accountId, extensionId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Uninstall failed')
    }
  })
  app.patch('/v1/extensions/:extensionId/preferences', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {extensionId} = request.params as {extensionId: string}
      return reply.send(
        successEnvelope(await installations.updatePreferences(auth.accountId, extensionId, (request.body as any) ?? {}), request.id),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Preference update failed')
    }
  })
  app.get('/v1/tools', profileConfig, async (request, reply) => {
    const tools = await db.selectFrom('greenfield_tools').selectAll().orderBy('slug').execute()
    return reply.send(successEnvelope(tools, request.id))
  })
  app.get('/v1/tools/:toolId', profileConfig, async (request, reply) => {
    const {toolId} = request.params as {toolId: string}
    const tool = await db
      .selectFrom('greenfield_tools')
      .selectAll()
      .where(eb => eb.or([eb('tool_id', '=', toolId), eb('slug', '=', toolId)]))
      .executeTakeFirst()
    if (!tool) return sendError(reply, 'NOT_FOUND', 'Tool not found', request.id)
    return reply.send(successEnvelope(tool, request.id))
  })
  app.get('/v1/functions', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    return reply.send(successEnvelope(await functions.listForAccount(auth.accountId), request.id))
  })
  app.post('/v1/functions/:functionId/invoke', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {functionId} = request.params as {functionId: string}
      const body = ((request.body as any) ?? {}) as Record<string, unknown>
      if (typeof body.installationId !== 'string' || !body.installationId) {
        throw Object.assign(new Error('installationId is required'), {code: 'VALIDATION_FAILED'})
      }
      const result = await functions.invoke(auth.accountId, body.installationId, functionId, body.input ?? {})
      return reply.send(successEnvelope(result, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Function invoke failed')
    }
  })
  app.get('/v1/plugins', profileConfig, async (request, reply) => {
    return reply.send(successEnvelope(await db.selectFrom('greenfield_plugins').selectAll().execute(), request.id))
  })
  app.get('/v1/connectors', profileConfig, async (request, reply) => {
    return reply.send(successEnvelope(connectorProviders.list(), request.id))
  })
  app.get('/v1/connectors/:providerId', profileConfig, async (request, reply) => {
    const provider = connectorProviders.get((request.params as any).providerId)
    if (!provider) return sendError(reply, 'NOT_FOUND', 'Connector provider not found', request.id)
    return reply.send(successEnvelope(provider, request.id))
  })
  app.post('/v1/connectors/:providerId/authorise', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const providerId = (request.params as any).providerId
      const adapter = connectorAdapters.require(providerId)
      const body = (request.body as any) ?? {}
      const initiated = await connectorOAuthStates.initiate({
        accountId: auth.accountId,
        providerId,
        redirectUri: typeof body.redirectUri === 'string' ? body.redirectUri : undefined,
        idempotencyKey: idempotencyKey(request, body),
      })
      const adapterResult = await adapter.getAuthorisationUrl({
        accountId: auth.accountId,
        providerId,
        state: initiated.state,
        redirectUri: initiated.redirectUri,
        scopes: arrayOfStrings(body.scopes),
        pkceChallenge: initiated.pkceChallenge,
        pkceChallengeMethod: initiated.pkceChallengeMethod,
      })
      return reply.code(202).send(
        successEnvelope(
          {
            providerId,
            stateId: initiated.stateId,
            status: initiated.status,
            authorisationUrl: adapterResult.authorisationUrl,
            redirectUri: initiated.redirectUri,
            expiresAt: initiated.expiresAt,
          },
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Connector authorisation could not be started')
    }
  })
  app.get('/v1/connections', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await connectorConnections.list(auth.accountId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Connection lookup failed')
    }
  })
  app.get('/v1/connections/:connectionId', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await connectorConnections.get(auth.accountId, (request.params as any).connectionId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Connection lookup failed')
    }
  })
  app.post('/v1/connections/:connectionId/enable', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await connectorConnections.enable(auth.accountId, (request.params as any).connectionId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Connection enable failed')
    }
  })
  app.post('/v1/connections/:connectionId/disable', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await connectorConnections.disable(auth.accountId, (request.params as any).connectionId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Connection disable failed')
    }
  })
  app.post('/v1/connections/:connectionId/refresh', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const connection = await connectorConnections.get(auth.accountId, (request.params as any).connectionId)
      await policies.assertAllowed({
        accountId: auth.accountId,
        action: 'connection.refresh',
        connectionId: connection.connectionId,
        resource: {type: 'connection', id: connection.connectionId, ownerAccountId: auth.accountId},
        requestContext: {requestId: request.id, correlationId: request.id},
      })
      const adapter = connectorAdapters.require(connection.providerId)
      await connectorConnections.beginRefresh(auth.accountId, connection.connectionId)
      try {
        const credentials = await connectorCredentials.decryptForTrustedBackend({
          accountId: auth.accountId,
          providerId: connection.providerId,
          connectionId: connection.connectionId,
        })
        const refreshed = await adapter.refreshCredentials({
          accountId: auth.accountId,
          providerId: connection.providerId,
          connectionId: connection.connectionId,
          credentials,
        })
        await connectorCredentials.storeEncrypted({
          accountId: auth.accountId,
          providerId: connection.providerId,
          connectionId: connection.connectionId,
          credentials: refreshed,
        })
        return reply.send(
          successEnvelope(
            await connectorConnections.completeRefresh(auth.accountId, connection.connectionId, {
              expiresAt: refreshed.expiresAt ? new Date(refreshed.expiresAt) : null,
            }),
            request.id,
          ),
        )
      } catch (error) {
        await connectorConnections.fail(auth.accountId, connection.connectionId, {failureCode: 'refresh_failed'})
        throw error
      }
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Connection refresh failed')
    }
  })
  app.delete('/v1/connections/:connectionId', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      await policies.assertAllowed({
        accountId: auth.accountId,
        action: 'connection.disconnect',
        connectionId: (request.params as any).connectionId,
        resource: {type: 'connection', id: (request.params as any).connectionId, ownerAccountId: auth.accountId},
        requestContext: {requestId: request.id, correlationId: request.id},
      })
      return reply.send(successEnvelope(await connectorConnections.disconnect(auth.accountId, (request.params as any).connectionId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Connection disconnect failed')
    }
  })
  app.get('/v1/widgets', profileConfig, async (request, reply) => {
    return reply.send(successEnvelope(await db.selectFrom('greenfield_widgets').selectAll().execute(), request.id))
  })
  app.get('/v1/modules', profileConfig, async (request, reply) => {
    const modules = await db
      .selectFrom('greenfield_extensions')
      .innerJoin(
        'greenfield_extension_versions',
        'greenfield_extension_versions.extension_id',
        'greenfield_extensions.extension_id',
      )
      .selectAll('greenfield_extensions')
      .select(['greenfield_extension_versions.manifest', 'greenfield_extension_versions.version'])
      .where('greenfield_extension_versions.status', '=', 'published')
      .execute()
    const onlyModules = modules.filter((row: any) => (row.manifest as any)?.kind === 'module')
    return reply.send(successEnvelope(onlyModules, request.id))
  })

  app.get('/v1/sessions/me', profileConfig, async (request, reply) => {
    const auth = requireAuth(request, reply)
    if (!auth) return
    return reply.send(successEnvelope(auth.session, request.id))
  })

  app.delete('/v1/sessions/me', writeConfig, async (request, reply) => {
    const auth = requireAuth(request, reply)
    if (!auth) return
    await sessions.revokeSession(auth.session.id)
    return reply.send(successEnvelope({revoked: true}, request.id))
  })

  app.get('/v1/feed/home', feedConfig, async (request, reply) => {
    try {
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const mode = typeof query.mode === 'string' ? query.mode : 'following'
      const viewerActorId = request.auth?.actorId ?? null
      const blocked = await moderation.blockedSet(viewerActorId)
      const muted = await moderation.mutedSet(viewerActorId)
      const excluded = Array.from(new Set([...blocked, ...muted]))
      const items = await posts.listHome(mode, limit, cursor, excluded, viewerActorId)
      const rankingVersion = mode === 'forYou' ? 'ranking-v1' : mode === 'following' ? 'following-graph-v1' : 'modules-chrono-v1'
      const page = toCursorPage(items, limit, item => {
        if (mode === 'forYou') {
          const ageHours = (Date.now() - new Date(item.createdAt).getTime()) / 3_600_000
          const score =
            item.likeCount * 2 +
            item.replyCount * 3 +
            item.repostCount * 4 +
            (item.reactionCount ?? 0) * 2 +
            Math.max(0, 48 - ageHours)
          return `${score}|${item.createdAt}|${item.id}`
        }
        return `${item.createdAt}|${item.id}`
      })
      return reply.send(successEnvelope({...page, rankingVersion}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load feed')
    }
  })

  app.get('/v1/feed/profile/:profileId', feedConfig, async (request, reply) => {
    try {
      const {profileId} = request.params as {profileId: string}
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const profile = await db
        .selectFrom('profiles')
        .select('handle')
        .where('id', '=', profileId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
      if (!profile) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      const items = await posts.listForHandle(profile.handle, limit, cursor, request.auth?.actorId ?? null)
      if (!items) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      const page = toCursorPage(items, limit, item => `${item.createdAt}|${item.id}`)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load profile feed')
    }
  })

  app.get('/v1/posts/:postId', profileConfig, async (request, reply) => {
    const {postId} = request.params as {postId: string}
    const post = await posts.getById(postId, request.auth?.actorId ?? null)
    if (!post) return sendError(reply, 'NOT_FOUND', 'Post not found', request.id)
    return reply.send(successEnvelope(post, request.id))
  })

  app.post('/v1/posts', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    try {
      const body = request.body as CreatePostInput
      if ((body as any)?.authorActorId && (body as any).authorActorId !== auth.actorId) {
        return sendError(reply, 'FORBIDDEN', 'Cross-actor create denied', request.id)
      }
      const created = await postWrites.create(auth.actorId, body, {
        requestId: request.id,
        correlationId: request.id,
      })
      return reply.code(201).send(successEnvelope(created, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to create post')
    }
  })

  app.patch('/v1/posts/:postId', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:update')
    if (!auth) return
    try {
      const {postId} = request.params as {postId: string}
      const body = request.body as UpdatePostInput
      const updated = await postWrites.update(auth.actorId, postId, body, {
        requestId: request.id,
        correlationId: request.id,
      })
      return reply.send(successEnvelope(updated, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to update post')
    }
  })

  app.delete('/v1/posts/:postId', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:delete')
    if (!auth) return
    try {
      const {postId} = request.params as {postId: string}
      await postWrites.delete(auth.actorId, postId, {
        requestId: request.id,
        correlationId: request.id,
      })
      return reply.send(successEnvelope({deleted: true}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to delete post')
    }
  })

  for (const [method, path, kind, enabled] of [
    ['POST', '/v1/posts/:postId/like', 'like', true],
    ['DELETE', '/v1/posts/:postId/like', 'like', false],
    ['POST', '/v1/posts/:postId/save', 'save', true],
    ['DELETE', '/v1/posts/:postId/save', 'save', false],
    ['POST', '/v1/posts/:postId/repost', 'repost', true],
    ['DELETE', '/v1/posts/:postId/repost', 'repost', false],
  ] as const) {
    app.route({
      method,
      url: path,
      ...writeConfig,
      handler: async (request, reply) => {
        if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
        const auth = requireCapability(request, reply, 'post:engage')
        if (!auth) return
        try {
          const {postId} = request.params as {postId: string}
          if (kind === 'like') {
            const current = await reactions.listReactions(auth.actorId, postId)
            if (enabled && current.viewerReaction !== 'like') await reactions.setReaction(auth.actorId, postId, 'like')
            if (!enabled && current.viewerReaction === 'like') await reactions.setReaction(auth.actorId, postId, null)
          } else {
            await postWrites.setEngagement(auth.actorId, postId, kind, enabled)
          }
          const post = await posts.getById(postId, auth.actorId)
          if (!post) return sendError(reply, 'NOT_FOUND', 'Post not found', request.id)
          return reply.send(successEnvelope({
            liked: post.liked,
            saved: post.saved,
            reposted: post.reposted,
            likeCount: post.likeCount,
            reactionCount: post.reactionCount,
            viewerReaction: post.viewerReaction,
            replyCount: post.replyCount,
            repostCount: post.repostCount,
            quoteCount: post.quoteCount,
          }, request.id))
        } catch (error: any) {
          return mapDomainError(reply, error, request.id, 'Engagement failed')
        }
      },
    })
  }

  app.post('/v1/posts/:postId/share', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    try {
      const {postId} = request.params as {postId: string}
      const body = (request.body ?? {}) as {channel?: PostShareChannel; idempotencyKey?: string}
      const share = await postShares.record({
        actorId: auth.actorId,
        postId,
        channel: body.channel ?? 'native',
        idempotencyKey: idempotencyKey(request, body),
      })
      return reply.code(201).send(successEnvelope(share, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Share failed')
    }
  })

  app.get('/v1/profiles/:handle', profileConfig, async (request, reply) => {
    const {handle} = request.params as {handle: string}
    if (!isModulaHandle(handle)) return sendError(reply, 'VALIDATION_FAILED', 'Invalid handle', request.id)
    const profile = await profiles.getByHandle(handle, request.auth?.actorId ?? null)
    if (!profile) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
    return reply.send(successEnvelope(profile, request.id))
  })

  app.get('/v1/profiles/:handle/posts', feedConfig, async (request, reply) => {
    try {
      const {handle} = request.params as {handle: string}
      if (!isModulaHandle(handle)) return sendError(reply, 'VALIDATION_FAILED', 'Invalid handle', request.id)
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const items = await posts.listForHandle(handle, limit, cursor, request.auth?.actorId ?? null)
      if (!items) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      const page = toCursorPage(items, limit, item => `${item.createdAt}|${item.id}`)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load posts')
    }
  })

  app.get('/v1/profiles/:handle/followers', profileConfig, async (request, reply) => {
    try {
      const {handle} = request.params as {handle: string}
      if (!isModulaHandle(handle)) return sendError(reply, 'VALIDATION_FAILED', 'Invalid handle', request.id)
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const result = await profiles.listFollowers(handle, limit, cursor, request.auth?.actorId ?? null)
      if (!result) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      const page = toCursorPage(result.items, limit, item => item.id)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load followers')
    }
  })

  app.get('/v1/profiles/:handle/following', profileConfig, async (request, reply) => {
    try {
      const {handle} = request.params as {handle: string}
      if (!isModulaHandle(handle)) return sendError(reply, 'VALIDATION_FAILED', 'Invalid handle', request.id)
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const result = await profiles.listFollowing(handle, limit, cursor, request.auth?.actorId ?? null)
      if (!result) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      const page = toCursorPage(result.items, limit, item => item.id)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load following')
    }
  })

  app.post('/v1/profiles/:profileId/follow', profileIdWriteConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:follow')
    if (!auth) return
    try {
      const {profileId} = request.params as {profileId: string}
      const relationship = await profileWrites.follow(auth.actorId, profileId)
      const profile = relationship.following ? await profiles.getById(profileId, auth.actorId) : null
      return reply.send(
        successEnvelope(
          {
            ...relationship,
            isFollowing: relationship.following,
            ...(profile ? {profile, followerCount: profile.followerCount} : {}),
          },
          request.id,
        ),
      )
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Follow failed')
    }
  })

  app.delete('/v1/profiles/:profileId/follow', profileIdWriteConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:follow')
    if (!auth) return
    try {
      const {profileId} = request.params as {profileId: string}
      const relationship = await profileWrites.unfollow(auth.actorId, profileId)
      const profile = await profiles.getById(profileId, auth.actorId)
      return reply.send(
        successEnvelope(
          {
            ...relationship,
            isFollowing: false,
            ...(profile ? {profile, followerCount: profile.followerCount} : {}),
          },
          request.id,
        ),
      )
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Unfollow failed')
    }
  })

  app.get('/v1/profiles/me/follow-requests', followRequestListConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:follow')
    if (!auth) return
    try {
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const requests = await profileWrites.listIncomingFollowRequests(auth.actorId, limit, cursor)
      return reply.send(successEnvelope(toCursorPage(requests, limit, item => item.requestId), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load follow requests')
    }
  })

  app.post('/v1/follow-requests/:requestId/accept', followRequestActionConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:follow')
    if (!auth) return
    try {
      const {requestId} = request.params as {requestId: string}
      return reply.send(successEnvelope(await profileWrites.acceptFollowRequest(auth.actorId, requestId), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Follow request acceptance failed')
    }
  })

  app.post('/v1/follow-requests/:requestId/reject', followRequestActionConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:follow')
    if (!auth) return
    try {
      const {requestId} = request.params as {requestId: string}
      return reply.send(successEnvelope(await profileWrites.rejectFollowRequest(auth.actorId, requestId), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Follow request rejection failed')
    }
  })

  app.delete('/v1/follow-requests/:requestId', followRequestActionConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:follow')
    if (!auth) return
    try {
      const {requestId} = request.params as {requestId: string}
      return reply.send(successEnvelope(await profileWrites.cancelFollowRequest(auth.actorId, requestId), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Follow request cancellation failed')
    }
  })

  app.patch('/v1/profiles/me', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'profile:update')
    if (!auth) return
    try {
      const body = request.body as {displayName?: string; bio?: string; visibility?: 'public' | 'followers' | 'teams' | 'private'; expectedVersion?: number; actorId?: string; handle?: string}
      if (body.actorId && body.actorId !== auth.actorId) {
        return sendError(reply, 'FORBIDDEN', 'Cross-actor profile edit denied', request.id)
      }
      const requestedHandle = typeof body.handle === 'string' ? body.handle.trim().toLowerCase() : ''
      if (requestedHandle) {
        const currentProfile = await profiles.getByActorId(auth.actorId, auth.actorId)
        if (!currentProfile) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
        if (requestedHandle !== currentProfile.handle.toLowerCase()) {
          await accounts.changeHandle(auth.accountId, requestedHandle)
        }
      }
      const updated = await profileWrites.updateMe(auth.actorId, body, {
        requestId: request.id,
        correlationId: request.id,
      })
      return reply.send(successEnvelope(updated, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Profile update failed')
    }
  })

  for (const mediaKind of ['avatar', 'cover'] as const) {
    app.post(`/v1/profiles/me/${mediaKind}`, writeConfig, async (request, reply) => {
      if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
      const auth = requireCapability(request, reply, 'profile:update')
      if (!auth) return
      try {
        const attachmentId = (request.body as {attachmentId?: unknown} | undefined)?.attachmentId
        if (typeof attachmentId !== 'string') {
          return sendError(reply, 'VALIDATION_FAILED', 'attachmentId is required', request.id)
        }
        const updated = await profileWrites.updateMedia(auth.actorId, auth.accountId, mediaKind, attachmentId, config.publicApiUrl, {
          requestId: request.id, correlationId: request.id,
        })
        return reply.send(successEnvelope(updated, request.id))
      } catch (error: any) {
        return mapDomainError(reply, error, request.id, 'Profile media update failed')
      }
    })
    app.delete(`/v1/profiles/me/${mediaKind}`, writeConfig, async (request, reply) => {
      if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
      const auth = requireCapability(request, reply, 'profile:update')
      if (!auth) return
      try {
        const updated = await profileWrites.updateMedia(auth.actorId, auth.accountId, mediaKind, null, config.publicApiUrl, {
          requestId: request.id, correlationId: request.id,
        })
        return reply.send(successEnvelope(updated, request.id))
      } catch (error: any) {
        return mapDomainError(reply, error, request.id, 'Profile media removal failed')
      }
    })
  }

  app.post('/v1/profiles/:profileId/block', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:block')
    if (!auth) return
    try {
      const {profileId} = request.params as {profileId: string}
      const actorId = await profileWrites.actorIdForProfileId(profileId)
      if (!actorId) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      await moderation.block(auth.actorId, actorId)
      return reply.send(successEnvelope({blocked: true}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Block failed')
    }
  })

  app.delete('/v1/profiles/:profileId/block', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:block')
    if (!auth) return
    try {
      const {profileId} = request.params as {profileId: string}
      const actorId = await profileWrites.actorIdForProfileId(profileId)
      if (!actorId) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      await moderation.unblock(auth.actorId, actorId)
      return reply.send(successEnvelope({blocked: false}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Unblock failed')
    }
  })

  app.post('/v1/profiles/:profileId/mute', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:mute')
    if (!auth) return
    try {
      const {profileId} = request.params as {profileId: string}
      const actorId = await profileWrites.actorIdForProfileId(profileId)
      if (!actorId) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      await moderation.mute(auth.actorId, actorId)
      return reply.send(successEnvelope({muted: true}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Mute failed')
    }
  })

  app.delete('/v1/profiles/:profileId/mute', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'social:mute')
    if (!auth) return
    try {
      const {profileId} = request.params as {profileId: string}
      const actorId = await profileWrites.actorIdForProfileId(profileId)
      if (!actorId) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
      await moderation.unmute(auth.actorId, actorId)
      return reply.send(successEnvelope({muted: false}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Unmute failed')
    }
  })

  app.post('/v1/reports', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'report:create')
    if (!auth) return
    try {
      const body = request.body as CreateReportInput
      const report = await moderation.createReport(auth.actorId, body)
      return reply.code(201).send(successEnvelope(report, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Report failed')
    }
  })

  app.get('/v1/reports/me', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'report:create')
    if (!auth) return
    try {
      const query = request.query as Record<string, unknown>
      return reply.send(successEnvelope({items: await moderation.listForReporter(auth.actorId, parseLimit(query.limit))}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load reports')
    }
  })

  app.get('/v1/admin/moderation/reports', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    try {
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const items = await moderation.listReports({
        status: typeof query.status === 'string' ? query.status : undefined,
        limit,
        cursor,
      })
      return reply.send(successEnvelope(toCursorPage(items, limit, item => `${item.createdAt}|${item.id}`), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load moderation queue')
    }
  })

  app.get('/v1/admin/moderation/reports/:reportId', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    try {
      const {reportId} = request.params as {reportId: string}
      return reply.send(successEnvelope(await moderation.getReport(reportId), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load report')
    }
  })

  app.patch('/v1/admin/moderation/reports/:reportId', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    try {
      const {reportId} = request.params as {reportId: string}
      const body = (request.body ?? {}) as {status?: ReportStatus; resolution?: string; expectedVersion?: number}
      return reply.send(successEnvelope(await moderation.reviewReport({
        reportId,
        reviewerActorId: auth.actorId,
        status: body.status as ReportStatus,
        resolution: body.resolution,
        expectedVersion: Number(body.expectedVersion),
      }), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to review report')
    }
  })

  app.post('/v1/admin/moderation/reports/:reportId/actions', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    try {
      const {reportId} = request.params as {reportId: string}
      const body = (request.body ?? {}) as {actionType?: ModerationActionType; note?: string; expectedVersion?: number}
      return reply.send(successEnvelope(await moderation.applyAction({
        reportId,
        reviewerActorId: auth.actorId,
        actionType: body.actionType as ModerationActionType,
        note: body.note,
        expectedVersion: Number(body.expectedVersion),
      }), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to apply moderation action')
    }
  })

  app.get('/v1/notifications', feedConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      const query = request.query as Record<string, unknown>
      const limit = parseLimit(query.limit)
      const cursor = decodeCursor(query.cursor)
      const items = await notifications.listForActor(auth.actorId, limit, cursor)
      const page = toCursorPage(items, limit, item => `${item.createdAt}|${item.id}`)
      return reply.send(successEnvelope(page, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to load notifications')
    }
  })

  app.post('/v1/notifications/:notificationId/read', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const {notificationId} = request.params as {notificationId: string}
    const ok = await notifications.markRead(auth.actorId, notificationId)
    if (!ok) return sendError(reply, 'NOT_FOUND', 'Notification not found', request.id)
    return reply.send(successEnvelope({read: true}, request.id))
  })

  app.post('/v1/notifications/read-all', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    const count = await notifications.markAllRead(auth.actorId)
    return reply.send(successEnvelope({updated: count}, request.id))
  })

  app.get('/v1/accounts/me/notification-preferences', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await notificationPreferences.get(auth.accountId), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Notification preferences lookup failed')
    }
  })

  app.patch('/v1/accounts/me/notification-preferences', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(
        successEnvelope(
          await notificationPreferences.patch(auth.accountId, (request.body as any) ?? {}),
          request.id,
        ),
      )
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Notification preferences update failed')
    }
  })

  app.get('/v1/search', feedConfig, async (request, reply) => {
    try {
      const data = await search.search(request.query as Record<string, unknown>, await resolveSearchActorContext(request))
      return reply.send(successEnvelope(data, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Search failed')
    }
  })

  app.get('/v1/search/suggestions', feedConfig, async (request, reply) => {
    try {
      return reply.send(successEnvelope(await search.suggestions(request.query as Record<string, unknown>, await resolveSearchActorContext(request)), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Search suggestions failed')
    }
  })

  app.get('/v1/search/recent', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await search.listRecent(await resolveSearchActorContext(request), request.query as Record<string, unknown>), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Recent search lookup failed')
    }
  })

  app.post('/v1/search/recent', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.code(201).send(successEnvelope(await search.recordRecent(await resolveSearchActorContext(request), (request.body as any) ?? {}), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Recent search save failed')
    }
  })

  app.delete('/v1/search/recent', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const query = {...(request.query as Record<string, unknown>), ...(((request.body as any) ?? {}) as Record<string, unknown>)}
      return reply.send(successEnvelope(await search.deleteRecent(await resolveSearchActorContext(request), query), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Recent search delete failed')
    }
  })

  app.get('/v1/search/saved', profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await search.listSaved(await resolveSearchActorContext(request)), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Saved search lookup failed')
    }
  })

  app.post('/v1/search/saved', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.code(201).send(successEnvelope(await search.createSaved(await resolveSearchActorContext(request), (request.body as any) ?? {}), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Saved search create failed')
    }
  })

  app.patch('/v1/search/saved/:savedSearchId', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {savedSearchId} = request.params as {savedSearchId: string}
      return reply.send(successEnvelope(await search.patchSaved(await resolveSearchActorContext(request), savedSearchId, (request.body as any) ?? {}), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Saved search update failed')
    }
  })

  app.delete('/v1/search/saved/:savedSearchId', writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {savedSearchId} = request.params as {savedSearchId: string}
      return reply.send(successEnvelope(await search.deleteSaved(await resolveSearchActorContext(request), savedSearchId), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Saved search delete failed')
    }
  })

  app.get('/v1/media/:mediaFile', feedConfig, async (request, reply) => {
    const params = request.params as {mediaFile?: string}
    const mediaFile = params.mediaFile ?? ''
    const match = /^([0-9a-f-]{36})\.(jpg|png|webp)$/i.exec(mediaFile)
    if (!match) return sendError(reply, 'NOT_FOUND', 'Media not found', request.id)
    const mediaId = match[1]
    if (!mediaId) return sendError(reply, 'NOT_FOUND', 'Media not found', request.id)
    const row = await db
      .selectFrom('post_media')
      .innerJoin('posts', 'posts.id', 'post_media.post_id')
      .select([
        'post_media.id as media_id',
        'posts.id as post_id',
        'posts.author_actor_id as author_actor_id',
        'posts.audience as audience',
      ])
      .where('post_media.id', '=', mediaId)
      .where('post_media.deleted_at', 'is', null)
      .where('posts.deleted_at', 'is', null)
      .executeTakeFirst()
    if (!row) return sendError(reply, 'NOT_FOUND', 'Media not found', request.id)
    if (!await posts.getById(row.post_id, request.auth?.actorId ?? null)) return sendError(reply, 'FORBIDDEN', 'Media unavailable', request.id)
    const stored = await postMediaStorage.readPostMedia(mediaFile)
    if (!stored) return sendError(reply, 'NOT_FOUND', 'Media not found', request.id)
    return sendBrowserVisibleMedia(reply, stored.contentType, stored.bytes)
  })

  app.get('/v1/discover', feedConfig, async (request, reply) => {
    const data = await discovery.getDiscover(request.auth?.actorId ?? null)
    return reply.send(successEnvelope(data, request.id))
  })

  app.get('/v1/activity', feedConfig, async (request, reply) => {
    const data = await discovery.listActivity(request.auth?.actorId ?? null)
    return reply.send(successEnvelope(data, request.id))
  })

  app.get('/v1/reels', feedConfig, async (request, reply) => {
    const data = await discovery.listReels(request.auth?.actorId ?? null)
    return reply.send(successEnvelope(data, request.id))
  })

  app.get('/v1/atproto/connections', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'atproto:connect')
    if (!auth) return
    const connections = await atproto.listConnections(auth.actorId)
    return reply.send(successEnvelope({items: connections}, request.id))
  })

  app.post('/v1/atproto/oauth/start', writeConfig, async (request, reply) => {
    if (!config.atprotoEnabled) return sendError(reply, 'CAPABILITY_DISABLED', 'AT Proto disabled', request.id)
    const auth = requireCapability(request, reply, 'atproto:connect')
    if (!auth) return
    try {
      const body = request.body as {
        clientKind?: 'web' | 'native'
        returnRoute?: string
        requestScope?: 'atproto' | 'publish'
        handle?: string
      }
      const started = await atproto.startOAuth({
        actorId: auth.actorId,
        sessionId: auth.session.id,
        clientKind: body.clientKind === 'native' ? 'native' : 'web',
        returnRoute: body.returnRoute ?? '/settings/connections/atproto',
        requestScope: body.requestScope === 'publish' ? 'publish' : 'atproto',
        handle: body.handle,
      })
      return reply.send(successEnvelope(started, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'OAuth start failed')
    }
  })

  app.get('/v1/atproto/oauth/callback', writeConfig, async (request, reply) => {
    if (!config.atprotoEnabled) return sendError(reply, 'CAPABILITY_DISABLED', 'AT Proto disabled', request.id)
    const auth = requireCapability(request, reply, 'atproto:connect')
    if (!auth) return
    try {
      const query = request.query as Record<string, string>
      const state = query.state
      if (!state) return sendError(reply, 'VALIDATION_FAILED', 'state required', request.id)
      // Preview completion path for disposable test identities (no provider tokens returned).
      if (config.environment !== 'production' && query.preview === '1') {
        const pdsUrl = query.pdsUrl || 'https://bsky.social'
        await assertSafeHttpsUrl(pdsUrl)
        const connection = await atproto.completePreviewOAuth({
          actorId: auth.actorId,
          sessionId: auth.session.id,
          state,
          did: query.did || `did:plc:preview${auth.actorId.replace(/[^a-z0-9]/gi, '').slice(0, 16)}`,
          handle: query.handle || 'preview.modula.test',
          pdsUrl,
        })
        return reply.send(successEnvelope({connection}, request.id))
      }
      const consumed = await atproto.consumeOAuthState({
        state,
        actorId: auth.actorId,
        sessionId: auth.session.id,
      })
      return reply.send(successEnvelope({returnRoute: consumed.returnRoute, status: 'pending_provider'}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'OAuth callback failed')
    }
  })

  app.post('/v1/atproto/connections/:connectionId/disconnect', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'atproto:connect')
    if (!auth) return
    try {
      const {connectionId} = request.params as {connectionId: string}
      await atproto.disconnect(auth.actorId, connectionId)
      return reply.send(successEnvelope({disconnected: true}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Disconnect failed')
    }
  })

  app.post('/v1/atproto/connections/:connectionId/refresh', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'atproto:connect')
    if (!auth) return
    const {connectionId} = request.params as {connectionId: string}
    const connection = await atproto.getConnection(auth.actorId, connectionId)
    if (!connection) return sendError(reply, 'NOT_FOUND', 'Connection not found', request.id)
    if (connection.status === 'revoked' || connection.status === 'disconnected') {
      return sendError(reply, 'FORBIDDEN', 'Connection is not refreshable', request.id)
    }
    return reply.send(successEnvelope({connection, refreshed: true}, request.id))
  })

  app.get('/v1/atproto/connections/:connectionId/status', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'atproto:connect')
    if (!auth) return
    const {connectionId} = request.params as {connectionId: string}
    const connection = await atproto.getConnection(auth.actorId, connectionId)
    if (!connection) return sendError(reply, 'NOT_FOUND', 'Connection not found', request.id)
    return reply.send(successEnvelope(connection, request.id))
  })

  app.get('/v1/atproto/preferences', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'atproto:publish')
    if (!auth) return
    const prefs = await atproto.getPreferences(auth.actorId)
    return reply.send(successEnvelope(prefs, request.id))
  })

  app.patch('/v1/atproto/preferences', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'atproto:publish')
    if (!auth) return
    const prefs = await atproto.updatePreferences(auth.actorId, request.body as any)
    return reply.send(successEnvelope(prefs, request.id))
  })

  app.get('/v1/atproto/feed', feedConfig, async (request, reply) => {
    const query = request.query as Record<string, unknown>
    const mode = (typeof query.mode === 'string' ? query.mode : 'modula-network') as AtmosphereFeedMode
    const limit = parseLimit(query.limit)
    const items = await atproto.atmosphereFeed(mode, limit)
    return reply.send(
      successEnvelope(
        {
          label: 'Atmosphere Preview',
          mode,
          items,
        },
        request.id,
      ),
    )
  })

  async function setOperationalControl(key: string, value: unknown, updatedBy: string): Promise<void> {
    await db
      .insertInto('operational_controls')
      .values({key, value, updated_at: new Date(), updated_by: updatedBy})
      .onConflict(oc => oc.column('key').doUpdateSet({value, updated_at: new Date(), updated_by: updatedBy}))
      .execute()
  }

  app.post('/v1/admin/ops/atproto/publish', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    const body = request.body as {enabled?: boolean}
    await setOperationalControl('atproto.publish.enabled', Boolean(body.enabled), auth.actorId)
    return reply.send(successEnvelope({atprotoPublishEnabled: Boolean(body.enabled)}, request.id))
  })

  app.post('/v1/admin/ops/atproto/ingest', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    const body = request.body as {paused?: boolean}
    await setOperationalControl('atproto.ingest.paused', Boolean(body.paused), auth.actorId)
    return reply.send(successEnvelope({atprotoIngestPaused: Boolean(body.paused)}, request.id))
  })

  app.post('/v1/admin/ops/atproto/connections/:connectionId/revoke', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    try {
      const {connectionId} = request.params as {connectionId: string}
      await atproto.adminRevokeConnection(connectionId, auth.actorId)
      return reply.send(successEnvelope({revoked: true}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to revoke connection')
    }
  })

  app.post('/v1/admin/ops/queue/drain', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    const body = request.body as {drained?: boolean}
    await setOperationalControl('jobs.queue.drained', Boolean(body.drained), auth.actorId)
    return reply.send(successEnvelope({queueDrained: Boolean(body.drained)}, request.id))
  })

  app.get('/v1/admin/ops/mail/summary', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    return reply.send(successEnvelope(await mail.summary(), request.id))
  })

  app.post('/v1/admin/ops/mail/identities/adopt', writeConfig, async (request, reply) => {
    const greenfieldAuth = await requireGreenfieldAuth(request, reply)
    if (!greenfieldAuth) return
    const adminAuth = requireCapability(request, reply, 'admin:ops')
    if (!adminAuth) return
    try {
      const body = ((request.body as any) ?? {}) as {
        accountId?: string
        address?: string
        providerReference?: string
        operatorIntent?: boolean
      }
      return reply.send(
        successEnvelope(
          await mailIdentities.adopt({
            accountId: body.accountId ?? '',
            address: body.address ?? '',
            providerReference: body.providerReference ?? '',
            operatorIntent: body.operatorIntent === true,
            operatorAccountId: greenfieldAuth.accountId,
          }),
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Modula Mail adoption failed')
    }
  })

  app.post('/v1/admin/ops/jobs/reaction-dead-letters/:jobId/retry', reactionDeadLetterRetryConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    const {jobId} = request.params as {jobId: string}
    const body = (request.body ?? {}) as {reason?: string}
    try {
      return reply.send(successEnvelope(await retryReactionNotificationDeadLetter(db, jobId, auth.actorId, {
        reason: body.reason?.trim() || undefined,
        requestId: request.id,
        correlationId: request.id,
      }), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Failed to retry reaction notification dead letter')
    }
  })

  app.post('/v1/admin/ops/queue/dead-letters/:deadLetterId/retry', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    const {deadLetterId} = request.params as {deadLetterId: string}
    try {
      const requeued = await db.transaction().execute(async trx => {
        const deadLetter = await trx
          .selectFrom('atproto_dead_letters')
          .selectAll()
          .where('id', '=', deadLetterId)
          .where('resolved_at', 'is', null)
          .executeTakeFirst()
        if (!deadLetter) throw Object.assign(new Error('Dead letter not found'), {code: 'NOT_FOUND'})
        const now = new Date()
        const jobId = `job-${deadLetterId}-retry-${now.getTime()}`
        await trx
          .insertInto('background_jobs')
          .values({
            id: jobId,
            job_type: deadLetter.source,
            payload: deadLetter.payload,
            status: 'QUEUED',
            action: deadLetter.source,
            trace_id: request.id,
            priority: 100,
            available_at: now,
            lease_owner: null,
            lease_expires_at: null,
            attempt_count: 0,
            maximum_attempts: 5,
            last_error: null,
            created_at: now,
            updated_at: now,
            completed_at: null,
          })
          .execute()
        await trx.updateTable('atproto_dead_letters').set({resolved_at: now}).where('id', '=', deadLetterId).execute()
        await new AuditRepository(trx).append('admin.queue.dead_letter.retried', {deadLetterId, jobId}, {type: 'job', id: jobId, actorId: auth.actorId})
        return jobId
      })
      return reply.send(successEnvelope({jobId: requeued}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to retry dead letter')
    }
  })

  app.get('/v1/admin/ops/events/subscriber-failures', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    const query = request.query as {subscriberId?: string}
    try {
      return reply.send(successEnvelope(await eventReplays.inspectSubscriberFailures(query.subscriberId), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to inspect event subscriber failures')
    }
  })

  app.get('/v1/admin/ops/search/health', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    try {
      return reply.send(successEnvelope(await search.health(), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Search health lookup failed')
    }
  })

  app.get('/v1/admin/ops/engines', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    try {
      return reply.send(successEnvelope({items: await engines.list()}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Engine topology lookup failed')
    }
  })

  app.get('/v1/admin/ops/engines/:engineId', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    try {
      const {engineId} = request.params as {engineId: string}
      const engine = await engines.get(engineId)
      if (!engine) return sendError(reply, 'NOT_FOUND', 'Engine not found', request.id)
      return reply.send(successEnvelope(engine, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Engine topology lookup failed')
    }
  })

  app.get('/v1/admin/ops/search/projections', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    try {
      return reply.send(successEnvelope(await search.projectionStates(), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Search projection lookup failed')
    }
  })

  app.get('/v1/admin/ops/search/failures', profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    try {
      return reply.send(successEnvelope(await search.projectionFailures(), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Search projection failure lookup failed')
    }
  })

  app.post('/v1/admin/ops/search/reindex', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    try {
      const context = await resolveSearchActorContext(request)
      context.capabilities = Array.from(auth.capabilities)
      return reply.code(202).send(successEnvelope(await search.requestReindex(context, (request.body as any) ?? {}), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Search reindex request failed')
    }
  })

  app.post('/v1/admin/ops/search/failures/:failureId/retry', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    try {
      const context = await resolveSearchActorContext(request)
      context.capabilities = Array.from(auth.capabilities)
      const {failureId} = request.params as {failureId: string}
      return reply.send(successEnvelope(await search.retryFailure(context, failureId), request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Search projection failure retry failed')
    }
  })

  app.post('/v1/admin/ops/policy/evaluate', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    const body = (request.body as Record<string, unknown>) ?? {}
    try {
      const decision = await policies.evaluateAndAudit({
        actorId: textField(body.actorId) ?? auth.actorId,
        accountId: textField(body.accountId),
        action: textField(body.action) ?? 'policy.inspect',
        capability: textField(body.capability),
        moduleId: textField(body.moduleId),
        connectionId: textField(body.connectionId),
        workspaceId: textField(body.workspaceId),
        teamId: textField(body.teamId),
        riskClassification: textField(body.riskClassification),
        currentState: textField(body.currentState),
        resource: objectField(body.resource),
        requestContext: {
          requestId: request.id,
          correlationId: request.id,
          userAgentClassification: classifyUserAgent(request.headers['user-agent']),
          ipClassification: 'unknown',
        },
      })
      return reply.send(successEnvelope({decision}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Policy evaluation failed')
    }
  })

  app.post('/v1/admin/ops/events/replay', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    const body = request.body as Record<string, unknown>
    try {
      const result = await eventReplays.replay({
        eventId: textField(body.eventId),
        eventType: textField(body.eventType),
        aggregateType: textField(body.aggregateType),
        aggregateId: textField(body.aggregateId),
        subscriberId: textField(body.subscriberId),
        occurredFrom: dateField(body.occurredFrom),
        occurredTo: dateField(body.occurredTo),
        dryRun: Boolean(body.dryRun),
        reason: textField(body.reason) ?? 'operator event replay',
        requestedByActorId: auth.actorId,
        requestId: request.id,
        correlationId: request.id,
      })
      return reply.send(successEnvelope(result, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to replay event deliveries')
    }
  })

  app.post('/v1/admin/ops/events/dead-letters/retry', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    const body = request.body as Record<string, unknown>
    try {
      const result = await eventReplays.retryDeadLetters({
        eventType: textField(body.eventType),
        subscriberId: textField(body.subscriberId),
        dryRun: Boolean(body.dryRun),
        reason: textField(body.reason) ?? 'operator dead-letter retry',
        requestedByActorId: auth.actorId,
        requestId: request.id,
        correlationId: request.id,
      })
      return reply.send(successEnvelope(result, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to retry event dead letters')
    }
  })

  app.post('/v1/admin/ops/events/replay/:replayId/cancel', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:ops')
    if (!auth) return
    const {replayId} = request.params as {replayId: string}
    const body = request.body as {reason?: string}
    try {
      const cancelled = await eventReplays.cancelReplay(replayId, auth.actorId, body.reason ?? 'operator cancelled unsafe replay')
      return reply.send(successEnvelope({replayId, cancelled}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Failed to cancel event replay')
    }
  })

  app.post('/v1/admin/ops/atproto/lexicons/:collection/disable', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'admin:moderation')
    if (!auth) return
    const {collection} = request.params as {collection: string}
    const body = request.body as {disabled?: boolean}
    await setOperationalControl(`atproto.lexicon.${collection}.disabled`, Boolean(body.disabled), auth.actorId)
    return reply.send(successEnvelope({collection, disabled: Boolean(body.disabled)}, request.id))
  })

  function textField(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
  }

  function dateField(value: unknown): Date | undefined {
    if (typeof value !== 'string' || value.trim().length === 0) return undefined
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return undefined
    return date
  }

  function objectField(value: unknown): any {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined
  }

  function classifyUserAgent(value: unknown): 'unknown' | 'browser' | 'mobile' | 'service' | 'bot' | 'cli' {
    const userAgent = Array.isArray(value) ? value.join(' ') : typeof value === 'string' ? value : ''
    if (!userAgent) return 'unknown'
    if (/(curl|httpie|wget|python-requests|go-http-client)/i.test(userAgent)) return 'cli'
    if (/(bot|crawler|spider)/i.test(userAgent)) return 'bot'
    if (/(iphone|ipad|android|mobile)/i.test(userAgent)) return 'mobile'
    if (/(mozilla|safari|chrome|firefox|edge)/i.test(userAgent)) return 'browser'
    return 'service'
  }

  // SSRF helper exposed only in tests via internal assert
  app.get('/v1/internal/ssrf-check', async (request, reply) => {
    if (config.nodeEnv !== 'test' && config.environment !== 'development') {
      return sendError(reply, 'NOT_FOUND', 'Not found', request.id)
    }
    const query = request.query as {url?: string; ip?: string}
    if (query.ip) {
      return reply.send(successEnvelope({blocked: isBlockedIp(query.ip)}, request.id))
    }
    try {
      await assertSafeHttpsUrl(query.url ?? '')
      return reply.send(successEnvelope({safe: true}, request.id))
    } catch (error: any) {
      return mapDomainError(reply, error, request.id, 'Unsafe URL')
    }
  })

  await registerPhase6sRoutes(app, db, config, {
    greenfieldSessions,
    mutationsAllowed,
    writeConfig,
    feedConfig,
    profileConfig,
    authWriteConfig,
  })

  await registerPhase7fStoriesRoutes(app, db, config, {
    sessions,
    feedConfig,
    writeConfig,
  })
  await registerMessagingRoutes(app, db, {feedConfig, writeConfig, publicApiUrl: config.publicApiUrl, mediaEnabled: config.messaging.mediaEnabled})
  await registerPushRoutes(app, db, {bundleId: config.pushBundleId, profileConfig, writeConfig})
  await registerMolibooRoutes(app, db, config, {feedConfig, writeConfig})
  setPublicIdentityProjectionEnabled({premium: config.premium.enabled, verification: config.premium.verificationEnabled})
  await registerPremiumRoutes(app, db, config, {profileConfig, writeConfig}, {appleVerifier: options.premiumAppleVerifier})
  await registerMolibooGameRoutes(app, db, config, {feedConfig, writeConfig})

  await registerDeveloperRoutes(app, db, config, greenfieldSessions, {profileConfig, writeConfig})
  const publisherReleaseJobRunner = await registerPublisherConsoleRoutes(app, db, config, greenfieldSessions, {profileConfig, writeConfig}, options.publisherConsole)
  await registerGubicPlayRoutes(app, db, config, greenfieldSessions, {profileConfig, writeConfig})
  await registerEntitlementRoutes(app, db, config, greenfieldSessions, {profileConfig, writeConfig})
  await registerAccountDataRoutes(app, db, config, greenfieldSessions, {profileConfig, writeConfig})
  await registerSupportRoutes(app, db, config, greenfieldSessions, {healthConfig, profileConfig, writeConfig})
  await registerSettingsV2Routes(app, db, config, greenfieldSessions, {profileConfig, writeConfig})
  await registerProviderRoutes(app, db, config, greenfieldSessions, {profileConfig, writeConfig})
  return {publisherReleaseJobRunner}
}

function idempotencyKey(request: any, body: unknown): string | undefined {
  const header = request.headers?.['idempotency-key'] ?? request.headers?.['x-idempotency-key']
  if (typeof header === 'string' && header.trim()) return header.trim()
  if (body && typeof body === 'object' && typeof (body as any).idempotencyKey === 'string') {
    const value = (body as any).idempotencyKey.trim()
    return value || undefined
  }
  return undefined
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim())
}
