import {sql, type Transaction} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import type {
  Database,
  GreenfieldDataBackupMode,
  GreenfieldDataBackupResponsibility,
  GreenfieldDataEncryptionClassification,
  GreenfieldDataMigrationState,
  GreenfieldDataRetentionMode,
  GreenfieldDataSchemaCompatibility,
  GreenfieldDataStorageBindingState,
  GreenfieldDataStorageMode,
} from '../database/types.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from '../modules/module-errors.js'
import {GreenfieldModuleRuntimeAccessService} from '../modules/runtime-access.js'
import {resolveCanonicalModuleId} from '@modula/greenfield-contracts'

type Db = ModulaDb | Transaction<Database>

export type DataStorageBindingInput = {
  bindingId?: string
  storageMode: GreenfieldDataStorageMode
  serviceId?: string | null
  locatorRef: string
  credentialRef?: string | null
  encryptionClassification?: GreenfieldDataEncryptionClassification
  state?: GreenfieldDataStorageBindingState
  metadata?: Record<string, unknown>
}

export type RegisterDataResourceInput = {
  resourceId?: string
  resourceKey: string
  installationId?: string
  releaseId?: string
  schemaId: string
  schemaVersion: string
  schemaDefinitionSha256?: string | null
  schemaCompatibility?: GreenfieldDataSchemaCompatibility
  primaryStorageMode: GreenfieldDataStorageMode
  storageBindings: DataStorageBindingInput[]
  backendServiceId?: string | null
  retention: {
    mode: GreenfieldDataRetentionMode
    ttlDays?: number | null
    legalHold?: boolean
    policyVersion: string
    metadata?: Record<string, unknown>
  }
  backup: {
    responsibility: GreenfieldDataBackupResponsibility
    mode: GreenfieldDataBackupMode
    scheduleRef?: string | null
    recoveryPointObjectiveSeconds?: number | null
    recoveryTimeObjectiveSeconds?: number | null
    metadata?: Record<string, unknown>
  }
  exportHandler: string
  deleteHandler: string
  encryptionClassification: GreenfieldDataEncryptionClassification
  idempotencyKey: string
  requestId?: string
}

export type RecordDataMigrationInput = {
  migrationId: string
  fromVersion: string
  toVersion: string
  migrationSha256: string
  reversible: boolean
  state: GreenfieldDataMigrationState
  attempt: number
  auditRef: string
  errorClass?: string | null
  startedAt?: Date | null
  finishedAt?: Date | null
  requestId?: string
}

export type DeclareDataSchemaVersionInput = {
  schemaId: string
  version: string
  definitionSha256: string
  compatibility: GreenfieldDataSchemaCompatibility
  requestId?: string
}

export class GreenfieldDataLedgerService {
  private readonly runtimeAccess: GreenfieldModuleRuntimeAccessService

  constructor(private readonly db: ModulaDb) {
    this.runtimeAccess = new GreenfieldModuleRuntimeAccessService(db)
  }

