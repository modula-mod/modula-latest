#!/usr/bin/env node
import {createHash, randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {isAbsolute, join, relative, resolve} from 'node:path'
import {
  classifyPermissionRisk,
  manifestChecksum,
  stableJson,
  validateGreenfieldModuleManifest,
} from '@modula/greenfield-module-manifest'

const requireFromApi = createRequire(new URL('../../services/greenfield-api/package.json', import.meta.url))
const {Pool} = requireFromApi('pg')

const args = parseArgs(process.argv.slice(2))
if (!args.path || !args.commit) usage()
const modulePath = isAbsolute(args.path) ? args.path : resolve(process.cwd(), args.path)
const commit = args.commit

loadEnvFile(resolve('services/greenfield-api/.env'))

const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL || process.env.MODULA_DATABASE_URL
if (!databaseUrl) fail('MODULA_DATABASE_URL is required')

git(modulePath, ['rev-parse', '--is-inside-work-tree'])
const status = git(modulePath, ['status', '--short'])
if (status.trim()) fail('Module repository working tree must be clean')
const head = git(modulePath, ['rev-parse', 'HEAD'])
if (head !== commit) fail(`Supplied commit does not match module HEAD: expected ${head}`)

const manifestPath = join(modulePath, 'module.manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const remote = git(modulePath, ['remote', 'get-url', 'origin'])
const repository = normalizeGithubRepository(remote)
if (manifest.source?.repository !== repository) fail(`Manifest repository ${manifest.source?.repository} does not match origin ${repository}`)
const fileManifestSha = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
if (manifest.integrity.manifestSha256 !== fileManifestSha) {
  fail(`Manifest file checksum mismatch: expected ${fileManifestSha}`)
}

const schemaSha256 = calculateSchemaChecksums(modulePath)
const releaseSha256 = calculateReleaseChecksum(modulePath)
if (manifest.integrity.releaseSha256 && manifest.integrity.releaseSha256 !== releaseSha256) {
  fail(`Release checksum mismatch: expected ${releaseSha256}`)
}
const manifestForImport = {
  ...manifest,
  source: {...manifest.source, commit},
  integrity: {...manifest.integrity, releaseSha256},
}
manifestForImport.integrity.manifestSha256 = manifestChecksum({...manifestForImport, integrity: {...manifestForImport.integrity, manifestSha256: ''}})
const computedManifestSha = manifestForImport.integrity.manifestSha256
const manifestResult = validateGreenfieldModuleManifest(manifestForImport)
if (!manifestResult.valid) fail(`Manifest invalid: ${manifestResult.issues.map(issue => `${issue.code} ${issue.path}`).join('; ')}`)
const evidence = collectLicenseEvidence(modulePath, manifestForImport)

const pool = new Pool({connectionString: databaseUrl, max: 1, application_name: 'modula-registry-import'})
try {
  await importRelease(pool, manifestForImport, {computedManifestSha, releaseSha256, schemaSha256, evidence})
  console.log(`module: ${manifestForImport.moduleId}`)
  console.log(`version: ${manifestForImport.version}`)
  console.log(`publisher: ${manifestForImport.publisher.displayName}`)
  console.log('manifest: valid')
  console.log('integrity: valid')
  console.log(`licence: ${manifestForImport.license.status}`)
  console.log(`trust: ${manifestForImport.trust.requestedLevel}`)
  console.log('release: pendingReview')
  console.log('execution: disabled')
} finally {
  await pool.end()
}

async function importRelease(pool, manifest, integrity) {
  const client = await pool.connect()
  const now = new Date()
  const releaseId = `module-release:${manifest.moduleId}:${manifest.version}`
  const extensionId = manifest.moduleId
  const extensionVersionId = `${manifest.moduleId}@${manifest.version}`
  const moduleVersionId = `module-version:${manifest.moduleId}:${manifest.version}`
  try {
    await client.query('BEGIN')
    const existing = await client.query('SELECT release_id FROM greenfield_module_releases WHERE module_id=$1 AND version=$2', [manifest.moduleId, manifest.version])
    if (existing.rowCount > 0) fail(`Release ${manifest.moduleId}@${manifest.version} already exists`)
    await client.query(
      `INSERT INTO greenfield_publishers (publisher_id, display_name, website, status, trust_level, created_at, updated_at, verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7)
       ON CONFLICT (publisher_id) DO UPDATE SET display_name=EXCLUDED.display_name, website=EXCLUDED.website, updated_at=EXCLUDED.updated_at`,
      [
        manifest.publisher.publisherId,
        manifest.publisher.displayName,
        manifest.publisher.website ?? null,
        manifest.trust.requestedLevel === 'firstParty' ? 'verified' : 'pending',
        manifest.trust.requestedLevel,
        now,
        manifest.trust.requestedLevel === 'firstParty' ? now : null,
      ],
    )
    const namespace = manifest.moduleId.split('.').slice(0, 2).join('.')
    await client.query(
      `INSERT INTO greenfield_publisher_namespaces (namespace, publisher_id, verification_method, verification_evidence, verified_at, revoked_at, created_at)
       VALUES ($1,$2,$3,$4,$5,NULL,$6)
       ON CONFLICT (namespace) DO UPDATE SET publisher_id=EXCLUDED.publisher_id, verified_at=COALESCE(greenfield_publisher_namespaces.verified_at, EXCLUDED.verified_at), revoked_at=NULL`,
      [namespace, manifest.publisher.publisherId, manifest.trust.requestedLevel === 'firstParty' ? 'firstPartyPolicy' : 'manifestDeclaration', JSON.stringify({manifest: manifest.moduleId}), manifest.trust.requestedLevel === 'firstParty' ? now : null, now],
    )
    await client.query(
      `INSERT INTO greenfield_extensions (extension_id, slug, publisher_account_id, status, created_at, updated_at)
       VALUES ($1,$2,NULL,'pendingReview',$3,$3)
       ON CONFLICT (extension_id) DO UPDATE SET status='pendingReview', updated_at=EXCLUDED.updated_at`,
      [extensionId, manifest.moduleId, now],
    )
    await client.query(
      `INSERT INTO greenfield_extension_versions (extension_version_id, extension_id, version, manifest, status, created_at)
       VALUES ($1,$2,$3,$4,'pendingReview',$5)`,
      [extensionVersionId, extensionId, manifest.version, JSON.stringify(manifest), now],
    )
    await client.query(
      `INSERT INTO greenfield_module_versions (module_version_id, extension_version_id, module_id, version, publisher_id, manifest, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'pendingReview',$7,$7)`,
      [moduleVersionId, extensionVersionId, manifest.moduleId, manifest.version, manifest.publisher.publisherId, JSON.stringify(manifest), now],
    )
    await client.query(
      `INSERT INTO greenfield_module_releases (
        release_id,module_version_id,extension_id,extension_version_id,module_id,version,publisher_id,release_state,
        source_repository,source_commit,manifest_path,manifest_sha256,release_sha256,signature_key_id,signature,
        compatibility,license_status,trust_level,published_at,quarantined_at,revoked_at,superseded_at,created_at,updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'pendingReview',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NULL,NULL,NULL,NULL,$18,$18)`,
      [
        releaseId,
        moduleVersionId,
        extensionId,
        extensionVersionId,
        manifest.moduleId,
        manifest.version,
        manifest.publisher.publisherId,
        manifest.source.repository,
        manifest.source.commit,
        manifest.source.manifestPath,
        integrity.computedManifestSha,
        integrity.releaseSha256,
        manifest.integrity.signatureKeyId ?? null,
        manifest.integrity.signature ?? null,
        JSON.stringify(manifest.compatibility),
        manifest.license.status,
        manifest.trust.requestedLevel,
        now,
      ],
    )
    await client.query(
      `INSERT INTO greenfield_module_sources (source_id,release_id,provider,repository,repository_id,default_branch,commit,manifest_path,release_tag,release_asset_name,fetched_at,etag)
       VALUES ($1,$2,'github',$3,NULL,NULL,$4,$5,$6,$7,$8,NULL)`,
      [`module-source:${releaseId}`, releaseId, manifest.source.repository, manifest.source.commit, manifest.source.manifestPath, manifest.source.releaseTag ?? null, manifest.source.releaseAssetName ?? null, now],
    )
    for (const dependency of manifest.dependencies ?? []) {
      await client.query(
        `INSERT INTO greenfield_module_dependencies (dependency_id, release_id, module_id, dependency_module_id, version_range, optional, reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [`module-dependency:${releaseId}:${dependency.moduleId}`, releaseId, manifest.moduleId, dependency.moduleId, dependency.versionRange, dependency.optional, dependency.reason ?? null, now],
      )
    }
    for (const permission of manifest.permissions) {
      await client.query(
        `INSERT INTO greenfield_module_permissions (permission_id, release_id, permission, reason, risk, requested_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [`module-permission:${releaseId}:${permission.permission}`, releaseId, permission.permission, permission.reason, permission.risk ?? classifyPermissionRisk(permission.permission), now],
      )
    }
    for (const contribution of flattenContributions(manifest)) {
      await client.query(
        `INSERT INTO greenfield_module_contributions (contribution_id, release_id, module_id, contribution_type, contribution_key, manifest, execution_required, registration_status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'declared',$8,$8)`,
        [`module-contribution:${releaseId}:${contribution.key}`, releaseId, manifest.moduleId, contribution.type, contribution.key, JSON.stringify(contribution.manifest), contribution.executionRequired, now],
      )
    }
    for (const item of integrity.evidence) {
      await client.query(
        `INSERT INTO greenfield_module_license_evidence (evidence_id, release_id, evidence_type, summary, source_path, checksum, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [`module-license:${releaseId}:${item.id}`, releaseId, item.type, item.summary, item.path, item.checksum, now],
      )
    }
    await client.query(
      `INSERT INTO greenfield_module_release_integrity (integrity_id, release_id, manifest_sha256, release_sha256, schema_sha256, settings_schema_sha256, source_commit, verified_at, mismatch_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,NULL)`,
      [`module-integrity:${releaseId}`, releaseId, integrity.computedManifestSha, integrity.releaseSha256, JSON.stringify(integrity.schemaSha256), integrity.schemaSha256['schemas/vault-settings.v1.schema.json'] ?? null, manifest.source.commit],
    )
    if (manifest.integrity.signatureKeyId && manifest.integrity.signature) {
      await client.query(
        `INSERT INTO greenfield_module_release_signatures (signature_id, release_id, signature_key_id, signature, algorithm, verified_at, revoked_at)
         VALUES ($1,$2,$3,$4,'Ed25519',NULL,NULL)`,
        [`module-signature:${releaseId}:${manifest.integrity.signatureKeyId}`, releaseId, manifest.integrity.signatureKeyId, manifest.integrity.signature],
      )
    }
    const outboxId = `outbox-${randomUUID()}`
    await client.query(
      `INSERT INTO outbox_events (id,event_type,aggregate_type,aggregate_id,payload,created_at,published_at,attempt_count,last_error)
       VALUES ($1,'module.release.imported','moduleRelease',$2,$3,$4,NULL,0,NULL)`,
      [outboxId, releaseId, JSON.stringify({moduleId: manifest.moduleId, version: manifest.version}), now],
    )
    await client.query(
      `INSERT INTO audit_events (id,event_type,actor_id,resource_type,resource_id,metadata,created_at)
       VALUES ($1,'module.release.imported',NULL,'moduleRelease',$2,$3,$4)`,
      [`audit-${randomUUID()}`, releaseId, JSON.stringify({moduleId: manifest.moduleId, version: manifest.version}), now],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function flattenContributions(manifest) {
  const mapping = {
    routes: 'route',
    profileTabs: 'profileTab',
    boardSurfaces: 'boardSurface',
    settings: 'setting',
    schemas: 'schema',
    tools: 'tool',
    functions: 'function',
    widgets: 'widget',
    plugins: 'plugin',
    connectors: 'connector',
    jobs: 'job',
    events: 'event',
  }
  const rows = []
  for (const [group, type] of Object.entries(mapping)) {
    for (const contribution of manifest.contributions[group] ?? []) {
      rows.push({type, key: contribution.id, manifest: contribution, executionRequired: Boolean(contribution.executionRequired)})
    }
  }
  return rows
}

function calculateSchemaChecksums(root) {
  const schemas = {}
  const schemaDir = join(root, 'schemas')
  for (const file of readdirSync(schemaDir).sort()) {
    if (!file.endsWith('.json')) continue
    const rel = `schemas/${file}`
    schemas[rel] = sha256(readFileSync(join(schemaDir, file)))
  }
  return schemas
}

function calculateReleaseChecksum(root) {
  const hash = createHash('sha256')
  for (const file of walk(root).sort()) {
    const rel = relative(root, file)
    hash.update(rel)
    hash.update('\0')
    const content =
      rel === 'module.manifest.json'
        ? Buffer.from(stableJson(normalizeManifestForReleaseChecksum(JSON.parse(readFileSync(file, 'utf8')))))
        : readFileSync(file)
    hash.update(content)
    hash.update('\0')
  }
  return hash.digest('hex')
}

function normalizeManifestForReleaseChecksum(manifest) {
  return {
    ...manifest,
    integrity: {...manifest.integrity, manifestSha256: '', releaseSha256: ''},
  }
}

function walk(root) {
  const ignored = [/(^|\/)\.git($|\/)/, /(^|\/)node_modules($|\/)/, /(^|\/)build($|\/)/, /(^|\/)dist($|\/)/, /(^|\/)\.env/, /(^|\/)tmp($|\/)/, /~$/]
  const files = []
  for (const entry of readdirSync(root)) {
    const abs = join(root, entry)
    const rel = relative(root, abs)
    if (ignored.some(pattern => pattern.test(rel))) continue
    const stat = statSync(abs)
    if (stat.isDirectory()) files.push(...walk(abs))
    else if (stat.isFile()) files.push(abs)
  }
  return files
}

function collectLicenseEvidence(root, manifest) {
  const evidence = []
  const candidates = [
    ['LICENSE-POLICY.md', 'firstPartyPolicy'],
    ['README.md', 'readmeDeclaration'],
    ['package.json', 'packageMetadata'],
  ]
  for (const [file, type] of candidates) {
    const abs = join(root, file)
    try {
      const content = readFileSync(abs)
      evidence.push({id: file, type, summary: type === 'firstPartyPolicy' ? 'Modula first-party licence policy' : `${file} licence declaration`, path: file, checksum: sha256(content)})
    } catch {}
  }
  if (manifest.license.status === 'firstParty' && !evidence.some(item => item.type === 'firstPartyPolicy')) {
    fail('firstParty licence status requires LICENSE-POLICY.md evidence')
  }
  return evidence
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeGithubRepository(remote) {
  const trimmed = remote.trim()
  const ssh = /^git@github\.com:([^/]+\/[^.]+)(?:\.git)?$/.exec(trimmed)
  if (ssh) return ssh[1]
  const https = /^https:\/\/github\.com\/([^/]+\/[^.]+)(?:\.git)?$/.exec(trimmed)
  if (https) return https[1]
  fail(`Unsupported GitHub origin remote ${remote}`)
}

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {encoding: 'utf8'}).trim()
}

function loadEnvFile(file) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const index = trimmed.indexOf('=')
      const key = trimmed.slice(0, index)
      const value = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {}
}

function parseArgs(argv) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index]?.startsWith('--')) parsed[argv[index].slice(2)] = argv[index + 1]
  }
  return parsed
}

function usage() {
  console.error('Usage: pnpm registry:import-module --path /absolute/module/path --commit <FULL_COMMIT_SHA>')
  process.exit(2)
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
