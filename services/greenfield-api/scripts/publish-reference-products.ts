import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {manifestChecksum, type GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {
  CANONICAL_VAULT_NOTES_CURRENT_TAG,
  CANONICAL_VAULT_NOTES_CURRENT_VERSION,
  CANONICAL_VAULT_NOTES_MODULE_ID,
} from '@modula/greenfield-contracts'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'

type ProductName = 'notes' | 'formatting' | 'ai' | 'voice'

type ReleaseProvenance = {
  repository: string
  releaseTag: string
  releaseCommit: string
  packageFile: string
  packageChecksum: string
  greenfieldManifestChecksum: string
}

type ReferenceProduct = {
  name: ProductName
  moduleId: string
  version: string
  root: string
  provenanceFile: string
  manifest: GreenfieldModuleManifest
  provenance: ReleaseProvenance
}

const definitions: Array<Omit<ReferenceProduct, 'root' | 'manifest' | 'provenance'>> = [
  {
    name: 'notes',
    moduleId: CANONICAL_VAULT_NOTES_MODULE_ID,
    version: CANONICAL_VAULT_NOTES_CURRENT_VERSION,
    provenanceFile: `${CANONICAL_VAULT_NOTES_CURRENT_TAG}.provenance.json`,
  },
  {
    name: 'formatting',
    moduleId: 'digital.modula.vault-notes.formatting',
    version: '0.1.0',
    provenanceFile: 'vault-formatting-v0.1.0.provenance.json',
  },
  {
    name: 'ai',
    moduleId: 'digital.modula.vault-notes.ai',
    version: '0.1.0',
    provenanceFile: 'vault-ai-v0.1.0.provenance.json',
  },
  {
    name: 'voice',
    moduleId: 'digital.modula.vault-notes.voice',
    version: '0.1.0',
    provenanceFile: 'vault-voice-v0.1.0.provenance.json',
  },
]

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const removeTestFixtures = args.has('--remove-test-fixtures')
if (removeTestFixtures && !apply) fail('--remove-test-fixtures requires --apply')
for (const arg of args) {
  if (arg !== '--apply' && arg !== '--remove-test-fixtures') fail(`Unknown argument: ${arg}`)
}

const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) fail('MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL is required')

const products = definitions.map(definition => loadProduct(definition))
const db = createDb(databaseUrl)
try {
  const releases = new GreenfieldModuleReleaseService(db)
  const before = await inspectRegistry(db, products)
  if (!apply) {
    printResult('DRY_RUN', before, products, [])
    process.exitCode = before.referenceProducts.every(product => product.action === 'already-published')
      && before.legacyPublishedVaultNotes.length === 0
      && before.testFixtures.length === 0
      ? 0
      : 3
  } else {
    for (const product of products) {
      let release = await releases.getRelease(product.moduleId, product.version)
      if (release) assertExistingRelease(product, release)
      if (!release) {
        await releases.importPendingReview(product.manifest, {
          repository: product.provenance.repository,
          releaseTag: product.provenance.releaseTag,
          releaseCommit: product.provenance.releaseCommit,
          artifactSha256: product.provenance.packageChecksum,
          manifestSha256: product.provenance.greenfieldManifestChecksum,
        })
        release = await releases.getRelease(product.moduleId, product.version)
      }
      if (!release) fail(`Release import did not persist ${product.moduleId}@${product.version}`)
      if (release.releaseState === 'pendingReview' || release.releaseState === 'verified') {
        release = await releases.publishRelease(product.moduleId, product.version)
      }
      assertExistingRelease(product, release)
      if (release.releaseState !== 'published') {
        fail(`Reference release ${product.moduleId}@${product.version} is ${release.releaseState}, expected published`)
      }
    }

    const superseded = await supersedeLegacyVaultNotes(db, products[0]!)
    const removedFixtures = removeTestFixtures ? await deleteKnownSearchFixtures(db) : []
    const after = await inspectRegistry(db, products)
    assertFinalRegistry(after, removeTestFixtures)
    printResult('APPLIED', after, products, [...superseded, ...removedFixtures])
  }
} finally {
  await db.destroy()
}

