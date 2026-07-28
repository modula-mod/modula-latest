import type {
  GreenfieldEngineRequirement,
  GreenfieldEngineProvider,
  GreenfieldNativeBuildRequirement,
  GreenfieldResolvedModuleRuntimeSubject,
  GreenfieldRuntimeCompatibility,
  GreenfieldRuntimePlatform,
  GreenfieldRuntimeReasonCode,
  GreenfieldRuntimeResolutionResult,
  GreenfieldSelectedRuntimeProvider,
  GreenfieldUnresolvedEngineRequirement,
} from '@modula/greenfield-module-engine-contracts'
import {isProviderLaunchable, isTrustedRuntimeProvider} from '@modula/greenfield-module-engine-contracts'
import type {GreenfieldRuntimeProviderRegistry} from './provider-registry.js'
import {satisfiesMinimumVersion} from './semver.js'

export type GreenfieldRuntimeResolutionOptions = {
  platform?: GreenfieldRuntimePlatform
  nativeBuildAvailable?: boolean
}

export function resolveRuntimeRequirements(
  subject: GreenfieldResolvedModuleRuntimeSubject,
  registry: GreenfieldRuntimeProviderRegistry,
  options: GreenfieldRuntimeResolutionOptions = {},
): GreenfieldRuntimeResolutionResult {
  const reasonCodes = new Set<GreenfieldRuntimeReasonCode>()
  const selectedProviders: GreenfieldSelectedRuntimeProvider[] = []
  const unresolvedRequirements: GreenfieldUnresolvedEngineRequirement[] = []
  const requiredPermissions = new Set<string>()
  const deniedCapabilities = new Set<string>()
  let nativeBuildRequirement: GreenfieldNativeBuildRequirement = 'not-required'
  let degradedModeEligible = false

  if (subject.installationStatus === 'removed') reasonCodes.add('module.not-installed')
  if (subject.installationStatus !== 'enabled') reasonCodes.add('module.disabled')
  if (subject.releaseState !== 'published') reasonCodes.add('release.unavailable')

  for (const requirement of subject.engineRequirements) {
    const permissionDenials = permissionsFor(requirement).filter(permission => !subject.grantedPermissions.includes(permission))
    for (const permission of permissionsFor(requirement)) requiredPermissions.add(permission)
    for (const permission of permissionDenials) deniedCapabilities.add(permission)
    if (permissionDenials.length > 0) {
      reasonCodes.add('permission.denied')
      addFallbackReason(requirement, reasonCodes)
      if (allowsDegradedMode(requirement)) degradedModeEligible = true
      unresolvedRequirements.push(unresolved(requirement, ['permission.denied']))
      continue
    }

    const candidates = registry.candidatesForKind(requirement.kind)
    if (candidates.length === 0) {
      addFallbackReason(requirement, reasonCodes)
      if (allowsDegradedMode(requirement)) degradedModeEligible = true
      unresolvedRequirements.push(unresolved(requirement, ['provider.missing']))
      continue
    }

    const evaluated = candidates.map(adapter => evaluateCandidate(adapter.provider, requirement, options))
    const viable = evaluated
      .filter(item => item.reasonCodes.length === 0)
      .map(item => item.provider)

    const available = viable.find(provider => provider.status === 'available') ?? viable[0]
    if (!available) {
      for (const evaluatedProvider of evaluated) {
        for (const reasonCode of evaluatedProvider.reasonCodes) reasonCodes.add(reasonCode)
        for (const capability of evaluatedProvider.deniedCapabilities) deniedCapabilities.add(capability)
      }
      if (evaluated.some(item => item.reasonCodes.includes('native-build.unavailable'))) {
        nativeBuildRequirement = 'unavailable'
      }
      addFallbackReason(requirement, reasonCodes)
      if (allowsDegradedMode(requirement)) degradedModeEligible = true
      unresolvedRequirements.push(unresolved(requirement, ['provider.unavailable']))
      continue
    }

    if (available.nativeBuildRequired) nativeBuildRequirement = 'required'
    if (available.status === 'degraded' || requirement.fallbackPolicy === 'degraded-allowed') {
      degradedModeEligible = true
      reasonCodes.add('degraded-mode.available')
    }
    selectedProviders.push({
      providerId: available.providerId,
      engineKind: available.engineKind,
      apiVersion: available.apiVersion,
      status: available.status,
      capabilities: available.capabilities,
    })
  }

  const blocked = reasonCodes.has('module.not-installed') ||
    reasonCodes.has('module.disabled') ||
    reasonCodes.has('release.unavailable') ||
    unresolvedRequirements.some(item => !isOptionalRequirement(item.requirementId, subject.engineRequirements)) ||
    nativeBuildRequirement === 'unavailable'

  if (!blocked && allRequiredRequirementsResolved(subject.engineRequirements, selectedProviders, unresolvedRequirements)) {
    reasonCodes.add('requirements.resolved')
  }

  const compatibility: GreenfieldRuntimeCompatibility = blocked ? 'blocked' : degradedModeEligible ? 'degraded' : 'compatible'
  const launchPermission = compatibility === 'compatible' ? 'allowed' : compatibility === 'degraded' ? 'degraded-only' : 'denied'

  return {
    accountId: subject.accountId,
    moduleId: subject.moduleId,
    releaseId: subject.releaseId,
    compatibility,
    launchPermission,
    selectedProviders,
    unresolvedRequirements,
    requiredPermissions: [...requiredPermissions],
    deniedCapabilities: [...deniedCapabilities],
    nativeBuildRequirement,
    degradedModeEligible,
    reasonCodes: [...reasonCodes],
  }
}

