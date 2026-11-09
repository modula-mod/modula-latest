import {generateKeyPairSync, randomUUID, sign} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {gzipSync} from 'node:zlib'
import {createServer} from '../src/app/create-server.js'
import {loadConfig} from '../src/config/env.js'
import {migrateUp} from '../src/database/migrate.js'
import {
  GreenfieldGithubReleaseSyncService,
  type GithubRelease,
  type GithubReleaseAsset,
  type GithubReleaseSource,
} from '../src/modules/github-release-sync-service.js'
import {GreenfieldPublisherSigningKeyService, buildPublisherReleaseStatement, statementBytes} from '../src/modules/release-signing.js'
import {adapterManifest, configureRegistryTestEnv, fixtureProduct, fixtureRoot, sha256} from '../tests/helpers/registry-fixtures.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
if (!databaseUrl || process.env.NODE_ENV === 'production' || process.env.MODULA_ENVIRONMENT === 'production') {
  throw new Error('Only an explicit nonproduction test database is permitted')
}

const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
const moduleId = `test.modula.qa-package-install-plan-${suffix}`
const version = '1.0.0'
const repository = 'modula-mod/registry-trust-fixtures'
const commit = '0123456789abcdef0123456789abcdef01234567'
const keyId = `qa-plan-${suffix}`

configureRegistryTestEnv(databaseUrl, '14024')
process.env.MODULA_PUBLIC_API_URL ??= 'http://127.0.0.1:14024'
process.env.MODULA_CHECKPOINT_SIGNING_KEY ??= 'qa-package-plan-ephemeral'

await migrateUp(databaseUrl)

const keys = generateKeyPairSync('ed25519')
const {app, db} = await createServer(loadConfig())

function responseData(response: {json(): unknown}): Record<string, any> {
  const body = response.json()
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Response was not an object')
  return body as Record<string, any>
}

function requireStatus(response: {statusCode: number; body: string}, expected: number, label: string): void {
  if (response.statusCode !== expected) throw new Error(`${label} returned ${response.statusCode}: ${response.body}`)
}

function tarEntry(path: string, bytes: Buffer): Buffer {
  const header = Buffer.alloc(512)
  header.write(path, 0, 100, 'utf8')
  header.write('0000644\0', 100)
  header.write('0000000\0', 108)
  header.write('0000000\0', 116)
  header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124)
  header.write('00000000000\0', 136)
  header.write('        ', 148)
  header.write('0', 156)
  header.write('ustar\0', 257)
  header.write('00', 263)
  let sum = 0
  for (const byte of header) sum += byte
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148)
  return Buffer.concat([header, bytes, Buffer.alloc(Math.ceil(bytes.length / 512) * 512 - bytes.length)])
}

function tgz(files: Record<string, Buffer>): Buffer {
  return gzipSync(Buffer.concat([...Object.entries(files).map(([path, bytes]) => tarEntry(`package/${path}`, bytes)), Buffer.alloc(1024)]))
}

class FakeSource implements GithubReleaseSource {
  constructor(public release: GithubRelease, public bytes: Map<string, Buffer>, public commitSha: string) {}
  async getRelease(repo: string, tag: string) {
    if (repo !== repository || tag !== this.release.tagName) throw Object.assign(new Error('not found'), {code: 'NOT_FOUND'})
    return this.release
  }
  async resolveTagCommit() { return this.commitSha }
  async downloadAsset(asset: GithubReleaseAsset) {
    return this.bytes.get(asset.name)!
  }
}

function buildSignedRelease() {
  const tag = `${moduleId}-v${version}`
  const packageFile = `${moduleId}-${version}.tgz`
  const product = fixtureProduct(moduleId, version, (mps) => {
    mps.source = {...(mps.source ?? {}), provider: 'github', repository}
    mps.publisher = {...(mps.publisher ?? {}), id: 'modula'}
  })
  const manifest = adapterManifest(moduleId, version)
  const files: Record<string, Buffer> = {
    'modula.product.json': Buffer.from(product.mpsBytes),
    'module.manifest.json': Buffer.from(JSON.stringify(manifest, null, 2)),
    [product.frontend.path]: product.frontend.bytes,
    'modula.module.json': Buffer.from(JSON.stringify({id: moduleId, moduleVersion: version, publisher: {id: 'modula'}})),
  }
  for (const record of (product.mps.backend?.records ?? []) as Array<{schemaPath?: string}>) {
    if (record.schemaPath) files[record.schemaPath] = readFileSync(join(fixtureRoot, record.schemaPath))
  }
  for (const asset of product.assets) files[asset.path] = asset.bytes
  const packageBytes = tgz(files)
  const statement = buildPublisherReleaseStatement({
    manifest,
    sourceSha: commit,
    artifactSha256: sha256(packageBytes),
    productManifestSha256: sha256(Buffer.from(product.mpsBytes)),
    frontendSha256: sha256(product.frontend.bytes),
    signingKeyId: keyId,
  })
  const provenance = {
    productId: moduleId,
    version,
    repository,
    releaseCommit: commit,
    releaseTag: tag,
    packageFile,
    packageChecksum: sha256(packageBytes),
    productManifestChecksum: sha256(Buffer.from(product.mpsBytes)),
    greenfieldManifestChecksum: manifest.integrity.manifestSha256,
    frontendArtifact: product.frontend.path,
    frontendChecksum: sha256(product.frontend.bytes),
    standardManifestChecksum: sha256(files['modula.module.json']!),
    signature: {algorithm: 'Ed25519', keyId, value: sign(null, statementBytes(statement), keys.privateKey).toString('base64url')},
  }
  const provenanceBytes = Buffer.from(JSON.stringify(provenance, null, 2))
  const assets: GithubReleaseAsset[] = [
    {name: packageFile, size: packageBytes.length, apiUrl: `https://api.github.com/assets/${packageFile}`, digest: `sha256:${sha256(packageBytes)}`},
    {name: `${tag}.provenance.json`, size: provenanceBytes.length, apiUrl: `https://api.github.com/assets/${tag}.provenance.json`, digest: `sha256:${sha256(provenanceBytes)}`},
  ]
  const source = new FakeSource({tagName: tag, draft: false, prerelease: false, assets}, new Map([[packageFile, packageBytes], [`${tag}.provenance.json`, provenanceBytes]]), commit)
  return {source, tag}
}

