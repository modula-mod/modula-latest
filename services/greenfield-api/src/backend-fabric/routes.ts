import {createHash} from 'node:crypto'
import type {ApiErrorCode} from '@modula/api-contracts'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {GreenfieldDataLedgerService, type DeclareDataSchemaVersionInput, type RecordDataMigrationInput, type RegisterDataResourceInput} from '../data-ledger/index.js'
import {GreenfieldEntitlementService} from '../entitlements/service.js'
import {GreenfieldAccountDataService} from '../account-data/service.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from '../modules/module-errors.js'
import {ModuleBackendTokenService, type ResolvedServiceAssertion} from '../modules/backend/token-service.js'
import {GreenfieldModuleRecordService} from '../modules/record-service.js'
import {collectionPermission, GreenfieldModuleRuntimeAccessService} from '../modules/runtime-access.js'
import {CredentialBrokerClient} from '../secrets/index.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {
  GreenfieldBackendEventJobService,
  type BackendEventPublishInput,
  type BackendJobClaimInput,
  type BackendJobEnqueueInput,
} from './event-job-service.js'

type RouteConfig = Record<string, unknown>

export async function registerBackendFabricRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
): Promise<void> {
  const assertions = new ModuleBackendTokenService(db, config)
  const runtimeAccess = new GreenfieldModuleRuntimeAccessService(db)
  const records = new GreenfieldModuleRecordService(db)
  const ledger = new GreenfieldDataLedgerService(db)
  const credentialBroker = new CredentialBrokerClient(config)
  const eventJobs = new GreenfieldBackendEventJobService(db)
  const entitlements = new GreenfieldEntitlementService(db)
  const accountData = new GreenfieldAccountDataService(db)
  const readConfig: RouteConfig = config.rateLimitEnabled ? {config: {rateLimit: {max: 240, timeWindow: '1 minute'}}} : {}
  const writeConfig: RouteConfig = config.rateLimitEnabled ? {config: {rateLimit: {max: 120, timeWindow: '1 minute'}}} : {}

  const authenticate = async (request: FastifyRequest): Promise<{productId: string; assertion: ResolvedServiceAssertion; rawAssertion: string}> => {
    if (request.headers.authorization !== undefined) {
      throw moduleError('UNAUTHENTICATED', 'Raw user bearer forwarding is forbidden on the backend service API')
    }
    const header = request.headers['x-modula-service-assertion']
    if (typeof header !== 'string' || !header.trim()) throw moduleError('UNAUTHENTICATED', 'Service assertion is required')
    const productId = String((request.params as {productId?: string}).productId ?? '')
    const assertion = await assertions.resolveServiceAssertion(header.trim(), productId)
    if (!assertion) throw moduleError('UNAUTHENTICATED', 'Service assertion is invalid, expired or outside the product scope')
    const service = await db
      .selectFrom('greenfield_module_service_registrations')
      .select('service_registration_id')
      .where('installation_id', '=', assertion.targetInstallationId)
      .where('account_id', '=', assertion.accountId)
      .where('module_id', '=', assertion.targetProductId)
      .where('service_id', '=', assertion.targetServiceId)
      .where('status', '=', 'registered')
      .where('health_state', 'in', ['healthy', 'degraded'])
      .executeTakeFirst()
    if (!service) throw moduleError('FORBIDDEN', 'Target service registration is disabled, unhealthy or unavailable')
    return {productId, assertion, rawAssertion: header.trim()}
  }

  app.get('/v1/backend/products/:productId/identity/context', readConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      const runtime = await scopedRuntime(runtimeAccess, assertion, productId, false)
      return {
        requestId: request.id,
        traceId: assertion.traceId,
        accountId: assertion.accountId,
        organisationId: null,
        productId,
        releaseId: runtime.releaseId,
        installationId: runtime.installationId,
        serviceId: assertion.targetServiceId,
      }
    })
  })

  app.get('/v1/backend/products/:productId/accounts/:accountId', readConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      const accountId = String((request.params as {accountId?: string}).accountId ?? '')
      if (accountId !== assertion.accountId) throw moduleError('FORBIDDEN', 'Service assertion cannot access another account')
      await scopedRuntime(runtimeAccess, assertion, productId, false)
      const account = await db
        .selectFrom('greenfield_accounts')
        .select(['account_id', 'status', 'created_at', 'updated_at'])
        .where('account_id', '=', accountId)
        .executeTakeFirst()
      if (!account) throw moduleError('NOT_FOUND', 'Account not found')
      return {
        accountId: account.account_id,
        status: account.status,
        createdAt: account.created_at.toISOString(),
        updatedAt: account.updated_at.toISOString(),
      }
    })
  })

  app.get('/v1/backend/products/:productId/installations/:installationId', readConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      const runtime = await scopedRuntime(runtimeAccess, assertion, productId, false, installationParam(request))
      return installationView(runtime)
    })
  })

  app.get('/v1/backend/products/:productId/installations/:installationId/capabilities', readConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      await scopedRuntime(runtimeAccess, assertion, productId, false, installationParam(request))
      return effectiveOperations(assertion).map(capability => capabilityGrant(assertion, capability))
    })
  })

  app.post('/v1/backend/products/:productId/capabilities/check', readConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      const body = requireObject(request.body)
      const installationId = requiredString(body.installationId, 'installationId')
      const capability = requiredString(body.capability, 'capability')
      await scopedRuntime(runtimeAccess, assertion, productId, false, installationId)
      const allowed = effectiveOperations(assertion).includes(capability)
      return {allowed, grant: allowed ? capabilityGrant(assertion, capability) : null}
    })
  })

  app.get('/v1/backend/products/:productId/records/:collection', readConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      const collection = collectionParam(request)
      requireAssertionOperation(assertion, collectionPermission(productId, collection, 'read'))
      await scopedRuntime(runtimeAccess, assertion, productId, true)
      const query = request.query as {cursor?: string; limit?: string; q?: string}
      const result = await records.list(assertion.accountId, productId, collection, {
        cursor: stringOrUndefined(query.cursor),
        limit: numberOrUndefined(query.limit),
        q: stringOrUndefined(query.q),
      })
      return {items: result.items, nextCursor: result.nextCursor}
    })
  })

  app.get('/v1/backend/products/:productId/records/:collection/:recordId', readConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      const collection = collectionParam(request)
      requireAssertionOperation(assertion, collectionPermission(productId, collection, 'read'))
      await scopedRuntime(runtimeAccess, assertion, productId, true)
      return records.get(assertion.accountId, productId, collection, recordParam(request))
    })
  })

  app.post('/v1/backend/products/:productId/records/:collection', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      const collection = collectionParam(request)
      requireAssertionOperation(assertion, collectionPermission(productId, collection, 'write'))
      await scopedRuntime(runtimeAccess, assertion, productId, true)
      return executeIdempotent(db, assertion, request, `records.create:${collection}`, async () =>
        records.create(assertion.accountId, productId, collection, {data: requireObject(request.body)}),
      )
    }, 201)
  })

  app.put('/v1/backend/products/:productId/records/:collection/:recordId', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      const collection = collectionParam(request)
      requireAssertionOperation(assertion, collectionPermission(productId, collection, 'write'))
      await scopedRuntime(runtimeAccess, assertion, productId, true)
      return executeIdempotent(db, assertion, request, `records.update:${collection}:${recordParam(request)}`, async () =>
        records.patch(assertion.accountId, productId, collection, recordParam(request), {data: requireObject(request.body)}),
      )
    })
  })

  app.delete('/v1/backend/products/:productId/records/:collection/:recordId', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      const collection = collectionParam(request)
      requireAssertionOperation(assertion, collectionPermission(productId, collection, 'delete'))
      await scopedRuntime(runtimeAccess, assertion, productId, true)
      return executeIdempotent(db, assertion, request, `records.delete:${collection}:${recordParam(request)}`, async () =>
        records.delete(assertion.accountId, productId, collection, recordParam(request)),
      )
    })
  })

  app.get('/v1/backend/products/:productId/installations/:installationId/resources', readConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireAssertionOperation(assertion, dataOperation(productId, 'read'))
      const installationId = installationParam(request)
      await scopedRuntime(runtimeAccess, assertion, productId, false, installationId)
      const query = request.query as {cursor?: string; limit?: string}
      return ledger.list(assertion.accountId, productId, {
        installationId,
        cursor: stringOrUndefined(query.cursor),
        limit: numberOrUndefined(query.limit),
      })
    })
  })

  app.get('/v1/backend/products/:productId/resources/:resourceId', readConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireAssertionOperation(assertion, dataOperation(productId, 'read'))
      await scopedRuntime(runtimeAccess, assertion, productId, false)
      return ledger.get(assertion.accountId, productId, resourceParam(request))
    })
  })

  app.post('/v1/backend/products/:productId/resources', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      requireAssertionOperation(assertion, dataOperation(productId, 'write'))
      await scopedRuntime(runtimeAccess, assertion, productId, false)
      const idempotencyKey = requiredIdempotencyKey(request)
      const input = registrationInput(request.body, idempotencyKey, request.id)
      return executeIdempotent(db, assertion, request, 'resources.register', () => ledger.register(assertion.accountId, productId, input))
    }, 201)
  })

  app.post('/v1/backend/products/:productId/resources/:resourceId/schemas', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      requireAssertionOperation(assertion, dataOperation(productId, 'write'))
      await scopedRuntime(runtimeAccess, assertion, productId, false)
      return ledger.declareSchemaVersion(assertion.accountId, productId, resourceParam(request), schemaInput(request.body, request.id))
    })
  })

  app.post('/v1/backend/products/:productId/resources/:resourceId/migrations', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      requireAssertionOperation(assertion, dataOperation(productId, 'write'))
      await scopedRuntime(runtimeAccess, assertion, productId, false)
      return ledger.recordMigration(assertion.accountId, productId, resourceParam(request), migrationInput(request.body, request.id))
    })
  })

  app.post('/v1/backend/products/:productId/events', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      requireAssertionOperation(assertion, 'events.publish')
      const runtime = await scopedRuntime(runtimeAccess, assertion, productId, true)
      const input = eventPublishInput(request.body)
      if (requiredIdempotencyKey(request) !== input.eventId) throw moduleError('VALIDATION_FAILED', 'Event idempotency key must equal eventId')
      return executeIdempotent(db, assertion, request, `events.publish:${input.eventType}`, () => eventJobs.publishEvent(assertion, runtime, input))
    }, 202)
  })

  app.post('/v1/backend/products/:productId/jobs', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      requireAssertionOperation(assertion, 'jobs.enqueue')
      const runtime = await scopedRuntime(runtimeAccess, assertion, productId, true)
      const input = jobEnqueueInput(request.body)
      if (requiredIdempotencyKey(request) !== input.idempotencyKey) throw moduleError('VALIDATION_FAILED', 'Job idempotency header must equal the body idempotencyKey')
      return executeIdempotent(db, assertion, request, `jobs.enqueue:${input.action}`, () => eventJobs.enqueueJob(assertion, runtime, input))
    }, 201)
  })

  app.post('/v1/backend/products/:productId/jobs/claim', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      requireAssertionOperation(assertion, 'jobs.claim')
      const runtime = await scopedRuntime(runtimeAccess, assertion, productId, true)
      return eventJobs.claimJobs(assertion, runtime, jobClaimInput(request.body))
    })
  })

  app.post('/v1/backend/products/:productId/jobs/:jobId/start', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      requireAssertionOperation(assertion, 'jobs.execute')
      const runtime = await scopedRuntime(runtimeAccess, assertion, productId, true)
      return eventJobs.startJob(assertion, runtime, jobIdParam(request))
    })
  })

  app.post('/v1/backend/products/:productId/jobs/:jobId/succeed', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      requireAssertionOperation(assertion, 'jobs.execute')
      const runtime = await scopedRuntime(runtimeAccess, assertion, productId, true)
      const body = requireObject(request.body)
      return eventJobs.succeedJob(assertion, runtime, jobIdParam(request), nullableString(body.resultReference, 'resultReference'))
    })
  })

  app.post('/v1/backend/products/:productId/jobs/:jobId/fail', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      requireAssertionOperation(assertion, 'jobs.execute')
      const runtime = await scopedRuntime(runtimeAccess, assertion, productId, true)
      const body = requireObject(request.body)
      return eventJobs.failJob(
        assertion,
        runtime,
        jobIdParam(request),
        requiredString(body.errorClass, 'errorClass'),
        requiredBoolean(body.retryable, 'retryable'),
      )
    })
  })

  app.get('/v1/backend/products/:productId/jobs/:jobId/result', readConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireAssertionOperation(assertion, 'jobs.result')
      const runtime = await scopedRuntime(runtimeAccess, assertion, productId, true)
      return eventJobs.jobResult(assertion, runtime, jobIdParam(request))
    })
  })

  app.post('/v1/backend/products/:productId/jobs/:jobId/cancel', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      requireAssertionOperation(assertion, 'jobs.cancel')
      const runtime = await scopedRuntime(runtimeAccess, assertion, productId, true)
      return eventJobs.cancelJob(assertion, runtime, jobIdParam(request))
    })
  })

  app.get('/v1/backend/products/:productId/accounts/:accountId/entitlements', readConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireAssertionOperation(assertion, 'entitlements.read')
      const accountId = String((request.params as {accountId?: string}).accountId ?? '')
      if (accountId !== assertion.accountId) throw moduleError('FORBIDDEN', 'Service assertion cannot read another account entitlement')
      await scopedRuntime(runtimeAccess, assertion, productId, false)
      return entitlements.listAccount(accountId, productId)
    })
  })

  app.post('/v1/backend/products/:productId/entitlements/check', readConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireAssertionOperation(assertion, 'entitlements.read')
      const body = requireObject(request.body)
      const accountId = requiredString(body.accountId, 'accountId')
      if (accountId !== assertion.accountId) throw moduleError('FORBIDDEN', 'Service assertion cannot check another account entitlement')
      await scopedRuntime(runtimeAccess, assertion, productId, false)
      return entitlements.check(accountId, productId, requiredString(body.capability, 'capability'))
    })
  })

  app.post('/v1/backend/products/:productId/usage', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      requireAssertionOperation(assertion, 'entitlements.usage')
      await scopedRuntime(runtimeAccess, assertion, productId, true)
      const body = requireObject(request.body)
      if (requiredIdempotencyKey(request) !== body.idempotencyKey) throw moduleError('VALIDATION_FAILED', 'Usage idempotency header must equal the body idempotencyKey')
      return entitlements.recordUsage(assertion.targetServiceId, assertion.accountId, productId, assertion.targetInstallationId, body)
    }, 201)
  })

  app.post('/v1/backend/products/:productId/secrets/lease', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion, rawAssertion}) => {
      requireAssertionOperation(assertion, 'secrets.use')
      await scopedRuntime(runtimeAccess, assertion, productId, true)
      const body = requireObject(request.body)
      const reference = secretReference(body.reference)
      const purpose = requiredString(body.purpose, 'purpose')
      return credentialBroker.lease({
        serviceAssertion: rawAssertion,
        reference,
        purpose,
        requestId: request.id,
        traceId: assertion.traceId,
      })
    }, 201)
  })

  app.post('/v1/backend/products/:productId/data-requests/claim', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      const body = requireObject(request.body)
      const requestType = dataRequestType(body.requestType)
      requireAssertionOperation(assertion, requestType === 'EXPORT' ? 'data.export' : 'data.delete')
      await scopedRuntime(runtimeAccess, assertion, productId, true)
      return accountData.claimServiceDomains({accountId: assertion.accountId, productId, installationId: assertion.targetInstallationId, serviceId: assertion.targetServiceId}, requestType, optionalInteger(body.maxDomains, 'maxDomains'))
    })
  })

  app.post('/v1/backend/products/:productId/data-request-domains/:domainId/complete', writeConfig, async (request, reply) => {
    return serviceRoute(reply, request, authenticate, async ({productId, assertion}) => {
      requireMutations(config)
      const body = requireObject(request.body)
      const requestType = dataRequestType(body.requestType)
      requireAssertionOperation(assertion, requestType === 'EXPORT' ? 'data.export' : 'data.delete')
      await scopedRuntime(runtimeAccess, assertion, productId, true)
      return accountData.completeServiceDomain(
        {accountId: assertion.accountId, productId, installationId: assertion.targetInstallationId, serviceId: assertion.targetServiceId},
        requiredString((request.params as {domainId?: unknown}).domainId, 'domainId'),
        requestType,
        body,
      )
    })
  })
}

