import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Greenfield Backend V1 migration ledger security', () => {
  let db: ModulaDb

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
  })

  afterAll(async () => db?.destroy())

  it('keeps schema provenance readable but immutable to every runtime role', async () => {
    const privileges = await sql<{
      role_name: string
      can_select: boolean
      can_insert: boolean
      can_update: boolean
      can_delete: boolean
    }>`
      SELECT role_name,
        bool_and(has_table_privilege(role_name, table_name, 'SELECT')) AS can_select,
        bool_or(has_table_privilege(role_name, table_name, 'INSERT')) AS can_insert,
        bool_or(has_table_privilege(role_name, table_name, 'UPDATE')) AS can_update,
        bool_or(has_table_privilege(role_name, table_name, 'DELETE')) AS can_delete
      FROM unnest(ARRAY['modula_api','modula_worker','modula_backup','modula_readonly']) AS role_name
      CROSS JOIN unnest(ARRAY['schema_metadata','schema_migrations']) AS table_name
      GROUP BY role_name
      ORDER BY role_name
    `.execute(db)

    expect(privileges.rows).toEqual([
      {role_name: 'modula_api', can_select: true, can_insert: false, can_update: false, can_delete: false},
      {role_name: 'modula_backup', can_select: true, can_insert: false, can_update: false, can_delete: false},
      {role_name: 'modula_readonly', can_select: true, can_insert: false, can_update: false, can_delete: false},
      {role_name: 'modula_worker', can_select: true, can_insert: false, can_update: false, can_delete: false},
    ])
  })

  it('retains the exact migration ledger and schema version', async () => {
    const version = await db.selectFrom('schema_metadata').select('value').where('key', '=', 'schema_version').executeTakeFirstOrThrow()
    const latest = await sql<{id: string}>`SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1`.execute(db)
    expect(version.value).toBe('052')
    expect(latest.rows[0]?.id).toBe('052_greenfield_backend_v1_migration_ledger_security')
  })
})