function loadProduct(definition: Omit<ReferenceProduct, 'root' | 'manifest' | 'provenance'>): ReferenceProduct {
  const envName = `MODULA_VAULT_${definition.name.toUpperCase()}_ROOT`
  const defaultDirectory = definition.name === 'notes'
    ? 'modula-vault-notes'
    : definition.name === 'formatting'
      ? 'modula-vault-formatting'
      : definition.name === 'ai'
        ? 'modula-vault-ai'
        : 'modula-vault-voice'
  const root = resolve(process.env[envName] ?? join('/root/modula-mod', defaultDirectory))
  const manifest = readJson<GreenfieldModuleManifest>(join(root, 'module.manifest.json'))
  const provenance = readJson<ReleaseProvenance>(join(root, 'release', definition.provenanceFile))
  if (manifest.moduleId !== definition.moduleId || manifest.version !== definition.version) {
    fail(`Reference identity mismatch in ${root}: ${manifest.moduleId}@${manifest.version}`)
  }
  if (provenance.repository !== manifest.source.repository) fail(`Repository provenance mismatch for ${definition.moduleId}`)
  if (git(root, ['status', '--short'])) fail(`Reference repository is dirty: ${root}`)
  const tagCommit = git(root, ['rev-parse', `${provenance.releaseTag}^{commit}`])
  if (tagCommit !== provenance.releaseCommit) fail(`Immutable tag mismatch for ${definition.moduleId}`)
  const computedManifestSha = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  if (computedManifestSha !== provenance.greenfieldManifestChecksum || manifest.integrity.manifestSha256 !== computedManifestSha) {
    fail(`Greenfield manifest checksum mismatch for ${definition.moduleId}`)
  }
  const packageChecksum = sha256(join(root, 'release', provenance.packageFile))
  if (packageChecksum !== provenance.packageChecksum) fail(`Release artifact checksum mismatch for ${definition.moduleId}`)
  return {...definition, root, manifest, provenance}
}

async function inspectRegistry(db: ModulaDb, products: ReferenceProduct[]) {
  const referenceProducts = []
  for (const product of products) {
    const row = await db
      .selectFrom('greenfield_module_releases')
      .select(['release_id', 'release_state', 'source_repository', 'source_commit', 'manifest_sha256', 'release_sha256'])
      .where('module_id', '=', product.moduleId)
      .where('version', '=', product.version)
      .executeTakeFirst()
    referenceProducts.push({
      moduleId: product.moduleId,
      version: product.version,
      action: row?.release_state === 'published' ? 'already-published' : row ? `publish-from-${row.release_state}` : 'import-and-publish',
    })
  }
  const legacyPublishedVaultNotes = await db
    .selectFrom('greenfield_module_releases')
    .select(['release_id', 'module_id', 'version', 'release_state'])
    .where('module_id', '=', 'digital.modula.vault-notes')
    .where('version', '!=', products[0]!.version)
    .where('release_state', '=', 'published')
    .orderBy('version')
    .execute()
  const testFixtures = (await db
    .selectFrom('greenfield_module_releases')
    .select(['release_id', 'module_id', 'version', 'release_state', 'source_repository', 'source_commit'])
    .where('source_repository', '=', 'modula-mod/search-module')
    .execute())
    .filter(isKnownSearchFixture)
  return {referenceProducts, legacyPublishedVaultNotes, testFixtures}
}

async function supersedeLegacyVaultNotes(db: ModulaDb, current: ReferenceProduct): Promise<string[]> {
  const legacy = await db
    .selectFrom('greenfield_module_releases')
    .select(['release_id', 'module_version_id', 'extension_version_id', 'version'])
    .where('module_id', '=', current.moduleId)
    .where('version', '!=', current.version)
    .where('release_state', '=', 'published')
    .execute()
  if (legacy.length === 0) return []
  const now = new Date()
  await db.transaction().execute(async trx => {
    await trx.updateTable('greenfield_module_releases').set({release_state: 'superseded', superseded_at: now, updated_at: now}).where('release_id', 'in', legacy.map(row => row.release_id)).execute()
    await trx.updateTable('greenfield_module_versions').set({status: 'superseded', updated_at: now}).where('module_version_id', 'in', legacy.map(row => row.module_version_id)).execute()
    await trx.updateTable('greenfield_extension_versions').set({status: 'superseded'}).where('extension_version_id', 'in', legacy.map(row => row.extension_version_id)).execute()
  })
  return legacy.map(row => `superseded:${current.moduleId}@${row.version}`)
}

