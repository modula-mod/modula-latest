import {Kysely, PostgresDialect} from 'kysely'
import pg from 'pg'
import type {Database} from './types.js'

export function createDb(connectionString: string, onPoolError?: (error: Error) => void): Kysely<Database> {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    application_name: 'modula-api',
  })
  // PostgreSQL emits idle-client failures on the pool itself during a restart.
  // Without a listener Node treats the event as uncaught and terminates.
  pool.on('error', error => onPoolError?.(error))
  return new Kysely<Database>({
    dialect: new PostgresDialect({pool}),
  })
}

export type ModulaDb = Kysely<Database>
