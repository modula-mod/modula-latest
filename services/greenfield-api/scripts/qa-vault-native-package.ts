import {createHash, generateKeyPairSync, randomUUID, sign} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {createServer} from '../src/app/create-server.js'
import {loadConfig} from '../src/config/env.js'
import {readTarGz} from '../src/lib/tar-gz.js'
import {
  GreenfieldGithubReleaseSyncService,
  type GithubRelease,
  type GithubReleaseAsset,
  type GithubReleaseSource,
} from '../src/modules/github-release-sync-service.js'
import {GreenfieldModuleManifestService} from '../src/modules/manifest-service.js'
import {GreenfieldPublisherSigningKeyService, buildPublisherReleaseStatement, statementBytes} from '../src/modules/release-signing.js'
import {createDb as createWorkerDb} from '../../greenfield-worker/src/database.js'
import {loadConfig as loadWorkerConfig} from '../../greenfield-worker/src/config.js'
import {handleModuleInstall} from '../../greenfield-worker/src/modules/installation-handler.js'
import {handleModuleEnable} from '../../greenfield-worker/src/modules/enable-handler.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const productRoot = process.env.VAULT_QA_PRODUCT_ROOT
const qaDatabase = databaseUrl ? new URL(databaseUrl) : null
const qaDatabaseName = qaDatabase?.pathname.replace(/^\/+/, '') ?? ''
if (!databaseUrl || !productRoot || !qaDatabase
    || !['127.0.0.1', 'localhost', '::1'].includes(qaDatabase.hostname)
    || !/(^|_)(qa|test)(_|$)/i.test(qaDatabaseName)
    || process.env.NODE_ENV === 'production' || process.env.MODULA_ENVIRONMENT === 'production') {
  throw new Error('An explicit nonproduction database and VAULT_QA_PRODUCT_ROOT are required')
}

process.env.NODE_ENV = 'test'
process.env.MODULA_ENVIRONMENT = 'development'
process.env.MODULA_PUBLIC_API_URL ??= 'http://127.0.0.1:14025'
process.env.MODULA_DATABASE_URL = databaseUrl
process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl
process.env.MODULA_ALLOWED_ORIGINS ??= 'https://modula.digital'
process.env.MODULA_CHECKPOINT_SIGNING_KEY ??= 'qa-vault-native-package-ephemeral'
process.env.MODULA_INVITE_ONLY = 'false'
process.env.MODULA_REGISTRATION_MODE = 'open'
process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
process.env.GREENFIELD_MODULE_REGISTRY_ENABLED = 'true'
process.env.GREENFIELD_MODULE_INSTALLATION_ENABLED = 'true'
process.env.GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED = 'true'
process.env.GREENFIELD_MODULE_FIRST_PARTY_EXECUTION_ENABLED = 'true'

const root = resolve(productRoot)
const product = JSON.parse(readFileSync(join(root, 'modula.product.json'), 'utf8')) as Record<string, any>
const moduleId = product.identity?.id as string
const version = product.identity?.version as string
const tag = `vault-notes-v${version}`
const packageFile = `modula-vault-notes-${version}.tgz`
const packageBytes = readFileSync(join(root, 'release', packageFile))
const provenance = JSON.parse(readFileSync(join(root, 'release', `${tag}.provenance.json`), 'utf8')) as Record<string, any>
const entries = readTarGz(packageBytes, {maxUncompressedBytes: 200 * 1024 * 1024})
const file = (path: string) => entries.get(`package/${path}`) ?? null
const mpsBytes = file('modula.product.json')
const manifestBytes = file('module.manifest.json')
const frontendBytes = file(product.frontend?.artifact?.path)
if (!moduleId || !version || !mpsBytes || !manifestBytes || !frontendBytes) {
  throw new Error('Vault QA release package is incomplete')
}