async function deleteKnownSearchFixtures(db: ModulaDb): Promise<string[]> {
  const candidates = await db
    .selectFrom('greenfield_module_releases')
    .select(['release_id', 'module_id', 'version', 'release_state', 'source_repository', 'source_commit', 'extension_id'])
    .where('source_repository', '=', 'modula-mod/search-module')
    .execute()
  const fixtures = candidates.filter(isKnownSearchFixture)
  const unexpected = candidates.filter(row => !isKnownSearchFixture(row))
  if (unexpected.length > 0) fail(`Refusing fixture cleanup: ${unexpected.length} search-module release(s) do not match the known test signature`)
  if (fixtures.length === 0) return []
  const extensionIds = fixtures.map(row => row.extension_id)
  const moduleIds = fixtures.map(row => row.module_id)
  await db.transaction().execute(async trx => {
    await trx.deleteFrom('search_documents').where('entity_type', '=', 'module').where('entity_id', 'in', moduleIds).execute()
    await trx.deleteFrom('greenfield_extensions').where('extension_id', 'in', extensionIds).execute()
  })
  return moduleIds.map(moduleId => `removed-test-fixture:${moduleId}`)
}

function isKnownSearchFixture(row: {module_id: string; version: string; release_state: string; source_repository: string; source_commit: string}) {
  return /^digital\.modula\.search-[0-9a-f]{8}$/.test(row.module_id)
    && row.version === '1.0.0'
    && row.release_state === 'quarantined'
    && row.source_repository === 'modula-mod/search-module'
    && row.source_commit === '1234567890abcdef1234567890abcdef12345678'
}

function assertExistingRelease(product: ReferenceProduct, release: Awaited<ReturnType<GreenfieldModuleReleaseService['getRelease']>>) {
  if (!release) fail(`Missing release ${product.moduleId}@${product.version}`)
  if (release.sourceRepository !== product.provenance.repository
    || release.sourceCommit !== product.provenance.releaseCommit
    || release.manifestSha256 !== product.provenance.greenfieldManifestChecksum
    || release.releaseSha256 !== product.provenance.packageChecksum) {
    fail(`Stored provenance mismatch for ${product.moduleId}@${product.version}`)
  }
}

function assertFinalRegistry(registry: Awaited<ReturnType<typeof inspectRegistry>>, fixturesWereRemoved: boolean) {
  if (registry.referenceProducts.some(product => product.action !== 'already-published')) fail('Reference products did not converge to published')
  if (registry.legacyPublishedVaultNotes.length !== 0) fail('Legacy Vault Notes releases remain publicly visible')
  if (fixturesWereRemoved && registry.testFixtures.length !== 0) fail('Known test fixtures remain registered')
}

function printResult(mode: 'DRY_RUN' | 'APPLIED', registry: Awaited<ReturnType<typeof inspectRegistry>>, products: ReferenceProduct[], changes: string[]) {
  console.log(JSON.stringify({
    mode,
    referenceProducts: registry.referenceProducts,
    immutableSources: products.map(product => ({
      moduleId: product.moduleId,
      version: product.version,
      releaseTag: product.provenance.releaseTag,
      releaseCommit: product.provenance.releaseCommit,
      manifestSha256: product.provenance.greenfieldManifestChecksum,
      artifactSha256: product.provenance.packageChecksum,
    })),
    visibleVaultNotesProducts: registry.legacyPublishedVaultNotes.length === 0 && registry.referenceProducts[0]?.action === 'already-published' ? 1 : registry.legacyPublishedVaultNotes.length,
    knownTestFixtures: registry.testFixtures.map(row => row.module_id),
    changes,
  }, null, 2))
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function git(root: string, command: string[]): string {
  return execFileSync('git', ['-C', root, ...command], {encoding: 'utf8'}).trim()
}

function fail(message: string): never {
  throw new Error(message)
}
