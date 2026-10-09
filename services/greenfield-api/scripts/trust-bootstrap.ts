/**
 * Registers a publisher public key and retrospective signatures after verifying
 * immutable release assets. The private signing key is never an input here.
 * Dry-run is the default; --apply is the only mutating mode.
 */
import {readFileSync} from 'node:fs'
import {verify} from 'node:crypto'
import {sql} from 'kysely'
import {createDb} from '../src/database/client.js'
import type {GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {GreenfieldGithubReleaseSyncService, HttpGithubReleaseSource} from '../src/modules/github-release-sync-service.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {buildPublisherReleaseStatement, normalizeSignatureInput, parsePublisherPublicKey, signingManifestDigest, statementBytes, statementSha256, GreenfieldPublisherSigningKeyService, type PublisherReleaseStatement} from '../src/modules/release-signing.js'

type BootstrapRelease = {
  releaseId: string
  repository: string
  releaseTag: string
  signature: {algorithm: 'Ed25519'; keyId: string; value: string}
  statementSha256: string
  statement: PublisherReleaseStatement
}
type BootstrapBundle = {
  schemaVersion: '1.0.0'
  publisherId: string
  keyId: string
  publicKeyPem: string
  releases: BootstrapRelease[]
  legacyUpgrades: Array<{moduleId: string; fromVersion: string; toVersion: string; expectedStates: Record<string, number>}>
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`)
  return value
}

function parseBundle(value: unknown): BootstrapBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Bootstrap bundle must be an object')
  const record = value as Record<string, unknown>
  if (record.schemaVersion !== '1.0.0') throw new Error('Unsupported bootstrap bundle schema')
  const publisherId = requiredString(record.publisherId, 'publisherId')
  const keyId = requiredString(record.keyId, 'keyId')
  const publicKeyPem = requiredString(record.publicKeyPem, 'publicKeyPem')
  if (!Array.isArray(record.releases) || record.releases.length === 0) throw new Error('At least one release is required')
  const seen = new Set<string>()
  const releases = record.releases.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`releases[${index}] must be an object`)
    const release = item as Record<string, unknown>
    const releaseId = requiredString(release.releaseId, `releases[${index}].releaseId`)
    if (seen.has(releaseId)) throw new Error(`Duplicate release ID ${releaseId}`)
    seen.add(releaseId)
    const signature = normalizeSignatureInput(release.signature)
    if (!signature || signature.keyId !== keyId) throw new Error(`Release ${releaseId} has no signature from ${keyId}`)
    const digest = requiredString(release.statementSha256, `releases[${index}].statementSha256`)
    if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error(`Release ${releaseId} has an invalid statement digest`)
    if (!release.statement || typeof release.statement !== 'object' || Array.isArray(release.statement)) throw new Error(`Release ${releaseId} has no canonical statement`)
    const statement = release.statement as PublisherReleaseStatement
    if (statement.statementType !== 'modula.publisher-release.v1' || statement.signingKeyId !== keyId
      || statementSha256(statement) !== digest) throw new Error(`Release ${releaseId} has mismatched signed facts`)
    return {
      releaseId,
      repository: requiredString(release.repository, `releases[${index}].repository`),
      releaseTag: requiredString(release.releaseTag, `releases[${index}].releaseTag`),
      signature: {algorithm: 'Ed25519' as const, keyId: signature.keyId, value: signature.value},
      statementSha256: digest,
      statement,
    }
  })
  const legacyUpgrades = Array.isArray(record.legacyUpgrades) ? record.legacyUpgrades.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`legacyUpgrades[${index}] must be an object`)
    const row = item as Record<string, unknown>
    if (!row.expectedStates || typeof row.expectedStates !== 'object' || Array.isArray(row.expectedStates)) throw new Error(`legacyUpgrades[${index}].expectedStates is required`)
    const expectedStates = row.expectedStates as Record<string, unknown>
    for (const [state, count] of Object.entries(expectedStates)) {
      if (!['enabled', 'disabled', 'installedDisabled'].includes(state) || !Number.isInteger(count) || (count as number) < 0) {
        throw new Error(`legacyUpgrades[${index}] has an invalid expected state count`)
      }
    }
    return {moduleId: requiredString(row.moduleId, `legacyUpgrades[${index}].moduleId`),
      fromVersion: requiredString(row.fromVersion, `legacyUpgrades[${index}].fromVersion`),
      toVersion: requiredString(row.toVersion, `legacyUpgrades[${index}].toVersion`),
      expectedStates: expectedStates as Record<string, number>}
  }) : []
  return {schemaVersion: '1.0.0', publisherId, keyId, publicKeyPem, releases, legacyUpgrades}
}

const fileIndex = process.argv.indexOf('--file')
if (fileIndex < 0 || !process.argv[fileIndex + 1]) throw new Error('--file <public bootstrap bundle> is required')
const apply = process.argv.includes('--apply')
if (apply && process.argv.includes('--dry-run')) throw new Error('Choose --apply or --dry-run, not both')
const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) throw new Error('MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL is required')
const bundle = parseBundle(JSON.parse(readFileSync(process.argv[fileIndex + 1], 'utf8')))
const publicKey = parsePublisherPublicKey(bundle.publicKeyPem)
const db = createDb(databaseUrl)

try {
  const publisher = await db.selectFrom('greenfield_publishers').select(['publisher_id', 'status']).where('publisher_id', '=', bundle.publisherId).executeTakeFirst()
  if (!publisher || publisher.status !== 'verified') throw new Error('Publisher is not verified')
  const existingKey = await db.selectFrom('greenfield_publisher_signing_keys')
    .select(['publisher_id', 'fingerprint', 'state', 'revoked_at'])
    .where('key_id', '=', bundle.keyId).executeTakeFirst()
  if (existingKey && (existingKey.publisher_id !== bundle.publisherId || existingKey.fingerprint !== publicKey.fingerprint
    || existingKey.state !== 'ACTIVE' || existingKey.revoked_at)) throw new Error('Registered signing key does not match the active bootstrap key')

  const fetcher = new GreenfieldGithubReleaseSyncService(db, new HttpGithubReleaseSource({token: process.env.GREENFIELD_MODULE_GITHUB_TOKEN ?? null}))
  const checked = []
  for (const item of bundle.releases) {
    const artifact = await fetcher.fetchVerified({repository: item.repository, releaseTag: item.releaseTag})
    const row = await db.selectFrom('greenfield_module_releases as release')
      .innerJoin('greenfield_module_versions as version', 'version.module_version_id', 'release.module_version_id')
      .select(['release.release_id', 'release.module_id', 'release.version', 'release.publisher_id', 'release.release_state',
        'release.source_repository', 'release.source_commit', 'release.manifest_sha256', 'release.release_sha256',
        'release.signature_key_id', 'release.signature', 'version.manifest'])
      .where('release.release_id', '=', item.releaseId).executeTakeFirst()
    const integrity = await db.selectFrom('greenfield_module_release_integrity')
      .select(['manifest_sha256', 'release_sha256', 'source_commit', 'mismatch_at'])
      .where('release_id', '=', item.releaseId).executeTakeFirst()
    const [ingestion, frontend] = await Promise.all([
      db.selectFrom('greenfield_mps_ingestions').select('manifest_sha256').where('release_id', '=', item.releaseId).executeTakeFirst(),
      db.selectFrom('greenfield_release_frontends').select('artifact_sha256').where('release_id', '=', item.releaseId).executeTakeFirst(),
    ])
    if (!row || row.release_state !== 'published' || row.publisher_id !== bundle.publisherId
      || row.module_id !== artifact.productId || row.version !== artifact.version
      || row.source_repository !== artifact.repository || row.source_commit !== artifact.releaseCommit
      || row.release_sha256 !== artifact.packageSha256 || row.manifest_sha256 !== signingManifestDigest(artifact.manifest)
      || integrity?.mismatch_at || integrity?.manifest_sha256 !== row.manifest_sha256
      || integrity?.release_sha256 !== row.release_sha256 || integrity?.source_commit !== row.source_commit
      || (ingestion && ingestion.manifest_sha256 !== artifact.evidence.productManifestSha256)
      || (frontend && frontend.artifact_sha256 !== artifact.evidence.frontendSha256)
      || signingManifestDigest(row.manifest as GreenfieldModuleManifest) !== row.manifest_sha256) {
      throw new Error(`Release facts do not match verified immutable asset: ${item.releaseId}`)
    }
    const statement = buildPublisherReleaseStatement({
      manifest: artifact.manifest,
      sourceSha: artifact.releaseCommit,
      artifactSha256: artifact.packageSha256,
      productManifestSha256: ingestion?.manifest_sha256 ?? null,
      frontendSha256: frontend?.artifact_sha256 ?? null,
      signingKeyId: bundle.keyId,
    })
    if (!statementBytes(statement).equals(statementBytes(item.statement))
      || statementSha256(statement) !== item.statementSha256
      || !verify(null, statementBytes(statement), publicKey.key, Buffer.from(item.signature.value, 'base64url'))) {
      throw new Error(`Signature does not verify against immutable release facts: ${item.releaseId}`)
    }
    if (row.signature_key_id && (row.signature_key_id !== bundle.keyId || row.signature !== item.signature.value)) {
      throw new Error(`Release has different signature evidence: ${item.releaseId}`)
    }
    checked.push({item, artifact, alreadyAttached: Boolean(row.signature_key_id)})
  }

  const installationImpact = await sql<{module_id: string; version: string; status: string; count: number}>`
    SELECT release.module_id, release.version, installation.status, COUNT(*)::int AS count
    FROM greenfield_extension_installations installation
    JOIN greenfield_module_releases release ON release.extension_version_id = installation.extension_version_id
    WHERE installation.status NOT IN ('removed', 'uninstalled', 'notInstalled')
    GROUP BY release.module_id, release.version, installation.status
    ORDER BY release.module_id, release.version, installation.status
  `.execute(db)
  for (const mapping of bundle.legacyUpgrades) {
    const target = checked.find(entry => entry.artifact.productId === mapping.moduleId && entry.artifact.version === mapping.toVersion)
    if (!target) throw new Error(`Legacy upgrade target is not signed in this bundle: ${mapping.moduleId}@${mapping.toVersion}`)
    const actualStates = Object.fromEntries(installationImpact.rows
      .filter(row => row.module_id === mapping.moduleId && row.version === mapping.fromVersion)
      .map(row => [row.status, row.count]))
    if (JSON.stringify(Object.entries(actualStates).sort()) !== JSON.stringify(Object.entries(mapping.expectedStates).sort())) {
      throw new Error(`Legacy installation count changed: ${mapping.moduleId}@${mapping.fromVersion}`)
    }
  }
  const covered = new Set(checked.map(entry => `${entry.artifact.productId}@${entry.artifact.version}`))
  for (const mapping of bundle.legacyUpgrades) covered.add(`${mapping.moduleId}@${mapping.fromVersion}`)
  const blockedInstallations = installationImpact.rows.filter(row => !covered.has(`${row.module_id}@${row.version}`))
  if (blockedInstallations.length) throw new Error(`Active installation releases lack a signed target or migration mapping: ${JSON.stringify(blockedInstallations)}`)
  if (apply) {
    const keys = new GreenfieldPublisherSigningKeyService(db)
    if (!existingKey) await keys.register(bundle.publisherId, {keyId: bundle.keyId, publicKeyPem: bundle.publicKeyPem}, null)
    const releases = new GreenfieldModuleReleaseService(db)
    for (const entry of checked) {
      await releases.attachPublishedSignature(entry.item.releaseId, {
        signature: entry.item.signature,
        statementSha256: entry.item.statementSha256,
      }, entry.artifact, null)
    }
  }
  process.stdout.write(`${JSON.stringify({mode: apply ? 'applied' : 'dry-run', publisherId: bundle.publisherId,
    keyId: bundle.keyId, publicKeyFingerprint: publicKey.fingerprint,
    keyAction: existingKey ? 'already-registered' : apply ? 'registered' : 'would-register',
    releases: checked.map(entry => ({releaseId: entry.item.releaseId, action: entry.alreadyAttached ? 'already-attached' : apply ? 'attached' : 'would-attach'})),
    installationImpact: installationImpact.rows, legacyUpgrades: bundle.legacyUpgrades}, null, 2)}\n`)
} finally {
  await db.destroy()
}
