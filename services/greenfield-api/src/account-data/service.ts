import {createHash} from 'node:crypto'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {sql} from 'kysely'
import type {Database} from '../database/types.js'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {GreenfieldEventBus} from '../events/domain-events.js'

export class GreenfieldAccountDataService {
  constructor(private readonly db: ModulaDb) {}

  async requestExport(accountId: string, idempotencyKey: string) { return this.createRequest(accountId, 'EXPORT', idempotencyKey, null) }
  async requestDeletion(accountId: string, idempotencyKey: string, recentAuth: {at: Date | null; strength: string}, confirmed: boolean) {
    if (!confirmed) invalid('Account deletion requires explicit confirmation')
    if (!recentAuth.at || Date.now() - recentAuth.at.getTime() > 10 * 60_000 || recentAuth.strength === 'low') forbidden('Recent step-up authentication is required')
    return this.createRequest(accountId, 'DELETE', idempotencyKey, recentAuth.strength)
  }

  async get(accountId: string, requestId: string) {
    const request = await this.ownedRequest(accountId, requestId)
    const domains = await this.db.selectFrom('greenfield_account_data_request_domains').selectAll().where('data_request_id', '=', requestId).orderBy('domain_key').execute()
    return {request, domains}
  }

  async artifacts(accountId: string, requestId: string) {
    const request = await this.ownedRequest(accountId, requestId)
    if (request.request_type !== 'EXPORT') invalid('Artifacts are only available for export requests')
    const rows = await this.db.selectFrom('greenfield_account_data_artifacts as a').innerJoin('greenfield_account_data_request_domains as d', 'd.data_request_domain_id', 'a.data_request_domain_id').select(['a.artifact_id','a.artifact_ref','a.sha256','a.media_type','a.byte_length','a.payload','a.expires_at','d.domain_key']).where('a.data_request_id', '=', requestId).orderBy('d.domain_key').execute()
    return {requestId, state: request.state, integrityManifest: request.integrity_manifest, artifacts: rows.map(row => ({artifactId: row.artifact_id, domainKey: row.domain_key, artifactRef: row.artifact_ref, sha256: row.sha256, mediaType: row.media_type, byteLength: Number(row.byte_length), expiresAt: row.expires_at?.toISOString() ?? null, payload: row.payload}))}
  }

  async advance(accountId: string, requestId: string) {
    const request = await this.ownedRequest(accountId, requestId)
    if (['COMPLETED','READY','CANCELLED','FAILED'].includes(request.state)) return this.get(accountId, requestId)
    if (request.request_type === 'EXPORT') await this.advanceExport(requestId, accountId)
    else await this.advanceDeletion(requestId, accountId, request.not_before!)
    return this.get(accountId, requestId)
  }

  async cancel(accountId: string, requestId: string) {
    const request = await this.ownedRequest(accountId, requestId)
    if (request.request_type !== 'DELETE' || !['WAITING_RETENTION','DELETING'].includes(request.state)) conflict('Deletion request cannot be cancelled')
    await this.db.updateTable('greenfield_account_data_requests').set({state: 'CANCELLED', cancelled_at: new Date(), updated_at: new Date()}).where('data_request_id', '=', requestId).execute()
    return this.get(accountId, requestId)
  }

