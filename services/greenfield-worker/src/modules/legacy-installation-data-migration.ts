import {createHash, randomUUID} from 'node:crypto'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import type {ModulaWorkerDb} from '../database.js'
import {convertLegacyVaultRecord, convertLegacyVaultSettings, legacyVaultTagId} from './legacy-vault-notes-conversion.js'
import {permanentModuleJob} from './module-job-errors.js'

const hash = (value: unknown) => createHash('sha256').update(canonicalJsonStringify(value)).digest('hex')

/**
 * Runs inside the same transaction that rebinds a historical installation.
 * Generic trust exit is permitted only when data is absent or a reviewed
 * version-specific adapter proves compatibility. It never fabricates trust.
 */
export async function migrateHistoricalInstallationData(
  db: ModulaWorkerDb,
  input: {installationId: string; accountId: string; moduleId: string; fromVersion: string; toVersion: string; targetReleaseId: string; dryRun?: boolean},
): Promise<{records: number; tags: number; settings: number}> {
  const recordQuery = db.selectFrom('greenfield_module_records').selectAll()
    .where('installation_id', '=', input.installationId)
    .where('account_id', '=', input.accountId)
    .where('module_id', '=', input.moduleId)
    .orderBy('created_at').orderBy('record_id')
  const records = await (input.dryRun ? recordQuery : recordQuery.forUpdate()).execute()
  const settingsQuery = db.selectFrom('greenfield_module_installation_settings').selectAll()
    .where('installation_id', '=', input.installationId).where('module_id', '=', input.moduleId)
  const settings = await (input.dryRun ? settingsQuery : settingsQuery.forUpdate()).executeTakeFirst()
  const vaultAdapter = input.moduleId === 'digital.modula.vault-notes'
    && ['0.1.0', '0.2.0'].includes(input.fromVersion) && input.toVersion === '1.8.0'
  if (!vaultAdapter) {
    if (records.length || settings) throw permanentModuleJob('VALIDATION_FAILED', 'Historical installation has data without a reviewed upgrade adapter')
    return {records: 0, tags: 0, settings: 0}
  }

  const definitions = await db.selectFrom('greenfield_module_record_collections')
    .select(['collection', 'schema_ref']).where('release_id', '=', input.targetReleaseId).execute()
  const schemas = new Map(definitions.map(row => [row.collection, row.schema_ref]))
  if (!['note', 'folder', 'tag'].every(collection => schemas.has(collection))) {
    throw permanentModuleJob('VALIDATION_FAILED', 'Vault 1.8 target collection schemas are incomplete')
  }
  const folderIds = new Map<string, string>()
  for (const row of records.filter(record => record.collection === 'folder')) {
    folderIds.set(row.record_id, row.record_id)
    const data = row.data as Record<string, unknown>
    if (typeof data?.folderId === 'string') {
      const previous = folderIds.get(data.folderId)
      if (previous && previous !== row.record_id) throw permanentModuleJob('VALIDATION_FAILED', 'Ambiguous historical folder identity')
      folderIds.set(data.folderId, row.record_id)
    }
  }

  // Convert and validate every row before the first mutation. The containing
  // transaction also rolls back the conversion if release projection fails.
  let folderPosition = 0
  const converted = records.map(row => ({row, next: convertLegacyVaultRecord({
    recordId: row.record_id, collection: row.collection, data: row.data, revision: row.revision,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }, input.installationId, folderIds, row.collection === 'folder' ? folderPosition++ : 0)}))
  const nextSettings = settings ? convertLegacyVaultSettings(settings.values) : null
  const tags = new Map<string, {id: string; name: string; normalizedName: string}>()
  for (const item of converted) for (const tag of item.next.tags) tags.set(tag.id, tag)
  if (input.dryRun) return {records: converted.length, tags: tags.size, settings: settings ? 1 : 0}
  const now = new Date()

  for (const {row, next} of converted) {
    const previousHash = hash(row.data)
    const existingVersion = await db.selectFrom('greenfield_module_record_versions')
      .select('payload_hash').where('account_id', '=', input.accountId).where('module_id', '=', input.moduleId)
      .where('collection', '=', row.collection).where('record_id', '=', row.record_id).where('revision', '=', row.revision).executeTakeFirst()
    if (existingVersion && existingVersion.payload_hash !== previousHash) throw permanentModuleJob('VALIDATION_FAILED', 'Historical record version hash conflicts with current data')
    if (!existingVersion) await db.insertInto('greenfield_module_record_versions').values({
      version_id: randomUUID(), record_id: row.record_id, account_id: input.accountId, module_id: input.moduleId,
      collection: row.collection, revision: row.revision, next_revision: row.revision + 1,
      data_snapshot: row.data, payload_hash: previousHash, change_source: 'import',
      metadata: {migration: 'vault-notes-legacy-to-1.8.0', sourceVersion: input.fromVersion}, created_at: now,
    }).execute()
    const eventId = randomUUID()
    const payloadHash = hash(next.data)
    const previous = await db.selectFrom('greenfield_module_record_events').select('event_hash')
      .where('record_id', '=', row.record_id).orderBy('revision', 'desc').executeTakeFirst()
    const eventHash = hash({eventId, recordId: row.record_id, moduleId: input.moduleId, collection: row.collection,
      operation: 'update', revision: row.revision + 1, payloadHash})
    await db.updateTable('greenfield_module_records').set({
      data: next.data, schema_ref: schemas.get(row.collection)!, search_text: next.searchText,
      folder_ref: next.folderRef, source_uri: next.sourceUri, revision: row.revision + 1, updated_at: now,
    }).where('record_id', '=', row.record_id).where('installation_id', '=', input.installationId).execute()
    await db.insertInto('greenfield_module_record_events').values({
      event_id: eventId, record_id: row.record_id, account_id: input.accountId, module_id: input.moduleId,
      collection: row.collection, operation: 'update', revision: row.revision + 1,
      previous_hash: previous?.event_hash ?? null, event_hash: eventHash, payload_hash: payloadHash,
      metadata: {migration: 'vault-notes-legacy-to-1.8.0', sourceVersion: input.fromVersion}, created_at: now,
    }).execute()
  }

  for (const tag of tags.values()) {
    // A retry after a committed update skips this adapter because the release
    // pointer is already 1.8. Within one transaction, these IDs are unique.
    if (tag.id !== legacyVaultTagId(input.installationId, tag.name)) throw permanentModuleJob('VALIDATION_FAILED', 'Legacy tag identity changed')
    const data = {id: tag.id, name: tag.name, normalizedName: tag.normalizedName,
      createdAt: now.toISOString(), updatedAt: now.toISOString()}
    await db.insertInto('greenfield_module_records').values({
      record_id: tag.id, account_id: input.accountId, module_id: input.moduleId, installation_id: input.installationId,
      collection: 'tag', schema_ref: schemas.get('tag')!, visibility: 'private', data,
      search_text: `${tag.name} ${tag.normalizedName}`, folder_ref: null, source_uri: null,
      retained_after_uninstall: true, revision: 1, created_at: now, updated_at: now, deleted_at: null,
    }).execute()
    const eventId = randomUUID()
    const payloadHash = hash(data)
    await db.insertInto('greenfield_module_record_events').values({
      event_id: eventId, record_id: tag.id, account_id: input.accountId, module_id: input.moduleId,
      collection: 'tag', operation: 'create', revision: 1, previous_hash: null,
      event_hash: hash({eventId, recordId: tag.id, moduleId: input.moduleId, collection: 'tag', operation: 'create', revision: 1, payloadHash}),
      payload_hash: payloadHash, metadata: {migration: 'vault-notes-legacy-to-1.8.0'}, created_at: now,
    }).execute()
  }

  if (settings && nextSettings) {
    const existingVersion = await db.selectFrom('greenfield_module_settings_versions').select('values')
      .where('settings_id', '=', settings.settings_id).where('version', '=', settings.version).executeTakeFirst()
    if (existingVersion && hash(existingVersion.values) !== hash(settings.values)) throw permanentModuleJob('VALIDATION_FAILED', 'Historical settings version conflicts with current values')
    if (!existingVersion) await db.insertInto('greenfield_module_settings_versions').values({
      settings_version_id: randomUUID(), settings_id: settings.settings_id, version: settings.version,
      values: settings.values, secret_refs: settings.secret_refs, changed_by: null, created_at: now,
    }).execute()
    await db.updateTable('greenfield_module_installation_settings').set({
      values: nextSettings, schema_version: 1, version: settings.version + 1, updated_by: null, updated_at: now,
    }).where('settings_id', '=', settings.settings_id).execute()
    await db.insertInto('greenfield_module_settings_versions').values({
      settings_version_id: randomUUID(), settings_id: settings.settings_id, version: settings.version + 1,
      values: nextSettings, secret_refs: settings.secret_refs, changed_by: null, created_at: now,
    }).execute()
  }
  return {records: converted.length, tags: tags.size, settings: settings ? 1 : 0}
}
