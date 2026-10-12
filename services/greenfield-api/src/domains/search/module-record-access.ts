import {moduleIdFamily, resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import {sql} from 'kysely'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import {collectionPermission, GreenfieldModuleRuntimeAccessService} from '../../modules/runtime-access.js'

type SearchRecordIdentity = {moduleId: string; recordType: string; recordId: string}

/**
 * Re-evaluates module runtime and record policy for every projected result.
 * The index is never an authority and an active share never bypasses the
 * recipient's trusted/enabled installation or exact-release grants.
 */
export class ModuleRecordSearchAccessEvaluator {
  private readonly runtime: GreenfieldModuleRuntimeAccessService

  constructor(private readonly db: ModulaDb, config: AppConfig) {
    this.runtime = new GreenfieldModuleRuntimeAccessService(db, config)
  }

  async canRead(metadata: Record<string, unknown>, ownerAccountId: string | null, actorAccountId: string | null): Promise<boolean> {
    const identity = identityFromMetadata(metadata)
    if (!identity || !ownerAccountId || !actorAccountId) return false

    try {
      const runtime = await this.runtime.resolve(actorAccountId, identity.moduleId, {requireEnabled: true})
      this.runtime.enforceCapability(runtime, collectionPermission(runtime.moduleId, identity.recordType, 'read'))

      const record = await this.db.selectFrom('greenfield_module_records')
        .select('record_id')
        .where('account_id', '=', ownerAccountId)
        .where('module_id', 'in', [...moduleIdFamily(runtime.moduleId)])
        .where('collection', '=', identity.recordType)
        .where('record_id', '=', identity.recordId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
      if (!record) return false
      if (ownerAccountId === actorAccountId) return true

      // Migration 069 owns the generic share table. Raw SQL keeps this search
      // lane independently typecheckable until the integration owner combines
      // both substreams.
      const share = await sql<{allowed: boolean}>`
        SELECT EXISTS (
          SELECT 1
          FROM greenfield_module_record_shares
          WHERE owner_account_id = ${ownerAccountId}
            AND recipient_account_id = ${actorAccountId}
            AND module_id = ${runtime.moduleId}
            AND record_type = ${identity.recordType}
            AND record_id = ${identity.recordId}
            AND revoked_at IS NULL
            AND (expires_at IS NULL OR expires_at > NOW())
        ) AS allowed
      `.execute(this.db)
      if (share.rows[0]?.allowed !== true) return false
      this.runtime.enforceCapability(runtime, sharingReadPermission(runtime.moduleId, identity.recordType))
      return true
    } catch {
      return false
    }
  }
}

function identityFromMetadata(metadata: Record<string, unknown>): SearchRecordIdentity | null {
  const moduleId = typeof metadata.moduleId === 'string' ? resolveCanonicalModuleId(metadata.moduleId) : ''
  const recordType = typeof metadata.recordType === 'string' ? metadata.recordType : ''
  const recordId = typeof metadata.recordId === 'string' ? metadata.recordId : ''
  if (!moduleId || !recordType || !recordId) return null
  return {moduleId, recordType, recordId}
}

function sharingReadPermission(moduleId: string, recordType: string): string {
  return `sharing:module.${moduleId}.${recordType}:read`
}
