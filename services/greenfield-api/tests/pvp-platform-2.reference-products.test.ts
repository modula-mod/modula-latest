import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import type {GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldModuleRuntimeAccessService} from '../src/modules/runtime-access.js'
import {ModuleBackendTokenService} from '../src/modules/backend/token-service.js'
import {createDb as createWorkerDb, type ModulaWorkerDb} from '../../greenfield-worker/src/database.js'
import {loadConfig as loadWorkerConfig} from '../../greenfield-worker/src/config.js'
import {handleModuleInstall} from '../../greenfield-worker/src/modules/installation-handler.js'
import {handleModuleEnable} from '../../greenfield-worker/src/modules/enable-handler.js'
import {handleModuleDisable} from '../../greenfield-worker/src/modules/disable-handler.js'
import {handleModuleUninstall} from '../../greenfield-worker/src/modules/uninstall-handler.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const roots = {
  notes: process.env.MODULA_VAULT_NOTES_ROOT ?? '/root/modula-mod/modula-vault-notes',
  formatting: process.env.MODULA_VAULT_FORMATTING_ROOT ?? '/root/modula-mod/modula-vault-formatting',
  ai: process.env.MODULA_VAULT_AI_ROOT ?? '/root/modula-mod/modula-vault-ai',
  voice: process.env.MODULA_VAULT_VOICE_ROOT ?? '/root/modula-mod/modula-vault-voice',
}
const ids = {
  notes: 'digital.modula.vault-notes',
  formatting: 'digital.modula.vault-notes.formatting',
  ai: 'digital.modula.vault-notes.ai',
  voice: 'digital.modula.vault-notes.voice',
}
const versions = {notes: '1.2.0', formatting: '0.1.0', ai: '0.1.0', voice: '0.1.0'}
const releaseTags = {
  notes: 'vault-notes-v1.2.0',
  formatting: 'vault-formatting-v0.1.0',
  ai: 'vault-ai-v0.1.0',
  voice: 'vault-voice-v0.1.0',
}
const suffix = randomUUID().slice(0, 8)

