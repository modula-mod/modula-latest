/**
 * Guarded, one-off production acceptance for release trust. Only test.modula.*
 * releases and a dedicated audit publisher/key are ever written. No private
 * signing key is persisted: the two synthetic keys exist only in this process.
 *
 * Default is read-only preflight. --apply requires an explicit run ID and the
 * deployed SHA. --cleanup can finish deactivation after an interrupted run.
 */
import {createHash, generateKeyPairSync, randomBytes, sign} from 'node:crypto'
import {GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION, createDefaultModuleSectionVersions,
  manifestChecksum, type GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {sql} from 'kysely'
import {createDb} from '../src/database/client.js'
import {GreenfieldModuleReleaseService} from '../src/modules/release-service.js'
import {GreenfieldModulePublisherService} from '../src/modules/publisher-service.js'
import {GreenfieldPublisherSigningKeyService, buildPublisherReleaseStatement, statementBytes} from '../src/modules/release-signing.js'
import {GreenfieldModuleRegistryService} from '../src/modules/registry-service.js'
import {GreenfieldRegistryTrustService} from '../src/modules/registry-trust-service.js'

const args = process.argv.slice(2)
const valueAfter = (flag: string) => { const index = args.indexOf(flag); return index < 0 ? null : args[index + 1] ?? null }
const apply = args.includes('--apply')
const cleanupOnly = args.includes('--cleanup')
if (apply && cleanupOnly) throw new Error('Choose --apply or --cleanup')
const runId = valueAfter('--run-id')
const expectedSha = valueAfter('--expected-sha')
if (!expectedSha || !/^[0-9a-f]{40}$/.test(expectedSha)) throw new Error('--expected-sha <accepted commit> is required')
if (apply || cleanupOnly) {
  if (!runId || !/^[0-9a-f]{8}$/.test(runId)) throw new Error('--run-id <8 lowercase hex> is required')
}
if (process.env.MODULA_ENVIRONMENT !== 'production' || process.env.NODE_ENV !== 'production') {
  throw new Error('This guarded acceptance is production-only')
}
if (process.env.MODULA_RELEASE_SHA !== expectedSha) throw new Error('One-off source SHA does not match the accepted deployment')
const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) throw new Error('Database URL is required through the protected production environment')
const baseUrl = (process.env.API_ATLAS_BASE_URL ?? '').replace(/\/$/, '')
if (!baseUrl || new URL(baseUrl).origin !== 'https://api.modula.digital') throw new Error('Canonical production API URL is required')

const publisherId = runId ? `api-fix-01d-audit-${runId}` : null
const moduleId = (kind: string) => `test.modula.api-fix-01d-${runId}-${kind}`
const releaseId = (kind: string) => `module-release:${moduleId(kind)}:1.0.0`
const keyId = (kind: string) => `api-fix-01d-${runId}-${kind}`
const kinds = ['invalid-signature', 'digest-mismatch', 'revoked-signer'] as const
type Kind = typeof kinds[number]

