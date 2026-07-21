import type {ModulaWorkerDb} from '../database.js'

export async function registerModuleSchemas(db: ModulaWorkerDb, releaseId: string) {
  const schemas = await db
    .selectFrom('greenfield_module_contributions')
    .selectAll()
    .where('release_id', '=', releaseId)
    .where('contribution_type', '=', 'schema')
    .execute()
  const now = new Date()
  for (const schema of schemas as any[]) {
    const schemaId = schema.contribution_key
    await db
      .insertInto('greenfield_schemas' as any)
      .values({schema_id: schemaId, owner: schema.module_id, status: 'active', created_at: now, updated_at: now})
      .onConflict((oc: any) => oc.column('schema_id').doNothing())
      .execute()
  }
}

export async function unregisterModuleSchemas(db: ModulaWorkerDb, releaseId: string) {
  await db
    .updateTable('greenfield_module_contributions')
    .set({registration_status: 'disabled', updated_at: new Date()})
    .where('release_id', '=', releaseId)
    .where('contribution_type', '=', 'schema')
    .execute()
}