const manifest = new GreenfieldModuleManifestService().parse(JSON.parse(manifestBytes.toString('utf8')))
const keys = generateKeyPairSync('ed25519')
const keyId = `vault-native-qa-${randomUUID().slice(0, 12)}`
const statement = buildPublisherReleaseStatement({
  manifest,
  sourceSha: provenance.releaseCommit,
  artifactSha256: sha256(packageBytes),
  productManifestSha256: sha256(mpsBytes),
  frontendSha256: sha256(frontendBytes),
  signingKeyId: keyId,
})
provenance.signature = {
  algorithm: 'Ed25519',
  keyId,
  value: sign(null, statementBytes(statement), keys.privateKey).toString('base64url'),
}
const provenanceBytes = Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`)

const assets: GithubReleaseAsset[] = [
  asset(packageFile, packageBytes),
  asset(`${tag}.provenance.json`, provenanceBytes),
]
const release: GithubRelease = {tagName: tag, draft: false, prerelease: true, assets}
const bytes = new Map([[packageFile, packageBytes], [`${tag}.provenance.json`, provenanceBytes]])
const source: GithubReleaseSource = {
  async getRelease() { return release },
  async resolveTagCommit() { return provenance.releaseCommit },
  async downloadAsset(input, maximumBytes) {
    const value = bytes.get(input.name)
    if (!value || value.length > maximumBytes) throw new Error(`Unavailable QA release asset: ${input.name}`)
    return value
  },
}

const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
const {app, db} = await createServer(loadConfig())

function responseData(response: {json(): unknown}): Record<string, any> {
  const body = response.json()
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Response was not an object')
  return body as Record<string, any>
}

function requireStatus(response: {statusCode: number; body: string}, expected: number, label: string): void {
  if (response.statusCode !== expected) throw new Error(`${label} returned ${response.statusCode}: ${response.body}`)
}

try {
  await app.ready()
  await new GreenfieldPublisherSigningKeyService(db).register('modula', {
    keyId,
    publicKeyPem: keys.publicKey.export({format: 'pem', type: 'spki'}).toString(),
  }, null)
  const synced = await new GreenfieldGithubReleaseSyncService(db, source).sync({
    repository: provenance.repository,
    releaseTag: tag,
    publish: true,
    dryRun: false,
  })
  if (synced.releaseState !== 'published' || synced.packageSha256 !== sha256(packageBytes)) {
    throw new Error('Vault QA release did not reach the disposable published state')
  }

  const email = `vault-native-${suffix}@example.invalid`
  const password = 'qa-vault-native-password-1'
  const register = await app.inject({
    method: 'POST', url: '/v1/accounts/register',
    payload: {email, password, handle: `vaultnative${suffix}`, displayName: 'Vault Native QA', acceptedTerms: true},
  })
  requireStatus(register, 201, 'register')
  const accountId = responseData(register).data.accountId as string
  const verify = await app.inject({
    method: 'POST', url: '/v1/accounts/verify-email',
    payload: {token: responseData(register).data.verificationToken},
  })
  requireStatus(verify, 200, 'verify email')
  const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
  requireStatus(session, 200, 'create session')
  const token = responseData(session).data.accessToken as string
  const headers = {authorization: `Bearer ${token}`}
  const context = {version, hostVersion: '1.1.0', platform: 'ios'}

  const installPlan = await app.inject({method: 'POST', url: `/v1/modules/${moduleId}/install-plan`, headers, payload: context})
  requireStatus(installPlan, 200, 'install plan')
  const requestedCapabilities = responseData(installPlan).data.requestedCapabilities as string[]
  const packagePlan = await app.inject({
    method: 'POST', url: `/v1/modules/${moduleId}/package-install-plan`, headers,
    payload: {...context, cachedPublicDigests: []},
  })
  requireStatus(packagePlan, 200, 'package install plan')
  const packagePlanData = responseData(packagePlan).data
  const rootPackage = packagePlanData.lock.packages.find((item: any) => item.packageId === moduleId)
  if (!rootPackage || rootPackage.category !== 'module' || rootPackage.artifact.mediaType !== 'application/gzip'
      || rootPackage.artifact.sha256 !== product.distribution.artifact.sha256) {
    throw new Error('Package install plan did not pin the Vault content archive')
  }

  const install = await app.inject({
    method: 'POST', url: `/v1/modules/${moduleId}/install`,
    headers: {...headers, 'idempotency-key': `vault-native-${suffix}`},
    payload: {
      ...context,
      approvedPermissions: requestedCapabilities,
      packageLockSha256: packagePlanData.lockSha256,
      cachedPublicDigests: [],
    },
  })
  requireStatus(install, 202, 'Vault package install')
  const installData = responseData(install).data
  const workerDb = createWorkerDb(databaseUrl)
  try {
    await handleModuleInstall(workerDb, loadWorkerConfig(), {
      planId: installData.planId,
      installationId: installData.installationId,
      releaseId: synced.releaseId,
      moduleId,
      accountId,
    })
  } finally {
    await workerDb.destroy()
  }
  const enable = await app.inject({
    method: 'POST', url: `/v1/modules/${moduleId}/enable`,
    headers: {...headers, 'idempotency-key': `vault-native-enable-${suffix}`},
    payload: {idempotencyKey: `vault-native-enable-${suffix}`},
  })
  requireStatus(enable, 202, 'enable Vault package')
  const enableWorkerDb = createWorkerDb(databaseUrl)
  try {
    await handleModuleEnable(enableWorkerDb, loadWorkerConfig(), {
      installationId: installData.installationId,
      moduleId,
      accountId,
    })
  } finally {
    await enableWorkerDb.destroy()
  }
  const descriptor = await app.inject({
    method: 'GET', url: `/v1/modules/${moduleId}/installation-descriptor?hostVersion=1.1.0&platform=ios`, headers,
  })
  requireStatus(descriptor, 200, 'installation descriptor')
  const descriptorData = responseData(descriptor).data
  if (!descriptorData.launchEligible || descriptorData.currentRelease?.trust?.signatureState !== 'verified') {
    throw new Error(`Installed Vault QA release was not launch eligible and verified: ${JSON.stringify({
      launchEligible: descriptorData.launchEligible,
      signatureState: descriptorData.currentRelease?.trust?.signatureState,
      permissionReview: descriptorData.permissionReview,
      compatibility: descriptorData.compatibility,
    })}`)
  }

  const artifactPath = new URL(rootPackage.artifact.download.pathOrUrl, 'http://127.0.0.1').pathname
  const download = await app.inject({method: 'GET', url: artifactPath, headers})
  requireStatus(download, 200, 'content artifact download')
  if (sha256(download.rawPayload) !== product.distribution.artifact.sha256) {
    throw new Error('Downloaded content artifact digest changed')
  }

  const noteData = {
    title: 'Native package acceptance note',
    document: {schemaVersion: '1.0.0', blocks: []},
    plainTextProjection: 'Created through the signed Vault Notes QA release',
    tagIds: [], pinned: false, favourite: false, archived: false, dataSchemaVersion: '1.0.0',
  }
  const create = await app.inject({
    method: 'POST', url: `/v1/modules/${moduleId}/records/note`, headers,
    payload: {mutationId: `vault-note-create-${suffix}`, data: noteData},
  })
  requireStatus(create, 201, 'create note')
  const created = responseData(create).data
  const update = await app.inject({
    method: 'PATCH', url: `/v1/modules/${moduleId}/records/note/${created.record_id}`, headers,
    payload: {mutationId: `vault-note-update-${suffix}`, expectedRevision: created.revision,
      data: {...noteData, title: 'Native package acceptance note edited'}},
  })
  requireStatus(update, 200, 'edit note')
  const updated = responseData(update).data
  const read = await app.inject({
    method: 'GET', url: `/v1/modules/${moduleId}/records/note/${created.record_id}`, headers,
  })
  requireStatus(read, 200, 'read note')
  if (responseData(read).data.data?.title !== 'Native package acceptance note edited') {
    throw new Error('Edited Vault note was not persisted')
  }

  process.stdout.write(`${JSON.stringify({
    scope: 'qa-disposable', publicRelease: false,
    product: {moduleId, version, productCommit: provenance.releaseCommit, packageSha256: sha256(packageBytes)},
    signing: {algorithm: 'Ed25519', keyId, privateKeyPersisted: false},
    sync: {releaseId: synced.releaseId, releaseState: synced.releaseState, checks: synced.checks},
    packageInstallPlan: {
      status: packagePlan.statusCode, lockSha256: packagePlanData.lockSha256,
      category: rootPackage.category, artifactSha256: rootPackage.artifact.sha256,
      mediaType: rootPackage.artifact.mediaType, sharing: rootPackage.sharing,
    },
    install: {status: install.statusCode, enable: enable.statusCode, launchEligible: descriptorData.launchEligible,
      signatureState: descriptorData.currentRelease.trust.signatureState},
    artifactDownload: {status: download.statusCode, sha256: sha256(download.rawPayload), bytes: download.rawPayload.length},
    noteLifecycle: {create: create.statusCode, edit: update.statusCode, read: read.statusCode,
      recordId: created.record_id, revision: updated.revision},
  }, null, 2)}\n`)
} finally {
  await app.close()
  await db.destroy()
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function asset(name: string, value: Buffer): GithubReleaseAsset {
  return {name, size: value.length, apiUrl: `https://api.github.com/qa-assets/${name}`, digest: `sha256:${sha256(value)}`}
}
