/**
 * Rebuilds the distribution inventory from registry-held, digest-verified
 * release packages. Dry-run is the default. This script never downloads a
 * release and never needs a signing private key.
 */
import {createHash} from 'node:crypto'
import {createDb} from '../src/database/client.js'
import {readTarGz} from '../src/lib/tar-gz.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'

const apply = process.argv.includes('--apply')
const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) throw new Error('MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL is required')

const db = createDb(databaseUrl)

try {
  const releases = await db.selectFrom('greenfield_module_releases as release')
    .innerJoin('greenfield_release_asset_blobs as blob', 'blob.sha256', 'release.release_sha256')
    .innerJoin('greenfield_mps_ingestions as ingestion', 'ingestion.release_id', 'release.release_id')
    .innerJoin('greenfield_module_release_signatures as signature', 'signature.release_id', 'release.release_id')
    .select([
      'release.release_id', 'release.module_id', 'release.version', 'release.release_sha256',
      'blob.bytes', 'blob.byte_size', 'ingestion.manifest_sha256', 'signature.verification_state',
    ])
    .where('release.release_state', 'in', ['published', 'superseded'])
    .where('signature.verification_state', '=', 'verified')
    .orderBy('release.module_id')
    .orderBy('release.version')
    .execute()

  const seen = new Set<string>()
  const report: Array<Record<string, unknown>> = []
  for (const release of releases) {
    if (seen.has(release.release_id)) continue
    seen.add(release.release_id)
    const packageBytes = release.bytes
    const packageDigest = sha256(packageBytes)
    if (packageDigest !== release.release_sha256 || Number(release.byte_size) !== packageBytes.length) {
      throw new Error(`Stored package identity mismatch for ${release.module_id}@${release.version}`)
    }
    const entries = readTarGz(packageBytes, {maxUncompressedBytes: 200 * 1024 * 1024})
    const file = (path: string) => entries.get(`package/${path}`) ?? null
    const mpsBytes = file('modula.product.json')
    if (!mpsBytes || sha256(mpsBytes) !== release.manifest_sha256) {
      throw new Error(`Stored MPS digest mismatch for ${release.module_id}@${release.version}`)
    }
    const mps = JSON.parse(mpsBytes.toString('utf8')) as Record<string, any>
    const frontendPath = typeof mps.frontend?.artifact?.path === 'string' ? mps.frontend.artifact.path : null
    const frontendBytes = frontendPath ? file(frontendPath) : null
    if (frontendPath && !frontendBytes) throw new Error(`Package is missing ${frontendPath} for ${release.module_id}@${release.version}`)
    const schemaPaths = [...new Set(((mps.backend?.records ?? []) as Array<{schemaPath?: unknown}>)
      .map(item => item.schemaPath).filter((value): value is string => typeof value === 'string'))]
    const schemas = schemaPaths.map(path => {
      const bytes = file(path)
      if (!bytes) throw new Error(`Package is missing ${path} for ${release.module_id}@${release.version}`)
      return {path, bytes}
    })
    const assets = presentationPaths(mps).flatMap(path => {
      const bytes = file(path)
      return bytes ? [{path, bytes}] : []
    })
    const before = await db.selectFrom('greenfield_release_artifacts')
      .select(['artifact_id']).where('release_id', '=', release.release_id).execute()
    if (apply) {
      await new GreenfieldMpsIngestService(db).ingest({
        filename: 'modula.product.json',
        bytes: mpsBytes,
        releaseId: release.release_id,
        frontend: frontendPath && frontendBytes ? {path: frontendPath, bytes: frontendBytes} : null,
        schemas,
        assets,
        distributionVerified: true,
      })
    }
    const afterCount = apply
      ? (await db.selectFrom('greenfield_release_artifacts').select(['artifact_id']).where('release_id', '=', release.release_id).execute()).length
      : before.length
    report.push({
      releaseId: release.release_id,
      moduleId: release.module_id,
      version: release.version,
      packageBytes: packageBytes.length,
      frontend: frontendPath,
      schemas: schemas.length,
      presentationAssets: assets.length,
      inventoryBefore: before.length,
      inventoryAfter: afterCount,
    })
  }
  process.stdout.write(`${JSON.stringify({mode: apply ? 'APPLIED' : 'DRY_RUN', releases: report.length, report}, null, 2)}\n`)
} finally {
  await db.destroy()
}

function presentationPaths(mps: Record<string, any>): string[] {
  const presentation = mps.presentation ?? {}
  const entries = [
    ...(presentation.assets ?? []), ...(presentation.screenshots ?? []),
    presentation.icon, presentation.logo, presentation.wordmark, presentation.cover, presentation.hero,
  ].filter(Boolean)
  return [...new Set(entries.map((entry: {path?: unknown}) => entry.path).filter((value): value is string => typeof value === 'string'))]
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}