  async register(accountId: string, productId: string, input: RegisterDataResourceInput) {
    validateRegistration(productId, input)
    const context = await this.runtimeAccess.resolve(accountId, productId, {requireEnabled: false})
    if (input.installationId && input.installationId !== context.installationId) {
      throw moduleError('FORBIDDEN', 'Data resource installation is outside the product scope')
    }
    if (input.releaseId && input.releaseId !== context.releaseId) {
      throw moduleError('FORBIDDEN', 'Data resource release is outside the installed release scope')
    }

    const previous = await this.db
      .selectFrom('greenfield_data_resources')
      .select(['resource_id', 'resource_key'])
      .where('owner_account_id', '=', accountId)
      .where('product_id', '=', context.moduleId)
      .where('idempotency_key', '=', input.idempotencyKey)
      .executeTakeFirst()
    if (previous) {
      if (previous.resource_key !== input.resourceKey) throw moduleError('CONFLICT', 'Idempotency key belongs to another data resource')
      return this.get(accountId, context.moduleId, previous.resource_id)
    }

    let resourceId = input.resourceId ?? `data-resource:${uuidv7()}`
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      const existing = await trx
        .selectFrom('greenfield_data_resources')
        .select(['resource_id'])
        .where('installation_id', '=', context.installationId)
        .where('resource_key', '=', input.resourceKey)
        .executeTakeFirst()
      const effectiveResourceId = existing?.resource_id ?? resourceId
      resourceId = effectiveResourceId
      if (existing && input.resourceId && input.resourceId !== existing.resource_id) {
        throw moduleError('CONFLICT', 'Resource key is already registered with another resource ID')
      }

      if (existing) {
        await trx
          .updateTable('greenfield_data_resources')
          .set({
            release_id: context.releaseId,
            schema_id: input.schemaId,
            schema_version: input.schemaVersion,
            primary_storage_mode: input.primaryStorageMode,
            backend_service_id: input.backendServiceId ?? null,
            export_handler: input.exportHandler,
            delete_handler: input.deleteHandler,
            encryption_classification: input.encryptionClassification,
            lifecycle_state: 'ACTIVE',
            deleted_at: null,
            updated_at: now,
          })
          .where('resource_id', '=', effectiveResourceId)
          .execute()
      } else {
        await trx
          .insertInto('greenfield_data_resources')
          .values({
            resource_id: effectiveResourceId,
            resource_key: input.resourceKey,
            owner_account_id: accountId,
            product_id: context.moduleId,
            installation_id: context.installationId,
            release_id: context.releaseId,
            schema_id: input.schemaId,
            schema_version: input.schemaVersion,
            primary_storage_mode: input.primaryStorageMode,
            backend_service_id: input.backendServiceId ?? null,
            export_handler: input.exportHandler,
            delete_handler: input.deleteHandler,
            encryption_classification: input.encryptionClassification,
            lifecycle_state: 'ACTIVE',
            idempotency_key: input.idempotencyKey,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          })
          .execute()
      }

      await upsertOwner(trx, effectiveResourceId, accountId, context.moduleId, now)
      await upsertSchemaVersion(trx, effectiveResourceId, context.releaseId, input, now)
      await upsertBindings(trx, effectiveResourceId, input, now)
      await upsertRetention(trx, effectiveResourceId, input, now)
      await upsertBackup(trx, effectiveResourceId, input, now)
      await new AuditRepository(trx).append(
        existing ? 'data.resource.reconciled' : 'data.resource.registered',
        {
          productId: context.moduleId,
          installationId: context.installationId,
          releaseId: context.releaseId,
          resourceKey: input.resourceKey,
          schemaId: input.schemaId,
          schemaVersion: input.schemaVersion,
          storageModes: input.storageBindings.map(binding => binding.storageMode),
        },
        {type: 'dataResource', id: effectiveResourceId},
        {accountId, requestId: input.requestId ?? null},
      )
    })
    return this.get(accountId, context.moduleId, resourceId)
  }

  async list(accountId: string, productId: string, input: {installationId?: string; cursor?: string; limit?: number} = {}) {
    const canonicalProductId = resolveCanonicalModuleId(productId)
    const limit = Math.max(1, Math.min(input.limit ?? 50, 100))
    const offset = cursorOffset(input.cursor)
    let query = this.db
      .selectFrom('greenfield_data_resources')
      .select(['resource_id'])
      .where('owner_account_id', '=', accountId)
      .where('product_id', '=', canonicalProductId)
    if (input.installationId) query = query.where('installation_id', '=', input.installationId)
    const rows = await query
      .orderBy('created_at', 'asc')
      .orderBy('resource_id', 'asc')
      .limit(limit + 1)
      .offset(offset)
      .execute()
    const items = await Promise.all(rows.slice(0, limit).map(row => this.get(accountId, canonicalProductId, row.resource_id)))
    return {items, nextCursor: rows.length > limit ? String(offset + limit) : null}
  }

  async get(accountId: string, productId: string, resourceId: string) {
    const canonicalProductId = resolveCanonicalModuleId(productId)
    const resource = await this.db
      .selectFrom('greenfield_data_resources')
      .selectAll()
      .where('resource_id', '=', resourceId)
      .where('owner_account_id', '=', accountId)
      .where('product_id', '=', canonicalProductId)
      .executeTakeFirst()
    if (!resource) throw moduleError('NOT_FOUND', 'Data resource not found')
    const [owners, bindings, schemas, retention, backup] = await Promise.all([
      this.db.selectFrom('greenfield_data_resource_owners').selectAll().where('resource_id', '=', resourceId).orderBy('created_at', 'asc').execute(),
      this.db.selectFrom('greenfield_data_storage_bindings').selectAll().where('resource_id', '=', resourceId).orderBy('created_at', 'asc').execute(),
      this.db.selectFrom('greenfield_data_schema_versions').selectAll().where('resource_id', '=', resourceId).orderBy('declared_at', 'asc').execute(),
      this.db.selectFrom('greenfield_data_retention_policies').selectAll().where('resource_id', '=', resourceId).executeTakeFirst(),
      this.db.selectFrom('greenfield_data_backup_policies').selectAll().where('resource_id', '=', resourceId).executeTakeFirst(),
    ])
    return {
      resourceId: resource.resource_id,
      resourceKey: resource.resource_key,
      ownerAccountId: resource.owner_account_id,
      owningProductId: resource.product_id,
      installationId: resource.installation_id,
      releaseId: resource.release_id,
      schemaId: resource.schema_id,
      schemaVersion: resource.schema_version,
      primaryStorageMode: resource.primary_storage_mode,
      storageModes: Array.from(new Set(bindings.map(binding => binding.storage_mode))),
      storageBindings: bindings.map(binding => ({
        bindingId: binding.binding_id,
        storageMode: binding.storage_mode,
        serviceId: binding.service_id,
        locatorRef: binding.locator_ref,
        credentialRef: binding.credential_ref,
        encryptionClassification: binding.encryption_classification,
        state: binding.state,
        metadata: binding.metadata,
        createdAt: binding.created_at.toISOString(),
        updatedAt: binding.updated_at.toISOString(),
        retiredAt: binding.retired_at?.toISOString() ?? null,
      })),
      backendServiceId: resource.backend_service_id,
      retentionPolicyId: retention?.retention_policy_id ?? null,
      retentionPolicy: retention ? {
        mode: retention.mode,
        ttlDays: retention.ttl_days,
        legalHold: retention.legal_hold,
        policyVersion: retention.policy_version,
        metadata: retention.metadata,
      } : null,
      backupPolicyId: backup?.backup_policy_id ?? null,
      backupPolicy: backup ? {
        responsibility: backup.responsibility,
        mode: backup.mode,
        scheduleRef: backup.schedule_ref,
        recoveryPointObjectiveSeconds: backup.recovery_point_objective_seconds,
        recoveryTimeObjectiveSeconds: backup.recovery_time_objective_seconds,
        lastBackupRef: backup.last_backup_ref,
        lastBackupAt: backup.last_backup_at?.toISOString() ?? null,
        lastRestoreTestAt: backup.last_restore_test_at?.toISOString() ?? null,
        metadata: backup.metadata,
      } : null,
      schemaVersions: schemas.map(schema => ({
        schemaVersionId: schema.schema_version_id,
        schemaId: schema.schema_id,
        version: schema.version,
        definitionSha256: schema.definition_sha256,
        compatibility: schema.compatibility,
        releaseId: schema.release_id,
        state: schema.state,
        declaredAt: schema.declared_at.toISOString(),
        activatedAt: schema.activated_at?.toISOString() ?? null,
        supersededAt: schema.superseded_at?.toISOString() ?? null,
      })),
      owners: owners.map(owner => ({
        ownerBindingId: owner.owner_binding_id,
        accountId: owner.account_id,
        ownerRole: owner.owner_role,
        provenance: owner.provenance,
        createdAt: owner.created_at.toISOString(),
        releasedAt: owner.released_at?.toISOString() ?? null,
      })),
      exportHandler: resource.export_handler,
      deleteHandler: resource.delete_handler,
      encryptionClassification: resource.encryption_classification,
      lifecycleState: resource.lifecycle_state,
      createdAt: resource.created_at.toISOString(),
      updatedAt: resource.updated_at.toISOString(),
      deletedAt: resource.deleted_at?.toISOString() ?? null,
    }
  }

  async declareSchemaVersion(accountId: string, productId: string, resourceId: string, input: DeclareDataSchemaVersionInput) {
    validateNamespaced(input.schemaId, productId, 'schema ID')
    if (!input.version || input.version.length > 80) throw moduleError('VALIDATION_FAILED', 'Schema version is required')
    if (!/^[0-9a-f]{64}$/.test(input.definitionSha256)) throw moduleError('VALIDATION_FAILED', 'Schema checksum must be lowercase SHA-256')
    const resource = await this.get(accountId, productId, resourceId)
    const context = await this.runtimeAccess.resolve(accountId, productId, {requireEnabled: false})
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_data_schema_versions')
        .values({
          schema_version_id: `data-schema:${resourceId}:${input.version}`,
          resource_id: resourceId,
          schema_id: input.schemaId,
          version: input.version,
          definition_sha256: input.definitionSha256,
          compatibility: input.compatibility,
          release_id: context.releaseId,
          state: input.version === resource.schemaVersion ? 'ACTIVE' : 'DECLARED',
          declared_at: now,
          activated_at: input.version === resource.schemaVersion ? now : null,
          superseded_at: null,
        })
        .onConflict(conflict => conflict.columns(['resource_id', 'version']).doUpdateSet({
          schema_id: input.schemaId,
          definition_sha256: input.definitionSha256,
          compatibility: input.compatibility,
          release_id: context.releaseId,
        }))
        .execute()
      await new AuditRepository(trx).append(
        'data.resource.schema.declared',
        {productId, schemaId: input.schemaId, version: input.version, compatibility: input.compatibility},
        {type: 'dataResource', id: resourceId},
        {accountId, requestId: input.requestId ?? null},
      )
    })
    return this.get(accountId, productId, resourceId)
  }

  async recordMigration(accountId: string, productId: string, resourceId: string, input: RecordDataMigrationInput) {
    validateMigration(input)
    const resource = await this.get(accountId, productId, resourceId)
    const existing = await this.db
      .selectFrom('greenfield_data_migration_history')
      .selectAll()
      .where('resource_id', '=', resourceId)
      .where('migration_id', '=', input.migrationId)
      .where('attempt', '=', input.attempt)
      .executeTakeFirst()
    if (existing) return migrationView(existing)

    const migrationHistoryId = `data-migration:${uuidv7()}`
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_data_migration_history')
        .values({
          migration_history_id: migrationHistoryId,
          resource_id: resourceId,
          migration_id: input.migrationId,
          from_version: input.fromVersion,
          to_version: input.toVersion,
          migration_sha256: input.migrationSha256,
          reversible: input.reversible,
          state: input.state,
          attempt: input.attempt,
          audit_ref: input.auditRef,
          error_class: input.errorClass ?? null,
          started_at: input.startedAt ?? null,
          finished_at: input.finishedAt ?? null,
          created_at: new Date(),
        })
        .execute()
      if (input.state === 'SUCCEEDED') {
        const schema = await trx
          .selectFrom('greenfield_data_schema_versions')
          .select(['schema_version_id'])
          .where('resource_id', '=', resourceId)
          .where('version', '=', input.toVersion)
          .executeTakeFirst()
        if (!schema) throw moduleError('VALIDATION_FAILED', 'Successful migration target schema is not declared')
        const now = input.finishedAt ?? new Date()
        await trx
          .updateTable('greenfield_data_schema_versions')
          .set({state: 'SUPERSEDED', superseded_at: now})
          .where('resource_id', '=', resourceId)
          .where('state', '=', 'ACTIVE')
          .where('version', '!=', input.toVersion)
          .execute()
        await trx
          .updateTable('greenfield_data_schema_versions')
          .set({state: 'ACTIVE', activated_at: now, superseded_at: null})
          .where('schema_version_id', '=', schema.schema_version_id)
          .execute()
        await trx
          .updateTable('greenfield_data_resources')
          .set({schema_version: input.toVersion, updated_at: now})
          .where('resource_id', '=', resourceId)
          .execute()
      }
      await new AuditRepository(trx).append(
        'data.resource.migration.recorded',
        {
          productId,
          migrationId: input.migrationId,
          fromVersion: input.fromVersion,
          toVersion: input.toVersion,
          state: input.state,
          attempt: input.attempt,
          reversible: input.reversible,
        },
        {type: 'dataResource', id: resource.resourceId},
        {accountId, requestId: input.requestId ?? null, result: input.state === 'FAILED' ? 'failed' : 'succeeded'},
      )
    })
    const row = await this.db.selectFrom('greenfield_data_migration_history').selectAll().where('migration_history_id', '=', migrationHistoryId).executeTakeFirstOrThrow()
    return migrationView(row)
  }
}

