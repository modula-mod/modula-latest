import {resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import type {Database} from '../database/types.js'
import {moduleError} from './module-errors.js'
import {
  collectionPermission,
  GreenfieldModuleRuntimeAccessService,
  sharingPermission,
  type GreenfieldModuleRuntimeContext,
} from './runtime-access.js'

export type GreenfieldModuleRecordAccess = {
  runtime: GreenfieldModuleRuntimeContext
  record: Database['greenfield_module_records']
  ownerAccountId: string
  access: 'owner' | 'read' | 'edit'
  shareId: string | null
}

/**
 * The canonical current-policy evaluator for a single generic module record.
 * A share is never authority by itself: the recipient must also pass the
 * installation, trust, exact-release review and collection-capability gates.
 */
export class GreenfieldModuleRecordAccessService {
  private readonly runtimeAccess: GreenfieldModuleRuntimeAccessService

  constructor(
    private readonly db: ModulaDb,
    config?: Pick<AppConfig, 'environment' | 'moduleAllowUntrustedDevelopmentReleases'>,
  ) {
    this.runtimeAccess = new GreenfieldModuleRuntimeAccessService(db, config)
  }

  async resolve(
    accountId: string,
    moduleId: string,
    recordType: string,
    recordId: string,
    options: {operation?: 'read' | 'write'; includeDeleted?: boolean} = {},
  ): Promise<GreenfieldModuleRecordAccess> {
    const operation = options.operation ?? 'read'
    const canonicalId = resolveCanonicalModuleId(moduleId)
    const runtime = await this.runtimeAccess.resolve(accountId, canonicalId, {requireEnabled: true})
    this.runtimeAccess.enforceCapability(runtime, collectionPermission(canonicalId, recordType, operation))

    let owned = this.db.selectFrom('greenfield_module_records').selectAll()
      .where('account_id', '=', accountId).where('module_id', '=', canonicalId)
      .where('collection', '=', recordType).where('record_id', '=', recordId)
    if (!options.includeDeleted) owned = owned.where('deleted_at', 'is', null) as typeof owned
    const ownedRecord = await owned.executeTakeFirst()
    if (ownedRecord) {
      return {runtime, record: ownedRecord, ownerAccountId: accountId, access: 'owner', shareId: null}
    }

    let shared = this.db.selectFrom('greenfield_module_record_shares as share')
      .innerJoin('greenfield_module_records as record', join => join
        .onRef('record.account_id', '=', 'share.owner_account_id')
        .onRef('record.module_id', '=', 'share.module_id')
        .onRef('record.collection', '=', 'share.record_type')
        .onRef('record.record_id', '=', 'share.record_id'))
      .selectAll('record')
      .select(['share.share_id', 'share.permission'])
      .where('share.recipient_account_id', '=', accountId).where('share.module_id', '=', canonicalId)
      .where('share.record_type', '=', recordType).where('share.record_id', '=', recordId)
      .where('share.revoked_at', 'is', null)
      .where(eb => eb.or([eb('share.expires_at', 'is', null), eb('share.expires_at', '>', new Date())]))
    if (!options.includeDeleted) shared = shared.where('record.deleted_at', 'is', null) as typeof shared
    if (operation === 'write') shared = shared.where('share.permission', '=', 'edit') as typeof shared
    const sharedRecord = await shared.executeTakeFirst()
    if (!sharedRecord) throw moduleError('NOT_FOUND', 'Module record not found')

    this.runtimeAccess.enforceCapability(runtime, sharingPermission(canonicalId, recordType, operation))
    const {share_id: shareId, permission, ...record} = sharedRecord
    return {
      runtime,
      record: record as Database['greenfield_module_records'],
      ownerAccountId: record.account_id,
      access: permission,
      shareId,
    }
  }

  async canRead(accountId: string, moduleId: string, recordType: string, recordId: string): Promise<boolean> {
    try {
      await this.resolve(accountId, moduleId, recordType, recordId)
      return true
    } catch {
      return false
    }
  }
}
