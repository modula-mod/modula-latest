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

  it('gives the dedicated backup role complete read-only table coverage', async () => {
    const coverage = await sql<{
      missing_select: number
      writable_tables: number
    }>`
      SELECT
        count(*) FILTER (
          WHERE NOT has_table_privilege(
            'modula_backup',
            format('%I.%I', namespace.nspname, relation.relname),
            'SELECT'
          )
        )::int AS missing_select,
        count(*) FILTER (
          WHERE has_table_privilege(
            'modula_backup',
            format('%I.%I', namespace.nspname, relation.relname),
            'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
          )
        )::int AS writable_tables
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relkind IN ('r', 'p')
    `.execute(db)

    expect(coverage.rows).toEqual([{missing_select: 0, writable_tables: 0}])
  })

  it('gives the dedicated backup role durable read-only sequence coverage', async () => {
    const coverage = await sql<{
      missing_select: number
      writable_sequences: number
      default_select: boolean
    }>`
      SELECT
        count(*) FILTER (
          WHERE NOT has_sequence_privilege(
            'modula_backup',
            format('%I.%I', namespace.nspname, relation.relname),
            'SELECT'
          )
        )::int AS missing_select,
        count(*) FILTER (
          WHERE has_sequence_privilege(
            'modula_backup',
            format('%I.%I', namespace.nspname, relation.relname),
            'USAGE,UPDATE'
          )
        )::int AS writable_sequences,
        EXISTS (
          SELECT 1
          FROM pg_default_acl default_acl
          CROSS JOIN LATERAL aclexplode(default_acl.defaclacl) privilege
          WHERE default_acl.defaclrole = 'modula_migrator'::regrole
            AND default_acl.defaclnamespace = 'public'::regnamespace
            AND default_acl.defaclobjtype = 'S'
            AND privilege.grantee = 'modula_backup'::regrole
            AND privilege.privilege_type = 'SELECT'
        ) AS default_select
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relkind = 'S'
    `.execute(db)

    expect(coverage.rows).toEqual([{missing_select: 0, writable_sequences: 0, default_select: true}])
  })

  it('retains the exact migration ledger and schema version', async () => {
    const version = await db.selectFrom('schema_metadata').select('value').where('key', '=', 'schema_version').executeTakeFirstOrThrow()
    const latest = await sql<{id: string}>`SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1`.execute(db)
    expect(version.value).toBe('076')
    expect(latest.rows[0]?.id).toBe('076_optional_package_media')
  })
})