async function upsertOwner(trx: Db, resourceId: string, accountId: string, productId: string, now: Date) {
  await trx
    .insertInto('greenfield_data_resource_owners')
    .values({
      owner_binding_id: `data-owner:${resourceId}:${accountId}`,
      resource_id: resourceId,
      account_id: accountId,
      owner_role: 'primary',
      provenance: `product-installation:${productId}`,
      created_at: now,
      released_at: null,
    })
    .onConflict(conflict => conflict.columns(['resource_id', 'account_id', 'owner_role']).doUpdateSet({released_at: null}))
    .execute()
}

async function upsertSchemaVersion(trx: Db, resourceId: string, releaseId: string, input: RegisterDataResourceInput, now: Date) {
  await trx
    .updateTable('greenfield_data_schema_versions')
    .set({state: 'SUPERSEDED', superseded_at: now})
    .where('resource_id', '=', resourceId)
    .where('state', '=', 'ACTIVE')
    .where('version', '!=', input.schemaVersion)
    .execute()
  await trx
    .insertInto('greenfield_data_schema_versions')
    .values({
      schema_version_id: `data-schema:${resourceId}:${input.schemaVersion}`,
      resource_id: resourceId,
      schema_id: input.schemaId,
      version: input.schemaVersion,
      definition_sha256: input.schemaDefinitionSha256 ?? null,
      compatibility: input.schemaCompatibility ?? 'UNSPECIFIED',
      release_id: releaseId,
      state: 'ACTIVE',
      declared_at: now,
      activated_at: now,
      superseded_at: null,
    })
    .onConflict(conflict => conflict.columns(['resource_id', 'version']).doUpdateSet({
      schema_id: input.schemaId,
      definition_sha256: input.schemaDefinitionSha256 ?? null,
      compatibility: input.schemaCompatibility ?? 'UNSPECIFIED',
      release_id: releaseId,
      state: 'ACTIVE',
      activated_at: now,
      superseded_at: null,
    }))
    .execute()
}

