import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {join, resolve, sep} from 'node:path'
import {manifestChecksum, type GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {createDb} from '../src/database/client.js'
import type {GreenfieldModuleReleaseRecord} from '../src/modules/module-domain.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'

type ReleaseProvenance = {
  repository: string
  releaseTag: string
  releaseCommit: string
  packageFile: string
  packageChecksum: string
  greenfieldManifestChecksum: string
}

type ProductRelease = {
  root: string
  productId: string
  version: string
  mpsBytes: string
  frontend: {path: string; bytes: Buffer} | null
  schemas: Array<{path: string; bytes: Buffer}>
  manifest: GreenfieldModuleManifest
  provenance: ReleaseProvenance
}

// DEPRECATED: superseded by scripts/sync-github-release.ts, which fetches and
// verifies the GitHub release server-side. Kept for existing verification
// harnesses that run against a local, tag-pinned checkout.
if (!process.argv.includes('--legacy-local-checkout')) {
  console.warn('[deprecated] publish-mps-products.ts: use scripts/sync-github-release.ts (registry:sync-github-release); pass --legacy-local-checkout to silence this warning')
}
const {apply, roots} = parseArgs(process.argv.slice(2).filter(arg => arg !== '--legacy-local-checkout'))
const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) fail('MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL is required')

const products = roots.map(loadProduct)
const identities = new Set<string>()
for (const product of products) {
  const identity = `${product.productId}@${product.version}`
  if (identities.has(identity)) fail(`Duplicate product root for ${identity}`)
  identities.add(identity)
}

const db = createDb(databaseUrl)
try {
  const releases = new GreenfieldModuleReleaseService(db)
  const mps = new GreenfieldMpsIngestService(db)
  const results = []
  for (const product of products) {
    let release = await releases.getRelease(product.productId, product.version)
    if (!apply) {
      if (release) assertStoredProvenance(product, release)
      results.push({
        productId: product.productId,
        version: product.version,
        action: release?.releaseState === 'published' ? 'already-published' : release ? `publish-from-${release.releaseState}` : 'import-and-publish',
      })
      continue
    }
    if (release) assertStoredProvenance(product, release)
    if (!release) {
      release = await releases.importPendingReview(product.manifest, {
        repository: product.provenance.repository,
        releaseTag: product.provenance.releaseTag,
        releaseCommit: product.provenance.releaseCommit,
        artifactSha256: product.provenance.packageChecksum,
        manifestSha256: product.provenance.greenfieldManifestChecksum,
      })
    }
    if (release.releaseState === 'pendingReview' || release.releaseState === 'verified') {
      release = await releases.publishRelease(product.productId, product.version)
    }
    assertStoredProvenance(product, release)
    if (release.releaseState !== 'published') fail(`Release ${product.productId}@${product.version} is ${release.releaseState}`)
    const ingested = await mps.ingest({
      filename: 'modula.product.json',
      bytes: product.mpsBytes,
      releaseId: release.releaseId,
      frontend: product.frontend,
      schemas: product.schemas,
    })
    if (!ingested || ingested.productId !== product.productId || ingested.version !== product.version) {
      fail(`MPS ingest did not persist ${product.productId}@${product.version}`)
    }
    results.push({productId: product.productId, version: product.version, action: 'published', releaseId: release.releaseId})
  }
  if (!apply) process.exitCode = results.every(item => item.action === 'already-published') ? 0 : 3
  console.log(JSON.stringify({mode: apply ? 'APPLIED' : 'DRY_RUN', products: results}, null, 2))
} finally {
  await db.destroy()
}

function parseArgs(args: string[]): {apply: boolean; roots: string[]} {
  let apply = false
  const roots: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!
    if (arg === '--apply') {
      apply = true
      continue
    }
    if (arg === '--product-root') {
      const root = args[index + 1]
      if (!root) fail('--product-root requires a repository path')
      roots.push(root)
      index += 1
      continue
    }
    if (arg.startsWith('--product-root=')) {
      roots.push(arg.slice('--product-root='.length))
      continue
    }
    fail(`Unknown argument: ${arg}`)
  }
  if (roots.length === 0) fail('At least one --product-root is required')
  return {apply, roots}
}

