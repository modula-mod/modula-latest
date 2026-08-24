import {createHash, randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {
  GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
  createDefaultModuleSectionVersions,
  manifestChecksum,
  type GreenfieldModuleManifest,
} from '@modula/greenfield-module-manifest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleDependencyResolver} from '../src/modules/dependency-resolver.js'
import {GreenfieldExtensionFabricService} from '../src/modules/extension-fabric-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldModuleRuntimeAccessService} from '../src/modules/runtime-access.js'
import {ModuleBackendTokenService} from '../src/modules/backend/token-service.js'
import {createDb as createWorkerDb, type ModulaWorkerDb} from '../../greenfield-worker/src/database.js'
import {loadConfig as loadWorkerConfig} from '../../greenfield-worker/src/config.js'
import {handleModuleInstall} from '../../greenfield-worker/src/modules/installation-handler.js'
import {handleModuleEnable} from '../../greenfield-worker/src/modules/enable-handler.js'
import {handleModuleDisable} from '../../greenfield-worker/src/modules/disable-handler.js'
import {handleExtensionEventDispatch} from '../../greenfield-worker/src/modules/extension-event-handler.js'
import {handleExtensionJob} from '../../greenfield-worker/src/modules/extension-job-handler.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const suffix = randomUUID().slice(0, 8)
const coreId = `digital.modula.fabric-notes.${suffix}`
const formattingId = `digital.modula.fabric-notes.${suffix}.formatting`
const backgroundId = `digital.modula.fabric-notes.${suffix}.background`
const editorPoint = 'fabric-notes.editor.command'
const afterSavePoint = 'fabric-notes.note.after-save'
const editorCapability = 'notes.editor.contribute'
const eventsCapability = 'notes.events.subscribe'

describeIfDb('PVP Platform 2 governed extension fabric', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let workerDb: ModulaWorkerDb
  let tokenA = ''
  let accountA = ''
  let accountB = ''
  let coreInstallationId = ''
  let formattingInstallationId = ''
  let coreReleaseId = ''
  let formattingReleaseId = ''
  let backgroundReleaseId = ''

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    workerDb = createWorkerDb(databaseUrl!)
    await app.ready()
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    const first = await registerAccount(`fabric-a-${suffix}@example.com`, `fabrica${suffix}`.slice(0, 20))
    const second = await registerAccount(`fabric-b-${suffix}@example.com`, `fabricb${suffix}`.slice(0, 20))
    tokenA = first.token
    accountA = first.accountId
    accountB = second.accountId
    coreReleaseId = (await publish(coreManifest())).releaseId
    formattingReleaseId = (await publish(formattingManifest())).releaseId
    backgroundReleaseId = (await publish(backgroundManifest())).releaseId
  })

  afterAll(async () => {
    await app?.close()
    await workerDb?.destroy()
    await db?.destroy()
  })

  it('installs a standalone module, then resolves a targeted plugin with real permission review', async () => {
    const coreInstall = await install(coreId, '1.1.0', [], `core-install-${suffix}`)
    expect(coreInstall.statusCode).toBe(202)
    coreInstallationId = coreInstall.json().data.installationId
    await handleModuleInstall(workerDb, loadWorkerConfig(), {
      planId: await planId(coreInstallationId),
      installationId: coreInstallationId,
      releaseId: coreReleaseId,
      moduleId: coreId,
      accountId: accountA,
    })
    await enable(coreId, coreInstallationId, coreReleaseId, `core-enable-${suffix}`)

    const preview = await app.inject({
      method: 'POST',
      url: `/v1/modules/${formattingId}/install-preview`,
      headers: {authorization: `Bearer ${tokenA}`},
      payload: {version: '0.1.0'},
    })
    expect(preview.statusCode, preview.body).toBe(200)
    expect(preview.json().data).toMatchObject({productKind: 'plugin', compatible: true})
    expect(preview.json().data.extensionTargets).toEqual([expect.objectContaining({
      productId: coreId,
      installedVersion: '1.1.0',
      compatible: true,
      requiredCapabilities: [editorCapability],
      requiredExtensionPoints: [editorPoint],
    })])

    const pluginInstall = await install(formattingId, '0.1.0', [editorCapability], `formatting-install-${suffix}`)
    expect(pluginInstall.statusCode).toBe(202)
    formattingInstallationId = pluginInstall.json().data.installationId
    await handleModuleInstall(workerDb, loadWorkerConfig(), {
      planId: await planId(formattingInstallationId),
      installationId: formattingInstallationId,
      releaseId: formattingReleaseId,
      moduleId: formattingId,
      accountId: accountA,
    })
    const projected = await db.selectFrom('greenfield_extension_runtime_projection').selectAll().where('installation_id', '=', formattingInstallationId).executeTakeFirstOrThrow()
    expect(projected).toMatchObject({product_kind: 'plugin', state: 'INSTALLED'})
    const grants = await db.selectFrom('greenfield_extension_capability_grants').select(['capability', 'state']).where('consumer_installation_id', '=', formattingInstallationId).execute()
    expect(grants).toEqual([expect.objectContaining({capability: editorCapability, state: 'granted'})])
  })

  it('composes enabled contributions generically and removes them at the extension boundary', async () => {
    await enable(formattingId, formattingInstallationId, formattingReleaseId, `formatting-enable-${suffix}`)
    let host = await composition()
    expect(host.extensions).toEqual([expect.objectContaining({
      extension_product_id: formattingId,
      contribution_kind: 'editor.command',
      extension_point: editorPoint,
      contract_id: 'vault.format.heading',
    })])
    expect(JSON.stringify(host.core.manifest)).not.toContain(formattingId)

    const disable = await app.inject({
      method: 'POST',
      url: `/v1/modules/${formattingId}/disable`,
      headers: {authorization: `Bearer ${tokenA}`, 'idempotency-key': `formatting-disable-${suffix}`},
    })
    expect(disable.statusCode).toBe(202)
    await handleModuleDisable(workerDb, {installationId: formattingInstallationId, releaseId: formattingReleaseId, moduleId: formattingId, accountId: accountA})
    host = await composition()
    expect(host.extensions).toEqual([])
    expect(host.target.status).toBe('enabled')

    await enable(formattingId, formattingInstallationId, formattingReleaseId, `formatting-reenable-${suffix}`)
    expect((await composition()).extensions).toHaveLength(1)
  })

  it('denies undeclared capability escalation and cross-account resource access', async () => {
    const broker = new GreenfieldExtensionFabricService(db)
    await expect(broker.assertInvocation({
      accountId: accountA,
      extensionProductId: formattingId,
      targetProductId: coreId,
      contributionId: 'format.heading',
      actionId: 'vault.format.heading',
      requiredCapabilities: ['notes.delete'],
    })).rejects.toMatchObject({code: 'FORBIDDEN'})

    await db.insertInto('greenfield_module_records').values({
      record_id: `account-b-note-${suffix}`,
      account_id: accountB,
      module_id: coreId,
      installation_id: null,
      collection: 'note',
      schema_ref: 'schema:fabric-note',
      visibility: 'private',
      data: {title: 'Account B private note', body: 'never disclose'},
      search_text: 'account b private note',
      folder_ref: null,
      source_uri: null,
      retained_after_uninstall: false,
      revision: 1,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    }).execute()
    await expect(broker.assertInvocation({
      accountId: accountA,
      extensionProductId: formattingId,
      targetProductId: coreId,
      contributionId: 'format.heading',
      actionId: 'vault.format.heading',
      requiredCapabilities: [editorCapability],
      resource: {type: 'moduleRecord', id: `account-b-note-${suffix}`, collection: 'note'},
    })).rejects.toMatchObject({code: 'NOT_FOUND'})
  })

  it('issues the existing Greenfield signed token as a scoped service assertion and never records raw bearer forwarding', async () => {
    const context = await new GreenfieldModuleRuntimeAccessService(db).resolve(accountA, formattingId, {requireEnabled: true})
    const issued = await new ModuleBackendTokenService(db, loadConfig()).issue({
      context,
      actorId: `account:${accountA}`,
      permissions: [editorCapability],
      capabilities: [editorCapability],
      requestId: `service-request-${suffix}`,
      backend: {
        mode: 'self-hosted',
        protocolVersion: '1.0.0',
        authentication: {tokenExchangeRequired: true, audience: 'modula-vault-formatting', tokenTtlSeconds: 120},
      } as any,
      extensionInvocation: {
        consumerProductId: formattingId,
        targetProductId: coreId,
        targetInstallationId: coreInstallationId,
        actionId: 'vault.format.heading',
        serviceId: 'formatting-service',
        scope: {type: 'action', ref: 'vault.format.heading'},
      },
    })
    expect(issued.claims).toMatchObject({consumer: formattingId, target: coreId, actionId: 'vault.format.heading'})
    expect(issued.claims.expiresAt - issued.claims.issuedAt).toBeLessThanOrEqual(900)
    const assertion = await db.selectFrom('greenfield_extension_service_assertions').selectAll().where('jti', '=', issued.claims.jti!).executeTakeFirstOrThrow()
    expect(assertion.raw_user_bearer_forwarded).toBe(false)
    expect(assertion.capabilities).toEqual([editorCapability])
    expect(assertion.expires_at.getTime() - assertion.issued_at.getTime()).toBeLessThanOrEqual(15 * 60_000)
  })

  it('records one failed contribution without taking down its core host', async () => {
    const failure = await app.inject({
      method: 'POST',
      url: `/v1/extensions/${formattingId}/contributions/format.heading/fail`,
      headers: {authorization: `Bearer ${tokenA}`},
      payload: {errorCode: 'TEST_ONLY_CONTRIBUTION_FAILURE'},
    })
    expect(failure.statusCode, failure.body).toBe(200)
    expect(failure.json().data).toMatchObject({status: 'failed', coreHostUnaffected: true})
    const host = await composition()
    expect(host.extensions).toEqual([])
    expect(host.target.status).toBe('enabled')
    const audit = await db
      .selectFrom('audit_events')
      .select(['event_type', 'account_id', 'metadata'])
      .where('event_type', '=', 'extension.contribution.failed')
      .where('account_id', '=', accountA)
      .executeTakeFirstOrThrow()
    expect(audit.metadata).toMatchObject({contributionId: 'format.heading', errorCode: 'TEST_ONLY_CONTRIBUTION_FAILURE'})
  })

  it('routes declared background actions and versioned events through account-scoped, redacted jobs', async () => {
    const backgroundInstall = await install(backgroundId, '0.1.0', [eventsCapability], `background-install-${suffix}`)
    expect(backgroundInstall.statusCode, backgroundInstall.body).toBe(202)
    const backgroundInstallationId = backgroundInstall.json().data.installationId as string
    await handleModuleInstall(workerDb, loadWorkerConfig(), {
      planId: await planId(backgroundInstallationId),
      installationId: backgroundInstallationId,
      releaseId: backgroundReleaseId,
      moduleId: backgroundId,
      accountId: accountA,
    })
    await enable(backgroundId, backgroundInstallationId, backgroundReleaseId, `background-enable-${suffix}`)

    const denied = await app.inject({
      method: 'POST',
      url: `/v1/extensions/${formattingId}/jobs`,
      headers: {authorization: `Bearer ${tokenA}`, 'idempotency-key': `undeclared-job-${suffix}`},
      payload: {targetProductId: coreId, contributionId: 'format.heading', actionId: 'vault.format.heading'},
    })
    expect(denied.statusCode).toBe(403)

    const queued = await app.inject({
      method: 'POST',
      url: `/v1/extensions/${backgroundId}/jobs`,
      headers: {authorization: `Bearer ${tokenA}`, 'idempotency-key': `declared-job-${suffix}`},
      payload: {
        targetProductId: coreId,
        contributionId: 'background.index',
        actionId: 'fabric.background.index',
        metadata: {noteBody: 'private content must not enter operational metadata', operation: 'index'},
      },
    })
    expect(queued.statusCode, queued.body).toBe(202)
    const executionId = queued.json().data.execution_id as string
    await handleExtensionJob(workerDb, {executionId, accountId: accountA, extensionProductId: backgroundId, requestId: `job-request-${suffix}`})
    const execution = await db.selectFrom('greenfield_extension_job_executions').selectAll().where('execution_id', '=', executionId).executeTakeFirstOrThrow()
    expect(execution).toMatchObject({status: 'FAILED', failure_code: 'PROVIDER_NOT_CONFIGURED', attempt_count: 1})
    expect(execution.redacted_metadata).toMatchObject({noteBody: '[redacted]', operation: 'index'})

    const subscription = await db
      .selectFrom('greenfield_extension_event_subscriptions')
      .selectAll()
      .where('installation_id', '=', backgroundInstallationId)
      .where('event_type', '=', 'vault.note.updated.v1')
      .executeTakeFirstOrThrow()
    expect(subscription).toMatchObject({status: 'enabled', required_capability: eventsCapability})
    const eventId = `fabric-event-${suffix}`
    await handleExtensionEventDispatch(workerDb, {
      subscriberId: subscription.subscription_id,
      event: {eventId, eventType: 'vault.note.updated.v1', accountId: accountA, requestId: `event-request-${suffix}`, payload: {moduleId: coreId, recordId: 'opaque-record-id'}},
    })
    const eventJob = await db
      .selectFrom('greenfield_extension_job_executions')
      .selectAll()
      .where('owner_installation_id', '=', backgroundInstallationId)
      .where('idempotency_key', '=', eventId)
      .executeTakeFirstOrThrow()
    expect(eventJob).toMatchObject({status: 'QUEUED', account_id: accountA, action_id: 'event:vault.note.updated.v1'})

    await handleExtensionEventDispatch(workerDb, {
      subscriberId: subscription.subscription_id,
      event: {eventId: `cross-account-event-${suffix}`, eventType: 'vault.note.updated.v1', accountId: accountB, payload: {moduleId: coreId}},
    })
    expect(await db.selectFrom('greenfield_extension_job_executions').select('execution_id').where('account_id', '=', accountB).where('extension_product_id', '=', backgroundId).execute()).toEqual([])
  })

  it('rejects deterministic A to B to C to A dependency cycles with a bounded path', async () => {
    const cycleA = `digital.modula.cycle-a.${suffix}`
    const cycleB = `digital.modula.cycle-b.${suffix}`
    const cycleC = `digital.modula.cycle-c.${suffix}`
    await publish(extensionManifest(cycleB, cycleC))
    await publish(extensionManifest(cycleC, cycleA))
    const proposed = extensionManifest(cycleA, cycleB)
    const plan = await new GreenfieldModuleDependencyResolver(db).resolve({moduleId: cycleA, manifest: proposed})
    expect(plan.installable).toBe(false)
    expect(plan.circular).toBe(true)
    expect(plan.errors.join('\n')).toContain('DEPENDENCY_CYCLE')
    expect(plan.cyclePath).toEqual([cycleA, cycleB, cycleC, cycleA])
    expect(plan.graphDepth).toBeLessThanOrEqual(16)
    expect(plan.graphNodes).toBeLessThanOrEqual(256)
  })

  it('quarantines an artifact whose manifest changes after checksum capture', async () => {
    const tampered = manifest(`digital.modula.tamper-${suffix}`, '1.0.0', {})
    const releases = new GreenfieldModuleReleaseService(db)
    const imported = await releases.importPendingReview(tampered, releaseEvidence(tampered))
    await db.updateTable('greenfield_module_versions')
      .set({manifest: {...tampered, description: 'tampered after checksum'}})
      .where('module_version_id', '=', `module-version:${tampered.moduleId}:${tampered.version}`)
      .execute()
    await expect(releases.publishRelease(tampered.moduleId, tampered.version)).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
    const quarantined = await db.selectFrom('greenfield_module_releases').select('release_state').where('release_id', '=', imported.releaseId).executeTakeFirstOrThrow()
    expect(quarantined.release_state).toBe('quarantined')
    const registrations = await db.selectFrom('greenfield_extension_contribution_registrations').select('contribution_registration_id').where('release_id', '=', imported.releaseId).execute()
    expect(registrations).toEqual([])
  })

  async function publish(manifest: GreenfieldModuleManifest) {
    const releases = new GreenfieldModuleReleaseService(db)
    const existing = await releases.getRelease(manifest.moduleId, manifest.version)
    if (existing) return existing
    await releases.importPendingReview(manifest, releaseEvidence(manifest))
    return releases.publishRelease(manifest.moduleId, manifest.version)
  }

  async function registerAccount(email: string, handle: string) {
    const password = 'secure-pass-word-1'
    const register = await app.inject({method: 'POST', url: '/v1/accounts/register', payload: {email, password, handle, displayName: 'Fabric Test', acceptedTerms: true}})
    expect(register.statusCode).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect(session.statusCode).toBe(200)
    return {accountId: register.json().data.accountId as string, token: session.json().data.accessToken as string}
  }

  function install(productId: string, version: string, approvedPermissions: string[], idempotencyKey: string) {
    return app.inject({
      method: 'POST',
      url: `/v1/modules/${productId}/install`,
      headers: {authorization: `Bearer ${tokenA}`, 'idempotency-key': idempotencyKey},
      payload: {version, approvedPermissions},
    })
  }

  async function enable(productId: string, installationId: string, releaseId: string, idempotencyKey: string) {
    const response = await app.inject({method: 'POST', url: `/v1/modules/${productId}/enable`, headers: {authorization: `Bearer ${tokenA}`, 'idempotency-key': idempotencyKey}})
    expect(response.statusCode).toBe(202)
    await handleModuleEnable(workerDb, loadWorkerConfig(), {installationId, releaseId, moduleId: productId, accountId: accountA})
  }

  async function composition() {
    const response = await app.inject({method: 'GET', url: `/v1/module-host/${coreId}/composition?platform=web`, headers: {authorization: `Bearer ${tokenA}`}})
    expect(response.statusCode).toBe(200)
    return response.json().data
  }

  async function planId(installationId: string) {
    return (await db.selectFrom('greenfield_module_install_plans').select('plan_id').where('installation_id', '=', installationId).executeTakeFirstOrThrow()).plan_id
  }
})