async function upsertBindings(trx: Db, resourceId: string, input: RegisterDataResourceInput, now: Date) {
  const activeLocators = input.storageBindings.map(binding => binding.locatorRef)
  if (activeLocators.length > 0) {
    await trx
      .updateTable('greenfield_data_storage_bindings')
      .set({state: 'RETIRED', retired_at: now, updated_at: now})
      .where('resource_id', '=', resourceId)
      .where('locator_ref', 'not in', activeLocators)
      .where('state', '!=', 'RETIRED')
      .execute()
  }
  for (const binding of input.storageBindings) {
    const bindingId = binding.bindingId ?? `data-binding:${uuidv7()}`
    await trx
      .insertInto('greenfield_data_storage_bindings')
      .values({
        binding_id: bindingId,
        resource_id: resourceId,
        storage_mode: binding.storageMode,
        service_id: binding.serviceId ?? null,
        locator_ref: binding.locatorRef,
        credential_ref: binding.credentialRef ?? null,
        encryption_classification: binding.encryptionClassification ?? input.encryptionClassification,
        state: binding.state ?? 'ACTIVE',
        metadata: jsonb(binding.metadata ?? {}),
        created_at: now,
        updated_at: now,
        retired_at: binding.state === 'RETIRED' ? now : null,
      })
      .onConflict(conflict => conflict.columns(['resource_id', 'storage_mode', 'locator_ref']).doUpdateSet({
        service_id: binding.serviceId ?? null,
        credential_ref: binding.credentialRef ?? null,
        encryption_classification: binding.encryptionClassification ?? input.encryptionClassification,
        state: binding.state ?? 'ACTIVE',
        metadata: jsonb(binding.metadata ?? {}),
        updated_at: now,
        retired_at: binding.state === 'RETIRED' ? now : null,
      }))
      .execute()
  }
}

