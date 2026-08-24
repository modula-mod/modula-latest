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
import {GreenfieldExtensionFabricService} from '../extension-fabric-service.js'

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
): Promise<void> {
  const registry = new GreenfieldModuleRegistryService(db)
  const marketplace = new GreenfieldModuleMarketplaceService(db)
  const releases = new GreenfieldModuleReleaseService(db)
  const publishers = new GreenfieldModulePublisherService(db, config)
  const installations = new GreenfieldModuleInstallationService(db, config)
  const updates = new GreenfieldModuleUpdateService(db, config)
  const uninstall = new GreenfieldModuleUninstallService(db, config)
  const settings = new GreenfieldModuleSettingsService(db, config)
  const contributions = new GreenfieldModuleContributionService(db, config)
  const views = new GreenfieldModuleViewService(db)
  const records = new GreenfieldModuleRecordService(db)
  const actions = new GreenfieldModuleActionService(db, config)
  const exports = new GreenfieldModuleExportService(db, config)
  const health = new GreenfieldModuleHealthService(db, config)
  const runtimeAccess = new GreenfieldModuleRuntimeAccessService(db)
  const runtime2 = new GreenfieldModuleRuntime2Service(db)
  const backendDiscovery = new ModuleBackendDiscoveryService(db)
  const backendHealth = new GreenfieldModuleBackendHealthService(db, config)
  const backendLifecycle = new ModuleBackendLifecycleService(db)
  const backendEvents = new ModuleBackendEventService(db, config)
  const backendWebhooks = new ModuleBackendWebhookService(db, config)
  const backendGateway = new ModuleBackendGatewayService(db, config)
  const extensionFabric = new GreenfieldExtensionFabricService(db)

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
      return reply.send(successEnvelope(await registry.getModule(canonicalModuleParam(request)), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module lookup failed')
    }
  })

  app.get('/v1/registry/products/:productId', routeConfig.profileConfig, async (request, reply) => {
    if (!requireRegistry(reply, request.id)) return
    try {
      return reply.send(successEnvelope(await registry.getModule(String((request.params as any).productId)), request.id))
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
      return reply.send(successEnvelope(await registry.getVersion(canonicalModuleParam(request), params.version), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Module version lookup failed')
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
          serviceId: String(body.serviceId ?? 'extension-backend'),
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
            version: body.version,
            approvedPermissions: body.approvedPermissions,
            platform: modulePlatform(body.platform),
            idempotencyKey: idempotencyKey(request, body),
          }),
          request.id,
        ),
      )
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Install failed')
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

  app.post('/v1/modules/:moduleId/update', routeConfig.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      const body = (request.body as any) ?? {}
      return reply.code(202).send(
        successEnvelope(
          await updates.update(auth.accountId, canonicalModuleParam(request), {
            version: body.version,
            approvedPermissionIncrease: Boolean(body.approvedPermissionIncrease),
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
      return reply.code(202).send(successEnvelope({queued: false, githubSyncEnabled: config.moduleGithubSyncEnabled}, request.id))
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
  const reserved = new Set(['cursor', 'limit', 'sort', 'direction', 'q', 'folder', 'createdFrom', 'createdTo', 'updatedFrom', 'updatedTo'])
  const filters: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(query ?? {})) {
    if (!reserved.has(key) && typeof value !== 'object') filters[key] = value
  }
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
  if (['VALIDATION_FAILED', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT', 'NOTE_REVISION_CONFLICT', 'CAPABILITY_DISABLED', 'UNAUTHENTICATED'].includes(code)) {
    return sendError(reply, code, error instanceof Error ? error.message : fallback, requestId)
  }
  return sendError(reply, 'SERVER_ERROR', fallback, requestId)
}