  async claimServiceDomains(context: {accountId: string; productId: string; installationId: string; serviceId: string}, requestType: string, maxDomains = 10) {
    if (!['EXPORT','DELETE'].includes(requestType)) invalid('Invalid data request type')
    return this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_account_data_request_domains').set({state: 'PENDING', claimed_by_service_id: null, claim_expires_at: null, updated_at: new Date()}).where('product_id', '=', context.productId).where('installation_id', '=', context.installationId).where('state', '=', 'CLAIMED').where('claim_expires_at', '<', new Date()).execute()
      const rows = await trx.selectFrom('greenfield_account_data_request_domains as d').innerJoin('greenfield_account_data_requests as r', 'r.data_request_id', 'd.data_request_id').select(['d.data_request_domain_id','d.data_request_id','d.domain_key','d.handler','d.resource_id','r.request_type','r.created_at']).where('r.account_id', '=', context.accountId).where('r.request_type', '=', requestType as any).where('d.product_id', '=', context.productId).where('d.installation_id', '=', context.installationId).where('d.state', '=', 'PENDING').orderBy('d.created_at').limit(Math.max(1, Math.min(20, maxDomains))).forUpdate().skipLocked().execute()
      const expires = new Date(Date.now() + 5 * 60_000)
      for (const row of rows) await trx.updateTable('greenfield_account_data_request_domains').set({state: 'CLAIMED', claimed_by_service_id: context.serviceId, claim_expires_at: expires, updated_at: new Date()}).where('data_request_domain_id', '=', row.data_request_domain_id).execute()
      return rows.map(row => ({domainId: row.data_request_domain_id, requestId: row.data_request_id, requestType: row.request_type, domainKey: row.domain_key, resourceId: row.resource_id, handler: row.handler, requestedAt: row.created_at.toISOString(), leaseExpiresAt: expires.toISOString()}))
    })
  }

  async completeServiceDomain(context: {accountId: string; productId: string; installationId: string; serviceId: string}, domainId: string, requestType: string, input: Record<string, unknown>) {
    const row = await this.db.selectFrom('greenfield_account_data_request_domains as d').innerJoin('greenfield_account_data_requests as r', 'r.data_request_id', 'd.data_request_id').select(['d.data_request_id','d.state','d.claimed_by_service_id','d.product_id','d.installation_id','r.account_id','r.request_type']).where('d.data_request_domain_id', '=', domainId).executeTakeFirst()
    if (!row || row.account_id !== context.accountId || row.product_id !== context.productId || row.installation_id !== context.installationId) forbidden('Data request domain is outside the service assertion')
    if (row.request_type !== requestType || !['EXPORT','DELETE'].includes(requestType)) forbidden('Data request type is outside the service assertion operation')
    if (row.state !== 'CLAIMED' || row.claimed_by_service_id !== context.serviceId) conflict('Data request domain is not leased to this service')
    const state = String(input.state)
    if (!['SUCCEEDED','RETAINED','FAILED'].includes(state)) invalid('Invalid data domain result state')
    await this.db.transaction().execute(async trx => {
      if (row.request_type === 'EXPORT' && state === 'SUCCEEDED') {
        const artifactRef = required(input.artifactRef, 1_000, 'Export artifact reference is required')
        const digest = digestValue(input.sha256)
        await trx.insertInto('greenfield_account_data_artifacts').values({artifact_id: uuidv7(), data_request_id: row.data_request_id, data_request_domain_id: domainId, artifact_ref: artifactRef, sha256: digest, media_type: required(input.mediaType, 160, 'Artifact media type is required'), byte_length: integer(input.byteLength, 0, Number.MAX_SAFE_INTEGER), payload: null, created_at: new Date(), expires_at: dateValue(input.expiresAt)}).execute()
      }
      await trx.updateTable('greenfield_account_data_request_domains').set({state: state as any, retention_decision: state === 'RETAINED' ? 'RETAIN_POLICY' : state === 'SUCCEEDED' && row.request_type === 'DELETE' ? 'DELETE' : null, failure_code: state === 'FAILED' ? safeCode(input.failureCode) ?? 'PRODUCT_HANDLER_FAILED' : null, completed_at: new Date(), claim_expires_at: null, updated_at: new Date()}).where('data_request_domain_id', '=', domainId).execute()
    })
    await this.refresh(row.data_request_id)
    return {domainId, state}
  }

  private async createRequest(accountId: string, type: 'EXPORT' | 'DELETE', idempotencyKey: string, recentAuthStrength: string | null) {
    if (!idempotencyKey || idempotencyKey.length > 200) invalid('Idempotency key is required')
    const account = await this.db.selectFrom('greenfield_accounts').select('status').where('account_id', '=', accountId).executeTakeFirst()
    if (!account || account.status === 'deleted') notFound('Active account not found')
    const requestId = uuidv7(), now = new Date(), notBefore = type === 'DELETE' ? new Date(now.getTime() + 7 * 86_400_000) : null
    const inserted = await this.db.insertInto('greenfield_account_data_requests').values({data_request_id: requestId, account_id: accountId, request_type: type, state: type === 'EXPORT' ? 'DISCOVERING' : 'WAITING_RETENTION', idempotency_key: idempotencyKey, requested_by_account_id: accountId, recent_auth_strength: recentAuthStrength, integrity_manifest: null, not_before: notBefore, expires_at: type === 'EXPORT' ? new Date(now.getTime() + 7 * 86_400_000) : null, failure_code: null, created_at: now, updated_at: now, completed_at: null, cancelled_at: null}).onConflict(oc => oc.columns(['account_id','request_type','idempotency_key']).doNothing()).returningAll().executeTakeFirst()
    if (!inserted) return this.db.selectFrom('greenfield_account_data_requests').selectAll().where('account_id', '=', accountId).where('request_type', '=', type).where('idempotency_key', '=', idempotencyKey).executeTakeFirstOrThrow()
    const resources = await this.db.selectFrom('greenfield_data_resources as r').leftJoin('greenfield_data_retention_policies as p', 'p.resource_id', 'r.resource_id').select(['r.resource_id','r.product_id','r.installation_id','r.primary_storage_mode','r.export_handler','r.delete_handler','p.legal_hold','p.mode']).where('r.owner_account_id', '=', accountId).where('r.lifecycle_state', '!=', 'DELETED').execute()
    const domains = [{data_request_domain_id: uuidv7(), data_request_id: requestId, domain_key: 'greenfield.core', domain_kind: 'GREENFIELD_CORE' as const, product_id: null, installation_id: null, resource_id: null, handler: type === 'EXPORT' ? 'greenfield.account.export' : 'greenfield.account.delete', state: 'PENDING' as const, retention_decision: null, claimed_by_service_id: null, claim_expires_at: null, failure_code: null, created_at: now, updated_at: now, completed_at: null}, ...resources.map(resource => ({data_request_domain_id: uuidv7(), data_request_id: requestId, domain_key: `resource:${resource.resource_id}`, domain_kind: storageKind(resource.primary_storage_mode), product_id: resource.product_id, installation_id: resource.installation_id, resource_id: resource.resource_id, handler: type === 'EXPORT' ? resource.export_handler : resource.delete_handler, state: 'PENDING' as const, retention_decision: type === 'DELETE' && resource.legal_hold ? 'RETAIN_LEGAL_HOLD' as const : null, claimed_by_service_id: null, claim_expires_at: null, failure_code: null, created_at: now, updated_at: now, completed_at: null}))]
    await this.db.insertInto('greenfield_account_data_request_domains').values(domains).execute()
    await new AuditRepository(this.db).append(`account.${type.toLowerCase()}.requested`, {domainCount: domains.length, notBefore: notBefore?.toISOString() ?? null}, {type: 'accountDataRequest', id: requestId}, {accountId})
    return inserted
  }

  private async advanceExport(requestId: string, accountId: string) {
    const domains = await this.db.selectFrom('greenfield_account_data_request_domains').selectAll().where('data_request_id', '=', requestId).where('state', '=', 'PENDING').orderBy('domain_key').execute()
    for (const domain of domains) {
      if (domain.domain_kind === 'GREENFIELD_CORE') await this.exportCore(requestId, domain.data_request_domain_id, accountId)
      else if (domain.domain_kind === 'GREENFIELD_RECORDS') await this.exportRecords(requestId, domain, accountId)
    }
    await this.refresh(requestId)
  }

  private async exportCore(requestId: string, domainId: string, accountId: string) {
    const actorIds = (await this.db.selectFrom('actors').select('id').where('account_id', '=', accountId).execute()).map(row => row.id)
    const [account, identities, profiles, posts, comments, developer, products, connections, entitlements, usage] = await Promise.all([
      this.db.selectFrom('greenfield_accounts').select(['account_id','primary_handle','status','created_at','updated_at']).where('account_id', '=', accountId).executeTakeFirstOrThrow(),
      this.db.selectFrom('greenfield_auth_identities').select(['kind','identifier','verified_at','metadata','created_at']).where('account_id', '=', accountId).execute(),
      actorIds.length ? this.db.selectFrom('profiles').selectAll().where('actor_id', 'in', actorIds).execute() : [],
      actorIds.length ? this.db.selectFrom('posts').selectAll().where('author_actor_id', 'in', actorIds).execute() : [],
      actorIds.length ? this.db.selectFrom('greenfield_comments').selectAll().where('author_actor_id', 'in', actorIds).execute() : [],
      this.db.selectFrom('greenfield_developer_profiles').selectAll().where('account_id', '=', accountId).executeTakeFirst(),
      this.db.selectFrom('greenfield_developer_products').selectAll().where('owner_account_id', '=', accountId).execute(),
      this.db.selectFrom('greenfield_connections').select(['connection_id','provider_id','display_name','external_account_label','state','enabled','connected_at','revoked_at','created_at','updated_at']).where('account_id', '=', accountId).execute(),
      this.db.selectFrom('greenfield_entitlements').selectAll().where('owner_account_id', '=', accountId).execute(),
      this.db.selectFrom('greenfield_usage_events').selectAll().where('account_id', '=', accountId).execute(),
    ])
    await this.storeArtifact(requestId, domainId, 'greenfield.core', jsonSafe({account, identities, profiles, posts, comments, developer, products, connections, entitlements, usage}))
  }

  private async exportRecords(requestId: string, domain: Database['greenfield_account_data_request_domains'], accountId: string) {
    const records = await this.db.selectFrom('greenfield_module_records').select(['record_id','module_id','installation_id','collection','schema_ref','visibility','data','revision','created_at','updated_at','deleted_at']).where('account_id', '=', accountId).where('module_id', '=', domain.product_id!).execute()
    await this.storeArtifact(requestId, domain.data_request_domain_id, domain.domain_key, jsonSafe({productId: domain.product_id, resourceId: domain.resource_id, records}))
  }

  private async storeArtifact(requestId: string, domainId: string, domainKey: string, payload: unknown) {
    const encoded = canonicalJsonStringify(payload), digest = sha256(encoded), now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_account_data_artifacts').values({artifact_id: uuidv7(), data_request_id: requestId, data_request_domain_id: domainId, artifact_ref: `account-export://${requestId}/${encodeURIComponent(domainKey)}.json`, sha256: digest, media_type: 'application/json', byte_length: Buffer.byteLength(encoded), payload: sql<unknown>`${JSON.stringify(payload)}::jsonb`, created_at: now, expires_at: new Date(now.getTime() + 7 * 86_400_000)}).execute()
      await trx.updateTable('greenfield_account_data_request_domains').set({state: 'SUCCEEDED', retention_decision: 'NOT_APPLICABLE', updated_at: now, completed_at: now}).where('data_request_domain_id', '=', domainId).execute()
    })
  }

  private async advanceDeletion(requestId: string, accountId: string, notBefore: Date) {
    if (notBefore > new Date()) conflict('Account deletion retention window is still active')
    await this.db.updateTable('greenfield_account_data_requests').set({state: 'DELETING', updated_at: new Date()}).where('data_request_id', '=', requestId).execute()
    const domains = await this.db.selectFrom('greenfield_account_data_request_domains').selectAll().where('data_request_id', '=', requestId).where('state', '=', 'PENDING').orderBy('domain_key').execute()
    for (const domain of domains) {
      if (domain.retention_decision === 'RETAIN_LEGAL_HOLD') await this.retainDomain(domain)
      else if (domain.domain_kind === 'GREENFIELD_RECORDS') await this.deleteRecords(domain, accountId)
    }
    const outstanding = await this.db.selectFrom('greenfield_account_data_request_domains').select(({fn}) => fn.countAll().as('count')).where('data_request_id', '=', requestId).where('domain_kind', '!=', 'GREENFIELD_CORE').where('state', 'in', ['PENDING','CLAIMED','FAILED']).executeTakeFirstOrThrow()
    if (Number(outstanding.count) === 0) await this.deleteCore(requestId, accountId)
    await this.refresh(requestId)
  }

  private async retainDomain(domain: Database['greenfield_account_data_request_domains']) {
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      if (domain.resource_id) await trx.updateTable('greenfield_data_resources').set({lifecycle_state: 'RETAINED', updated_at: now}).where('resource_id', '=', domain.resource_id).execute()
      await trx.updateTable('greenfield_account_data_request_domains').set({state: 'RETAINED', completed_at: now, updated_at: now}).where('data_request_domain_id', '=', domain.data_request_domain_id).execute()
    })
  }

  private async deleteRecords(domain: Database['greenfield_account_data_request_domains'], accountId: string) {
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_module_records').set({deleted_at: now, updated_at: now}).where('account_id', '=', accountId).where('module_id', '=', domain.product_id!).where('deleted_at', 'is', null).execute()
      if (domain.resource_id) {
        await trx.updateTable('greenfield_data_resources').set({lifecycle_state: 'DELETED', deleted_at: now, updated_at: now}).where('resource_id', '=', domain.resource_id).execute()
        await trx.updateTable('greenfield_data_storage_bindings').set({state: 'RETIRED', retired_at: now, updated_at: now}).where('resource_id', '=', domain.resource_id).execute()
        await trx.updateTable('greenfield_data_resource_owners').set({released_at: now}).where('resource_id', '=', domain.resource_id).where('released_at', 'is', null).execute()
      }
      await trx.updateTable('greenfield_account_data_request_domains').set({state: 'SUCCEEDED', retention_decision: 'DELETE', completed_at: now, updated_at: now}).where('data_request_domain_id', '=', domain.data_request_domain_id).execute()
    })
  }

  private async deleteCore(requestId: string, accountId: string) {
    const core = await this.db.selectFrom('greenfield_account_data_request_domains').selectAll().where('data_request_id', '=', requestId).where('domain_kind', '=', 'GREENFIELD_CORE').executeTakeFirstOrThrow()
    if (core.state === 'SUCCEEDED') return
    const now = new Date(), actorIds = (await this.db.selectFrom('actors').select('id').where('account_id', '=', accountId).execute()).map(row => row.id)
    await this.db.transaction().execute(async trx => {
      if (actorIds.length) {
        await trx.updateTable('posts').set({text: null, deleted_at: now, updated_at: now}).where('author_actor_id', 'in', actorIds).execute()
        await trx.updateTable('profiles').set({display_name: 'Deleted account', bio: '', avatar_url: null, cover_url: null, location_label: null, website_label: null, website_url: null, website_domain: null, deleted_at: now, updated_at: now}).where('actor_id', 'in', actorIds).execute()
        await trx.updateTable('greenfield_comments').set({text: '', deleted_at: now, deletion_kind: 'user', updated_at: now}).where('author_actor_id', 'in', actorIds).execute()
        await trx.updateTable('greenfield_story_groups').set({deleted_at: now, updated_at: now}).where('owner_actor_id', 'in', actorIds).execute()
        await trx.updateTable('actors').set({deleted_at: now, updated_at: now}).where('id', 'in', actorIds).execute()
      }
      const connectionIds = (await trx.selectFrom('greenfield_connections').select('connection_id').where('account_id', '=', accountId).execute()).map(row => row.connection_id)
      if (connectionIds.length) await trx.deleteFrom('greenfield_connection_credentials').where('connection_id', 'in', connectionIds).execute()
      await trx.updateTable('greenfield_connections').set({state: 'revoked', enabled: false, revoked_at: now, revocation_reason: 'ACCOUNT_DELETION', revoked_by: 'service.greenfield-account-data', updated_at: now}).where('account_id', '=', accountId).execute()
      await trx.updateTable('greenfield_sessions').set({status: 'revoked', revoked_at: now}).where('account_id', '=', accountId).execute()
      await trx.updateTable('greenfield_session_tokens').set({revoked_at: now}).where('session_id', 'in', trx.selectFrom('greenfield_sessions').select('session_id').where('account_id', '=', accountId)).execute()
      await trx.updateTable('greenfield_developer_profiles').set({biography: '', website: null, status: 'CLOSED', updated_at: now}).where('account_id', '=', accountId).execute()
      await trx.updateTable('greenfield_developer_products').set({state: 'ARCHIVED', updated_at: now}).where('owner_account_id', '=', accountId).execute()
      await trx.deleteFrom('greenfield_email_verifications').where('account_id', '=', accountId).execute()
      await trx.deleteFrom('greenfield_recovery_tokens').where('account_id', '=', accountId).execute()
      await trx.deleteFrom('greenfield_recovery_codes').where('account_id', '=', accountId).execute()
      await trx.deleteFrom('greenfield_recovery_code_sets').where('account_id', '=', accountId).execute()
      await trx.deleteFrom('greenfield_external_identities').where('account_id', '=', accountId).execute()
      await trx.deleteFrom('greenfield_totp_credentials').where('account_id', '=', accountId).execute()
      await trx.deleteFrom('greenfield_passkeys').where('account_id', '=', accountId).execute()
      await trx.deleteFrom('greenfield_password_credentials').where('account_id', '=', accountId).execute()
      await trx.updateTable('greenfield_sessions').set({authentication_method_id: null}).where('account_id', '=', accountId).execute()
      await trx.deleteFrom('greenfield_authentication_methods').where('account_id', '=', accountId).execute()
      await trx.deleteFrom('greenfield_auth_identities').where('account_id', '=', accountId).execute()
      await trx.updateTable('greenfield_accounts').set({status: 'deleted', updated_at: now}).where('account_id', '=', accountId).execute()
      await trx.updateTable('greenfield_account_data_request_domains').set({state: 'SUCCEEDED', retention_decision: 'DELETE', completed_at: now, updated_at: now}).where('data_request_domain_id', '=', core.data_request_domain_id).execute()
      const retained = await trx.selectFrom('greenfield_account_data_request_domains').select(['domain_key','retention_decision']).where('data_request_id', '=', requestId).where('state', '=', 'RETAINED').execute()
      const manifestHash = sha256(canonicalJsonStringify({requestId, accountIdHash: sha256(accountId), retained: jsonSafe(retained), completedAt: now.toISOString()}))
      await trx.insertInto('greenfield_account_deletion_tombstones').values({account_id: accountId, data_request_id: requestId, retained_domains: sql<unknown>`${JSON.stringify(retained)}::jsonb`, deletion_manifest_sha256: manifestHash, completed_at: now}).execute()
      await new GreenfieldEventBus(trx).publish({eventType: 'account.deleted.v1', aggregateType: 'account', aggregateId: accountId, accountId, producerKind: 'service', producerId: 'service.greenfield-account-data', visibility: 'internal', classification: 'sensitive', idempotencyKey: `account-deleted:${requestId}`, payload: {requestId, retainedDomainCount: retained.length, deletionManifestSha256: manifestHash}, metadata: {source: 'greenfield.account-data'}})
    })
  }

  private async refresh(requestId: string) {
    const request = await this.db.selectFrom('greenfield_account_data_requests').selectAll().where('data_request_id', '=', requestId).executeTakeFirstOrThrow()
    const domains = await this.db.selectFrom('greenfield_account_data_request_domains').selectAll().where('data_request_id', '=', requestId).orderBy('domain_key').execute()
    if (domains.some(domain => domain.state === 'FAILED')) return this.db.updateTable('greenfield_account_data_requests').set({state: 'FAILED', failure_code: 'DOMAIN_FAILED', updated_at: new Date()}).where('data_request_id', '=', requestId).execute()
    const complete = domains.every(domain => ['SUCCEEDED','RETAINED','SKIPPED'].includes(domain.state))
    if (!complete) return this.db.updateTable('greenfield_account_data_requests').set({state: request.request_type === 'EXPORT' ? 'COLLECTING' : request.state, updated_at: new Date()}).where('data_request_id', '=', requestId).execute()
    const artifacts = await this.db.selectFrom('greenfield_account_data_artifacts as a').innerJoin('greenfield_account_data_request_domains as d', 'd.data_request_domain_id', 'a.data_request_domain_id').select(['d.domain_key','a.sha256','a.artifact_ref','a.byte_length']).where('a.data_request_id', '=', requestId).orderBy('d.domain_key').execute()
    const manifest = jsonSafe({requestId, accountIdHash: sha256(request.account_id), requestType: request.request_type, domains: domains.map(domain => ({domainKey: domain.domain_key, state: domain.state, retentionDecision: domain.retention_decision})), artifacts: artifacts.map(value => ({...value, byte_length: Number(value.byte_length)}))})
    await this.db.updateTable('greenfield_account_data_requests').set({state: request.request_type === 'EXPORT' ? 'READY' : 'COMPLETED', integrity_manifest: sql<unknown>`${JSON.stringify(manifest)}::jsonb`, completed_at: new Date(), updated_at: new Date()}).where('data_request_id', '=', requestId).execute()
    await new AuditRepository(this.db).append(`account.${request.request_type.toLowerCase()}.completed`, {domainCount: domains.length, retainedDomainCount: domains.filter(domain => domain.state === 'RETAINED').length}, {type: 'accountDataRequest', id: requestId}, {accountId: request.account_id})
  }

  private async ownedRequest(accountId: string, requestId: string) { const row = await this.db.selectFrom('greenfield_account_data_requests').selectAll().where('data_request_id', '=', requestId).where('account_id', '=', accountId).executeTakeFirst(); if (!row) notFound('Account data request not found'); return row }
}

