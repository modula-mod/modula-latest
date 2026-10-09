import type {MpsFrontendArtifact} from '@modula/greenfield-product-standard'
import type {ModulaDb} from '../database/client.js'
import type {AppConfig} from '../config/index.js'
import {moduleError} from '../modules/module-errors.js'
import {GreenfieldModuleRuntimeAccessService} from '../modules/runtime-access.js'

export type GreenfieldProductFrontendResponse =
  | {
      source: 'legacy'
      productId: string
      version: string
      releaseId: string
      installationId: string
      installationStatus: 'enabled'
    }
  | {
      source: 'mps'
      productId: string
      version: string
      releaseId: string
      installationId: string
      installationStatus: 'enabled'
      mode: 'declarative' | 'host-contribution'
      artifact: {
        role: 'product.frontend'
        path: string
        mediaType: 'application/vnd.modula.frontend+json'
        sha256: string
        schemaVersion: '1.0.0'
        verifiedAt: string
      }
      mpsVersion: '1.0-RC' | '1.0'
      entryView: string | null
      routeCount: number
      compatibility: unknown
      requiredCapabilities: unknown
      frontend: MpsFrontendArtifact
    }

export class GreenfieldProductFrontendService {
  private readonly access: GreenfieldModuleRuntimeAccessService

  constructor(private readonly db: ModulaDb, config?: AppConfig) {
    this.access = new GreenfieldModuleRuntimeAccessService(db, config)
  }

  async resolve(accountId: string, moduleId: string): Promise<GreenfieldProductFrontendResponse> {
    const context = await this.access.resolve(accountId, moduleId, {requireEnabled: true})
    const ingestion = await this.db.selectFrom('greenfield_mps_ingestions')
      .select(['ingestion_id', 'frontend_mode'])
      .where('release_id', '=', context.releaseId)
      .where('product_id', '=', context.moduleId)
      .where('version', '=', context.version)
      .executeTakeFirst()

    if (!ingestion) {
      return {
        source: 'legacy',
        productId: context.moduleId,
        version: context.version,
        releaseId: context.releaseId,
        installationId: context.installationId,
        installationStatus: 'enabled',
      }
    }
    if (ingestion.frontend_mode === 'none') {
      throw moduleError('CAPABILITY_DISABLED', 'The installed product release is explicitly headless')
    }

    const row = await this.db.selectFrom('greenfield_release_frontends')
      .selectAll()
      .where('ingestion_id', '=', ingestion.ingestion_id)
      .where('release_id', '=', context.releaseId)
      .where('product_id', '=', context.moduleId)
      .where('version', '=', context.version)
      .executeTakeFirst()
    if (!row) throw moduleError('VALIDATION_FAILED', 'The installed MPS release has no verified frontend projection')
    if (row.frontend_mode !== ingestion.frontend_mode) throw moduleError('VALIDATION_FAILED', 'Frontend release metadata is incoherent')

    return {
      source: 'mps',
      productId: context.moduleId,
      version: context.version,
      releaseId: context.releaseId,
      installationId: context.installationId,
      installationStatus: 'enabled',
      mode: row.frontend_mode,
      artifact: {
        role: row.artifact_role,
        path: row.artifact_path,
        mediaType: row.media_type,
        sha256: row.artifact_sha256,
        schemaVersion: row.schema_version,
        verifiedAt: row.verified_at.toISOString(),
      },
      mpsVersion: row.mps_version,
      entryView: row.entry_view,
      routeCount: row.route_count,
      compatibility: row.compatibility,
      requiredCapabilities: row.required_capabilities,
      frontend: row.runtime_projection as MpsFrontendArtifact,
    }
  }
}
