import type {GreenfieldModuleManifestV1} from '@modula/greenfield-module-manifest'
import {getNamespacePrefix, usesReservedNamespace} from '@modula/greenfield-module-manifest'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {moduleError} from './module-errors.js'

export class GreenfieldModulePublisherService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config?: AppConfig,
  ) {}

  async getPublisher(publisherId: string) {
    return this.db.selectFrom('greenfield_publishers').selectAll().where('publisher_id', '=', publisherId).executeTakeFirst()
  }

  async ensurePublisherForManifest(manifest: GreenfieldModuleManifestV1): Promise<void> {
    const now = new Date()
    const firstParty = manifest.trust.requestedLevel === 'firstParty' || manifest.license.status === 'firstParty'
    await this.db
      .insertInto('greenfield_publishers')
      .values({
        publisher_id: manifest.publisher.publisherId,
        display_name: manifest.publisher.displayName,
        website: manifest.publisher.website ?? null,
        status: firstParty ? 'verified' : 'pending',
        trust_level: manifest.trust.requestedLevel,
        created_at: now,
        updated_at: now,
        verified_at: firstParty ? now : null,
        suspended_at: null,
        revoked_at: null,
      })
      .onConflict(oc =>
        oc.column('publisher_id').doUpdateSet({
          display_name: manifest.publisher.displayName,
          website: manifest.publisher.website ?? null,
          updated_at: now,
        }),
      )
      .execute()

    await this.ensureNamespace(manifest)
  }

  async ensureNamespace(manifest: GreenfieldModuleManifestV1): Promise<void> {
    const namespace = getNamespacePrefix(manifest.moduleId)
    const existing = await this.db
      .selectFrom('greenfield_publisher_namespaces')
      .selectAll()
      .where('namespace', '=', namespace)
      .where('revoked_at', 'is', null)
      .executeTakeFirst()
    if (existing && existing.publisher_id !== manifest.publisher.publisherId) {
      throw moduleError('CONFLICT', `Namespace ${namespace} is already owned by ${existing.publisher_id}`)
    }
    const firstParty = manifest.trust.requestedLevel === 'firstParty' || manifest.license.status === 'firstParty'
    if (usesReservedNamespace(manifest.moduleId) && !firstParty) {
      throw moduleError('FORBIDDEN', `Reserved namespace ${namespace} requires first-party verification`)
    }
    await this.db
      .insertInto('greenfield_publisher_namespaces')
      .values({
        namespace,
        publisher_id: manifest.publisher.publisherId,
        verification_method: firstParty ? 'firstPartyPolicy' : 'manifestDeclaration',
        verification_evidence: firstParty ? {policy: 'Modula first-party publisher policy'} : {manifest: manifest.moduleId},
        verified_at: firstParty ? new Date() : null,
        revoked_at: null,
        created_at: new Date(),
      })
      .onConflict(oc =>
        oc.column('namespace').doUpdateSet({
          publisher_id: manifest.publisher.publisherId,
          revoked_at: null,
        }),
      )
      .execute()
  }

  async verifyPublisher(publisherId: string) {
    await this.db
      .updateTable('greenfield_publishers')
      .set({status: 'verified', verified_at: new Date(), updated_at: new Date()})
      .where('publisher_id', '=', publisherId)
      .execute()
    return this.getPublisher(publisherId)
  }

  async suspendPublisher(publisherId: string) {
    await this.db
      .updateTable('greenfield_publishers')
      .set({status: 'suspended', suspended_at: new Date(), updated_at: new Date()})
      .where('publisher_id', '=', publisherId)
      .execute()
    return this.getPublisher(publisherId)
  }

  async revokePublisher(publisherId: string) {
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_publishers')
        .set({status: 'revoked', revoked_at: now, updated_at: now})
        .where('publisher_id', '=', publisherId)
        .execute()
      await trx.updateTable('greenfield_publisher_namespaces').set({revoked_at: now}).where('publisher_id', '=', publisherId).execute()
    })
    return this.getPublisher(publisherId)
  }

  async requireAdminAccount(accountId: string): Promise<void> {
    const account = await this.db.selectFrom('greenfield_accounts').selectAll().where('account_id', '=', accountId).executeTakeFirst()
    const adminHandles = this.config?.adminHandles ?? []
    if (!account || !adminHandles.includes(account.primary_handle.toLowerCase())) {
      throw moduleError('FORBIDDEN', 'Administrative module registry capability required')
    }
  }
}