async function upsertRetention(trx: Db, resourceId: string, input: RegisterDataResourceInput, now: Date) {
  await trx
    .insertInto('greenfield_data_retention_policies')
    .values({
      retention_policy_id: `data-retention:${resourceId}`,
      resource_id: resourceId,
      mode: input.retention.mode,
      ttl_days: input.retention.mode === 'TTL' ? input.retention.ttlDays ?? null : null,
      legal_hold: input.retention.legalHold ?? false,
      policy_version: input.retention.policyVersion,
      metadata: jsonb(input.retention.metadata ?? {}),
      created_at: now,
      updated_at: now,
    })
    .onConflict(conflict => conflict.column('resource_id').doUpdateSet({
      mode: input.retention.mode,
      ttl_days: input.retention.mode === 'TTL' ? input.retention.ttlDays ?? null : null,
      legal_hold: input.retention.legalHold ?? false,
      policy_version: input.retention.policyVersion,
      metadata: jsonb(input.retention.metadata ?? {}),
      updated_at: now,
    }))
    .execute()
}

async function upsertBackup(trx: Db, resourceId: string, input: RegisterDataResourceInput, now: Date) {
  await trx
    .insertInto('greenfield_data_backup_policies')
    .values({
      backup_policy_id: `data-backup:${resourceId}`,
      resource_id: resourceId,
      responsibility: input.backup.responsibility,
      mode: input.backup.mode,
      schedule_ref: input.backup.scheduleRef ?? null,
      recovery_point_objective_seconds: input.backup.recoveryPointObjectiveSeconds ?? null,
      recovery_time_objective_seconds: input.backup.recoveryTimeObjectiveSeconds ?? null,
      last_backup_ref: null,
      last_backup_at: null,
      last_restore_test_at: null,
      metadata: jsonb(input.backup.metadata ?? {}),
      created_at: now,
      updated_at: now,
    })
    .onConflict(conflict => conflict.column('resource_id').doUpdateSet({
      responsibility: input.backup.responsibility,
      mode: input.backup.mode,
      schedule_ref: input.backup.scheduleRef ?? null,
      recovery_point_objective_seconds: input.backup.recoveryPointObjectiveSeconds ?? null,
      recovery_time_objective_seconds: input.backup.recoveryTimeObjectiveSeconds ?? null,
      metadata: jsonb(input.backup.metadata ?? {}),
      updated_at: now,
    }))
    .execute()
}