async function serviceRoute<T>(
  reply: FastifyReply,
  request: FastifyRequest,
  authenticate: (request: FastifyRequest) => Promise<{productId: string; assertion: ResolvedServiceAssertion; rawAssertion: string}>,
  operation: (context: {productId: string; assertion: ResolvedServiceAssertion; rawAssertion: string}) => Promise<T>,
  successStatus = 200,
) {
  try {
    const context = await authenticate(request)
    const result = await operation(context)
    return reply.code(successStatus).send(successEnvelope(result, request.id))
  } catch (error) {
    const code = domainCode(error)
    return reply.code(statusForError(code)).send(failureEnvelope(code, errorMessage(error), request.id))
  }
}

async function scopedRuntime(
  runtimeAccess: GreenfieldModuleRuntimeAccessService,
  assertion: ResolvedServiceAssertion,
  productId: string,
  requireEnabled: boolean,
  expectedInstallationId = assertion.targetInstallationId,
) {
  if (expectedInstallationId !== assertion.targetInstallationId) throw moduleError('FORBIDDEN', 'Service assertion cannot access another installation')
  const runtime = await runtimeAccess.resolve(assertion.accountId, productId, {requireEnabled})
  if (runtime.installationId !== assertion.targetInstallationId) throw moduleError('FORBIDDEN', 'Service assertion installation is no longer current')
  return runtime
}

