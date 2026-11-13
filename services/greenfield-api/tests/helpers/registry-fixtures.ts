import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {expect} from 'vitest'
import {
  GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
  createDefaultModuleSectionVersions,
  manifestChecksum,
  type GreenfieldModuleManifest,
} from '@modula/greenfield-module-manifest'

export const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../fixtures/mps/reference-module')

export function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

export function configureRegistryTestEnv(databaseUrl: string, port = '4057') {
  process.env.NODE_ENV = 'test'
  process.env.MODULA_ENVIRONMENT = 'development'
  process.env.MODULA_API_HOST = '127.0.0.1'
  process.env.MODULA_API_PORT = port
  process.env.MODULA_PUBLIC_API_URL = 'https://api.test.modula.digital'
  process.env.MODULA_DATABASE_URL = databaseUrl
  process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl
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
  process.env.GREENFIELD_MODULE_GITHUB_SYNC_ENABLED = 'true'
  process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
  process.env.MODULA_CHECKPOINT_SIGNING_KEY = 'registry-trust-test-signing-key'
  process.env.MODULA_MODULE_SECRETS_KEY = 'registry-trust-module-secret-key'
}

export type FixtureProduct = {
  productId: string
  version: string
  mpsBytes: string
  frontend: {path: string; bytes: Buffer}
  schemas: Array<{path: string; bytes: Buffer}>
  assets: Array<{path: string; bytes: Buffer}>
  mps: Record<string, any>
}

/** The MPS reference module re-identified so each test owns an isolated product. */
export function fixtureProduct(productId: string, version = '0.1.0', mutate?: (mps: Record<string, any>, frontend: Record<string, any>) => void): FixtureProduct {
  const mps = JSON.parse(readFileSync(join(fixtureRoot, 'modula.product.json'), 'utf8'))
  const frontendPath: string = mps.frontend.artifact.path
  const frontendJson = JSON.parse(readFileSync(join(fixtureRoot, frontendPath), 'utf8'))
  frontendJson.productId = productId
  frontendJson.releaseVersion = version
  mps.identity.id = productId
  mps.identity.version = version
  delete mps.identity.aliases
  delete mps.family
  mps.relationships = []
  mutate?.(mps, frontendJson)
  const frontendBytes = Buffer.from(`${JSON.stringify(frontendJson, null, 2)}\n`)
  mps.frontend.artifact.sha256 = sha256(frontendBytes)
  mps.release = {...(mps.release ?? {}), provenance: {...(mps.release?.provenance ?? {}), frontendSha256: sha256(frontendBytes)}}
  const assets = collectAssetPaths(mps).map(path => ({path, bytes: readFileSync(join(fixtureRoot, path))}))
  return {
    productId,
    version,
    mpsBytes: `${JSON.stringify(mps, null, 2)}\n`,
    frontend: {path: frontendPath, bytes: frontendBytes},
    schemas: [{path: 'schemas/note.schema.json', bytes: readFileSync(join(fixtureRoot, 'schemas/note.schema.json'))}],
    assets,
    mps,
  }
}

function collectAssetPaths(mps: Record<string, any>): string[] {
  const presentation = mps.presentation ?? {}
  const entries = [
    ...(presentation.assets ?? []), ...(presentation.screenshots ?? []),
    presentation.icon, presentation.logo, presentation.wordmark, presentation.cover, presentation.hero,
  ].filter(Boolean)
  return [...new Set(entries.map((entry: {path: string}) => entry.path))]
}

export function adapterManifest(moduleId: string, version: string, overrides: Partial<GreenfieldModuleManifest> = {}): GreenfieldModuleManifest {
  const manifest = {
    manifestVersion: GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
    moduleId,
    name: moduleId.split('.').at(-1) ?? moduleId,
    description: `Registry trust fixture ${moduleId}`,
    version,
    standardVersion: '2.1.0',
    sectionVersions: createDefaultModuleSectionVersions(),
    publisher: {publisherId: 'modula', displayName: 'Modula', website: 'https://modula.digital'},
    source: {provider: 'github', repository: 'modula-mod/registry-trust-fixtures', commit: '0123456789abcdef0123456789abcdef01234567', manifestPath: 'module.manifest.json', releaseTag: `${moduleId}-v${version}`, releaseAssetName: `${moduleId}-${version}.tgz`},
    license: {status: 'firstParty', evidenceIds: ['registry-trust-fixture']},
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
      version,
      kind: 'module',
      targets: [],
      extensionPoints: [],
      contributions: [],
      retention: {defaultMode: 'KEEP_DATA', supportsUserChoice: true},
      graphPolicy: {maxDepth: 16, maxNodes: 256},
    },
    integrity: {manifestSha256: '', releaseSha256: 'b'.repeat(64)},
    ...overrides,
  } as GreenfieldModuleManifest
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

export function evidenceFor(manifest: GreenfieldModuleManifest, artifactSha256 = sha256(`artifact:${manifest.moduleId}:${manifest.version}`)) {
  return {
    repository: manifest.source.repository,
    releaseTag: manifest.source.releaseTag!,
    releaseCommit: manifest.source.commit,
    artifactSha256,
    manifestSha256: manifest.integrity.manifestSha256,
  }
}

/**
 * Registers and signs in a test account. Like the other suites, it clears the
 * per-IP email-verification limiter before and after, so these suites never
 * leave limiter state that makes parallel suites hit 429.
 */
export async function registerAccount(app: any, email: string, handle: string, db?: any) {
  const clearLimiter = async () => { if (db) await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute() }
  await clearLimiter()
  try {
    return await registerAccountInner(app, email, handle)
  } finally {
    await clearLimiter()
  }
}

async function registerAccountInner(app: any, email: string, handle: string) {
  const password = 'secure-pass-word-1'
  const register = await app.inject({method: 'POST', url: '/v1/accounts/register', payload: {email, password, handle, displayName: 'Registry Trust Test', acceptedTerms: true}})
  expect(register.statusCode, register.body).toBe(201)
  await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
  const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
  expect(session.statusCode, session.body).toBe(200)
  return {accountId: register.json().data.accountId as string, token: session.json().data.accessToken as string}
}

/**
 * Stores the immutable module-package bytes that evidenceFor() digests by
 * default, so a fixture release has the package artifact install requires
 * (GF-MOD-01). Pass `bytes` when the evidence used a different digest.
 */
export async function storeFixturePackageArtifact(db: any, release: {releaseId: string; moduleId: string; version: string}, bytes: Buffer = Buffer.from(`artifact:${release.moduleId}:${release.version}`)) {
  const digest = sha256(bytes)
  const now = new Date()
  await db.insertInto('greenfield_release_asset_blobs')
    .values({sha256: digest, media_type: 'application/gzip', byte_size: bytes.length, bytes, created_at: now})
    .onConflict((oc: any) => oc.column('sha256').doNothing()).execute()
  await db.insertInto('greenfield_release_artifacts').values({
    artifact_id: `release:${release.releaseId}:module-package`, release_id: release.releaseId, kind: 'module-package',
    sha256: digest, filename: `${release.moduleId}-${release.version}.tgz`, access_class: 'installation',
    required_for_offline_launch: true, created_at: now,
  }).onConflict((oc: any) => oc.column('artifact_id').doNothing()).execute()
  return digest
}
