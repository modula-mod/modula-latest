import type {
  GreenfieldModuleBetaClassification,
  GreenfieldModuleInstallabilityProjection,
  GreenfieldModuleReleaseStatus,
} from '@modula/greenfield-module-registry-contracts'

const LEGACY_MODULE_REPLACEMENTS: Record<string, string> = {
  'modula.module.vaultNotes': 'digital.modula.vault-notes',
  'modula.vault-notes': 'digital.modula.vault-notes',
  'module-vault-notes': 'digital.modula.vault-notes',
  'modula.module.tasks': 'digital.modula.tasks',
  'modula.module.dimon': 'digital.dimon.core',
}

export function classifyBetaModule(input: {
  moduleId: string
  status: string
  manifest?: Record<string, unknown>
}): {
  classification: GreenfieldModuleBetaClassification
  visibleInBeta: boolean
  canonicalModuleId?: string
  reasonCode: string
  reason: string
} {
  const canonicalModuleId = LEGACY_MODULE_REPLACEMENTS[input.moduleId]
  if (canonicalModuleId) {
    return {
      classification: 'DUPLICATE',
      visibleInBeta: false,
      canonicalModuleId,
      reasonCode: 'module.legacy_duplicate',
      reason: `Legacy module identity replaced by ${canonicalModuleId}.`,
    }
  }

  if (/^test\.modula\./i.test(input.moduleId) || /^digital\.modula\.search-[0-9a-f]+$/i.test(input.moduleId) || input.manifest?.testOnly === true) {
    return {
      classification: 'TEST_ONLY',
      visibleInBeta: false,
      reasonCode: 'module.generated_fixture',
      reason: 'Test-only product is hidden from the beta Product Hub.',
    }
  }

  if (input.manifest?.inactive === true || input.status === 'inactive') {
    return {
      classification: 'INTERNAL_ONLY',
      visibleInBeta: false,
      reasonCode: 'module.internal_only',
      reason: 'Internal system capability is not exposed as a beta-installable product.',
    }
  }

  if (input.manifest?.state === 'planned' || input.status === 'planned') {
    return {
      classification: 'COMING_SOON',
      visibleInBeta: true,
      reasonCode: 'module.coming_soon',
      reason: 'Product is intentionally listed as a future first-party module.',
    }
  }

  if (input.status === 'quarantined') {
    return {
      classification: 'QUARANTINED',
      visibleInBeta: true,
      reasonCode: 'module.security_review_required',
      reason: 'Release is quarantined pending review.',
    }
  }

  if (input.status === 'published') {
    return {
      classification: 'CANONICAL_PRODUCT',
      visibleInBeta: true,
      reasonCode: 'module.available',
      reason: 'Published release is available for compatible beta clients.',
    }
  }

  if (input.status === 'superseded') {
    return {
      classification: 'VALID_OLDER_RELEASE',
      visibleInBeta: false,
      reasonCode: 'module.older_release',
      reason: 'Older release is retained as release history, not a separate product card.',
    }
  }

  return {
    classification: 'BROKEN',
    visibleInBeta: false,
    reasonCode: 'module.unavailable',
    reason: 'Record is not beta-visible until it is classified or repaired.',
  }
}

export function installabilityForBetaModule(input: {
  moduleId: string
  version?: string | null
  releaseId?: string | null
  releaseState?: GreenfieldModuleReleaseStatus | 'planned' | 'inactive' | 'unavailable' | string
  classification: GreenfieldModuleBetaClassification
  installable: boolean
}): GreenfieldModuleInstallabilityProjection {
  const release = input.version ? {version: input.version, releaseId: input.releaseId ?? null} : null
  if (input.classification === 'COMING_SOON') {
    return {
      moduleId: input.moduleId,
      release,
      status: 'coming_soon',
      reasonCode: 'module.coming_soon',
      reason: 'Coming Soon',
    }
  }
  if (input.classification === 'QUARANTINED' || input.releaseState === 'quarantined') {
    return {
      moduleId: input.moduleId,
      release,
      status: 'quarantined',
      reasonCode: 'module.security_review_required',
      reason: 'Security review required',
    }
  }
  if (input.installable && input.releaseState === 'published') {
    return {
      moduleId: input.moduleId,
      release,
      status: 'available',
      reasonCode: 'module.available',
      reason: 'Available',
    }
  }
  return {
    moduleId: input.moduleId,
    release,
    status: 'unavailable',
    reasonCode: 'module.unavailable',
    reason: 'Unavailable',
  }
}
