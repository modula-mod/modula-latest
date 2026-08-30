import {createHash, randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
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
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'
import {createDb as createWorkerDb, type ModulaWorkerDb} from '../../greenfield-worker/src/database.js'
import {loadConfig as loadWorkerConfig} from '../../greenfield-worker/src/config.js'
import {handleModuleInstall} from '../../greenfield-worker/src/modules/installation-handler.js'
import {handleModuleEnable} from '../../greenfield-worker/src/modules/enable-handler.js'
import {handleModuleDisable} from '../../greenfield-worker/src/modules/disable-handler.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../fixtures/mps/reference-module')
const productId = 'digital.modula.reference-notes'
const version = '0.1.0'
const suffix = randomUUID().slice(0, 8)

describeIfDb('MPS product-owned frontend exact-release runtime', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let workerDb: ModulaWorkerDb
  let token = ''
  let accountId = ''
  let releaseId = ''
  let installationId = ''

  beforeAll(async () => {
    configureTestEnv()
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    workerDb = createWorkerDb(databaseUrl!)
    await app.ready()
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()

    const manifest = productManifest(productId, version)
    const releases = new GreenfieldModuleReleaseService(db)
    let release = await releases.getRelease(productId, version)
    if (!release) {
      await releases.importPendingReview(manifest, releaseEvidence(manifest))
      release = await releases.publishRelease(productId, version)
    }
    releaseId = release.releaseId

    const mpsBytes = readFileSync(join(fixtureRoot, 'modula.product.json'), 'utf8')
    const mps = JSON.parse(mpsBytes) as {frontend: {artifact: {path: string}}}
    await new GreenfieldMpsIngestService(db).ingest({
      filename: 'modula.product.json',
      bytes: mpsBytes,
      releaseId,
      frontend: {
        path: mps.frontend.artifact.path,
        bytes: readFileSync(join(fixtureRoot, mps.frontend.artifact.path)),
      },
      schemas: [{
        path: 'schemas/note.schema.json',
        bytes: readFileSync(join(fixtureRoot, 'schemas/note.schema.json')),
      }],
    })

    const account = await registerAccount(`frontend-${suffix}@example.com`, `frontend${suffix}`.slice(0, 20))
    token = account.token
    accountId = account.accountId
    installationId = await installAndEnable(productId, version, releaseId, `mps-${suffix}`)
  })

  afterAll(async () => {
    await app?.close()
    await workerDb?.destroy()
    await db?.destroy()
  })

  it('returns the verified frontend bound to the enabled installation release', async () => {
    const response = await frontend(productId)
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json().data).toMatchObject({
      source: 'mps',
      productId,
      version,
      releaseId,
      installationId,
      mode: 'declarative',
      entryView: 'home',
      routeCount: 5,
      artifact: {
        role: 'product.frontend',
        sha256: '1995ee5feb55de76c33280253a943433fe21b2770a4c63b8ead8a9bab2231c70',
      },
      frontend: {productId, releaseVersion: version, entry: 'home'},
    })
  })

  it('projects product record schemas into the same exact release runtime', async () => {
    const collection = await db.selectFrom('greenfield_module_record_collections')
      .select(['release_id', 'module_id', 'collection', 'fields', 'searchable_fields', 'filterable_fields', 'sortable_fields', 'schema_definition'])
      .where('release_id', '=', releaseId)
      .where('module_id', '=', productId)
      .where('collection', '=', 'note')
      .executeTakeFirstOrThrow()
    expect(collection.release_id).toBe(releaseId)
    expect((collection.fields as Array<{fieldId: string}>).map(field => field.fieldId)).toEqual(['id', 'title', 'body', 'tags'])
    expect(collection.searchable_fields).toEqual(['id', 'title', 'body', 'tags'])
    expect(collection.filterable_fields).toEqual(['id', 'title'])
    expect(collection.sortable_fields).toEqual(['id', 'title'])
    expect(collection.schema_definition).toMatchObject({type: 'object', additionalProperties: false})
  })

  it('does not expose the frontend while the installation is disabled', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/modules/${productId}/disable`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `disable-${suffix}`},
    })
    expect(response.statusCode, response.body).toBe(202)
    await handleModuleDisable(workerDb, {installationId, releaseId, moduleId: productId, accountId})
    const disabled = await frontend(productId)
    expect(disabled.statusCode).toBe(403)
  })

  it('marks a historical release without MPS ingestion as legacy explicitly', async () => {
    const legacyId = `com.example.legacy-frontend-${suffix}`
    const legacyVersion = '1.0.0'
    const manifest = productManifest(legacyId, legacyVersion)
    const releases = new GreenfieldModuleReleaseService(db)
    await releases.importPendingReview(manifest, releaseEvidence(manifest))
    const release = await releases.publishRelease(legacyId, legacyVersion)
    await installAndEnable(legacyId, legacyVersion, release.releaseId, `legacy-${suffix}`)
    const response = await frontend(legacyId)
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json().data).toMatchObject({
      source: 'legacy',
      productId: legacyId,
      version: legacyVersion,
      releaseId: release.releaseId,
    })
  })

  async function frontend(id: string) {
    return app.inject({method: 'GET', url: `/v1/modules/${id}/frontend`, headers: {authorization: `Bearer ${token}`}})
  }

  async function registerAccount(email: string, handle: string) {
    const password = 'secure-pass-word-1'
    const register = await app.inject({method: 'POST', url: '/v1/accounts/register', payload: {email, password, handle, displayName: 'Frontend Runtime Test', acceptedTerms: true}})
    expect(register.statusCode, register.body).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    expect(session.statusCode, session.body).toBe(200)
    return {accountId: register.json().data.accountId as string, token: session.json().data.accessToken as string}
  }

  async function installAndEnable(id: string, releaseVersion: string, activeReleaseId: string, key: string): Promise<string> {
    const install = await app.inject({
      method: 'POST',
      url: `/v1/modules/${id}/install`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `install-${key}`},
      payload: {version: releaseVersion, approvedPermissions: []},
    })
    expect(install.statusCode, install.body).toBe(202)
    const activeInstallationId = install.json().data.installationId as string
    const plan = await db.selectFrom('greenfield_module_install_plans').select('plan_id').where('installation_id', '=', activeInstallationId).executeTakeFirstOrThrow()
    await handleModuleInstall(workerDb, loadWorkerConfig(), {
      planId: plan.plan_id,
      installationId: activeInstallationId,
      releaseId: activeReleaseId,
      moduleId: id,
      accountId,
    })
    const enable = await app.inject({
      method: 'POST',
      url: `/v1/modules/${id}/enable`,
      headers: {authorization: `Bearer ${token}`, 'idempotency-key': `enable-${key}`},
    })
    expect(enable.statusCode, enable.body).toBe(202)
    await handleModuleEnable(workerDb, loadWorkerConfig(), {
      installationId: activeInstallationId,
      releaseId: activeReleaseId,
      moduleId: id,
      accountId,
    })
    return activeInstallationId
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
  process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'product-frontend-test-signing-key'
  process.env.MODULA_MODULE_SECRETS_KEY = 'product-frontend-module-secret-key'
}

function productManifest(moduleId: string, releaseVersion: string): GreenfieldModuleManifest {
  const manifest = {
    manifestVersion: GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
    moduleId,
    name: moduleId.split('.').at(-1) ?? moduleId,
    description: `Product frontend fixture ${moduleId}`,
    version: releaseVersion,
    standardVersion: '2.1.0',
    sectionVersions: createDefaultModuleSectionVersions(),
    publisher: {publisherId: 'modula', displayName: 'Frontend Test Publisher', website: 'https://modula.digital'},
    source: {provider: 'github', repository: 'modula-mod/product-frontend-fixtures', commit: '0123456789abcdef0123456789abcdef01234567', manifestPath: 'module.manifest.json', releaseTag: `${moduleId}-v${releaseVersion}`},
    license: {status: 'firstParty', evidenceIds: ['product-frontend-fixture']},
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
    extensionProduct: {
      version: releaseVersion,
      kind: 'module',
      targets: [],
      extensionPoints: [],
      contributions: [],
      retention: {defaultMode: 'KEEP_DATA', supportsUserChoice: true},
      graphPolicy: {maxDepth: 16, maxNodes: 256},
    },
    integrity: {manifestSha256: '', releaseSha256: 'b'.repeat(64)},
  } as GreenfieldModuleManifest
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

function releaseEvidence(manifest: GreenfieldModuleManifest) {
  return {
    repository: manifest.source.repository,
    releaseTag: manifest.source.releaseTag!,
    releaseCommit: manifest.source.commit,
    artifactSha256: createHash('sha256').update(`frontend-runtime:${manifest.moduleId}:${manifest.version}`).digest('hex'),
    manifestSha256: manifest.integrity.manifestSha256,
  }
}
