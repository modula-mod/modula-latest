// GF-MSG-01: the messaging v3 E2E harness may only ever talk to loopback.
//
// Every URL the harness uses (API base, socket, database) must name a literal
// loopback host. Hostnames are NOT resolved: `localhost` and any DNS name,
// including *.modula.digital and test.modula.*, are refused, so a
// misconfigured environment can never point the harness at a shared or
// production stack.
//
// Database URLs are checked twice (SENTINEL #176 F1): once as a WHATWG URL,
// and once exactly as the pinned `pg` driver parses it (pg-connection-string,
// resolved from the existing dependency tree, no new dependency), because pg
// lets query parameters such as `?host=` or `?hostaddr=` override the
// authority, and percent-encoded hosts are decoded (`%2Fvar%2Frun` is a unix
// socket). Any query string or fragment is refused outright: there is no
// allowlist.

import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const LOOPBACK_URL_HOSTS = new Set(['127.0.0.1', '[::1]'])
const LOOPBACK_PG_HOSTS = new Set(['127.0.0.1', '[::1]', '::1'])
const HTTP_SCHEMES = new Set(['http:', 'ws:'])
const PG_SCHEMES = new Set(['postgres:', 'postgresql:'])
const DATABASE_NAME = /^[A-Za-z0-9_]{1,63}$/

const apiPackageJson = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'services', 'greenfield-api', 'package.json')
let pgParse = null
/** pg-connection-string's `parse`, loaded from the same copy `pg` itself uses. */
export function pgConnectionStringParse() {
  if (!pgParse) {
    const pgEntry = createRequire(apiPackageJson).resolve('pg')
    pgParse = createRequire(pgEntry)('pg-connection-string').parse
  }
  return pgParse
}

function parseUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return null
  try { return new URL(value) } catch { return null }
}

function validPort(port) {
  return /^\d{1,5}$/.test(port) && Number(port) >= 1 && Number(port) <= 65535
}

/** Reason the value is not an acceptable loopback http:/ws: URL, or null when it is. */
export function httpUrlProblem(value) {
  const url = parseUrl(value)
  if (!url) return 'not a URL'
  if (!HTTP_SCHEMES.has(url.protocol)) return `scheme ${url.protocol} not allowed (http: or ws: only)`
  if (url.username || url.password) return 'credentials in URL not allowed'
  if (url.search || value.includes('?')) return 'query string not allowed'
  if (url.hash || value.includes('#')) return 'fragment not allowed'
  if (!LOOPBACK_URL_HOSTS.has(url.hostname)) return `host "${url.hostname || 'empty'}" is not 127.0.0.1 or [::1]`
  if (url.port && !validPort(url.port)) return 'invalid port'
  return null
}

/** Reason the value is not an acceptable loopback postgres URL, or null when it is. */
export function databaseUrlProblem(value) {
  const url = parseUrl(value)
  if (!url) return 'not a URL'
  if (!PG_SCHEMES.has(url.protocol)) return `scheme ${url.protocol} not allowed (postgres: or postgresql: only)`
  if (url.search || value.includes('?')) return 'query string not allowed (pg lets ?host=/?hostaddr= override the target)'
  if (url.hash || value.includes('#')) return 'fragment not allowed'
  if (value.includes(',')) return 'multi-host lists not allowed'
  if (!LOOPBACK_URL_HOSTS.has(url.hostname)) return `host "${url.hostname || 'empty'}" is not literally 127.0.0.1 or [::1]`
  if (!validPort(url.port)) return 'an explicit port is required'
  const database = url.pathname.replace(/^\//, '')
  if (!DATABASE_NAME.test(database)) return 'database name must match [A-Za-z0-9_]{1,63}'
  let parsed
  try {
    parsed = pgConnectionStringParse()(value)
  } catch {
    return 'pg cannot parse the URL'
  }
  // The effective target exactly as pg will connect.
  if (typeof parsed.host !== 'string' || !LOOPBACK_PG_HOSTS.has(parsed.host)) return `pg resolves host "${parsed.host ?? 'none'}", not loopback`
  if (parsed.hostaddr !== undefined) return 'hostaddr not allowed'
  if (String(parsed.port) !== url.port) return 'pg resolves a different port'
  if (parsed.database !== database) return 'pg resolves a different database'
  for (const key of ['options', 'sslcert', 'sslkey', 'sslrootcert', 'sslmode', 'ssl', 'client_encoding', 'application_name', 'fallback_application_name', 'replication']) {
    if (parsed[key] !== undefined) return `${key} not allowed`
  }
  return null
}

export function isLoopbackHttpUrl(value) { return httpUrlProblem(value) === null }
export function isLoopbackDatabaseUrl(value) { return databaseUrlProblem(value) === null }

function hostForMessage(value) {
  // Never echo credentials: report only the host.
  try { return new URL(value).hostname || 'empty' } catch { return 'unparseable' }
}

function assertWith(problemFor, named) {
  for (const [name, value] of Object.entries(named)) {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} is required`)
    const problem = problemFor(value)
    if (problem) throw new Error(`${name} refused (host "${hostForMessage(value)}"): ${problem}; this harness only targets loopback`)
  }
}

/** Throws unless every value is a loopback http:/ws: URL without credentials or query. */
export function assertLoopbackHttpUrls(named) { assertWith(httpUrlProblem, named) }
/** Throws unless every value is a loopback postgres URL that pg also resolves to loopback. */
export function assertLoopbackDatabaseUrls(named) { assertWith(databaseUrlProblem, named) }
