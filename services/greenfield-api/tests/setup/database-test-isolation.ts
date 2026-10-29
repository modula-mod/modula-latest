import pg from 'pg'
import {beforeAll} from 'vitest'

/**
 * Database-backed API suites share one disposable PostgreSQL database. Keep
 * the per-IP email-verification limiter from leaking between test files while
 * preserving limiter behavior inside each file, including the dedicated auth
 * security acceptance tests.
 */
beforeAll(async () => {
  const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
  if (!databaseUrl) return

  const client = new pg.Client({connectionString: databaseUrl})
  await client.connect()
  try {
    const table = await client.query<{name: string | null}>(
      `SELECT to_regclass('public.greenfield_auth_rate_limits')::text AS name`,
    )
    if (table.rows[0]?.name) {
      await client.query(`DELETE FROM greenfield_auth_rate_limits WHERE purpose = 'email_verification'`)
    }
  } finally {
    await client.end()
  }
})
