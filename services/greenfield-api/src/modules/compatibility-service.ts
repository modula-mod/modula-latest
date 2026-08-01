import {compareSemver, satisfiesSemverRange, type GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import type {AppConfig} from '../config/index.js'
import {GREENFIELD_PROTOCOL_VERSION, GREENFIELD_VERSION, MODULA_HOST_VERSION, type GreenfieldModuleReleaseRecord} from './module-domain.js'

export type GreenfieldModuleIncompatibilityReason =
  | 'GREENFIELD_VERSION_TOO_OLD'
  | 'HOST_VERSION_TOO_OLD'
  | 'HOST_VERSION_TOO_NEW'
  | 'PROTOCOL_UNSUPPORTED'
  | 'PLATFORM_UNSUPPORTED'
  | 'RELEASE_NOT_PUBLISHED'
  | 'RELEASE_QUARANTINED'
  | 'RELEASE_REVOKED'
  | 'PUBLISHER_SUSPENDED'
  | 'LICENSE_NOT_APPROVED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'PERMISSION_RESTRICTED'

export type CompatibilityContext = {
  platform: 'ios' | 'android' | 'web' | 'desktop' | 'server'
  trustPolicy?: 'firstPartyOnly' | 'reviewed'
  requiredCapabilities?: string[]
  unavailableDependencies?: boolean
  publisherStatus?: string
}

export class GreenfieldModuleCompatibilityService {
  constructor(private readonly config?: AppConfig) {}

  evaluate(release: GreenfieldModuleReleaseRecord, context: CompatibilityContext): {compatible: boolean; reasons: GreenfieldModuleIncompatibilityReason[]} {
    const manifest = release.manifest
    const reasons: GreenfieldModuleIncompatibilityReason[] = []
    if (release.releaseState !== 'published') reasons.push('RELEASE_NOT_PUBLISHED')
    if (release.releaseState === 'quarantined') reasons.push('RELEASE_QUARANTINED')
    if (release.releaseState === 'revoked') reasons.push('RELEASE_REVOKED')
    if (context.publisherStatus === 'suspended' || context.publisherStatus === 'revoked') reasons.push('PUBLISHER_SUSPENDED')
    if (!this.licenseApproved(manifest)) reasons.push('LICENSE_NOT_APPROVED')
    if (!this.greenfieldVersionAllowed(manifest)) reasons.push('GREENFIELD_VERSION_TOO_OLD')
    if (!this.hostMinimumAllowed(manifest)) reasons.push('HOST_VERSION_TOO_OLD')
    if (!this.hostMaximumAllowed(manifest)) reasons.push('HOST_VERSION_TOO_NEW')
    if (!manifest.compatibility.protocolVersions.includes(GREENFIELD_PROTOCOL_VERSION)) reasons.push('PROTOCOL_UNSUPPORTED')
    if (!manifest.compatibility.platforms.includes(context.platform)) reasons.push('PLATFORM_UNSUPPORTED')
    if (context.unavailableDependencies) reasons.push('DEPENDENCY_UNAVAILABLE')
    if (context.trustPolicy === 'firstPartyOnly' && manifest.trust.requestedLevel !== 'firstParty') reasons.push('PERMISSION_RESTRICTED')
    if (this.config && !this.config.moduleRemoteFunctionsEnabled && manifest.lifecycle?.executionMode === 'remoteHttp') {
      reasons.push('PERMISSION_RESTRICTED')
    }
    return {compatible: reasons.length === 0, reasons: Array.from(new Set(reasons))}
  }

  private licenseApproved(manifest: GreenfieldModuleManifest): boolean {
    return ['firstParty', 'verified', 'founderOverride'].includes(manifest.license.status)
  }

  private greenfieldVersionAllowed(manifest: GreenfieldModuleManifest): boolean {
    return compareSemver(GREENFIELD_VERSION, manifest.compatibility.minimumGreenfieldVersion) >= 0
  }

  private hostMinimumAllowed(manifest: GreenfieldModuleManifest): boolean {
    return compareSemver(MODULA_HOST_VERSION, manifest.compatibility.minimumModulaHostVersion) >= 0
  }

  private hostMaximumAllowed(manifest: GreenfieldModuleManifest): boolean {
    return manifest.compatibility.maximumModulaHostVersion
      ? satisfiesSemverRange(MODULA_HOST_VERSION, `<=${manifest.compatibility.maximumModulaHostVersion}`)
      : true
  }
}
