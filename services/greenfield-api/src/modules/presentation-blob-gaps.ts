import type {ModulaDb} from '../database/client.js'

/**
 * GF-MOD-02 (G004): presentation metadata rows whose bytes are not stored.
 * A row is a gap when it has no digest or no blob exists for its digest.
 * Read-only; used by the publication gate and the internal admin report.
 */
export type PresentationBlobGap = {
  assetId: string
  releaseId: string | null
  productId: string
  version: string
  role: string
  path: string
  sha256: string | null
}

export async function presentationAssetsMissingBlobs(db: ModulaDb, scope: {releaseId?: string} = {}): Promise<PresentationBlobGap[]> {
  let query = db.selectFrom('greenfield_release_presentation_assets as asset')
    .leftJoin('greenfield_release_asset_blobs as blob', 'blob.sha256', 'asset.sha256')
    .select(['asset.asset_id', 'asset.release_id', 'asset.product_id', 'asset.version', 'asset.role', 'asset.artifact_path', 'asset.sha256'])
    .where('blob.sha256', 'is', null)
  if (scope.releaseId) query = query.where('asset.release_id', '=', scope.releaseId)
  const rows = await query.orderBy('asset.product_id').orderBy('asset.version').orderBy('asset.asset_id').execute()
  return rows.map(row => ({
    assetId: row.asset_id, releaseId: row.release_id, productId: row.product_id, version: row.version,
    role: row.role, path: row.artifact_path, sha256: row.sha256,
  }))
}