function auditManifest(id: string, publisher: {publisherId: string; displayName: string; website: string}): GreenfieldModuleManifest {
  const manifest = {
    manifestVersion: GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
    moduleId: id,
    name: 'API-FIX-01D isolated trust audit',
    description: 'Hidden, non-user-facing crypto-negative acceptance fixture',
    version: '1.0.0',
    standardVersion: '2.1.0',
    sectionVersions: createDefaultModuleSectionVersions(),
    publisher,
    source: {provider: 'github', repository: 'modula-mod/api-fix-01d-audit',
      commit: '0123456789abcdef0123456789abcdef01234567', manifestPath: 'module.manifest.json',
      releaseTag: `${id}-v1.0.0`, releaseAssetName: `${id}-1.0.0.tgz`},
    license: {status: 'firstParty', evidenceIds: ['api-fix-01d-isolated-audit']},
    trust: {requestedLevel: 'firstParty'},
    compatibility: {minimumGreenfieldVersion: '0.1.0', minimumModulaHostVersion: '0.1.0',
      protocolVersions: ['greenfield.v1'], platforms: ['server', 'web', 'ios', 'android']},
    permissions: [], dependencies: [], contributions: {},
    dependencyGraph: {version: '2.0.0', requires: [], optional: [], recommended: [], conflicts: [], replaces: [], provides: []},
    capabilityDiscovery: {version: '2.0.0'}, serviceRegistry: {version: '2.0.0', items: []},
    apiRegistry: {version: '2.0.0', items: []}, hookRegistry: {version: '2.0.0', items: []},
    permissionModel: {version: '2.0.0', categories: {}}, jobRegistry: {version: '2.0.0', items: []},
    storageModel: {version: '2.0.0', items: []}, widgetRegistry: {version: '2.0.0', items: []},
    navigationRegistry: {version: '2.0.0', items: []}, uiContributions: {version: '2.0.0', items: []},
    eventBus: {version: '2.0.0', items: []},
    extensionProduct: {version: '1.0.0', kind: 'module', targets: [], extensionPoints: [], contributions: [],
      retention: {defaultMode: 'KEEP_DATA', supportsUserChoice: true}, graphPolicy: {maxDepth: 16, maxNodes: 256}},
    integrity: {manifestSha256: '', releaseSha256: 'b'.repeat(64)},
  } as GreenfieldModuleManifest
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

function auditEvidence(manifest: GreenfieldModuleManifest) {
  return {repository: manifest.source.repository, releaseTag: manifest.source.releaseTag!,
    releaseCommit: manifest.source.commit,
    artifactSha256: createHash('sha256').update(`api-fix-01d:${manifest.moduleId}:artifact`).digest('hex'),
    manifestSha256: manifest.integrity.manifestSha256}
}
const db = createDb(databaseUrl)
const releases = new GreenfieldModuleReleaseService(db)
const publishers = new GreenfieldModulePublisherService(db)
const keys = new GreenfieldPublisherSigningKeyService(db)
const registry = new GreenfieldModuleRegistryService(db)
const trust = new GreenfieldRegistryTrustService(db)

async function api(method: string, path: string, token?: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'cache-control': 'no-store',
      ...(token ? {authorization: `Bearer ${token}`} : {}),
      ...(body === undefined ? {} : {'content-type': 'application/json', 'idempotency-key': `api-fix-01d-${runId}-${method}-${path}`.slice(0, 180)}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const payload = await response.json().catch(() => null) as {data?: Record<string, unknown>; error?: {code?: string}} | null
  return {status: response.status, payload}
}

async function auditToken() {
  const email = process.env.API_ATLAS_A_EMAIL
  const password = process.env.API_ATLAS_A_PASSWORD
  if (!email || !password) throw new Error('Protected audit identity A is required')
  const login = await api('POST', '/v1/sessions', undefined, {email, password, clientName: 'API-FIX-01D trust acceptance', platform: 'server'})
  const token = login.payload?.data?.accessToken
  if (login.status !== 200 || typeof token !== 'string') throw new Error('Audit identity login failed')
  const me = await api('GET', '/v1/accounts/me', token)
  if (me.status !== 200 || me.payload?.data?.primaryHandle !== 'api-atlas-a') throw new Error('Unexpected audit account')
  return {token, accountId: me.payload.data.accountId as string}
}

async function assertNoInstall(accountId: string, kind: Kind) {
  const rows = await db.selectFrom('greenfield_extension_installations as installation')
    .innerJoin('greenfield_module_releases as release', 'release.extension_version_id', 'installation.extension_version_id')
    .select(['installation.installation_id', 'installation.status'])
    .where('release.module_id', '=', moduleId(kind))
    .execute()
  if (rows.length) throw new Error(`Audit ${kind} created an installation`)
  const reviews = await db.selectFrom('greenfield_module_permission_reviews as review')
    .innerJoin('greenfield_module_releases as release', 'release.release_id', 'review.release_id')
    .select('review.review_id').where('release.module_id', '=', moduleId(kind)).execute()
  if (reviews.length) throw new Error(`Audit ${kind} created a permission review`)
  const plans = await db.selectFrom('greenfield_module_install_plans as plan')
    .innerJoin('greenfield_module_releases as release', 'release.release_id', 'plan.release_id')
    .select('plan.plan_id').where('release.module_id', '=', moduleId(kind)).execute()
  if (plans.length) throw new Error(`Audit ${kind} created an install plan`)
  const jobs = await db.selectFrom('outbox_events').select('id')
    .where('event_type', 'in', ['module.install', 'module.install.requested', 'module.update', 'module.update.requested'])
    .where('aggregate_id', '=', moduleId(kind)).execute()
  if (jobs.length) throw new Error(`Audit ${kind} enqueued an install/update side effect`)
  if (!accountId) throw new Error('Audit account missing')
}

async function deactivateFixtures() {
  if (!runId || !publisherId) return {releases: 0, keys: 0, publisher: false}
  const activeInstallations = await db.selectFrom('greenfield_extension_installations as installation')
    .innerJoin('greenfield_module_releases as release', 'release.extension_version_id', 'installation.extension_version_id')
    .select('installation.installation_id')
    .where('release.module_id', 'in', kinds.map(moduleId))
    .where('installation.status', 'not in', ['removed', 'uninstalled', 'notInstalled']).execute()
  if (activeInstallations.length) throw new Error('Active synthetic installation exists; cleanup stopped for controlled uninstall')
  let revokedReleases = 0
  for (const kind of kinds) {
    const row = await db.selectFrom('greenfield_module_releases')
      .select(['release_id', 'module_id', 'release_state', 'publisher_id']).where('release_id', '=', releaseId(kind)).executeTakeFirst()
    if (!row) continue
    if (row.module_id !== moduleId(kind) || row.publisher_id !== publisherId) throw new Error('Fixture identity mismatch; cleanup stopped')
    if (row.release_state !== 'revoked') await releases.revokeRelease(row.release_id, 'API-FIX-01D audit fixture deactivated')
    revokedReleases++
  }
  let revokedKeys = 0
  for (const kind of ['active', 'revoke'] as const) {
    const row = await db.selectFrom('greenfield_publisher_signing_keys').select(['key_id', 'publisher_id', 'state'])
      .where('key_id', '=', keyId(kind)).executeTakeFirst()
    if (!row) continue
    if (row.publisher_id !== publisherId) throw new Error('Fixture signing key publisher mismatch; cleanup stopped')
    if (row.state !== 'REVOKED') await keys.revoke(publisherId, row.key_id, 'API-FIX-01D audit cleanup', null)
    revokedKeys++
  }
  const publisher = await publishers.getPublisher(publisherId)
  if (publisher && publisher.status !== 'revoked') await publishers.revokePublisher(publisherId)
  return {releases: revokedReleases, keys: revokedKeys, publisher: Boolean(publisher)}
}

try {
  const migration = await sql<{id: string}>`SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1`.execute(db)
  if (migration.rows[0]?.id !== '067_legacy_duplicate_installation_versions') throw new Error('Migration 067 is required')
  const version = await api('GET', '/version.json')
  const marker = version.payload as Record<string, unknown> | null
  if (version.status !== 200 || marker?.commit !== expectedSha
    || marker?.expectedMigration !== '067_legacy_duplicate_installation_versions') {
    throw new Error('Production runtime marker does not match the accepted source and migration')
  }
  const realKey = await keys.get('modula-2026-10-offline-01')
  if (realKey.state !== 'ACTIVE') throw new Error('Production signing key is not active')
  const existing = runId ? await db.selectFrom('greenfield_module_releases').select('release_id')
    .where('module_id', 'in', kinds.map(moduleId)).execute() : []
  if (!apply && !cleanupOnly) {
    process.stdout.write(`${JSON.stringify({mode: 'DRY_RUN', source: expectedSha, migration: migration.rows[0].id,
      auditNamespace: 'test.modula', runId, existingFixtures: existing.length, productionSignerActive: true})}\n`)
  } else if (cleanupOnly) {
    process.stdout.write(`${JSON.stringify({mode: 'CLEANUP', runId, ...await deactivateFixtures()})}\n`)
  } else {
    if (existing.length) throw new Error('Run ID already has release fixtures; use --cleanup first')
    if (await publishers.getPublisher(publisherId!)) {
      throw new Error('Run ID already has an audit publisher; inspect and use --cleanup before retrying')
    }
    const namespace = await db.selectFrom('greenfield_publisher_namespaces')
      .select(['publisher_id', 'revoked_at']).where('namespace', '=', 'test.modula').executeTakeFirst()
    if (namespace && !namespace.revoked_at && namespace.publisher_id !== publisherId) {
      throw new Error('test.modula namespace is owned by another publisher; no fixture was created')
    }
    const audit = await auditToken()
    const results: Record<string, unknown> = {}
    const activePair = generateKeyPairSync('ed25519')
    const revokePair = generateKeyPairSync('ed25519')
    const publicPem = (pair: typeof activePair) => pair.publicKey.export({format: 'pem', type: 'spki'}).toString()
    const publisher = {publisherId: publisherId!, displayName: 'API-FIX-01D isolated audit', website: 'https://modula.digital'}
    try {
      // An unsigned import establishes only the isolated publisher/namespace;
      // it is not made executable. The signed fixtures below use that publisher.
      const firstManifest = auditManifest(moduleId(kinds[0]), publisher)
      await publishers.ensurePublisherForManifest(firstManifest)
      await keys.register(publisherId!, {keyId: keyId('active'), publicKeyPem: publicPem(activePair)}, null)
      await keys.register(publisherId!, {keyId: keyId('revoke'), publicKeyPem: publicPem(revokePair)}, null)

      for (const kind of kinds) {
        const manifest = kind === kinds[0] ? firstManifest : auditManifest(moduleId(kind), publisher)
        const evidence = auditEvidence(manifest)
        const selectedKey = kind === 'revoked-signer' ? 'revoke' : 'active'
        const pair = kind === 'revoked-signer' ? revokePair : activePair
        const statement = buildPublisherReleaseStatement({manifest, sourceSha: evidence.releaseCommit,
          artifactSha256: evidence.artifactSha256, signingKeyId: keyId(selectedKey)})
        const signature = sign(null, statementBytes(statement), pair.privateKey).toString('base64url')
        await releases.importPendingReview(manifest, {...evidence, signature: {algorithm: 'Ed25519', keyId: keyId(selectedKey), value: signature}})
        await releases.publishRelease(manifest.moduleId, manifest.version)
        const before = await trust.forRelease(await registry.getVersion(manifest.moduleId, manifest.version))
        if (!before.verified || before.signature.state !== 'verified') throw new Error(`Audit ${kind} did not begin trusted`)
        const catalog = await api('GET', `/v1/registry/modules?q=${encodeURIComponent(manifest.moduleId)}`)
        const listed = catalog.payload?.data
        if (catalog.status !== 200 || JSON.stringify(listed).includes(manifest.moduleId)) {
          throw new Error(`Audit ${kind} appeared in the public catalogue`)
        }
        results[kind] = {validBeforeMutation: true}
      }

      // The only raw fact changes are tightly scoped to these freshly created
      // synthetic release IDs. Re-run the ordinary verifier to record invalid
      // cryptographic state and quarantine before exercising HTTP install.
      const badSignature = randomBytes(64).toString('base64url')
      await db.updateTable('greenfield_module_release_signatures').set({signature: badSignature})
        .where('release_id', '=', releaseId('invalid-signature')).where('signature_key_id', '=', keyId('active')).execute()
      await releases.verifyRelease(moduleId('invalid-signature'), '1.0.0').then(
        () => { throw new Error('Invalid Ed25519 signature unexpectedly verified') },
        error => { if (!String(error).includes('signature invalid')) throw error },
      )
      const originalDigest = (await releases.getReleaseById(releaseId('digest-mismatch')))?.releaseSha256
      const alteredDigest = createHash('sha256').update(`api-fix-01d:${runId}:altered`).digest('hex')
      if (!originalDigest || originalDigest === alteredDigest) throw new Error('Digest fixture was not distinct')
      await db.updateTable('greenfield_module_releases').set({release_sha256: alteredDigest})
        .where('release_id', '=', releaseId('digest-mismatch')).where('publisher_id', '=', publisherId!).execute()
      await releases.verifyRelease(moduleId('digest-mismatch'), '1.0.0').then(
        () => { throw new Error('Changed digest unexpectedly verified') },
        error => { if (!String(error).includes('signature invalid')) throw error },
      )
      const revoked = await keys.revoke(publisherId!, keyId('revoke'), 'API-FIX-01D synthetic signer revocation', null)
      if (revoked.state !== 'REVOKED') throw new Error('Synthetic key was not revoked')

      for (const kind of kinds) {
        const block = await trust.forRelease(await registry.getVersion(moduleId(kind), '1.0.0'))
        if (block.verified || block.signature.state !== (kind === 'revoked-signer' ? 'revokedKey' : 'invalid')) {
          throw new Error(`Audit ${kind} did not fail closed`)
        }
        const attempt = await api('POST', `/v1/modules/${moduleId(kind)}/install`, audit.token,
          {version: '1.0.0', approvedPermissions: [], idempotencyKey: `api-fix-01d-${runId}-${kind}`})
        if (attempt.status !== 403 || attempt.payload?.error?.code !== 'UNTRUSTED_RELEASE') {
          throw new Error(`Audit ${kind} install did not return canonical untrusted-release denial: ${attempt.status}/${attempt.payload?.error?.code}`)
        }
        await assertNoInstall(audit.accountId, kind)
        results[kind] = {...results[kind] as object, signatureState: block.signature.state,
          ...(kind === 'digest-mismatch' ? {mismatchType: 'artifactSha256'} : {}),
          trust: false, install: 'UNTRUSTED_RELEASE', installationRows: 0, permissionReviews: 0, installPlans: 0}
      }
      const realKeyAfter = await keys.get('modula-2026-10-offline-01')
      if (realKeyAfter.state !== 'ACTIVE') throw new Error('Production signing key changed')
      process.stdout.write(`${JSON.stringify({mode: 'APPLY', result: 'PASS', runId, source: expectedSha, cases: results,
        productionSignerUnaffected: true})}\n`)
    } finally {
      const cleanup = await deactivateFixtures()
      for (const kind of kinds) await assertNoInstall(audit.accountId, kind)
      process.stdout.write(`${JSON.stringify({mode: 'CLEANUP', runId, ...cleanup})}\n`)
    }
  }
} finally {
  await db.destroy()
}