function configureTestEnv() {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4042'
  process.env.MODULA_PUBLIC_API_URL = 'https://api.test.modula.digital'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
  process.env.MODULA_INVITE_ONLY = 'false'
  process.env.MODULA_REGISTRATION_MODE = 'open'
  process.env.GREENFIELD_MODULE_REGISTRY_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_INSTALLATION_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_FIRST_PARTY_EXECUTION_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_COMMUNITY_EXECUTION_ENABLED = 'true'
  process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
  process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'pvp-platform-2-test-signing-key'
  process.env.MODULA_MODULE_SECRETS_KEY = 'pvp-platform-2-module-secret-key'
}

function coreManifest(): GreenfieldModuleManifest {
  return manifest(coreId, '1.1.0', {
    permissions: [],
    extensionProduct: {
      version: '1.1.0',
      kind: 'module',
      targets: [],
      extensionPoints: [{
        id: editorPoint,
        title: 'Editor commands',
        contributionKinds: ['editor.command'],
        requiredCapability: editorCapability,
        platforms: ['ios', 'android', 'web'],
        maxContributions: 20,
      }, {
        id: afterSavePoint,
        title: 'After-save actions',
        contributionKinds: ['background.action'],
        platforms: ['ios', 'android', 'web'],
        maxContributions: 20,
      }],
      contributions: [],
      retention: {defaultMode: 'KEEP_DATA', supportsUserChoice: true},
      graphPolicy: {maxDepth: 16, maxNodes: 256},
    },
  })
}

