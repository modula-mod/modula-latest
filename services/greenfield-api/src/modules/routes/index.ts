import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import type {GreenfieldSessionService} from '../../sessions/service.js'
import {failureEnvelope, statusForError, successEnvelope} from '../../transport/envelope.js'
import {GreenfieldModuleContributionService} from '../contribution-service.js'
import {GreenfieldModuleActionService} from '../action-service.js'
import {GreenfieldModuleExportService} from '../export-service.js'
import {GreenfieldModuleHealthService} from '../health-service.js'
import {GreenfieldModuleInstallationService} from '../installation-service.js'
import {GreenfieldModuleManifestService} from '../manifest-service.js'
import {moduleError} from '../module-errors.js'
import {GreenfieldModulePublisherService} from '../publisher-service.js'
import {GreenfieldModuleRecordService} from '../record-service.js'
import type {ModuleRecordQuery} from '../record-service.js'
import {GreenfieldModuleRegistryService} from '../registry-service.js'
import {GreenfieldModuleReleaseService} from '../release-service.js'
import {GreenfieldModuleRuntimeAccessService} from '../runtime-access.js'
import {GreenfieldModuleRuntime2Service} from '../runtime2-service.js'
import {GreenfieldModuleSettingsService} from '../settings-service.js'
import {GreenfieldModuleUninstallService} from '../uninstall-service.js'
import {GreenfieldModuleUpdateService} from '../update-service.js'
import {GreenfieldModuleViewService} from '../view-service.js'
import {ModuleBackendDiscoveryService} from '../backend/discovery-service.js'
import {ModuleBackendEventService} from '../backend/event-service.js'
import {ModuleBackendHealthService as GreenfieldModuleBackendHealthService} from '../backend/health-service.js'
import {ModuleBackendLifecycleService} from '../backend/lifecycle-service.js'
import {ModuleBackendWebhookService} from '../backend/webhook-service.js'
import {ModuleBackendGatewayService} from '../backend/gateway-service.js'
import {resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import {GreenfieldModuleMarketplaceService} from '../marketplace-service.js'
import {GreenfieldPublisherSigningKeyService} from '../release-signing.js'
import {loadRegisteredIdentityAliases} from '../identity-aliases.js'
import {GreenfieldGithubReleaseSyncService, HttpGithubReleaseSource, type GithubReleaseSource} from '../github-release-sync-service.js'
import {parseTrustOptions} from '../registry-trust-service.js'
import {GreenfieldExtensionFabricService} from '../extension-fabric-service.js'
import {GreenfieldDataLedgerService} from '../../data-ledger/index.js'
import {GreenfieldMpsIngestService} from '../../product-standard/ingest-service.js'
import {GreenfieldProductFrontendService} from '../../product-standard/frontend-service.js'
import {GreenfieldAIExtensionActionService} from '../../ai/extension-action-service.js'
import {statusForAiError} from '../../ai/errors.js'

type RouteConfig = Record<string, unknown>

function canonicalModuleParam(request: FastifyRequest): string {
  return resolveCanonicalModuleId(String((request.params as {moduleId?: string}).moduleId ?? ''))
}

export async function registerModuleRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  sessions: GreenfieldSessionService,
  routeConfig: {profileConfig: RouteConfig; writeConfig: RouteConfig},
  options: {githubReleaseSource?: GithubReleaseSource} = {},
): Promise<void> {
  await loadRegisteredIdentityAliases(db, app.log)
  const registry = new GreenfieldModuleRegistryService(db, {publicApiUrl: config.publicApiUrl})
  const marketplace = new GreenfieldModuleMarketplaceService(db)
  const signingKeys = new GreenfieldPublisherSigningKeyService(db)
  const githubSync = new GreenfieldGithubReleaseSyncService(db, options.githubReleaseSource ?? new HttpGithubReleaseSource({token: process.env.GREENFIELD_MODULE_GITHUB_TOKEN ?? null}))
  const releases = new GreenfieldModuleReleaseService(db)
  const publishers = new GreenfieldModulePublisherService(db, config)
  const installations = new GreenfieldModuleInstallationService(db, config)
  const updates = new GreenfieldModuleUpdateService(db, config)
  const uninstall = new GreenfieldModuleUninstallService(db, config)
  const settings = new GreenfieldModuleSettingsService(db, config)
  const contributions = new GreenfieldModuleContributionService(db, config)
  const views = new GreenfieldModuleViewService(db, config)
  const records = new GreenfieldModuleRecordService(db, config)
  const actions = new GreenfieldModuleActionService(db, config)
  const exports = new GreenfieldModuleExportService(db, config)
  const health = new GreenfieldModuleHealthService(db, config)
  const runtimeAccess = new GreenfieldModuleRuntimeAccessService(db, config)
  const runtime2 = new GreenfieldModuleRuntime2Service(db)
  const backendDiscovery = new ModuleBackendDiscoveryService(db)
  const backendHealth = new GreenfieldModuleBackendHealthService(db, config)
  const backendLifecycle = new ModuleBackendLifecycleService(db)
  const backendEvents = new ModuleBackendEventService(db, config)
  const backendWebhooks = new ModuleBackendWebhookService(db, config)
  const backendGateway = new ModuleBackendGatewayService(db, config)
  const extensionFabric = new GreenfieldExtensionFabricService(db)
  const dataLedger = new GreenfieldDataLedgerService(db, config)
  const mpsIngest = new GreenfieldMpsIngestService(db)
  const productFrontends = new GreenfieldProductFrontendService(db, config)
  const extensionAi = new GreenfieldAIExtensionActionService(db, config)

  const requireRegistry = (reply: FastifyReply, requestId: string) => {
    if (!config.moduleRegistryEnabled) {
      reply.code(statusForError('CAPABILITY_DISABLED')).send(failureEnvelope('CAPABILITY_DISABLED', 'Greenfield module registry is disabled', requestId))
      return false
    }
    return true
  }

  app.get('/v1/registry/modules', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    try {
      return reply.send(successEnvelope(await registry.listModules(request.query as any), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module registry listing failed')
    }
  })

  app.get('/v1/registry/products', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    try {
      return reply.send(successEnvelope(await registry.listModules({...(request.query as any), productKind: (request.query as any)?.productKind ?? 'all'}), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Registry product listing failed')
    }
  })

  app.get('/v1/registry/modules/:moduleId', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    try {
      return reply.send(successEnvelope(await registry.getModule(canonicalModuleParam(request), parseTrustOptions(request.query)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module lookup failed')
    }
  })

  app.get('/v1/registry/products/:productId', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    try {
      return reply.send(successEnvelope(await registry.getModule(String((request.params as any).productId), parseTrustOptions(request.query)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Registry product lookup failed')
    }
  })

  app.get('/v1/registry/products/:productId/relationships', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    try {
      return reply.send(successEnvelope(await extensionFabric.relationships(String((request.params as any).productId)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Registry product relationship lookup failed')
    }
  })

  app.get('/v1/product-standard/products/:productId', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    try {
      const productId = String((request.params as {productId?: string}).productId ?? '')
      const ingested = await mpsIngest.getLatest(productId)
      if (!ingested) throw moduleError('NOT_FOUND', 'MPS product ingestion not found')
      return reply.send(successEnvelope(ingested, request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'MPS product lookup failed')
    }
  })

  app.get('/v1/product-standard/products/:productId/versions/:version', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    try {
      const params = request.params as {productId?: string; version?: string}
      const ingested = await mpsIngest.get(String(params.productId ?? ''), String(params.version ?? ''))
      if (!ingested) throw moduleError('NOT_FOUND', 'MPS product ingestion not found')
      return reply.send(successEnvelope(ingested, request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'MPS product version lookup failed')
    }
  })

  app.post('/v1/admin/product-standard/ingest', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      await publishers.requireAdminAccount(auth.accountId)
      if (!requireRegistry(reply, request.id)) return
      const body = (request.body as {
        filename?: unknown
        bytes?: unknown
        manifest?: unknown
        releaseId?: unknown
        frontend?: {path?: unknown; bytes?: unknown}
        schemas?: Array<{path?: unknown; bytes?: unknown}>
      } | null) ?? {}
      const filename = typeof body.filename === 'string' && body.filename.trim() ? body.filename : 'modula.product.json'
      const bytes = typeof body.bytes === 'string'
        ? body.bytes
        : JSON.stringify(body.manifest && typeof body.manifest === 'object' ? body.manifest : body)
      const releaseId = typeof body.releaseId === 'string' && body.releaseId.trim() ? body.releaseId : null
      const frontend = typeof body.frontend?.path === 'string' && typeof body.frontend.bytes === 'string'
        ? {path: body.frontend.path, bytes: body.frontend.bytes}
        : null
      if (body.schemas !== undefined && !Array.isArray(body.schemas)) throw moduleError('VALIDATION_FAILED', 'MPS schemas must be an array')
      const schemas = (body.schemas ?? []).map((schema, index) => {
        if (typeof schema.path !== 'string' || typeof schema.bytes !== 'string') {
          throw moduleError('VALIDATION_FAILED', `MPS schema artifact ${index} is invalid`)
        }
        return {path: schema.path, bytes: schema.bytes}
      })
      return reply.code(201).send(successEnvelope(await mpsIngest.ingest({filename, bytes, releaseId, frontend, schemas}), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'MPS product ingest failed')
    }
  })

  app.get('/v1/registry/modules/:moduleId/versions', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    try {
      return reply.send(successEnvelope(await registry.listVersions(canonicalModuleParam(request)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module versions lookup failed')
    }
  })

  app.get('/v1/registry/modules/:moduleId/versions/:version', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    const params = request.params as any
    try {
      return reply.send(successEnvelope(await registry.getVersionDetail(canonicalModuleParam(request), params.version, parseTrustOptions(request.query)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module version lookup failed')
    }
  })

  app.get('/v1/registry/publishers/:publisherId/signing-keys', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    try {
      return reply.send(successEnvelope(await signingKeys.listForPublisher(String((request.params as any).publisherId)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Signing key lookup failed')
    }
  })

  // Immutable release package, when the registry holds the verified bytes.
  app.get('/v1/registry/releases/:releaseId/artifact', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    try {
      const artifact = await registry.presentation.readReleaseArtifact(String((request.params as {releaseId?: string}).releaseId ?? ''))
      return reply
        .header('ETag', `"sha256-${artifact.sha256}"`)
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .header('X-Content-Type-Options', 'nosniff')
        .header('Content-Disposition', `attachment; filename="${artifact.filename}"`)
        .header('X-Modula-Artifact-Sha256', artifact.sha256)
        .type('application/gzip')
        .send(artifact.bytes)
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Release artifact lookup failed')
    }
  })

  // Immutable release media. Bytes are content-addressed and verified at ingest;
  // the registry is the only distribution origin for presentation artwork.
  app.get('/v1/registry/releases/:releaseId/assets/:assetId', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    const params = request.params as {releaseId?: string; assetId?: string}
    try {
      const asset = await registry.presentation.readAsset(String(params.releaseId ?? ''), String(params.assetId ?? ''))
      const etag = `"sha256-${asset.sha256}"`
      reply
        .header('ETag', etag)
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .header('X-Content-Type-Options', 'nosniff')
        .header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .header('Content-Disposition', 'inline')
        .header('X-Modula-Asset-Sha256', asset.sha256)
        .header('X-Modula-Development-Asset', asset.developmentAsset ? 'true' : 'false')
      if (request.headers['if-none-match'] === etag) return reply.code(304).send()
      return reply.type(asset.mediaType).send(asset.bytes)
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Release asset lookup failed')
    }
  })

  app.put('/v1/registry/modules/:moduleId/rating', routeConfig.writeConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const rating = Number((request.body as {rating?: unknown} | undefined)?.rating)
      return reply.send(successEnvelope(await marketplace.submitRating(canonicalModuleParam(request), auth.accountId, rating), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module rating update failed')
    }
  })

  app.get('/v1/registry/publishers/:publisherId', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    const publisher = await publishers.getPublisher((request.params as any).publisherId)
    if (!publisher) return sendError(reply, 'NOT_FOUND', 'Publisher not found', request.id)
    return reply.send(successEnvelope(publisher, request.id))
  })

  app.get('/v1/modules/installed', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    return reply.send(successEnvelope(await installations.listInstalled(auth.accountId), request.id))
  })

  app.get('/v1/modules/installed/:moduleId', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    const installed = await installations.getInstalled(auth.accountId, canonicalModuleParam(request))
    if (!installed) return sendError(reply, 'NOT_FOUND', 'Module installation not found', request.id)
    return reply.send(successEnvelope(installed, request.id))
  })

  app.get('/v1/module-host/:targetProductId/composition', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const query = (request.query as any) ?? {}
      return reply.send(successEnvelope(await extensionFabric.composeHost(auth.accountId, String((request.params as any).targetProductId), {
        platform: typeof query.platform === 'string' ? query.platform : 'web',
        route: typeof query.route === 'string' ? query.route : undefined,
        online: query.online !== 'false',
      }), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module Host extension composition failed')
    }
  })

  app.get('/v1/extensions/:extensionProductId/capabilities', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await extensionFabric.declaredCapabilities(auth.accountId, String((request.params as any).extensionProductId)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Extension capability lookup failed')
    }
  })

  app.post('/v1/extensions/:extensionProductId/capabilities/review', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = (request.body as any) ?? {}
      const approved = Array.isArray(body.approvedCapabilities) ? body.approvedCapabilities.filter((value: unknown): value is string => typeof value === 'string') : []
      return reply.send(successEnvelope(await extensionFabric.reviewCapabilities(auth.accountId, String((request.params as any).extensionProductId), approved), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Extension capability review failed')
    }
  })

  app.post('/v1/extensions/:extensionProductId/contributions/:contributionId/invoke', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = (request.body as any) ?? {}
      const brokered = await extensionFabric.assertInvocation({
        accountId: auth.accountId,
        extensionProductId: String((request.params as any).extensionProductId),
        targetProductId: String(body.targetProductId ?? ''),
        contributionId: String((request.params as any).contributionId),
        actionId: String(body.actionId ?? ''),
        requiredCapabilities: Array.isArray(body.requiredCapabilities) ? body.requiredCapabilities.filter((value: unknown): value is string => typeof value === 'string') : [],
        resource: body.resource,
      })
      const extensionProductId = String((request.params as any).extensionProductId)
      const context = await runtimeAccess.resolve(auth.accountId, extensionProductId, {requireEnabled: true})
      if (!backendGateway.canHandle(context, String(body.actionId ?? ''))) {
        if (extensionAi.canHandle(context, String(body.actionId ?? ''))) {
          const result = await extensionAi.execute({
            accountId: auth.accountId,
            context,
            actionId: String(body.actionId ?? ''),
            resource: brokered.resource,
            requestId: request.id,
          })
          return reply.send(successEnvelope({authorized: true, executor: 'AI_GATEWAY', ...brokered, result}, request.id))
        }
        return reply.send(successEnvelope({authorized: true, executor: 'DECLARATIVE_ONLY', ...brokered}, request.id))
      }
      const result = await backendGateway.executeAction({
        context,
        actionId: String(body.actionId ?? ''),
        actorId: actorIdForAccount(auth.accountId),
        payload: {
          target: {productId: String(body.targetProductId ?? '')},
          resource: brokered.resource,
          variables: body.variables && typeof body.variables === 'object' ? body.variables : {},
        },
        idempotencyKey: idempotencyKey(request, body),
        requestId: request.id,
        extensionInvocation: {
          consumerProductId: extensionProductId,
          targetProductId: String(body.targetProductId ?? ''),
          targetInstallationId: brokered.targetInstallationId,
          scope: brokered.scope,
          capabilities: brokered.capabilities,
        },
      })
      return reply.send(successEnvelope({authorized: true, executor: 'SERVICE_FABRIC', result}, request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Extension contribution invocation denied')
    }
  })

  app.post('/v1/extensions/:extensionProductId/contributions/:contributionId/fail', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = (request.body as any) ?? {}
      const errorCode = String(body.errorCode ?? 'CONTRIBUTION_RENDER_FAILED').slice(0, 80)
      return reply.send(successEnvelope(await extensionFabric.failContribution(
        auth.accountId,
        String((request.params as any).extensionProductId),
        String((request.params as any).contributionId),
        errorCode,
      ), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Extension contribution failure recording failed')
    }
  })

  app.post('/v1/extensions/:extensionProductId/jobs', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = (request.body as any) ?? {}
      return reply.code(202).send(successEnvelope(await extensionFabric.enqueueJob({
        accountId: auth.accountId,
        extensionProductId: String((request.params as any).extensionProductId),
        targetProductId: String(body.targetProductId ?? ''),
        contributionId: String(body.contributionId ?? ''),
        actionId: String(body.actionId ?? ''),
        idempotencyKey: idempotencyKey(request, body),
        requestId: request.id,
        metadata: body.metadata,
      }), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Extension job enqueue failed')
    }
  })

  app.get('/v1/extensions/:extensionProductId/inspector', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    if (config.environment === 'production') return sendError(reply, 'NOT_FOUND', 'Developer inspector is unavailable', request.id)
    try {
      return reply.send(successEnvelope(await extensionFabric.developerInspector(auth.accountId, String((request.params as any).extensionProductId)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Extension developer inspector failed')
    }
  })

  app.get('/v1/modules/:moduleId/runtime', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await runtime2.runtimeSummary(auth.accountId, canonicalModuleParam(request)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module runtime lookup failed')
    }
  })

  app.get('/v1/modules/:moduleId/data-resources', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const query = (request.query as {installationId?: string; cursor?: string; limit?: string}) ?? {}
      return reply.send(successEnvelope(await dataLedger.list(auth.accountId, canonicalModuleParam(request), {
        installationId: stringOrUndefined(query.installationId),
        cursor: stringOrUndefined(query.cursor),
        limit: query.limit === undefined ? undefined : Number(query.limit),
      }), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module data resource lookup failed')
    }
  })

  app.post('/v1/modules/:moduleId/data-resources', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = ((request.body as Record<string, unknown>) ?? {}) as any
      return reply.code(201).send(successEnvelope(await dataLedger.register(auth.accountId, canonicalModuleParam(request), {
        ...body,
        idempotencyKey: idempotencyKey(request, body),
        requestId: request.id,
      }), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module data resource registration failed')
    }
  })

  app.get('/v1/modules/:moduleId/data-resources/:resourceId', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await dataLedger.get(
        auth.accountId,
        canonicalModuleParam(request),
        String((request.params as {resourceId?: string}).resourceId ?? ''),
      ), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module data resource lookup failed')
    }
  })

  app.post('/v1/modules/:moduleId/data-resources/:resourceId/migrations', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = ((request.body as Record<string, unknown>) ?? {}) as any
      return reply.code(201).send(successEnvelope(await dataLedger.recordMigration(
        auth.accountId,
        canonicalModuleParam(request),
        String((request.params as {resourceId?: string}).resourceId ?? ''),
        {...body, requestId: request.id},
      ), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module data migration recording failed')
    }
  })

  app.post('/v1/modules/:moduleId/data-resources/:resourceId/schemas', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = ((request.body as Record<string, unknown>) ?? {}) as any
      return reply.code(201).send(successEnvelope(await dataLedger.declareSchemaVersion(
        auth.accountId,
        canonicalModuleParam(request),
        String((request.params as {resourceId?: string}).resourceId ?? ''),
        {...body, requestId: request.id},
      ), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module data schema declaration failed')
    }
  })

  app.post('/v1/modules/:moduleId/services/:serviceId/invoke', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = (request.body as any) ?? {}
      return reply.send(successEnvelope(await runtime2.invokeService({
        accountId: auth.accountId,
        actorId: actorIdForAccount(auth.accountId),
        providerModuleId: canonicalModuleParam(request),
        serviceId: (request.params as any).serviceId,
        callerModuleId: typeof body.callerModuleId === 'string' ? body.callerModuleId : canonicalModuleParam(request),
        payload: body.input ?? {},
        idempotencyKey: idempotencyKey(request, body),
        depth: Number.isInteger(body.depth) ? body.depth : 1,
        requestId: request.id,
      }), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module service invocation failed')
    }
  })

  app.post('/v1/modules/:moduleId/install-preview', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = (request.body as any) ?? {}
      return reply.send(successEnvelope(await installations.installPreview(auth.accountId, canonicalModuleParam(request), body.version, modulePlatform(body.platform)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Install preview failed')
    }
  })

  app.post('/v1/modules/:moduleId/install', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = (request.body as any) ?? {}
      return reply.code(202).send(
        successEnvelope(
          await installations.install(auth.accountId, canonicalModuleParam(request), {
            version: typeof body.version === 'string' && body.version.trim() ? body.version.trim() : undefined,
            approvedPermissions: body.approvedPermissions,
            platform: modulePlatform(body.platform),
            hostVersion: parseTrustOptions({hostVersion: body.hostVersion}).hostVersion,
            idempotencyKey: idempotencyKey(request, body),
          }),
          request.id,
        ),
      )
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Install failed')
    }
  })

  app.get('/v1/modules/:moduleId/install-descriptor', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const options = parseTrustOptions(request.query)
      return reply.send(successEnvelope(await installations.getInstallDescriptor(auth.accountId, canonicalModuleParam(request), {hostVersion: options.hostVersion}), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Install descriptor lookup failed')
    }
  })

  app.post('/v1/modules/:moduleId/enable', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.code(202).send(successEnvelope(await installations.enable(auth.accountId, canonicalModuleParam(request), idempotencyKey(request, request.body)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Enable failed')
    }
  })

  app.post('/v1/modules/:moduleId/disable', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.code(202).send(successEnvelope(await installations.disable(auth.accountId, canonicalModuleParam(request), idempotencyKey(request, request.body)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Disable failed')
    }
  })

  // Versions of a module relative to the account's installation (upgrade,
  // downgrade, current), gated on registry trust and compatibility.
  app.get('/v1/modules/:moduleId/versions', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await updates.versions(auth.accountId, canonicalModuleParam(request), parseTrustOptions(request.query)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module versions lookup failed')
    }
  })

  // Dry run of a version switch: permission changes, data-schema warning, trust
  // and the immutable install descriptor of the target release. Changes nothing.
  app.post('/v1/modules/:moduleId/version-preview', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = (request.body as any) ?? {}
      return reply.send(successEnvelope(await updates.preview(auth.accountId, canonicalModuleParam(request), {
        version: typeof body.version === 'string' && body.version.trim() ? body.version.trim() : undefined,
        ...parseTrustOptions({hostVersion: body.hostVersion, platform: body.platform}),
      }), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Version preview failed')
    }
  })

  app.post('/v1/modules/:moduleId/update', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = (request.body as any) ?? {}
      return reply.code(202).send(
        successEnvelope(
          await updates.update(auth.accountId, canonicalModuleParam(request), {
            version: typeof body.version === 'string' && body.version.trim() ? body.version.trim() : undefined,
            approvedPermissionIncrease: body.approvedPermissionIncrease === true,
            approvedPermissions: Array.isArray(body.approvedPermissions) ? body.approvedPermissions.filter((permission: unknown): permission is string => typeof permission === 'string') : undefined,
            acknowledgeDowngradeRisk: body.acknowledgeDowngradeRisk === true,
            ...parseTrustOptions({hostVersion: body.hostVersion, platform: body.platform}),
            idempotencyKey: idempotencyKey(request, body),
          }),
          request.id,
        ),
      )
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Update failed')
    }
  })

  app.post('/v1/modules/:moduleId/permissions/review', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = (request.body as any) ?? {}
      return reply.send(successEnvelope(await installations.reviewPermissions(auth.accountId, canonicalModuleParam(request), {
        approvedPermissions: Array.isArray(body.approvedPermissions) ? body.approvedPermissions.filter((permission: unknown): permission is string => typeof permission === 'string') : [],
        idempotencyKey: idempotencyKey(request, body),
      }), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Permission review failed')
    }
  })

  app.post('/v1/modules/:moduleId/uninstall-preview', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await uninstall.preview(auth.accountId, canonicalModuleParam(request)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Uninstall preview failed')
    }
  })

  app.delete('/v1/modules/:moduleId/install', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = (request.body as any) ?? {}
      return reply.code(202).send(
        successEnvelope(
          await uninstall.uninstall(auth.accountId, canonicalModuleParam(request), {
            choice: body.choice,
            confirmDelete: Boolean(body.confirmDelete),
            recentAuth: Boolean(body.recentAuth),
            removeDependants: Boolean(body.removeDependants),
            idempotencyKey: idempotencyKey(request, body),
          }),
          request.id,
        ),
      )
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Uninstall failed')
    }
  })

  app.get('/v1/modules/:moduleId/settings-schema', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await settings.schema(auth.accountId, canonicalModuleParam(request)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Settings schema failed')
    }
  })

  app.get('/v1/modules/:moduleId/settings', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await settings.get(auth.accountId, canonicalModuleParam(request)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Settings lookup failed')
    }
  })

  app.patch('/v1/modules/:moduleId/settings', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await settings.patch(auth.accountId, canonicalModuleParam(request), ((request.body as any)?.values ?? request.body ?? {}) as any), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Settings update failed')
    }
  })

  app.get('/v1/modules/contributions', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    return reply.send(successEnvelope(await contributions.list(auth.accountId, request.query as any), request.id))
  })

  app.get('/v1/modules/:moduleId/views', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await views.listViews(auth.accountId, canonicalModuleParam(request)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module views lookup failed')
    }
  })

  app.get('/v1/modules/:moduleId/frontend', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await productFrontends.resolve(auth.accountId, canonicalModuleParam(request)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Product frontend lookup failed')
    }
  })

  app.get('/v1/modules/:moduleId/views/:viewId', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    const params = request.params as any
    try {
      return reply.send(successEnvelope(await views.getView(auth.accountId, params.moduleId, params.viewId), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module view lookup failed')
    }
  })

  app.get('/v1/modules/:moduleId/records/:collection', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    const params = request.params as any
    try {
      return reply.send(successEnvelope(await records.list(auth.accountId, params.moduleId, params.collection, normalizeRecordQuery(request.query as Record<string, unknown>)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module records lookup failed')
    }
  })

  app.post('/v1/modules/:moduleId/records/:collection', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    const params = request.params as any
    try {
      return reply.code(201).send(successEnvelope(await records.create(auth.accountId, params.moduleId, params.collection, (request.body as any) ?? {}), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module record creation failed')
    }
  })

  app.get('/v1/modules/:moduleId/records/:collection/:recordId', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    const params = request.params as any
    try {
      return reply.send(successEnvelope(await records.get(auth.accountId, params.moduleId, params.collection, params.recordId), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module record lookup failed')
    }
  })

  app.patch('/v1/modules/:moduleId/records/:collection/:recordId', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    const params = request.params as any
    try {
      return reply.send(successEnvelope(await records.patch(auth.accountId, params.moduleId, params.collection, params.recordId, (request.body as any) ?? {}), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module record update failed')
    }
  })

  app.delete('/v1/modules/:moduleId/records/:collection/:recordId', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    const params = request.params as any
    try {
      return reply.send(successEnvelope(await records.delete(auth.accountId, params.moduleId, params.collection, params.recordId, (request.body as any) ?? {}), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module record delete failed')
    }
  })

  app.post('/v1/modules/:moduleId/records/:collection/:recordId/restore', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    const params = request.params as any
    try {
      return reply.send(successEnvelope(await records.restore(auth.accountId, params.moduleId, params.collection, params.recordId, (request.body as any) ?? {}), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module record restore failed')
    }
  })

  app.delete('/v1/modules/:moduleId/records/:collection/:recordId/permanent', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    const params = request.params as any
    try {
      return reply.send(successEnvelope(await records.purge(auth.accountId, params.moduleId, params.collection, params.recordId, (request.body as any) ?? {}), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module record permanent delete failed')
    }
  })

  app.post('/v1/modules/:moduleId/actions/:actionId', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    const params = request.params as any
    try {
      return reply.send(
        successEnvelope(
          await actions.execute(auth.accountId, params.moduleId, params.actionId, {
            input: (request.body as any)?.input ?? request.body ?? {},
            idempotencyKey: idempotencyKey(request, request.body),
            actorId: actorIdForAccount(auth.accountId),
            requestId: request.id,
          }),
          request.id,
        ),
      )
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module action failed')
    }
  })

  app.post('/v1/modules/:moduleId/export', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    const params = request.params as any
    try {
      return reply.send(successEnvelope(await exports.create(auth.accountId, params.moduleId, (request.body as any) ?? {}), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module export failed')
    }
  })

  app.get('/v1/modules/:moduleId/health', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await health.get(auth.accountId, canonicalModuleParam(request)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module health lookup failed')
    }
  })

  app.get('/v1/modules/:moduleId/backend', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const context = await runtimeAccess.resolve(auth.accountId, canonicalModuleParam(request), {requireEnabled: false})
      return reply.send(successEnvelope(await backendHealth.diagnostics(context), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module backend diagnostics failed')
    }
  })

  app.post('/v1/modules/:moduleId/backend/discover', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const context = await runtimeAccess.resolve(auth.accountId, canonicalModuleParam(request), {requireEnabled: false})
      return reply.send(successEnvelope(await backendDiscovery.discover(context, {origin: stringOrUndefined((request.body as any)?.origin)}), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module backend discovery failed')
    }
  })

  app.post('/v1/modules/:moduleId/backend/health', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const context = await runtimeAccess.resolve(auth.accountId, canonicalModuleParam(request), {requireEnabled: false})
      return reply.send(successEnvelope(await backendHealth.check(context), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module backend health failed')
    }
  })

  app.post('/v1/modules/:moduleId/backend/disable', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const context = await runtimeAccess.resolve(auth.accountId, canonicalModuleParam(request), {requireEnabled: false})
      return reply.send(successEnvelope(await backendLifecycle.disable(context), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module backend disable failed')
    }
  })

  app.post('/v1/modules/:moduleId/backend/events', routeConfig.writeConfig, async (request, reply) => {
    try {
      const token = bearerToken(request)
      return reply.send(successEnvelope(await backendEvents.ingest(canonicalModuleParam(request), request.body ?? {}, token, signatureHeader(request, 'x-modula-event-signature')), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module backend event ingestion failed')
    }
  })

  app.post('/v1/modules/:moduleId/backend/webhooks/modula', routeConfig.writeConfig, async (request, reply) => {
    try {
      const token = bearerToken(request)
      return reply.send(successEnvelope(await backendWebhooks.receive(canonicalModuleParam(request), request.body ?? {}, token, signatureHeader(request, 'x-modula-webhook-signature')), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module backend webhook receipt failed')
    }
  })

  app.post('/v1/admin/registry/modules/import', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      await publishers.requireAdminAccount(auth.accountId)
      const body = (request.body as any) ?? {}
      const manifest = new GreenfieldModuleManifestService().parse(body.manifest ?? request.body)
      return reply.code(201).send(successEnvelope(await releases.importPendingReview(manifest, body.releaseEvidence), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Registry import failed')
    }
  })

  app.post('/v1/admin/registry/sync', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      await publishers.requireAdminAccount(auth.accountId)
      if (!config.moduleGithubSyncEnabled) throw moduleError('CAPABILITY_DISABLED', 'GitHub registry sync is disabled')
      const body = (request.body as Record<string, unknown> | undefined) ?? {}
      const result = await githubSync.sync({
        repository: String(body.repository ?? ''),
        releaseTag: String(body.releaseTag ?? ''),
        publish: body.publish === true,
        // Dry run unless the caller explicitly asks to apply.
        dryRun: body.dryRun !== false,
      })
      return reply.code(result.mode === 'APPLIED' ? 201 : 200).send(successEnvelope(result, request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Registry sync failed')
    }
  })

  app.get('/v1/admin/registry/sync-runs', routeConfig.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      await publishers.requireAdminAccount(auth.accountId)
      return reply.send(successEnvelope(await db.selectFrom('greenfield_module_sync_runs').selectAll().orderBy('created_at', 'desc').execute(), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Registry sync runs failed')
    }
  })

  app.post('/v1/admin/registry/releases/:releaseId/verify', routeConfig.writeConfig, releaseAdminAction(sessions, publishers, request =>
    releases.verifyReleaseFromId((request.params as any).releaseId),
  ))
  app.post('/v1/admin/registry/releases/:releaseId/signature', {
    ...routeConfig.writeConfig,
    schema: {
      params: {type: 'object', additionalProperties: false, required: ['releaseId'], properties: {
        releaseId: {type: 'string', minLength: 1, maxLength: 240, pattern: '^[A-Za-z0-9._:-]+$'},
      }},
      body: {type: 'object', additionalProperties: false, required: ['signature', 'statementSha256'], properties: {
        signature: {type: 'object', additionalProperties: false, required: ['algorithm', 'keyId', 'value'], properties: {
          algorithm: {type: 'string', const: 'Ed25519'},
          keyId: {type: 'string', minLength: 3, maxLength: 160, pattern: '^[A-Za-z0-9._:-]+$'},
          value: {type: 'string', minLength: 86, maxLength: 86, pattern: '^[A-Za-z0-9_-]+$'},
        }},
        statementSha256: {type: 'string', pattern: '^[0-9a-f]{64}$'},
      }},
    },
  }, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      await publishers.requireAdminAccount(auth.accountId)
      const {releaseId} = request.params as {releaseId: string}
      const body = request.body as {signature: unknown; statementSha256: string}
      const release = await releases.getReleaseById(releaseId)
      if (!release) throw moduleError('NOT_FOUND', 'Release not found')
      if (release.releaseState !== 'published' || !release.manifest.source.releaseTag) {
        throw moduleError('CONFLICT', 'Published release provenance is required for signature attachment')
      }
      // Download and verify GitHub tag, package bytes and provenance before taking a database row lock.
      const verifiedArtifact = await githubSync.fetchVerified({
        repository: release.sourceRepository,
        releaseTag: release.manifest.source.releaseTag,
      })
      return reply.send(successEnvelope(await releases.attachPublishedSignature(releaseId, body, verifiedArtifact, auth.accountId, request.id), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Release signature attachment failed')
    }
  })
  app.post('/v1/admin/registry/releases/:releaseId/publish', routeConfig.writeConfig, releaseAdminAction(sessions, publishers, request =>
    publishByReleaseId(releases, (request.params as any).releaseId),
  ))
  app.post('/v1/admin/registry/releases/:releaseId/quarantine', routeConfig.writeConfig, releaseAdminAction(sessions, publishers, request =>
    releases.quarantineRelease((request.params as any).releaseId, ((request.body as any)?.reason ?? 'administrative quarantine') as string, ((request.body as any)?.policyAction ?? 'block') as any),
  ))
  app.post('/v1/admin/registry/releases/:releaseId/revoke', routeConfig.writeConfig, releaseAdminAction(sessions, publishers, request =>
    releases.revokeRelease((request.params as any).releaseId, ((request.body as any)?.reason ?? 'administrative revocation') as string),
  ))

  app.post('/v1/admin/registry/publishers/:publisherId/verify', routeConfig.writeConfig, publisherAdminAction(sessions, publishers, request =>
    publishers.verifyPublisher((request.params as any).publisherId),
  ))
  app.post('/v1/admin/registry/publishers/:publisherId/suspend', routeConfig.writeConfig, publisherAdminAction(sessions, publishers, request =>
    publishers.suspendPublisher((request.params as any).publisherId),
  ))
  app.post('/v1/admin/registry/publishers/:publisherId/revoke', routeConfig.writeConfig, publisherAdminAction(sessions, publishers, request =>
    publishers.revokePublisher((request.params as any).publisherId),
  ))

  // Publisher signing keys: public halves only. Private keys stay with the publisher.
  app.post('/v1/admin/registry/publishers/:publisherId/signing-keys', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      await publishers.requireAdminAccount(auth.accountId)
      const body = (request.body as Record<string, unknown> | undefined) ?? {}
      return reply.code(201).send(successEnvelope(await signingKeys.register(String((request.params as any).publisherId), body, auth.accountId), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Signing key registration failed')
    }
  })
  app.post('/v1/admin/registry/publishers/:publisherId/signing-keys/:keyId/revoke', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      await publishers.requireAdminAccount(auth.accountId)
      const params = request.params as {publisherId: string; keyId: string}
      return reply.send(successEnvelope(await signingKeys.revoke(params.publisherId, params.keyId, (request.body as any)?.reason, auth.accountId), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Signing key revocation failed')
    }
  })
}

async function publishByReleaseId(releases: GreenfieldModuleReleaseService, releaseId: string) {
  const release = await releases.getReleaseById(releaseId)
  if (!release) throw moduleError('NOT_FOUND', 'Release not found')
  return releases.publishRelease(release.moduleId, release.version)
}

function releaseAdminAction(
  sessions: GreenfieldSessionService,
  publishers: GreenfieldModulePublisherService,
  action: (request: FastifyRequest) => Promise<unknown>,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      await publishers.requireAdminAccount(auth.accountId)
      return reply.send(successEnvelope(await action(request), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Administrative release action failed')
    }
  }
}

function publisherAdminAction(
  sessions: GreenfieldSessionService,
  publishers: GreenfieldModulePublisherService,
  action: (request: FastifyRequest) => Promise<unknown>,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      await publishers.requireAdminAccount(auth.accountId)
      return reply.send(successEnvelope(await action(request), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Administrative publisher action failed')
    }
  }
}

async function requireGreenfieldAuth(request: FastifyRequest, reply: FastifyReply, sessions: GreenfieldSessionService) {
  const token = bearerToken(request)
  const auth = token ? await sessions.resolveAccess(token) : null
  if (!auth) {
    sendError(reply, 'UNAUTHENTICATED', 'Authentication required', request.id)
    return null
  }
  return auth
}

function bearerToken(request: FastifyRequest): string {
  const rawHeader = request.headers.authorization
  const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function signatureHeader(request: FastifyRequest, name: string): string | undefined {
  const rawHeader = request.headers[name.toLowerCase()]
  const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
  return typeof header === 'string' && header.trim().length > 0 ? header.trim() : undefined
}

function idempotencyKey(request: FastifyRequest, body: unknown): string {
  const header = request.headers['idempotency-key']
  const fromHeader = Array.isArray(header) ? header[0] : header
  const fromBody = body && typeof body === 'object' ? (body as any).idempotencyKey : undefined
  return String(fromHeader ?? fromBody ?? '').trim()
}

function normalizeRecordQuery(query: Record<string, unknown>): ModuleRecordQuery {
  const reserved = new Set(['cursor', 'limit', 'sort', 'direction', 'q', 'folder', 'createdFrom', 'createdTo', 'updatedFrom', 'updatedTo', 'recordState'])
  const filters: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(query ?? {})) {
    if (key.startsWith('filter.')) {
      const field = key.slice('filter.'.length)
      if (!field || typeof value !== 'string') throw moduleError('VALIDATION_FAILED', 'Invalid encoded module record filter')
      let decoded: unknown
      try {
        decoded = JSON.parse(value)
      } catch {
        throw moduleError('VALIDATION_FAILED', 'Invalid encoded module record filter')
      }
      if (!(decoded === null || ['string', 'number', 'boolean'].includes(typeof decoded))) throw moduleError('VALIDATION_FAILED', 'Invalid encoded module record filter')
      filters[field] = decoded
    } else if (!reserved.has(key) && typeof value !== 'object') filters[key] = value
  }
  if (query.recordState !== undefined && query.recordState !== 'active' && query.recordState !== 'deleted') throw moduleError('VALIDATION_FAILED', 'Invalid module record state')
  const direction: 'asc' | 'desc' | undefined = query.direction === 'asc' ? 'asc' : query.direction === 'desc' ? 'desc' : undefined
  return {
    cursor: stringOrUndefined(query.cursor),
    limit: query.limit === undefined ? undefined : Number(query.limit),
    sort: stringOrUndefined(query.sort),
    direction,
    q: stringOrUndefined(query.q),
    folder: stringOrUndefined(query.folder),
    createdFrom: stringOrUndefined(query.createdFrom),
    createdTo: stringOrUndefined(query.createdTo),
    updatedFrom: stringOrUndefined(query.updatedFrom),
    updatedTo: stringOrUndefined(query.updatedTo),
    recordState: query.recordState === 'deleted' ? 'deleted' : query.recordState === 'active' ? 'active' : undefined,
    filters,
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  return undefined
}

function modulePlatform(value: unknown): 'ios' | 'android' | 'web' | 'desktop' | 'server' {
  return value === 'ios' || value === 'android' || value === 'web' || value === 'desktop' || value === 'server' ? value : 'web'
}

function actorIdForAccount(accountId: string): string {
  return `actor-${accountId}`
}

function sendError(reply: FastifyReply, code: any, message: string, requestId: string) {
  return reply.code(statusForError(code)).send(failureEnvelope(code, message, requestId))
}

function sendMapped(reply: FastifyReply, error: unknown, requestId: string, fallback: string) {
  const code = error && typeof error === 'object' && 'code' in error ? (error as any).code : 'SERVER_ERROR'
  if (typeof code === 'string' && code.startsWith('AI_')) {
    return reply.code(statusForAiError(code)).send(failureEnvelope(code as any, error instanceof Error ? error.message : fallback, requestId))
  }
  if (['VALIDATION_FAILED', 'NOT_FOUND', 'FORBIDDEN', 'PERMISSION_REVIEW_REQUIRED', 'MODULE_PERMISSION_DENIED', 'INSTALLATION_DISABLED', 'UNTRUSTED_RELEASE', 'CONFLICT', 'NOTE_REVISION_CONFLICT', 'CAPABILITY_DISABLED', 'UNAUTHENTICATED'].includes(code)) {
    return sendError(reply, code, error instanceof Error ? error.message : fallback, requestId)
  }
  return sendError(reply, 'SERVER_ERROR', fallback, requestId)
}