function installationView(runtime: Awaited<ReturnType<GreenfieldModuleRuntimeAccessService['resolve']>>) {
  return {
    installationId: runtime.installationId,
    accountId: runtime.accountId,
    productId: runtime.moduleId,
    releaseId: runtime.releaseId,
    version: runtime.version,
    status: runtime.installationStatus,
    releaseState: runtime.releaseState,
  }
}

function capabilityGrant(assertion: ResolvedServiceAssertion, capability: string) {
  return {
    grantId: `service-assertion-grant:${sha256(`${assertion.jti}:${capability}`).slice(0, 40)}`,
    capabilityId: capability,
    granteeServiceId: assertion.targetServiceId,
    scope: assertion.scope,
    issuedAt: assertion.issuedAt.toISOString(),
    expiresAt: assertion.expiresAt.toISOString(),
    revokedAt: null,
    provenance: assertion.jti,
  }
}

function effectiveOperations(assertion: ResolvedServiceAssertion): string[] {
  return Array.from(new Set([...assertion.capabilities, ...assertion.scope.operations])).sort()
}

function requireAssertionOperation(assertion: ResolvedServiceAssertion, operation: string): void {
  if (!effectiveOperations(assertion).includes(operation)) throw moduleError('FORBIDDEN', `Service assertion capability denied: ${operation}`)
}

