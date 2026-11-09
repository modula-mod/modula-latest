import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import pg from 'pg'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {listMigrationFiles, migrateDown, migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const adminDatabaseUrl = process.env.MODULA_TEST_ADMIN_DATABASE_URL
const describeIfDb = databaseUrl && adminDatabaseUrl ? describe : describe.skip
const roles = ['modula_api', 'modula_worker', 'modula_backup'] as const
type PrivilegeSnapshot = Array<{
  table_name: string
  role_name: string
  can_select: boolean
  can_insert: boolean
  can_update: boolean
  can_delete: boolean
}>

async function snapshotPrivileges(connectionString: string): Promise<PrivilegeSnapshot> {
  const client = new pg.Client({connectionString})
  await client.connect()
  try {
    const result = await client.query<PrivilegeSnapshot[number]>(
      `SELECT c.relname AS table_name,
              role_name,
              has_table_privilege(role_name, c.oid, 'SELECT') AS can_select,
              has_table_privilege(role_name, c.oid, 'INSERT') AS can_insert,
              has_table_privilege(role_name, c.oid, 'UPDATE') AS can_update,
              has_table_privilege(role_name, c.oid, 'DELETE') AS can_delete
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         CROSS JOIN unnest($1::text[]) AS role_name
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname, role_name`,
      [roles],
    )
    return result.rows
  } finally {
    await client.end()
  }
}

function privilege(rows: PrivilegeSnapshot, table: string, role: string) {
  const row = rows.find(entry => entry.table_name === table && entry.role_name === role)
  expect(row, `${role} privileges on ${table}`).toBeTruthy()
  return row!
}

async function copyMigrationsThrough(sourceDir: string, destDir: string, maxId: number) {
  for (const name of await fs.readdir(sourceDir)) {
    if (!name.endsWith('.sql')) continue
    const numericId = Number(name.slice(0, 3))
    if (!Number.isInteger(numericId) || numericId > maxId) continue
    await fs.copyFile(path.join(sourceDir, name), path.join(destDir, name))
  }
}

describeIfDb.sequential('migration privilege rollback for 084 and 085', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const databaseName = `modula_priv_rollback_${suffix}`
  let adminPool: pg.Pool
  let url: string
  let migrationsDir: string
  let dirThrough083: string
  let dirThrough084: string
  let has085 = false

  beforeAll(async () => {
    const files = await listMigrationFiles()
    if (files.length === 0) throw new Error('No migrations found')
    migrationsDir = path.dirname(files[0]!.file)
    has085 = files.some(file => file.id.startsWith('085_'))
    if (!files.some(file => file.id === '084_moliboo_signed_packs')) {
      throw new Error('084_moliboo_signed_packs is required for this suite')
    }
    adminPool = new pg.Pool({connectionString: adminDatabaseUrl!})
    await adminPool.query(`CREATE DATABASE "${databaseName}" OWNER modula_migrator`)
    const parsed = new URL(databaseUrl!)
    parsed.pathname = `/${databaseName}`
    url = parsed.toString()
    dirThrough083 = await fs.mkdtemp(path.join(os.tmpdir(), 'modula-migrations-083-'))
    dirThrough084 = await fs.mkdtemp(path.join(os.tmpdir(), 'modula-migrations-084-'))
    await copyMigrationsThrough(migrationsDir, dirThrough083, 83)
    await copyMigrationsThrough(migrationsDir, dirThrough084, 84)
  }, 60_000)

  afterAll(async () => {
    if (adminPool) {
      await adminPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [databaseName])
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`)
      await adminPool.end()
    }
    if (dirThrough083) await fs.rm(dirThrough083, {recursive: true, force: true})
    if (dirThrough084) await fs.rm(dirThrough084, {recursive: true, force: true})
  }, 60_000)

  it('restores exact prior table privileges after 084 and 085 down/up', async () => {
    const applied083 = await migrateUp(url, dirThrough083)
    expect(applied083.at(-1)).toBe('083_moliboo_game_systems')
    const after083 = await snapshotPrivileges(url)
    expect(privilege(after083, 'greenfield_moliboo_items', 'modula_api')).toMatchObject({
      can_select: true, can_insert: false, can_update: false, can_delete: false,
    })
    for (const table of ['greenfield_moliboo_inventory', 'greenfield_moliboo_equipped'] as const) {
      expect(privilege(after083, table, 'modula_api')).toMatchObject({
        can_select: true, can_insert: true, can_update: true, can_delete: true,
      })
    }

    expect(await migrateUp(url, dirThrough084)).toEqual(['084_moliboo_signed_packs'])
    const after084Up = await snapshotPrivileges(url)
    expect(privilege(after084Up, 'greenfield_moliboo_items', 'modula_api')).toMatchObject({
      can_select: true, can_insert: true, can_update: true, can_delete: false,
    })

    expect(await migrateDown(url, dirThrough084)).toBe('084_moliboo_signed_packs')
    const after084Down = await snapshotPrivileges(url)
    expect(after084Down).toEqual(after083)
    expect(privilege(after084Down, 'greenfield_moliboo_items', 'modula_api')).toMatchObject({
      can_select: true, can_insert: false, can_update: false, can_delete: false,
    })
    for (const table of ['greenfield_moliboo_inventory', 'greenfield_moliboo_equipped'] as const) {
      expect(privilege(after084Down, table, 'modula_api')).toMatchObject({
        can_select: true, can_insert: true, can_update: true, can_delete: true,
      })
    }

    expect(await migrateUp(url, dirThrough084)).toEqual(['084_moliboo_signed_packs'])
    const after084Reup = await snapshotPrivileges(url)
    expect(after084Reup).toEqual(after084Up)

    if (!has085) return

    const applied085 = await migrateUp(url, migrationsDir)
    expect(applied085).toEqual(['085_publisher_release_console'])
    const after085Up = await snapshotPrivileges(url)

    expect(await migrateDown(url, migrationsDir)).toBe('085_publisher_release_console')
    const after085Down = await snapshotPrivileges(url)
    expect(after085Down).toEqual(after084Reup)

    expect(await migrateUp(url, migrationsDir)).toEqual(['085_publisher_release_console'])
    const after085Reup = await snapshotPrivileges(url)
    expect(after085Reup).toEqual(after085Up)
  }, 120_000)
})
