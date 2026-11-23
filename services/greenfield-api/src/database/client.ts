import {Kysely, PostgresDialect} from 'kysely'
import pg from 'pg'
import type {Database} from './types.js'

export function createDb(
  connectionString: string,
  onPoolError?: (error: Error) => void,
  options: {max?: number; applicationName?: string} = {},
): Kysely<Database> {
  const pool = new pg.Pool({
    connectionString,
    max: options.max ?? 10,
    application_name: options.applicationName ?? 'modula-api',
  })
  // PostgreSQL emits idle-client failures on the pool itself during a restart.
  // Without a listener Node treats the event as uncaught and terminates.
  pool.on('error', error => onPoolError?.(error))
  return new Kysely<Database>({
    dialect: new PostgresDialect({pool}),
  })
}

export type ModulaDb = Kysely<Database>
