// GF-MSG-01: ownership-tracked disposable database (SENTINEL #176 F2).
//
// The harness may only ever DROP a database that THIS run created. The handle
// records `created: true` only after `CREATE DATABASE` returned successfully;
// a collision ("already exists"), or any other create failure, leaves
// `created: false` and the drop is a no-op. `CREATE DATABASE` (no IF NOT
// EXISTS) fails on collision, so a pre-existing database is never adopted.

const DISPOSABLE_NAME = /^gf_msg_01_[a-z0-9]{6,32}$/

export function assertDisposableName(name) {
  if (typeof name !== 'string' || !DISPOSABLE_NAME.test(name)) throw new Error(`refusing database name ${JSON.stringify(name)}: must match ${DISPOSABLE_NAME}`)
  return name
}

/**
 * `query(sql)` runs one statement on the admin connection. Returns a handle;
 * throws (with `handle.created === false`) when the database could not be
 * created, including when it already exists.
 */
export async function createOwnedDatabase(query, name) {
  assertDisposableName(name)
  const handle = {name, created: false, dropped: false}
  try {
    await query(`CREATE DATABASE "${name}"`)
  } catch (error) {
    const wrapped = new Error(`could not create disposable database ${name}: ${error?.message ?? error}`)
    wrapped.handle = handle
    throw wrapped
  }
  handle.created = true
  return handle
}

/** Idempotent: drops only a database this run created; returns true if it dropped. */
export async function dropOwnedDatabase(query, handle) {
  if (!handle || handle.created !== true || handle.dropped) return false
  assertDisposableName(handle.name)
  handle.dropped = true
  await query(`DROP DATABASE IF EXISTS "${handle.name}" WITH (FORCE)`)
  return true
}