try {
  await app.ready()
  await new GreenfieldPublisherSigningKeyService(db).register('modula', {
    keyId,
    publicKeyPem: keys.publicKey.export({format: 'pem', type: 'spki'}).toString(),
  }, null)
  const built = buildSignedRelease()
  const synced = await new GreenfieldGithubReleaseSyncService(db, built.source).sync({
    repository,
    releaseTag: built.tag,
    publish: true,
    dryRun: false,
  })
  if (!('signed' in synced) || synced.signed !== true || synced.releaseState !== 'published') {
    throw new Error(`Fixture release was not published and signed: ${JSON.stringify(synced)}`)
  }

  const release = await db.selectFrom('greenfield_module_releases')
    .select(['release_id', 'release_state', 'release_sha256', 'source_commit', 'signature_key_id'])
    .where('module_id', '=', moduleId)
    .where('version', '=', version)
    .executeTakeFirstOrThrow()
  if (release.release_state !== 'published' || !release.signature_key_id) {
    throw new Error('Fixture QA release must be published and signed before lifecycle verification')
  }

  const email = `qa-plan-${suffix}@example.invalid`
  const password = 'qa-package-plan-password-1'
  const register = await app.inject({
    method: 'POST',
    url: '/v1/accounts/register',
    payload: {email, password, handle: `qaplan${suffix}`, displayName: 'Package Plan QA', acceptedTerms: true},
  })
  requireStatus(register, 201, 'register')
  const registerBody = responseData(register)
  const verify = await app.inject({
    method: 'POST',
    url: '/v1/accounts/verify-email',
    payload: {token: registerBody.data.verificationToken},
  })
  requireStatus(verify, 200, 'verify email')
  const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
  requireStatus(session, 200, 'create session')
  const token = responseData(session).data.accessToken as string
  const headers = {authorization: `Bearer ${token}`}
  const context = {version, hostVersion: '1.1.0', platform: 'ios'}

  const packagePlan = await app.inject({
    method: 'POST',
    url: `/v1/modules/${moduleId}/package-install-plan`,
    headers,
    payload: context,
  })
  requireStatus(packagePlan, 404, 'fixture optional package plan')
  const packagePlanBody = responseData(packagePlan)
  if (packagePlanBody.error?.code !== 'NOT_FOUND') throw new Error('Fixture package-plan failure was not NOT_FOUND')

  const install = await app.inject({
    method: 'POST',
    url: `/v1/modules/${moduleId}/install`,
    headers: {...headers, 'idempotency-key': `qa-plan-${suffix}`},
    payload: {...context, approvedPermissions: []},
  })
  requireStatus(install, 202, 'fixture standard install')
  const installBody = responseData(install)
  const descriptor = await app.inject({
    method: 'GET',
    url: `/v1/modules/${moduleId}/installation-descriptor?hostVersion=1.1.0&platform=ios`,
    headers,
  })
  requireStatus(descriptor, 200, 'fixture installation descriptor')
  const descriptorBody = responseData(descriptor)
  if (descriptorBody.data?.currentRelease?.version !== version
    || descriptorBody.data?.currentRelease?.trust?.signatureState !== 'verified') {
    throw new Error('Installation descriptor did not preserve the signed fixture release')
  }

  process.stdout.write(`${JSON.stringify({
    scope: 'qa-disposable',
    moduleId,
    release: {
      releaseId: release.release_id,
      version,
      state: release.release_state,
      sha256: release.release_sha256,
      sourceCommit: release.source_commit,
      signingKeyId: release.signature_key_id,
    },
    packageInstallPlan: {status: packagePlan.statusCode, code: packagePlanBody.error.code},
    standardInstall: {
      status: install.statusCode,
      installationId: installBody.data.installationId,
      distributionReady: installBody.data.distributionReady,
    },
    installationDescriptor: {
      status: descriptor.statusCode,
      version: descriptorBody.data.currentRelease.version,
      signatureState: descriptorBody.data.currentRelease.trust.signatureState,
    },
  }, null, 2)}\n`)
} finally {
  await app.close()
  await db.destroy()
}
