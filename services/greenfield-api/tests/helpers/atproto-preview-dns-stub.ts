/**
 * Test-only AT Proto preview DNS resolver stub.
 *
 * Supplies a `dns.lookup` implementation used solely by tests (installed via
 * `vi.mock('node:dns')` in the test file) so `assertSafeHttpsUrl` can be
 * pointed at a chosen address for a hostname (for example `bsky.social`)
 * without changing the production SSRF policy, allowlisting any host, or
 * altering the production / preview callback path.
 *
 * Preview `completePreviewOAuth` stores the PDS URL after the SSRF check and
 * does not fetch it, so the safe mapping only returns a public, non-blocked
 * address — no live network is required or used.
 *
 * Always restore the original lookup (the installer returns an uninstall
 * hook) so other tests keep real DNS / the production guard.
 */
import type {LookupAddress, LookupOptions} from 'node:dns'
import type {Mock} from 'vitest'

export const ATPROTO_PREVIEW_PDS_HOSTNAME = 'bsky.social'
/** Public address outside every range `isBlockedIp` rejects. Used only as a DNS stand-in. */
export const ATPROTO_PREVIEW_SAFE_ADDRESS = '1.1.1.1'
/** Benchmarking range (`198.18.0.0/15`) that production `isBlockedIp` must keep blocked. */
export const ATPROTO_PREVIEW_BLOCKED_BENCHMARK_ADDRESS = '198.18.0.1'

type LookupFn = typeof import('node:dns').lookup
type LookupCallback =
  | ((err: NodeJS.ErrnoException | null, address: string, family: number) => void)
  | ((err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void)

export function applyAtprotoPreviewDnsStub(
  lookup: Mock,
  original: LookupFn,
  entries: Record<string, LookupAddress[]>,
): () => void {
  const mapped = new Map(
    Object.entries(entries).map(([host, addresses]) => [host.toLowerCase(), addresses]),
  )

  lookup.mockImplementation(((
    hostname: string,
    options?: LookupOptions | LookupCallback,
    callback?: LookupCallback,
  ) => {
    let opts: LookupOptions = {}
    let cb: LookupCallback | undefined
    if (typeof options === 'function') {
      cb = options
    } else {
      opts = options ?? {}
      cb = callback
    }
    const addresses = mapped.get(String(hostname).toLowerCase())
    if (!addresses) {
      if (typeof options === 'function') {
        return (original as Function)(hostname, options)
      }
      return (original as Function)(hostname, opts, cb)
    }
    if (!cb) {
      throw new Error('atproto preview DNS stub requires a callback lookup')
    }
    process.nextTick(() => {
      if (opts.all) {
        ;(cb as (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void)(
          null,
          addresses,
        )
        return
      }
      const first = addresses[0]
      if (!first) {
        const error = Object.assign(new Error(`No addresses resolved for ${hostname}`), {
          code: 'ENOTFOUND',
        })
        ;(cb as (err: NodeJS.ErrnoException | null, address: string, family: number) => void)(
          error,
          '',
          4,
        )
        return
      }
      ;(cb as (err: NodeJS.ErrnoException | null, address: string, family: number) => void)(
        null,
        first.address,
        first.family,
      )
    })
  }) as LookupFn)

  return () => {
    lookup.mockImplementation(original)
  }
}

export function installSafeAtprotoPreviewDnsStub(lookup: Mock, original: LookupFn): () => void {
  return applyAtprotoPreviewDnsStub(lookup, original, {
    [ATPROTO_PREVIEW_PDS_HOSTNAME]: [{address: ATPROTO_PREVIEW_SAFE_ADDRESS, family: 4}],
  })
}

export function installBlockedAtprotoPreviewDnsStub(lookup: Mock, original: LookupFn): () => void {
  return applyAtprotoPreviewDnsStub(lookup, original, {
    [ATPROTO_PREVIEW_PDS_HOSTNAME]: [
      {address: ATPROTO_PREVIEW_BLOCKED_BENCHMARK_ADDRESS, family: 4},
    ],
  })
}