function dataOperation(productId: string, operation: 'read' | 'write'): string {
  return `data:module.${productId}:${operation}`
}

async function executeIdempotent<T>(
  db: ModulaDb,
  assertion: ResolvedServiceAssertion,
  request: FastifyRequest,
  action: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (!assertion.actorId) throw moduleError('FORBIDDEN', 'Idempotent service mutation requires an accountable actor')
  const suppliedKey = requiredIdempotencyKey(request)
  const key = `backend:${assertion.targetProductId}:${action}:${suppliedKey}`
  const requestHash = sha256(canonicalJsonStringify({method: request.method, url: request.url.split('?')[0], body: request.body ?? null}))
  const now = new Date()
  const reservationId = `backend-idempotency:${uuidv7()}`
  const inserted = await db
    .insertInto('idempotency_keys')
    .values({
      id: reservationId,
      actor_id: assertion.actorId,
      key,
      request_hash: requestHash,
      response_status: null,
      response_body: null,
      created_at: now,
      updated_at: now,
      expires_at: new Date(now.getTime() + 60 * 60 * 1000),
    })
    .onConflict(conflict => conflict.columns(['actor_id', 'key']).doNothing())
    .returning('id')
    .executeTakeFirst()
  if (!inserted) {
    const previous = await db
      .selectFrom('idempotency_keys')
      .select(['request_hash', 'response_status', 'response_body', 'expires_at'])
      .where('actor_id', '=', assertion.actorId)
      .where('key', '=', key)
      .executeTakeFirstOrThrow()
    if (previous.request_hash !== requestHash) throw moduleError('CONFLICT', 'Idempotency key was already used for another request')
    if (previous.response_status === null || previous.response_body === null) throw moduleError('CONFLICT', 'Idempotent request is already in progress')
    return previous.response_body as T
  }
  try {
    const result = await operation()
    await db
      .updateTable('idempotency_keys')
      .set({response_status: 200, response_body: jsonValue(result), updated_at: new Date()})
      .where('id', '=', reservationId)
      .execute()
    return result
  } catch (error) {
    await db.deleteFrom('idempotency_keys').where('id', '=', reservationId).execute()
    throw error
  }
}

