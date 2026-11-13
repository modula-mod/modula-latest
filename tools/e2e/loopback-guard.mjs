// GF-MSG-01: the messaging v3 E2E harness may only ever talk to loopback.
//
// Every URL the harness uses (API base, socket, database) must resolve to a
// literal loopback host. Hostnames are NOT resolved: `localhost` and any DNS
// name — including *.modula.digital and test.modula.* — are refused, so a
// misconfigured environment can never point the harness at a shared or
// production stack.

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', '::1'])

/** True when `value` parses as a URL whose host is a literal loopback address. */
export function isLoopbackUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.username && !/^postgres(ql)?:$/.test(url.protocol)) return false
  return LOOPBACK_HOSTS.has(url.hostname)
}

/** Throws unless every URL is loopback; the message never echoes credentials. */
export function assertLoopbackUrls(named) {
  for (const [name, value] of Object.entries(named)) {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} is required`)
    if (!isLoopbackUrl(value)) {
      let host = 'unparseable'
      try { host = new URL(value).hostname || 'empty' } catch { /* keep unparseable */ }
      throw new Error(`${name} must point at 127.0.0.1 or [::1] (got host "${host}"); this harness refuses non-loopback targets`)
    }
  }
}
