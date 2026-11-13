import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {manifestChecksum, type GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldModuleReleaseService, type GreenfieldModuleReleaseEvidence} from '../src/modules/release-service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const apiDatabaseUrl = process.env.MODULA_TEST_API_DATABASE_URL ?? databaseUrl
const describeIfDb = databaseUrl ? describe : describe.skip
const fixturePath = join(process.cwd(), '../../fixtures/modules/module-owned-backend/module.manifest.json')

describeIfDb('generic MPS release publication', () => {
  let db: ModulaDb
  let releases: GreenfieldModuleReleaseService

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(apiDatabaseUrl!)
    releases = new GreenfieldModuleReleaseService(db)
  })

  afterAll(async () => db?.destroy())

  it('imports, publishes, and rejects a duplicate immutable release', async () => {
    const manifest = manifestFor(`com.example.publish-${suffix()}`, 'example.publisher')
    const imported = await releases.importPendingReview(manifest, evidenceFor(manifest))
    expect(imported.releaseState).toBe('pendingReview')
    expect((await releases.publishRelease(manifest.moduleId, manifest.version)).releaseState).toBe('published')
    await expect(releases.importPendingReview(manifest, evidenceFor(manifest))).rejects.toMatchObject({code: 'CONFLICT'})
  })

  it('rejects invalid artifact and manifest hashes', async () => {
    const badArtifact = manifestFor(`com.example.bad-artifact-${suffix()}`, 'example.publisher')
    await expect(releases.importPendingReview(badArtifact, evidenceFor(badArtifact, {artifactSha256: '0'.repeat(64)})))
      .rejects.toMatchObject({code: 'VALIDATION_FAILED'})

    const badManifest = manifestFor(`com.example.bad-manifest-${suffix()}`, 'example.publisher')
    await expect(releases.importPendingReview(badManifest, evidenceFor(badManifest, {manifestSha256: 'f'.repeat(64)})))
      .rejects.toMatchObject({code: 'VALIDATION_FAILED'})
  })

  it('rejects malformed signature declarations', async () => {
    const manifest = manifestFor(`com.example.bad-signature-${suffix()}`, 'example.publisher')
    manifest.integrity.signatureKeyId = 'publisher-key-1'
    manifest.integrity.signature = 'bad-signature'
    manifest.integrity.manifestSha256 = checksum(manifest)
    await expect(releases.importPendingReview(manifest, evidenceFor(manifest))).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
  })

  it('rejects an unverified publisher claiming the reserved namespace', async () => {
    const manifest = manifestFor(`digital.modula.untrusted-${suffix()}`, 'attacker.publisher', false)
    await expect(releases.importPendingReview(manifest, evidenceFor(manifest))).rejects.toMatchObject({code: 'FORBIDDEN'})
  })

  it('rejects a second publisher claiming an owned namespace', async () => {
    const namespace = `com.owner${suffix()}`
    const first = manifestFor(`${namespace}.alpha`, 'publisher.alpha')
    await releases.importPendingReview(first, evidenceFor(first))
    const second = manifestFor(`${namespace}.beta`, 'publisher.beta')
    await expect(releases.importPendingReview(second, evidenceFor(second))).rejects.toMatchObject({code: 'CONFLICT'})
  })
})

function manifestFor(moduleId: string, publisherId: string, firstParty = false): GreenfieldModuleManifest {
  const manifest = structuredClone(JSON.parse(readFileSync(fixturePath, 'utf8'))) as GreenfieldModuleManifest
  manifest.moduleId = moduleId
  manifest.version = '1.0.0'
  manifest.publisher = {publisherId, displayName: publisherId}
  manifest.source = {
    provider: 'github',
    repository: `${publisherId}/${moduleId}`,
    commit: 'a'.repeat(40),
    manifestPath: 'module.manifest.json',
    releaseTag: `${moduleId}-v1.0.0`,
    releaseAssetName: `${moduleId}-1.0.0.tgz`,
  }
  manifest.license = {status: firstParty ? 'firstParty' : 'declared', evidenceIds: ['test-evidence']}
  manifest.trust = {requestedLevel: firstParty ? 'firstParty' : 'untrustedManifest'}
  manifest.permissions = []
  manifest.contributions = {}
  delete manifest.backend
  Object.assign(manifest, {
    extensionProduct: {
      version: '1.0.0',
      kind: 'plugin',
      targets: [],
      extensionPoints: [],
      contributions: [],
      retention: {defaultMode: 'DELETE_DATA', supportsUserChoice: false, metadataNamespace: moduleId},
      graphPolicy: {maxDepth: 8, maxNodes: 128},
    },
  })
  manifest.integrity = {manifestSha256: '', releaseSha256: 'b'.repeat(64)}
  manifest.integrity.manifestSha256 = checksum(manifest)
  return manifest
}

function evidenceFor(manifest: GreenfieldModuleManifest, overrides: Partial<GreenfieldModuleReleaseEvidence> = {}): GreenfieldModuleReleaseEvidence {
  return {
    repository: manifest.source.repository,
    releaseTag: manifest.source.releaseTag!,
    releaseCommit: 'a'.repeat(40),
    artifactSha256: 'b'.repeat(64),
    manifestSha256: checksum(manifest),
    ...overrides,
  }
}

function checksum(manifest: GreenfieldModuleManifest): string {
  return manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
}

function suffix(): string {
  return randomUUID().replaceAll('-', '').slice(0, 10)
}