function registrationInput(value: unknown, idempotencyKey: string, requestId: string): RegisterDataResourceInput {
  const body = requireObject(value)
  const input = body as unknown as RegisterDataResourceInput
  return {...input, idempotencyKey, requestId}
}

function schemaInput(value: unknown, requestId: string): DeclareDataSchemaVersionInput {
  const body = requireObject(value)
  return {...body as unknown as DeclareDataSchemaVersionInput, requestId}
}

function migrationInput(value: unknown, requestId: string): RecordDataMigrationInput {
  const body = requireObject(value) as Record<string, unknown>
  return {
    ...body as unknown as RecordDataMigrationInput,
    startedAt: optionalDate(body.startedAt, 'startedAt'),
    finishedAt: optionalDate(body.finishedAt, 'finishedAt'),
    requestId,
  }
}

function eventPublishInput(value: unknown): BackendEventPublishInput {
  const body = requireObject(value)
  const classification = requiredString(body.classification, 'classification')
  if (!['public', 'internal', 'private', 'sensitive', 'restricted'].includes(classification)) {
    throw moduleError('VALIDATION_FAILED', 'classification is not supported')
  }
  return {
    eventId: requiredString(body.eventId, 'eventId'),
    eventType: requiredString(body.eventType, 'eventType'),
    schemaVersion: requiredString(body.schemaVersion, 'schemaVersion'),
    producer: requiredString(body.producer, 'producer'),
    accountId: nullableString(body.accountId, 'accountId'),
    installationId: nullableString(body.installationId, 'installationId'),
    occurredAt: requiredString(body.occurredAt, 'occurredAt'),
    traceId: requiredString(body.traceId, 'traceId'),
    classification: classification as BackendEventPublishInput['classification'],
    payload: requireObject(body.payload),
  }
}