function backgroundManifest(): GreenfieldModuleManifest {
  return manifest(backgroundId, '0.1.0', {
    permissions: [{permission: eventsCapability, reason: 'Subscribe to declared note events', risk: 'medium'}],
    contributions: {
      events: [{
        id: 'background.events.note-updated',
        title: 'Note updated',
        eventType: 'vault.note.updated.v1',
        direction: 'subscribes',
      }],
    },
    extensionProduct: {
      version: '0.1.0',
      kind: 'addon',
      targets: [{
        productId: coreId,
        versionRange: '>=1.1.0 <2.0.0',
        requiredCapabilities: [eventsCapability],
        requiredExtensionPoints: [afterSavePoint],
      }],
      extensionPoints: [],
      contributions: [{
        id: 'background.index',
        title: 'Index after save',
        kind: 'background.action',
        extensionPoint: afterSavePoint,
        functionId: 'fabric.background.index',
        requiredCapability: eventsCapability,
        availability: {platforms: ['ios', 'android', 'web'], requiresOnline: false},
      }],
      retention: {defaultMode: 'KEEP_DATA', supportsUserChoice: true},
    },
  })
}

function formattingManifest(): GreenfieldModuleManifest {
  return manifest(formattingId, '0.1.0', {
    permissions: [{permission: editorCapability, reason: 'Register declared editor commands', risk: 'low'}],
    extensionProduct: {
      version: '0.1.0',
      kind: 'plugin',
      targets: [{productId: coreId, versionRange: '>=1.1.0 <2.0.0', requiredCapabilities: [editorCapability], requiredExtensionPoints: [editorPoint]}],
      extensionPoints: [],
      contributions: [{
        id: 'format.heading',
        title: 'Format heading',
        kind: 'editor.command',
        extensionPoint: editorPoint,
        actionId: 'vault.format.heading',
        requiredCapability: editorCapability,
        availability: {platforms: ['ios', 'android', 'web'], requiresOnline: false},
        priority: 20,
      }],
      retention: {defaultMode: 'DELETE_DATA', supportsUserChoice: false},
    },
  })
}

