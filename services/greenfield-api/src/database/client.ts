import {Kysely, PostgresDialect} from 'kysely'
import pg from 'pg'
import type {Database} from './types.js'

export function createDb(connectionString: string): Kysely<Database> {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    application_name: 'modula-api',
  })
  return new Kysely<Database>({
    dialect: new PostgresDialect({pool}),
  })
}

export type ModulaDb = Kysely<Database>
