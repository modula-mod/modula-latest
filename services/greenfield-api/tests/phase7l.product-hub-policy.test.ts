import {describe, expect, it} from 'vitest'
import {classifyBetaModule, installabilityForBetaModule} from '../src/modules/beta-catalogue-policy.js'

describe('Phase 7L-B Product Hub beta catalogue policy', () => {
  it('keeps canonical Vault Notes available as one beta product', () => {
    const policy = classifyBetaModule({
      moduleId: 'digital.modula.vault-notes',
      status: 'published',
      manifest: {moduleId: 'digital.modula.vault-notes'},
    })
    expect(policy).toMatchObject({
      classification: 'CANONICAL_PRODUCT',
      visibleInBeta: true,
      reasonCode: 'module.available',
    })
    expect(
      installabilityForBetaModule({
        moduleId: 'digital.modula.vault-notes',
        version: '0.2.0',
        releaseState: 'published',
        classification: policy.classification,
        installable: true,
      }),
    ).toMatchObject({
      status: 'available',
      reasonCode: 'module.available',
      release: {version: '0.2.0'},
    })
  })

  it('hides legacy duplicate module identities from beta Product Hub', () => {
    expect(classifyBetaModule({moduleId: 'modula.module.vaultNotes', status: 'unavailable'})).toMatchObject({
      classification: 'DUPLICATE',
      visibleInBeta: false,
      canonicalModuleId: 'digital.modula.vault-notes',
    })
    expect(classifyBetaModule({moduleId: 'modula.vault-notes', status: 'published'})).toMatchObject({
      classification: 'DUPLICATE',
      visibleInBeta: false,
      canonicalModuleId: 'digital.modula.vault-notes',
    })
    expect(classifyBetaModule({moduleId: 'modula.module.tasks', status: 'unavailable'})).toMatchObject({
      classification: 'DUPLICATE',
      visibleInBeta: false,
      canonicalModuleId: 'digital.modula.tasks',
    })
    expect(classifyBetaModule({moduleId: 'modula.module.dimon', status: 'inactive'})).toMatchObject({
      classification: 'DUPLICATE',
      visibleInBeta: false,
      canonicalModuleId: 'digital.dimon.core',
    })
  })

  it('keeps planned modules as coming soon without marking them broken', () => {
    const policy = classifyBetaModule({
      moduleId: 'digital.modula.tasks',
      status: 'planned',
      manifest: {moduleId: 'digital.modula.tasks', state: 'planned'},
    })
    expect(policy).toMatchObject({classification: 'COMING_SOON', visibleInBeta: true})
    expect(
      installabilityForBetaModule({
        moduleId: 'digital.modula.tasks',
        releaseState: 'planned',
        classification: policy.classification,
        installable: false,
      }),
    ).toMatchObject({status: 'coming_soon', reason: 'Coming Soon'})
  })

  it('hides internal DIMON capability records and generated test fixtures', () => {
    expect(
      classifyBetaModule({
        moduleId: 'digital.dimon.core',
        status: 'inactive',
        manifest: {moduleId: 'digital.dimon.core', inactive: true},
      }),
    ).toMatchObject({classification: 'INTERNAL_ONLY', visibleInBeta: false})
    expect(classifyBetaModule({moduleId: 'digital.modula.search-c1153c4e', status: 'quarantined'})).toMatchObject({
      classification: 'TEST_ONLY',
      visibleInBeta: false,
    })
    expect(classifyBetaModule({moduleId: 'test.modula.reference-notes', status: 'published'})).toMatchObject({
      classification: 'TEST_ONLY',
      visibleInBeta: false,
    })
    expect(classifyBetaModule({moduleId: 'example.test-fixture', status: 'published', manifest: {testOnly: true}})).toMatchObject({
      classification: 'TEST_ONLY',
      visibleInBeta: false,
    })
  })

  it('can show non-fixture quarantined products as security review required', () => {
    const policy = classifyBetaModule({moduleId: 'digital.modula.reviewed-module', status: 'quarantined'})
    expect(policy).toMatchObject({classification: 'QUARANTINED', visibleInBeta: true})
    expect(
      installabilityForBetaModule({
        moduleId: 'digital.modula.reviewed-module',
        version: '1.0.0',
        releaseState: 'quarantined',
        classification: policy.classification,
        installable: false,
      }),
    ).toMatchObject({
      status: 'quarantined',
      reasonCode: 'module.security_review_required',
      reason: 'Security review required',
    })
  })
})
