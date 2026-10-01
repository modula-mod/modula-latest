import {createHash} from 'node:crypto'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import type {ModulaDb} from '../database/client.js'
import type {GreenfieldModuleReleaseRecord} from './module-domain.js'
import {GreenfieldRegistryTrustService, type RegistryTrustBlock, type RegistryTrustOptions} from './registry-trust-service.js'

export const INSTALL_DESCRIPTOR_VERSION = '1.0.0'

/**
 * The registry's answer to "install module X at version V": everything a host
 * needs to pin and verify one immutable release. Hosts fetch artifacts only
 * through the registry refs below and check every digest before use.
 */
export type GreenfieldInstallDescriptor = {
  descriptorVersion: typeof INSTALL_DESCRIPTOR_VERSION
  moduleId: string
  version: string
  registryReleaseId: string
  releaseState: string
  publisherId: string
  installationId: string | null
  artifact: {
    sha256: string | null
    mediaType: 'application/gzip'
    ref: string | null
    source: {provider: 'github'; repository: string; commit: string; releaseTag: string | null; releaseAssetName: string | null}
  }
  manifest: {productManifestSha256: string | null; adapterManifestSha256: string; productStandard: string | null}
  frontend: null | {
    mode: string
    path: string
    mediaType: string
    sha256: string
    schemaVersion: string
    mpsVersion: string
    entryView: string | null
    requiredCapabilities: unknown
    ref: string
  }
  trust: {
    verified: boolean
    publisherVerified: boolean
    signatureState: RegistryTrustBlock['signature']['state']
    signatureKeyId: string | null
    publicKeyFingerprint: string | null
    revoked: boolean
    quarantined: boolean
    warnings: string[]
  }
  compatibility: RegistryTrustBlock['compatibility']
  permissions: {granted: string[]; denied: string[]}
}

export type IssuedInstallDescriptor = GreenfieldInstallDescriptor & {descriptorSha256: string; issuedAt: string}

export class GreenfieldInstallDescriptorService {
  private readonly trust: GreenfieldRegistryTrustService

  constructor(private readonly db: ModulaDb, private readonly publicApiUrl?: string | null) {
    this.trust = new GreenfieldRegistryTrustService(db)
  }

  async build(
    release: GreenfieldModuleReleaseRecord,
    input: {installationId: string | null; grantedPermissions: string[]; deniedPermissions: string[]; trustOptions?: RegistryTrustOptions; trustBlock?: RegistryTrustBlock},
  ): Promise<IssuedInstallDescriptor> {
    const [trust, ingestion, frontend, packageBlob] = await Promise.all([
      input.trustBlock ? Promise.resolve(input.trustBlock) : this.trust.forRelease(release, input.trustOptions ?? {}),
      this.db.selectFrom('greenfield_mps_ingestions').select(['manifest_sha256', 'product_standard']).where('release_id', '=', release.releaseId).executeTakeFirst(),
      this.db.selectFrom('greenfield_release_frontends')
        .select(['frontend_mode', 'artifact_path', 'media_type', 'artifact_sha256', 'schema_version', 'mps_version', 'entry_view', 'required_capabilities'])
        .where('release_id', '=', release.releaseId).executeTakeFirst(),
      release.releaseSha256
        ? this.db.selectFrom('greenfield_release_asset_blobs').select('sha256').where('sha256', '=', release.releaseSha256).executeTakeFirst()
        : Promise.resolve(undefined),
    ])
    const descriptor: GreenfieldInstallDescriptor = {
      descriptorVersion: INSTALL_DESCRIPTOR_VERSION,
      moduleId: release.moduleId,
      version: release.version,
      registryReleaseId: release.releaseId,
      releaseState: release.releaseState,
      publisherId: release.publisherId,
      installationId: input.installationId,
      artifact: {
        sha256: release.releaseSha256,
        mediaType: 'application/gzip',
        ref: packageBlob ? this.url(`/v1/registry/releases/${encodeURIComponent(release.releaseId)}/artifact`) : null,
        source: {
          provider: 'github',
          repository: trust.provenance.repository,
          commit: trust.provenance.commit,
          releaseTag: trust.provenance.releaseTag,
          releaseAssetName: trust.provenance.releaseAssetName,
        },
      },
      manifest: {
        productManifestSha256: ingestion?.manifest_sha256 ?? null,
        adapterManifestSha256: release.manifestSha256,
        productStandard: ingestion?.product_standard ?? null,
      },
      frontend: frontend ? {
        mode: frontend.frontend_mode,
        path: frontend.artifact_path,
        mediaType: frontend.media_type,
        sha256: frontend.artifact_sha256,
        schemaVersion: frontend.schema_version,
        mpsVersion: frontend.mps_version,
        entryView: frontend.entry_view,
        requiredCapabilities: frontend.required_capabilities,
        ref: this.url(`/v1/modules/${encodeURIComponent(release.moduleId)}/frontend`),
      } : null,
      trust: {
        verified: trust.verified,
        publisherVerified: trust.publisher.verified,
        signatureState: trust.signature.state,
        signatureKeyId: trust.signature.keyId,
        publicKeyFingerprint: trust.signature.publicKeyFingerprint,
        revoked: trust.revocation.revoked,
        quarantined: trust.quarantine.quarantined,
        warnings: trust.warnings.map(warning => warning.code),
      },
      compatibility: trust.compatibility,
      permissions: {granted: [...input.grantedPermissions].sort(), denied: [...input.deniedPermissions].sort()},
    }
    return {...descriptor, descriptorSha256: descriptorDigest(descriptor), issuedAt: new Date().toISOString()}
  }

  private url(path: string) {
    return this.publicApiUrl ? `${this.publicApiUrl.replace(/\/+$/, '')}${path}` : path
  }
}

/** Digest over the canonical JSON of the descriptor body (issuedAt excluded). */
export function descriptorDigest(descriptor: GreenfieldInstallDescriptor): string {
  return createHash('sha256').update(canonicalJsonStringify(descriptor)).digest('hex')
}