function jobEnqueueInput(value: unknown): BackendJobEnqueueInput {
  const body = requireObject(value)
  if (!Object.prototype.hasOwnProperty.call(body, 'input')) throw moduleError('VALIDATION_FAILED', 'input is required')
  return {
    jobId: requiredString(body.jobId, 'jobId'),
    ownerAccountId: requiredString(body.ownerAccountId, 'ownerAccountId'),
    productId: requiredString(body.productId, 'productId'),
    installationId: requiredString(body.installationId, 'installationId'),
    action: requiredString(body.action, 'action'),
    serviceId: requiredString(body.serviceId, 'serviceId'),
    maximumAttempts: requiredInteger(body.maximumAttempts, 'maximumAttempts'),
    timeoutMs: requiredInteger(body.timeoutMs, 'timeoutMs'),
    idempotencyKey: requiredString(body.idempotencyKey, 'idempotencyKey'),
    traceId: requiredString(body.traceId, 'traceId'),
    input: body.input,
  }
}

function jobClaimInput(value: unknown): BackendJobClaimInput {
  if (value === undefined || value === null) return {}
  const body = requireObject(value)
  let actions: string[] | undefined
  if (body.actions !== undefined) {
    if (!Array.isArray(body.actions) || !body.actions.every(item => typeof item === 'string')) throw moduleError('VALIDATION_FAILED', 'actions must be an array of strings')
    actions = body.actions.map(item => item.trim())
  }
  return {
    actions,
    maxJobs: optionalInteger(body.maxJobs, 'maxJobs'),
    leaseDurationMs: optionalInteger(body.leaseDurationMs, 'leaseDurationMs'),
  }
}