function validateRegistration(productId: string, input: RegisterDataResourceInput) {
  if (!input.idempotencyKey || input.idempotencyKey.length > 240) throw moduleError('VALIDATION_FAILED', 'Data resource idempotency key is required')
  validateNamespaced(input.resourceKey, productId, 'resource key')
  validateNamespaced(input.schemaId, productId, 'schema ID')
  validateNamespaced(input.exportHandler, productId, 'export handler')
  validateNamespaced(input.deleteHandler, productId, 'delete handler')
  if (!input.schemaVersion || input.schemaVersion.length > 80) throw moduleError('VALIDATION_FAILED', 'Schema version is required')
  if (input.schemaDefinitionSha256 && !/^[0-9a-f]{64}$/.test(input.schemaDefinitionSha256)) throw moduleError('VALIDATION_FAILED', 'Schema checksum must be lowercase SHA-256')
  if (!Array.isArray(input.storageBindings) || input.storageBindings.length < 1 || input.storageBindings.length > 8) throw moduleError('VALIDATION_FAILED', 'One to eight storage bindings are required')
  if (!input.storageBindings.some(binding => binding.storageMode === input.primaryStorageMode)) throw moduleError('VALIDATION_FAILED', 'Primary storage mode must have a binding')
  if (input.retention.mode === 'TTL' && (!Number.isInteger(input.retention.ttlDays) || Number(input.retention.ttlDays) < 1)) throw moduleError('VALIDATION_FAILED', 'TTL retention requires positive ttlDays')
  for (const binding of input.storageBindings) validateBinding(binding)
  rejectSecretMaterial(input.retention.metadata)
  rejectSecretMaterial(input.backup.metadata)
}

