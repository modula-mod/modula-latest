import {createHash} from 'node:crypto'
import pg from 'pg'
import {manifestChecksum, type GreenfieldModuleManifestV1} from '@modula/greenfield-module-manifest'

type CountResult = {count: string | number}
type Check = {name: string; count: number; severity: 'critical' | 'informational'; detail: string}

const connectionString = process.env.MODULA_DATABASE_URL ?? process.env.MODULA_TEST_DATABASE_URL
if (!connectionString) throw new Error('MODULA_DATABASE_URL or MODULA_TEST_DATABASE_URL is required')

const client = new pg.Client({connectionString, application_name: 'greenfield-v1-integrity-read-only'})
await client.connect()
const checks: Check[] = []

try {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
  await count('orphan_installations', `
    SELECT count(*) FROM greenfield_extension_installations i
    LEFT JOIN greenfield_accounts a ON a.account_id=i.account_id
    LEFT JOIN greenfield_extension_versions v ON v.extension_version_id=i.extension_version_id
    WHERE a.account_id IS NULL OR v.extension_version_id IS NULL`, 'critical', 'installation has no account or extension version')
  await count('presentation_assets_missing_blob', `
    SELECT count(*) FROM greenfield_release_presentation_assets a
    LEFT JOIN greenfield_release_asset_blobs b ON b.sha256=a.sha256
    WHERE b.sha256 IS NULL`, 'informational', 'presentation metadata has no stored bytes (GF-MOD-02 / G004; backfill out of scope)')
  await count('orphan_permission_reviews', `
    SELECT count(*) FROM greenfield_module_permission_reviews r
    LEFT JOIN greenfield_extension_installations i ON i.installation_id=r.installation_id
    LEFT JOIN greenfield_module_releases rel ON rel.release_id=r.release_id
    WHERE i.installation_id IS NULL OR rel.release_id IS NULL`, 'critical', 'permission review has no installation or release')
  await count('enabled_installations_requiring_permission_review', `
    SELECT count(*) FROM greenfield_extension_installations i
    JOIN greenfield_module_versions v ON v.extension_version_id=i.extension_version_id
    LEFT JOIN LATERAL (
      SELECT granted_permissions FROM greenfield_module_permission_reviews r
      WHERE r.installation_id=i.installation_id ORDER BY reviewed_at DESC LIMIT 1
    ) review ON true
    WHERE i.status='enabled' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v.manifest->'permissions','[]'::jsonb)) permission
      WHERE NOT COALESCE(review.granted_permissions,'[]'::jsonb) ? (permission->>'permission')
    )`, 'informational', 'runtime grants nothing until the exact installed release receives explicit review')
  await count('orphan_records', `
    SELECT count(*) FROM greenfield_module_records r
    LEFT JOIN greenfield_extension_installations i ON i.installation_id=r.installation_id
    WHERE r.installation_id IS NOT NULL AND i.installation_id IS NULL`, 'critical', 'record points to a missing installation')
  await count('orphan_revisions', `
    SELECT count(*) FROM greenfield_module_record_revisions rv
    LEFT JOIN greenfield_module_records r
      ON r.account_id=rv.account_id AND r.module_id=rv.module_id
      AND r.collection=rv.record_type AND r.record_id=rv.record_id
    WHERE r.record_id IS NULL`, 'critical', 'revision has no authoritative record')
  await count('revision_duplicate_or_gap', `
    WITH ordered AS (
      SELECT revision,lag(revision) OVER (PARTITION BY account_id,module_id,record_type,record_id ORDER BY revision) AS previous
      FROM greenfield_module_record_revisions
    ) SELECT count(*) FROM ordered WHERE previous IS NOT NULL AND revision<>previous+1`, 'critical', 'persisted record revision history has a duplicate or internal gap')
  await count('legacy_revision_starts_above_one', `
    SELECT count(*) FROM (
      SELECT account_id,module_id,record_type,record_id,min(revision) AS first_revision
      FROM greenfield_module_record_revisions GROUP BY account_id,module_id,record_type,record_id
    ) histories WHERE first_revision>1`, 'informational', 'pre-MP02 imported records begin at their source revision; no history was fabricated')
  await count('record_latest_revision_mismatch', `
    SELECT count(*) FROM greenfield_module_records r
    LEFT JOIN (
      SELECT account_id,module_id,record_type,record_id,max(revision) AS revision
      FROM greenfield_module_record_revisions GROUP BY account_id,module_id,record_type,record_id
    ) rv ON rv.account_id=r.account_id AND rv.module_id=r.module_id
      AND rv.record_type=r.collection AND rv.record_id=r.record_id
    WHERE rv.revision IS NULL OR rv.revision<>r.revision`, 'critical', 'record revision differs from its latest immutable revision')
  await count('orphan_record_references', `
    SELECT count(*) FROM greenfield_module_record_references ref
    LEFT JOIN greenfield_module_records src
      ON src.account_id=ref.account_id AND src.module_id=ref.source_module_id
      AND src.collection=ref.source_record_type AND src.record_id=ref.source_record_id
    LEFT JOIN greenfield_module_records target
      ON target.account_id=ref.account_id AND target.module_id=ref.target_module_id
      AND target.collection=ref.target_record_type AND target.record_id=ref.target_record_id
    WHERE src.record_id IS NULL OR target.record_id IS NULL`, 'critical', 'reference source or target is absent')
  await count('orphan_media_bindings', `
    SELECT count(*) FROM greenfield_module_record_media_bindings b
    LEFT JOIN greenfield_module_records r
      ON r.account_id=b.record_owner_account_id AND r.module_id=b.module_id
      AND r.collection=b.record_type AND r.record_id=b.record_id
    LEFT JOIN attachments a ON a.attachment_id=b.asset_id
    WHERE r.record_id IS NULL OR a.attachment_id IS NULL`, 'critical', 'media binding has no record or asset')
  await count('orphan_shares', `
    SELECT count(*) FROM greenfield_module_record_shares s
    LEFT JOIN greenfield_module_records r
      ON r.account_id=s.owner_account_id AND r.module_id=s.module_id
      AND r.collection=s.record_type AND r.record_id=s.record_id
    LEFT JOIN greenfield_accounts recipient ON recipient.account_id=s.recipient_account_id
    WHERE r.record_id IS NULL OR recipient.account_id IS NULL`, 'critical', 'share has no record or recipient')
  await count('expired_share_rows', `
    SELECT count(*) FROM greenfield_module_record_shares
    WHERE expires_at<=now() AND revoked_at IS NULL AND visibility_lost_at IS NULL`, 'informational', 'expired rows remain as audit history; authorization checks expiry')
  await count('orphan_artifact_metadata', `
    SELECT count(*) FROM greenfield_release_artifacts a
    LEFT JOIN greenfield_release_asset_blobs b ON b.sha256=a.sha256
    WHERE b.sha256 IS NULL`, 'critical', 'release artifact metadata has no immutable blob')
  await count('broken_release_pointers', `
    SELECT count(*) FROM greenfield_module_releases r
    LEFT JOIN greenfield_module_versions v ON v.module_version_id=r.module_version_id
    WHERE v.module_version_id IS NULL OR v.module_id<>r.module_id OR v.version<>r.version`, 'critical', 'release does not match its module version')
  await count('invalid_signer_references', `
    SELECT count(*) FROM greenfield_module_releases r
    LEFT JOIN greenfield_publisher_signing_keys k ON k.key_id=r.signature_key_id
    WHERE r.signature_key_id IS NOT NULL AND k.key_id IS NULL`, 'critical', 'release references a missing signing key')
  await count('duplicate_active_installations', `
    SELECT count(*) FROM (
      SELECT i.account_id,v.module_id,count(*)
      FROM greenfield_extension_installations i
      JOIN greenfield_module_versions v ON v.extension_version_id=i.extension_version_id
      WHERE i.status='enabled' AND NOT i.legacy_duplicate_allowed
      GROUP BY i.account_id,v.module_id HAVING count(*)>1
    ) duplicates`, 'critical', 'account has duplicate active non-legacy installation state')
  await count('mutation_payload_conflicts', `
    SELECT count(*) FROM (
      SELECT account_id,installation_id,mutation_id
      FROM greenfield_module_record_mutations
      GROUP BY account_id,installation_id,mutation_id
      HAVING count(DISTINCT payload_hash)>1
    ) conflicts`, 'critical', 'mutation ID maps to more than one payload')
  await count('mutation_missing_result', `
    SELECT count(*) FROM greenfield_module_record_mutations
    WHERE status='completed' AND result IS NULL`, 'critical', 'completed mutation has no deterministic result')
  await count('sync_duplicate_sequence', `
    SELECT count(*) FROM (
      SELECT change_sequence FROM greenfield_module_record_changes GROUP BY change_sequence HAVING count(*)>1
    ) duplicates`, 'critical', 'sync sequence is duplicated')
  await count('current_revision_missing_sync_change', `
    SELECT count(*) FROM greenfield_module_records r
    LEFT JOIN greenfield_module_record_changes c
      ON c.account_id=r.account_id AND c.module_id=r.module_id AND c.record_type=r.collection
      AND c.record_id=r.record_id AND c.revision=r.revision
    WHERE c.change_sequence IS NULL`, 'critical', 'authoritative record revision has no sync change')
  await count('orphan_publisher_namespaces', `
    SELECT count(*) FROM greenfield_publisher_namespaces n
    LEFT JOIN greenfield_publishers p ON p.publisher_id=n.publisher_id
    WHERE p.publisher_id IS NULL`, 'critical', 'publisher namespace has no publisher')

  const releaseTables = await client.query<{table_name: string}>(`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='release_id' AND table_name<>'greenfield_module_releases'
    ORDER BY table_name`)
  let releaseOrphans = 0
  for (const {table_name: table} of releaseTables.rows) {
    if (!/^[a-z0-9_]+$/.test(table)) throw new Error(`unsafe catalog table name: ${table}`)
    const result = await client.query<CountResult>(`
      SELECT count(*) FROM public.${table} child
      LEFT JOIN greenfield_module_releases parent ON parent.release_id=child.release_id
      WHERE child.release_id IS NOT NULL AND parent.release_id IS NULL`)
    releaseOrphans += Number(result.rows[0]?.count ?? 0)
  }
  checks.push({name: 'orphan_release_children', count: releaseOrphans, severity: 'critical', detail: `${releaseTables.rowCount} release-linked tables inspected`})

  const records = await client.query<{account_id: string; module_id: string; collection: string; record_id: string}>('SELECT account_id,module_id,collection,record_id FROM greenfield_module_records')
  const recordKeys = new Set(records.rows.map(row => JSON.stringify([row.account_id, row.module_id, row.collection, row.record_id])))
  const search = await client.query<{entity_id: string; metadata: {tombstone?: boolean} | null}>("SELECT entity_id,metadata FROM search_documents WHERE entity_type='module-record'")
  let invalidSearch = 0
  for (const row of search.rows) {
    try {
      const key = Buffer.from(row.entity_id, 'base64url').toString('utf8')
      const decoded = JSON.parse(key)
      if (!Array.isArray(decoded) || decoded.length !== 4) invalidSearch += 1
      else if (!recordKeys.has(JSON.stringify(decoded))) {
        if (row.metadata?.tombstone !== true) invalidSearch += 1
      }
    } catch {
      invalidSearch += 1
    }
  }
  checks.push({name: 'orphan_search_projections', count: invalidSearch, severity: 'critical', detail: `${search.rowCount} module-record projections decoded; intentional tombstones retained`})

  const blobs = await client.query<{sha256: string; bytes: Buffer}>('SELECT sha256,bytes FROM greenfield_release_asset_blobs')
  let corruptBlobs = 0
  for (const blob of blobs.rows) if (createHash('sha256').update(blob.bytes).digest('hex') !== blob.sha256) corruptBlobs += 1
  checks.push({name: 'artifact_bit_rot', count: corruptBlobs, severity: 'critical', detail: `${blobs.rowCount} immutable blobs rehashed`})

  const releases = await client.query<{manifest_sha256: string; manifest: GreenfieldModuleManifestV1}>(`
    SELECT r.manifest_sha256,v.manifest FROM greenfield_module_releases r
    JOIN greenfield_module_versions v ON v.module_version_id=r.module_version_id`)
  let manifestMismatches = 0
  for (const release of releases.rows) {
    const manifest = release.manifest
    const computed = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
    if (computed !== release.manifest_sha256 || manifest.integrity.manifestSha256 !== computed) manifestMismatches += 1
  }
  checks.push({name: 'release_manifest_digest_mismatch', count: manifestMismatches, severity: 'critical', detail: `${releases.rowCount} release manifests recalculated`})

  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined)
  throw error
} finally {
  await client.end()
}

const failures = checks.filter(check => check.severity === 'critical' && check.count > 0)
process.stdout.write(`${JSON.stringify({
  schemaVersion: '1.0.0',
  mode: 'READ_ONLY',
  generatedAt: new Date().toISOString(),
  result: failures.length === 0 ? 'PASS' : 'FAIL',
  checks,
  criticalFailureCount: failures.length,
}, null, 2)}\n`)
if (failures.length > 0) process.exitCode = 1

async function count(name: string, query: string, severity: Check['severity'], detail: string): Promise<void> {
  const result = await client.query<CountResult>(query)
  checks.push({name, count: Number(result.rows[0]?.count ?? 0), severity, detail})
}