function optionalDate(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') throw moduleError('VALIDATION_FAILED', `${field} must be an ISO timestamp or null`)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw moduleError('VALIDATION_FAILED', `${field} must be an ISO timestamp or null`)
  return parsed
}

function requiredIdempotencyKey(request: FastifyRequest): string {
  const value = request.headers['idempotency-key']
  if (typeof value !== 'string' || !value.trim() || value.length > 180) throw moduleError('VALIDATION_FAILED', 'A bounded idempotency-key header is required')
  return value.trim()
}

function collectionParam(request: FastifyRequest): string {
  return requiredString((request.params as {collection?: unknown}).collection, 'collection')
}

function recordParam(request: FastifyRequest): string {
  return requiredString((request.params as {recordId?: unknown}).recordId, 'recordId')
}

function resourceParam(request: FastifyRequest): string {
  return requiredString((request.params as {resourceId?: unknown}).resourceId, 'resourceId')
}

function jobIdParam(request: FastifyRequest): string {
  return requiredString((request.params as {jobId?: unknown}).jobId, 'jobId')
}

function installationParam(request: FastifyRequest): string {
  return requiredString((request.params as {installationId?: unknown}).installationId, 'installationId')
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw moduleError('VALIDATION_FAILED', 'Request body must be an object')
  return value as Record<string, unknown>
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 240) throw moduleError('VALIDATION_FAILED', `${field} is required`)
  return value.trim()
}

function nullableString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null
  return requiredString(value, field)
}

function requiredInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw moduleError('VALIDATION_FAILED', `${field} must be an integer`)
  return value
}

function optionalInteger(value: unknown, field: string): number | undefined {
  return value === undefined ? undefined : requiredInteger(value, field)
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw moduleError('VALIDATION_FAILED', `${field} must be a boolean`)
  return value
}

function dataRequestType(value: unknown): 'EXPORT' | 'DELETE' {
  if (value !== 'EXPORT' && value !== 'DELETE') throw moduleError('VALIDATION_FAILED', 'requestType must be EXPORT or DELETE')
  return value
}

function secretReference(value: unknown): string {
  const reference = requiredString(value, 'reference')
  if (!/^secret:\/\/[a-z0-9][a-z0-9._/-]{2,250}$/.test(reference)) throw moduleError('VALIDATION_FAILED', 'reference must be a bounded secret:// handle')
  return reference
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) throw moduleError('VALIDATION_FAILED', 'limit must be an integer from 1 to 100')
  return parsed
}

function requireMutations(config: AppConfig): void {
  if (!config.mutationsEnabled) throw moduleError('CAPABILITY_DISABLED', 'Backend service mutations are disabled')
}

const EXPOSED_DOMAIN_CODES = new Set<ApiErrorCode>([
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'FORBIDDEN',
  'CONFLICT',
  'NOTE_REVISION_CONFLICT',
  'CAPABILITY_DISABLED',
  'UNAUTHENTICATED',
  'RATE_LIMITED',
])

function domainCode(error: unknown): ApiErrorCode {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as {code?: unknown}).code === 'string') {
    const code = (error as {code: string}).code as ApiErrorCode
    if (EXPOSED_DOMAIN_CODES.has(code)) return code
  }
  return 'SERVER_ERROR'
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && domainCode(error) !== 'SERVER_ERROR') return error.message
  return 'Backend service request failed'
}

function jsonValue<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value))
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}