function extensionManifest(moduleId: string, targetProductId: string): GreenfieldModuleManifest {
  return manifest(moduleId, '1.0.0', {
    extensionProduct: {
      version: '1.0.0',
      kind: 'addon',
      targets: [{productId: targetProductId, versionRange: '>=1.0.0 <2.0.0'}],
      extensionPoints: [],
      contributions: [],
      retention: {defaultMode: 'KEEP_DATA', supportsUserChoice: true},
      graphPolicy: {maxDepth: 16, maxNodes: 256},
    },
  })
}

function manifest(moduleId: string, version: string, overrides: Record<string, unknown>): GreenfieldModuleManifest {
  const value = {
    manifestVersion: GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
    moduleId,
    name: moduleId.split('.').at(-1) ?? moduleId,
    description: `PVP Platform 2 fixture ${moduleId}`,
    version,
    standardVersion: '2.1.0',
    sectionVersions: createDefaultModuleSectionVersions(),
    publisher: {publisherId: 'modula', displayName: 'Modula', website: 'https://modula.digital'},
    source: {provider: 'github', repository: 'modula-mod/pvp-platform-2-fixtures', commit: '0123456789abcdef0123456789abcdef01234567', manifestPath: 'dist/greenfield.manifest.json', releaseTag: `fixture-v${version}`},
    license: {status: 'firstParty', evidenceIds: ['pvp-platform-2-fixture']},
    trust: {requestedLevel: 'firstParty'},
    compatibility: {minimumGreenfieldVersion: '0.1.0', minimumModulaHostVersion: '0.1.0', protocolVersions: ['greenfield.v1'], platforms: ['server', 'web', 'ios', 'android']},
    permissions: [],
    dependencies: [],
    contributions: {},
    dependencyGraph: {version: '2.0.0', requires: [], optional: [], recommended: [], conflicts: [], replaces: [], provides: []},
    capabilityDiscovery: {version: '2.0.0'},
    serviceRegistry: {version: '2.0.0', items: []},
    apiRegistry: {version: '2.0.0', items: []},
    hookRegistry: {version: '2.0.0', items: []},
    permissionModel: {version: '2.0.0', categories: {}},
    jobRegistry: {version: '2.0.0', items: []},
    storageModel: {version: '2.0.0', items: []},
    widgetRegistry: {version: '2.0.0', items: []},
    navigationRegistry: {version: '2.0.0', items: []},
    uiContributions: {version: '2.0.0', items: []},
    eventBus: {version: '2.0.0', items: []},
    integrity: {manifestSha256: 'a'.repeat(64), releaseSha256: 'b'.repeat(64)},
    ...overrides,
  } as GreenfieldModuleManifest
  value.integrity.manifestSha256 = manifestChecksum({...value, integrity: {...value.integrity, manifestSha256: ''}})
  return value
}

function releaseEvidence(manifest: GreenfieldModuleManifest) {
  return {
    repository: manifest.source.repository,
    releaseTag: manifest.source.releaseTag!,
    releaseCommit: manifest.source.commit,
    artifactSha256: createHash('sha256').update(`fixture-artifact:${manifest.moduleId}:${manifest.version}`).digest('hex'),
    manifestSha256: manifest.integrity.manifestSha256,
  }
}