function storageKind(mode: string): Database['greenfield_account_data_request_domains']['domain_kind'] { return mode === 'greenfield-records' ? 'GREENFIELD_RECORDS' : mode === 'object-storage' ? 'OBJECT_STORAGE' : mode === 'external-service' ? 'EXTERNAL_SERVICE' : 'MODULE_SERVICE' }
function jsonSafe(value: unknown): any { return JSON.parse(JSON.stringify(value)) }
function sha256(value: string) { return createHash('sha256').update(value).digest('hex') }
function required(value: unknown,max:number,message:string){const text=typeof value==='string'?value.trim():'';if(!text||text.length>max)invalid(message);return text}
function integer(value:unknown,min:number,max:number){const number=Number(value);if(!Number.isSafeInteger(number)||number<min||number>max)invalid('Invalid integer');return number}
function digestValue(value:unknown){const text=String(value??'');if(!/^[0-9a-f]{64}$/.test(text))invalid('Invalid SHA-256');return text}
function dateValue(value:unknown){if(value==null)return null;const date=new Date(String(value));if(Number.isNaN(date.getTime()))invalid('Invalid date');return date}
function safeCode(value:unknown){const text=typeof value==='string'?value.trim():'';return /^[A-Z][A-Z0-9_]{1,80}$/.test(text)?text:null}
function invalid(message:string):never{throw Object.assign(new Error(message),{code:'VALIDATION_FAILED'})}
function forbidden(message:string):never{throw Object.assign(new Error(message),{code:'FORBIDDEN'})}
function conflict(message:string):never{throw Object.assign(new Error(message),{code:'CONFLICT'})}
function notFound(message:string):never{throw Object.assign(new Error(message),{code:'NOT_FOUND'})}