function validateBinding(binding: DataStorageBindingInput) {
  if (!/^(greenfield|storage|postgres|object|service):\/\/[A-Za-z0-9._:/-]+$/.test(binding.locatorRef)) {
    throw moduleError('VALIDATION_FAILED', 'Storage locator must be an opaque approved binding reference')
  }
  if (binding.credentialRef && !/^secret:\/\/[a-z0-9._/-]+$/.test(binding.credentialRef)) {
    throw moduleError('VALIDATION_FAILED', 'Storage credential must use a secret handle')
  }
  if (binding.storageMode === 'dedicated-postgres' && !binding.locatorRef.startsWith('postgres://binding/')) {
    throw moduleError('VALIDATION_FAILED', 'Dedicated PostgreSQL must use an opaque postgres binding reference')
  }
  if (binding.storageMode === 'external-service' && !binding.serviceId) {
    throw moduleError('VALIDATION_FAILED', 'External service storage requires a service identity')
  }
  rejectSecretMaterial(binding.metadata)
}

function validateMigration(input: RecordDataMigrationInput) {
  if (!input.migrationId || input.migrationId.length > 240) throw moduleError('VALIDATION_FAILED', 'Migration ID is required')
  if (!input.fromVersion || !input.toVersion || input.fromVersion === input.toVersion) throw moduleError('VALIDATION_FAILED', 'Migration versions must be distinct')
  if (!/^[0-9a-f]{64}$/.test(input.migrationSha256)) throw moduleError('VALIDATION_FAILED', 'Migration checksum must be lowercase SHA-256')
  if (!Number.isInteger(input.attempt) || input.attempt < 1) throw moduleError('VALIDATION_FAILED', 'Migration attempt must be positive')
  if (!input.auditRef) throw moduleError('VALIDATION_FAILED', 'Migration audit reference is required')
  if (input.state === 'FAILED' && !input.errorClass) throw moduleError('VALIDATION_FAILED', 'Failed migration requires an error class')
}

function validateNamespaced(value: string, productId: string, label: string) {
  if (!value || value.length > 240 || (value !== productId && !value.startsWith(`${productId}.`))) {
    throw moduleError('VALIDATION_FAILED', `Data ${label} must stay in the product namespace`)
  }
}

const SECRET_KEY_PATTERN = /(password|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|api[_-]?key|credential|secret)/i
const SECRET_VALUE_PATTERN = /^(sk-[A-Za-z0-9_-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/

function rejectSecretMaterial(input: unknown, depth = 0) {
  if (input === undefined || input === null) return
  if (depth > 6) throw moduleError('VALIDATION_FAILED', 'Data ledger metadata is too deeply nested')
  if (typeof input === 'string') {
    if (SECRET_VALUE_PATTERN.test(input)) throw moduleError('VALIDATION_FAILED', 'Plaintext secret material is forbidden in the data ledger')
    return
  }
  if (Array.isArray(input)) {
    for (const value of input) rejectSecretMaterial(value, depth + 1)
    return
  }
  if (typeof input !== 'object') return
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(key)) throw moduleError('VALIDATION_FAILED', 'Secret-shaped metadata keys are forbidden in the data ledger')
    rejectSecretMaterial(value, depth + 1)
  }
}

function cursorOffset(cursor?: string): number {
  if (!cursor) return 0
  if (!/^\d+$/.test(cursor)) throw moduleError('VALIDATION_FAILED', 'Invalid data resource cursor')
  const value = Number(cursor)
  if (!Number.isSafeInteger(value) || value < 0) throw moduleError('VALIDATION_FAILED', 'Invalid data resource cursor')
  return value
}

function migrationView(row: Database['greenfield_data_migration_history']) {
  return {
    migrationHistoryId: row.migration_history_id,
    resourceId: row.resource_id,
    migrationId: row.migration_id,
    fromVersion: row.from_version,
    toVersion: row.to_version,
    migrationSha256: row.migration_sha256,
    reversible: row.reversible,
    state: row.state,
    attempt: row.attempt,
    auditRef: row.audit_ref,
    errorClass: row.error_class,
    startedAt: row.started_at?.toISOString() ?? null,
    finishedAt: row.finished_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  }
}

function jsonb(value: unknown) {
  return sql<unknown>`${JSON.stringify(value)}::jsonb`
}
