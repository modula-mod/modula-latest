import type {GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
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

  async ensurePublisherForManifest(manifest: GreenfieldModuleManifest): Promise<void> {
    const now = new Date()
    const claimsFirstParty = manifest.trust.requestedLevel === 'firstParty' || manifest.license.status === 'firstParty'
    const reserved = usesReservedNamespace(manifest.moduleId)
    const existing = await this.getPublisher(manifest.publisher.publisherId)
    if (!existing) {
      if (claimsFirstParty || reserved) throw moduleError('FORBIDDEN', 'First-party publishers and reserved namespaces must be pre-authorized by registry policy')
      await this.db.insertInto('greenfield_publishers').values({
        publisher_id: manifest.publisher.publisherId,
        display_name: manifest.publisher.displayName,
        website: manifest.publisher.website ?? null,
        status: 'pending',
        trust_level: 'untrustedManifest',
        created_at: now,
        updated_at: now,
        verified_at: null,
        suspended_at: null,
        revoked_at: null,
      }).execute()
    } else {
      const authoritativeFirstParty = existing.status === 'verified' && existing.trust_level === 'firstParty' && !existing.revoked_at
      if ((claimsFirstParty || reserved) && !authoritativeFirstParty) {
        throw moduleError('FORBIDDEN', 'Manifest claims cannot grant first-party trust or reserved namespace authority')
      }
      await this.db.updateTable('greenfield_publishers').set({
        display_name: manifest.publisher.displayName,
        website: manifest.publisher.website ?? null,
        updated_at: now,
      }).where('publisher_id', '=', manifest.publisher.publisherId).execute()
    }

    await this.ensureNamespace(manifest)
  }

  async ensureNamespace(manifest: GreenfieldModuleManifest): Promise<void> {
    const namespace = getNamespacePrefix(manifest.moduleId)
    const existing = await this.db
      .selectFrom('greenfield_publisher_namespaces')
      .selectAll()
      .where('namespace', '=', namespace)
      .executeTakeFirst()
    if (existing && existing.publisher_id !== manifest.publisher.publisherId) {
      throw moduleError('CONFLICT', `Namespace ${namespace} is already owned by ${existing.publisher_id}`)
    }
    if (existing?.revoked_at) throw moduleError('FORBIDDEN', `Namespace ${namespace} is revoked and requires registry review`)
    const publisher = await this.getPublisher(manifest.publisher.publisherId)
    const authoritativeFirstParty = publisher?.status === 'verified' && publisher.trust_level === 'firstParty' && !publisher.revoked_at
    const claimsFirstParty = manifest.trust.requestedLevel === 'firstParty' || manifest.license.status === 'firstParty'
    if (claimsFirstParty && !authoritativeFirstParty) {
      throw moduleError('FORBIDDEN', 'Manifest claims cannot grant first-party trust')
    }
    if (usesReservedNamespace(manifest.moduleId)) {
      if (!authoritativeFirstParty || !existing || !existing.verified_at || existing.publisher_id !== manifest.publisher.publisherId) {
        throw moduleError('FORBIDDEN', `Reserved namespace ${namespace} requires authoritative registry policy`)
      }
      return
    }
    if (existing) return
    await this.db
      .insertInto('greenfield_publisher_namespaces')
      .values({
        namespace,
        publisher_id: manifest.publisher.publisherId,
        verification_method: 'manifestDeclaration',
        verification_evidence: {manifest: manifest.moduleId},
        verified_at: null,
        revoked_at: null,
        created_at: new Date(),
      })
      .onConflict(oc => oc.column('namespace').doNothing())
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