function permissionsFor(requirement: GreenfieldEngineRequirement): string[] {
  return requirement.requiredPermissions?.length ? requirement.requiredPermissions : requirement.capabilities
}

function unresolved(
  requirement: GreenfieldEngineRequirement,
  reasonCodes: GreenfieldRuntimeReasonCode[],
): GreenfieldUnresolvedEngineRequirement {
  return {
    requirementId: requirement.requirementId,
    kind: requirement.kind,
    capabilities: requirement.capabilities,
    reasonCodes,
  }
}

function evaluateCandidate(
  provider: GreenfieldEngineProvider,
  requirement: GreenfieldEngineRequirement,
  options: GreenfieldRuntimeResolutionOptions,
): {
  provider: GreenfieldEngineProvider
  reasonCodes: GreenfieldRuntimeReasonCode[]
  deniedCapabilities: string[]
} {
  const reasonCodes: GreenfieldRuntimeReasonCode[] = []
  const deniedCapabilities: string[] = []

  if (!isTrustedRuntimeProvider(provider)) reasonCodes.push('provider.untrusted')
  if (!isProviderLaunchable(provider)) {
    reasonCodes.push(providerStatusReason(provider.status))
    if (!provider.launchable) reasonCodes.push('provider.not-launchable')
  }
  if (options.platform && !provider.supportedPlatforms?.includes(options.platform)) {
    reasonCodes.push('platform.unsupported')
  }
  if (!satisfiesMinimumVersion(provider.apiVersion, requirement.minimumApiVersion)) {
    reasonCodes.push('api.incompatible')
  }
  const missingCapability = requirement.capabilities.find(capability => !provider.capabilities.includes(capability))
  if (missingCapability) {
    reasonCodes.push('capability.unsatisfied')
    deniedCapabilities.push(missingCapability)
  }
  if (provider.nativeBuildRequired && (options.nativeBuildAvailable !== true || requirement.nativeBuildPolicy === 'forbidden')) {
    reasonCodes.push('native-build.unavailable')
  }

  return {
    provider,
    reasonCodes: [...new Set(reasonCodes)],
    deniedCapabilities,
  }
}

function providerStatusReason(status: string): GreenfieldRuntimeReasonCode {
  if (status === 'not-configured') return 'provider.not-configured'
  if (status === 'disabled') return 'provider.disabled'
  if (status === 'degraded') return 'provider.degraded'
  if (status === 'quarantined') return 'provider.quarantined'
  if (status === 'failed') return 'provider.failed'
  return 'provider.unavailable'
}

function addFallbackReason(requirement: GreenfieldEngineRequirement, reasonCodes: Set<GreenfieldRuntimeReasonCode>): void {
  if (allowsDegradedMode(requirement)) {
    reasonCodes.add('degraded-mode.available')
    return
  }
  reasonCodes.add('degraded-mode.denied')
}

function allowsDegradedMode(requirement: GreenfieldEngineRequirement): boolean {
  return requirement.fallbackPolicy === 'degraded-allowed' || requirement.fallbackPolicy === 'optional'
}

function isOptionalRequirement(requirementId: string, requirements: GreenfieldEngineRequirement[]): boolean {
  const requirement = requirements.find(item => item.requirementId === requirementId)
  return requirement?.fallbackPolicy === 'optional' || requirement?.fallbackPolicy === 'degraded-allowed'
}

function allRequiredRequirementsResolved(
  requirements: GreenfieldEngineRequirement[],
  selectedProviders: GreenfieldSelectedRuntimeProvider[],
  unresolvedRequirements: GreenfieldUnresolvedEngineRequirement[],
): boolean {
  const unresolvedRequired = unresolvedRequirements.some(item => !isOptionalRequirement(item.requirementId, requirements))
  const requiredCount = requirements.filter(requirement => !isOptionalRequirement(requirement.requirementId, requirements)).length
  return !unresolvedRequired && selectedProviders.length >= requiredCount
}