function loadProduct(inputRoot: string): ProductRelease {
  const root = resolve(inputRoot)
  if (git(root, ['status', '--short'])) fail(`Product repository is dirty: ${root}`)
  const mpsBytes = readFileSync(join(root, 'modula.product.json'), 'utf8')
  const mps = JSON.parse(mpsBytes) as {
    identity?: {id?: unknown; version?: unknown}
    frontend?: {mode?: unknown; artifact?: {path?: unknown}}
    backend?: {records?: Array<{schemaPath?: unknown}>}
  }
  const manifest = readJson<GreenfieldModuleManifest>(join(root, 'module.manifest.json'))
  const productId = typeof mps.identity?.id === 'string' ? mps.identity.id : ''
  const version = typeof mps.identity?.version === 'string' ? mps.identity.version : ''
  if (!productId || !version || manifest.moduleId !== productId || manifest.version !== version) {
    fail(`MPS and Greenfield identities do not match in ${root}`)
  }
  const releaseTag = manifest.source.releaseTag
  const packageFile = manifest.source.releaseAssetName
  if (!releaseTag || !packageFile) fail(`Immutable release metadata is incomplete for ${productId}@${version}`)
  const provenance = readJson<ReleaseProvenance>(join(root, 'release', `${releaseTag}.provenance.json`))
  if (provenance.repository !== manifest.source.repository || provenance.releaseTag !== releaseTag || provenance.packageFile !== packageFile) {
    fail(`Release provenance identity mismatch for ${productId}@${version}`)
  }
  if (git(root, ['rev-parse', `${releaseTag}^{commit}`]) !== provenance.releaseCommit) {
    fail(`Immutable tag mismatch for ${productId}@${version}`)
  }
  if (git(root, ['rev-parse', 'HEAD']) !== provenance.releaseCommit) {
    fail(`Product checkout must be pinned to immutable tag ${releaseTag} for ${productId}@${version}`)
  }
  const computedManifestSha = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  if (computedManifestSha !== provenance.greenfieldManifestChecksum || manifest.integrity.manifestSha256 !== computedManifestSha) {
    fail(`Greenfield manifest checksum mismatch for ${productId}@${version}`)
  }
  if (sha256(join(root, 'release', packageFile)) !== provenance.packageChecksum) {
    fail(`Release artifact checksum mismatch for ${productId}@${version}`)
  }
  const packagePath = join(root, 'release', packageFile)
  assertPackagedFile(packagePath, root, 'modula.product.json')
  const frontendPath = typeof mps.frontend?.artifact?.path === 'string' ? mps.frontend.artifact.path : null
  const frontendFile = frontendPath ? resolveProductArtifact(root, frontendPath) : null
  const frontend = frontendPath && frontendFile ? {path: frontendPath, bytes: readFileSync(frontendFile)} : null
  if (mps.frontend?.mode !== 'none' && !frontend) fail(`MPS frontend artifact is incomplete for ${productId}@${version}`)
  if (frontendPath) assertPackagedFile(packagePath, root, frontendPath)
  const schemaPaths = [...new Set((mps.backend?.records ?? [])
    .map(record => record.schemaPath)
    .filter((path): path is string => typeof path === 'string'))]
  const schemas = schemaPaths.map(path => ({path, bytes: readFileSync(resolveProductArtifact(root, path))}))
  for (const path of schemaPaths) assertPackagedFile(packagePath, root, path)
  return {root, productId, version, mpsBytes, frontend, schemas, manifest, provenance}
}

function assertPackagedFile(packagePath: string, root: string, relativePath: string): void {
  const packaged = execFileSync('tar', ['-xOf', packagePath, `package/${relativePath}`])
  const source = readFileSync(resolveProductArtifact(root, relativePath))
  if (!packaged.equals(source)) fail(`Packaged artifact differs from tagged source: ${relativePath}`)
}

function resolveProductArtifact(root: string, artifactPath: string): string {
  const file = resolve(root, artifactPath)
  if (!file.startsWith(`${root}${sep}`)) fail(`MPS artifact path escapes the product root: ${artifactPath}`)
  return file
}

function assertStoredProvenance(product: ProductRelease, release: GreenfieldModuleReleaseRecord): void {
  if (release.sourceRepository !== product.provenance.repository
    || release.sourceCommit !== product.provenance.releaseCommit
    || release.manifestSha256 !== product.provenance.greenfieldManifestChecksum
    || release.releaseSha256 !== product.provenance.packageChecksum) {
    fail(`Stored provenance mismatch for ${product.productId}@${product.version}`)
  }
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], {encoding: 'utf8'}).trim()
}

function fail(message: string): never {
  throw new Error(message)
}
