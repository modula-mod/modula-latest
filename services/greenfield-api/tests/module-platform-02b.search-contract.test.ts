import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('MP02B generic module-record search contract', () => {
  it('emits and subscribes to one product-neutral record change event', () => {
    const records = source('../src/modules/record-service.ts')
    const subscribers = source('../../greenfield-worker/src/search/subscribers.ts')
    const up = source('../migrations/071_module_record_search_projection.sql')
    const down = source('../migrations/071_module_record_search_projection.down.sql')
    expect(records).toContain("eventType: 'module.record.changed'")
    expect(records).toContain('publishCanonicalRecordChangedEvent')
    expect(subscribers).toContain("'module.record.changed': {projectorId: 'search.module-record-projector'")
    expect(up).toContain("'subscription:search.module-record-projector:module.record.changed'")
    expect(down).toContain("WHERE event_type = 'module.record.changed'")
    expect(up).not.toContain('digital.modula.vault-notes')
  })

  it('uses collection allowlists and excludes sensitive fields from projection', () => {
    const projector = source('../../greenfield-worker/src/search/module-record-projector.ts')
    expect(projector).toContain('searchable_fields')
    expect(projector).toContain('filterable_fields')
    expect(projector).toContain('nonSensitiveFieldNames')
    expect(projector).toContain("status: 'hidden'")
    expect(projector).not.toContain('digital.modula.vault-notes')
  })

  it('re-evaluates trusted runtime grants, active shares, revocation and expiry at query time', () => {
    const access = source('../src/domains/search/module-record-access.ts')
    const repository = source('../src/domains/search/repository.ts')
    const service = source('../src/domains/search/service.ts')
    expect(access).toContain("resolve(actorAccountId, identity.moduleId, {requireEnabled: true})")
    expect(access).toContain("collectionPermission(runtime.moduleId, identity.recordType, 'read')")
    expect(access).toContain('sharing:module.${moduleId}.${recordType}:read')
    expect(access).toContain('revoked_at IS NULL')
    expect(access).toContain('expires_at > NOW()')
    expect(repository).toContain('greenfield_module_record_shares AS record_share')
    expect(service).toContain('moduleRecordAccess.canRead')
  })
})