describeIfDb('PVP Platform 2 immutable reference products', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let workerDb: ModulaWorkerDb
  let tokenA = ''
  let tokenB = ''
  let accountA = ''
  const releases = new Map<string, {releaseId: string}>()
  const installations = new Map<string, string>()

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    workerDb = createWorkerDb(databaseUrl!)
    await app.ready()
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    const first = await register(`reference-a-${suffix}@example.com`, `referencea${suffix}`.slice(0, 20))
    tokenA = first.token
    accountA = first.accountId
    tokenB = (await register(`reference-b-${suffix}@example.com`, `referenceb${suffix}`.slice(0, 20))).token
    for (const product of ['notes', 'formatting', 'ai', 'voice'] as const) {
      const manifest = JSON.parse(execFileSync('git', ['show', `${releaseTags[product]}:module.manifest.json`], {cwd: roots[product], encoding: 'utf8'})) as GreenfieldModuleManifest
      const provenanceName = product === 'notes' ? 'vault-notes-v1.2.0.provenance.json' : product === 'formatting' ? 'vault-formatting-v0.1.0.provenance.json' : product === 'ai' ? 'vault-ai-v0.1.0.provenance.json' : 'vault-voice-v0.1.0.provenance.json'
      const provenance = JSON.parse(readFileSync(join(roots[product], 'release', provenanceName), 'utf8'))
      expect(manifest.moduleId).toBe(ids[product])
      expect(manifest.version).toBe(versions[product])
      const service = new GreenfieldModuleReleaseService(db)
      let release = await service.getRelease(manifest.moduleId, manifest.version)
      if (!release) {
        await service.importPendingReview(manifest, {
          repository: provenance.repository,
          releaseTag: provenance.releaseTag,
          releaseCommit: provenance.releaseCommit,
          artifactSha256: provenance.packageChecksum,
          manifestSha256: provenance.greenfieldManifestChecksum,
        })
        release = await service.publishRelease(manifest.moduleId, manifest.version)
      }
      expect(release.releaseState).toBe('published')
      expect(release.sourceCommit).toMatch(/^[0-9a-f]{40}$/)
      releases.set(product, release)
    }
  })

  afterAll(async () => {
    await app?.close()
    await workerDb?.destroy()
    await db?.destroy()
  })

  it('projects real registry relationships from immutable releases', async () => {
    const response = await app.inject({method: 'GET', url: `/v1/registry/products/${ids.notes}/relationships`})
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json().data.extensions).toEqual(expect.arrayContaining([
      expect.objectContaining({productId: ids.formatting, productKind: 'plugin'}),
      expect.objectContaining({productId: ids.ai, productKind: 'addon'}),
      expect.objectContaining({productId: ids.voice, productKind: 'addon'}),
    ]))
  })

  it('installs Vault Notes alone, then composes and removes real extension contributions generically', async () => {
    await installAndEnable('notes')
    let host = await composition(tokenA)
    expect(host.target).toMatchObject({productId: ids.notes, version: versions.notes, status: 'enabled'})
    expect(host.extensions).toEqual([])

    await installAndEnable('formatting')
    await installAndEnable('ai')
    await installAndEnable('voice')
    host = await composition(tokenA)
    expect(new Set(host.extensions.map((item: any) => item.extension_product_id))).toEqual(new Set([ids.formatting, ids.ai, ids.voice]))
    expect(JSON.stringify(host.core.manifest)).not.toContain(ids.ai)
    expect(JSON.stringify(host.core.manifest)).not.toContain(ids.voice)
    expect(JSON.stringify(host.core.manifest)).not.toContain(ids.formatting)

    await transition('formatting', 'disable')
    host = await composition(tokenA)
    expect(host.extensions.some((item: any) => item.extension_product_id === ids.formatting)).toBe(false)
    expect(host.extensions.some((item: any) => item.extension_product_id === ids.ai)).toBe(true)
    expect(host.target.status).toBe('enabled')

    await transition('formatting', 'enable')
    expect((await composition(tokenA)).extensions.some((item: any) => item.extension_product_id === ids.formatting)).toBe(true)
  })

  it('issues Vault AI a single-purpose assertion for its own add-on backend without host authority', async () => {
    const installationId = installations.get('ai')!
    const context = await new GreenfieldModuleRuntimeAccessService(db, loadConfig()).resolve(accountA, ids.ai, {requireEnabled: true})
    const actor = await db.selectFrom('actors').select('id').where('account_id', '=', accountA).executeTakeFirstOrThrow()
    const actionId = context.manifest.backend?.actions?.[0]?.actionId
    expect(actionId).toBe('digital.modula.vault-notes.ai.function.summarise')
    const issued = await new ModuleBackendTokenService(db, loadConfig()).issue({
      context,
      backend: context.manifest.backend!,
      actorId: actor.id,
      permissions: context.grantedPermissions,
      capabilities: ['ai.request'],
      requestId: `vault-ai-own-backend-${suffix}`,
      extensionInvocation: {
        consumerProductId: ids.ai,
        targetProductId: ids.ai,
        targetInstallationId: installationId,
        actionId: actionId!,
        serviceId: 'service.digital.modula.vault-notes.ai.backend',
        scope: {type: 'installation', ref: installationId},
      },
    })
    expect(await new ModuleBackendTokenService(db, loadConfig()).resolveServiceAssertion(issued.token, ids.notes)).toBeNull()
    const resolved = await new ModuleBackendTokenService(db, loadConfig()).resolveServiceAssertion(issued.token, ids.ai)
    expect(resolved).toMatchObject({
      consumerProductId: ids.ai,
      targetProductId: ids.ai,
      targetInstallationId: installationId,
      targetServiceId: 'service.digital.modula.vault-notes.ai.backend',
      actionId,
      accountId: accountA,
    })
    expect(resolved?.scope.productId).toBe(ids.ai)
    expect(resolved?.scope.installationId).toBe(installationId)
    const stored = await db.selectFrom('greenfield_extension_service_assertions').select(['raw_user_bearer_forwarded', 'consumer_product_id', 'target_product_id']).where('jti', '=', issued.claims.jti!).executeTakeFirstOrThrow()
    expect(stored).toMatchObject({raw_user_bearer_forwarded: false, consumer_product_id: ids.ai, target_product_id: ids.ai})
  })

  it('keeps the reference host and dependency projection account isolated', async () => {
    const foreign = await app.inject({method: 'GET', url: `/v1/module-host/${ids.notes}/composition?platform=web`, headers: {authorization: `Bearer ${tokenB}`}})
    expect(foreign.statusCode).toBe(404)
    const uninstall = await app.inject({method: 'POST', url: `/v1/modules/${ids.notes}/uninstall-preview`, headers: {authorization: `Bearer ${tokenA}`}})
    expect(uninstall.statusCode, uninstall.body).toBe(200)
    expect(new Set(uninstall.json().data.dependantExtensions.map((item: any) => item.productId))).toEqual(new Set([ids.formatting, ids.ai, ids.voice]))
  })

  it('blocks orphaning the parent and preserves target data across extension retention choices', async () => {
    const coreRecordId = `reference-note-${suffix}`
    const aiRecordId = `reference-summary-${suffix}`
    const voiceRecordId = `reference-recording-${suffix}`
    await db.insertInto('greenfield_module_records').values([
      record(coreRecordId, ids.notes, 'note', {title: 'Project Atlas', body: 'Core note survives extension lifecycle'}),
      record(aiRecordId, ids.ai, 'summary', {summaryReference: 'summary-opaque'}),
      record(voiceRecordId, ids.voice, 'recording', {recordingReference: 'recording-opaque'}),
    ]).execute()

    const blocked = await app.inject({
      method: 'DELETE',
      url: `/v1/modules/${ids.notes}/install`,
      headers: {authorization: `Bearer ${tokenA}`, 'idempotency-key': `reference-parent-blocked-${suffix}`},
      payload: {choice: 'keepData', removeDependants: false},
    })
    expect(blocked.statusCode).toBe(409)

    await uninstallProduct('ai', 'keepData')
    expect((await composition(tokenA)).extensions.some((item: any) => item.extension_product_id === ids.ai)).toBe(false)
    expect(await db.selectFrom('greenfield_module_records').select('retained_after_uninstall').where('record_id', '=', aiRecordId).executeTakeFirstOrThrow()).toMatchObject({retained_after_uninstall: true})
    expect(await db.selectFrom('greenfield_module_records').select('deleted_at').where('record_id', '=', coreRecordId).executeTakeFirstOrThrow()).toMatchObject({deleted_at: null})

    await installAndEnable('ai')
    expect((await composition(tokenA)).extensions.some((item: any) => item.extension_product_id === ids.ai)).toBe(true)
    expect(await db.selectFrom('greenfield_module_records').select('record_id').where('record_id', '=', aiRecordId).executeTakeFirstOrThrow()).toMatchObject({record_id: aiRecordId})

    await uninstallProduct('voice', 'deleteData')
    expect(await db.selectFrom('greenfield_module_records').select('deleted_at').where('record_id', '=', voiceRecordId).executeTakeFirstOrThrow()).toMatchObject({deleted_at: expect.any(Date)})
    expect(await db.selectFrom('greenfield_module_records').select('deleted_at').where('record_id', '=', coreRecordId).executeTakeFirstOrThrow()).toMatchObject({deleted_at: null})
    expect((await composition(tokenA)).target.status).toBe('enabled')
  })

  async function installAndEnable(product: keyof typeof ids) {
    const preview = await app.inject({method: 'POST', url: `/v1/modules/${ids[product]}/install-preview`, headers: {authorization: `Bearer ${tokenA}`}, payload: {version: versions[product], platform: 'web'}})
    expect(preview.statusCode, preview.body).toBe(200)
    expect(preview.json().data.compatible, JSON.stringify(preview.json().data)).toBe(true)
    const permissions = preview.json().data.permissions.map((permission: any) => permission.permission)
    const install = await app.inject({
      method: 'POST',
      url: `/v1/modules/${ids[product]}/install`,
      headers: {authorization: `Bearer ${tokenA}`, 'idempotency-key': `reference-install-${product}-${randomUUID()}`},
      payload: {version: versions[product], platform: 'web', approvedPermissions: permissions},
    })
    expect(install.statusCode, install.body).toBe(202)
    const installationId = install.json().data.installationId as string
    installations.set(product, installationId)
    await handleModuleInstall(workerDb, loadWorkerConfig(), {
      planId: (await db.selectFrom('greenfield_module_install_plans').select('plan_id').where('installation_id', '=', installationId).executeTakeFirstOrThrow()).plan_id,
      installationId,
      releaseId: releases.get(product)!.releaseId,
      moduleId: ids[product],
      accountId: (await db.selectFrom('greenfield_extension_installations').select('account_id').where('installation_id', '=', installationId).executeTakeFirstOrThrow()).account_id,
    })
    await transition(product, 'enable')
  }

  async function transition(product: keyof typeof ids, action: 'enable' | 'disable') {
    const installationId = installations.get(product)!
    const accountId = (await db.selectFrom('greenfield_extension_installations').select('account_id').where('installation_id', '=', installationId).executeTakeFirstOrThrow()).account_id
    const response = await app.inject({method: 'POST', url: `/v1/modules/${ids[product]}/${action}`, headers: {authorization: `Bearer ${tokenA}`, 'idempotency-key': `reference-${action}-${product}-${randomUUID()}`}})
    expect(response.statusCode, response.body).toBe(202)
    const payload = {installationId, releaseId: releases.get(product)!.releaseId, moduleId: ids[product], accountId}
    if (action === 'enable') await handleModuleEnable(workerDb, loadWorkerConfig(), payload)
    else await handleModuleDisable(workerDb, payload)
  }

  async function uninstallProduct(product: keyof typeof ids, choice: 'keepData' | 'deleteData') {
    const installationId = installations.get(product)!
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/modules/${ids[product]}/install`,
      headers: {authorization: `Bearer ${tokenA}`, 'idempotency-key': `reference-uninstall-${product}-${randomUUID()}`},
      payload: {choice, confirmDelete: choice === 'deleteData', recentAuth: choice === 'deleteData', removeDependants: false},
    })
    expect(response.statusCode, response.body).toBe(202)
    await handleModuleUninstall(workerDb, {installationId, releaseId: releases.get(product)!.releaseId, moduleId: ids[product], dataRetentionChoice: choice})
  }

  async function composition(token: string) {
    const response = await app.inject({method: 'GET', url: `/v1/module-host/${ids.notes}/composition?platform=web`, headers: {authorization: `Bearer ${token}`}})
    expect(response.statusCode, response.body).toBe(200)
    return response.json().data
  }

  async function register(email: string, handle: string) {
    const password = 'secure-pass-word-1'
    const registerResponse = await app.inject({method: 'POST', url: '/v1/accounts/register', payload: {email, password, handle, displayName: 'Reference Test', acceptedTerms: true}})
    expect(registerResponse.statusCode).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: registerResponse.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect(session.statusCode).toBe(200)
    return {accountId: registerResponse.json().data.accountId as string, token: session.json().data.accessToken as string}
  }

  function record(recordId: string, moduleId: string, collection: string, data: Record<string, unknown>) {
    const now = new Date()
    return {
      record_id: recordId,
      account_id: accountA,
      module_id: moduleId,
      installation_id: installations.get(moduleId === ids.notes ? 'notes' : moduleId === ids.ai ? 'ai' : 'voice') ?? null,
      collection,
      schema_ref: `schema:${collection}`,
      visibility: 'private' as const,
      data,
      search_text: '',
      folder_ref: null,
      source_uri: null,
      retained_after_uninstall: false,
      revision: 1,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }
  }
})

function configureTestEnv() {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = '4043'
  process.env.MODULA_PUBLIC_API_URL = 'https://api.test.modula.digital'
  process.env.MODULA_DATABASE_URL = databaseUrl!
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
  process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
  process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
  process.env.MODULA_INVITE_ONLY = 'false'
  process.env.MODULA_REGISTRATION_MODE = 'open'
  process.env.GREENFIELD_MODULE_REGISTRY_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_INSTALLATION_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES = 'true'
  process.env.GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_FIRST_PARTY_EXECUTION_ENABLED = 'true'
  process.env.GREENFIELD_MODULE_COMMUNITY_EXECUTION_ENABLED = 'true'
  process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
  process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'pvp-platform-2-reference-signing-key'
  process.env.MODULA_MODULE_SECRETS_KEY = 'pvp-platform-2-reference-module-secret-key'
}
