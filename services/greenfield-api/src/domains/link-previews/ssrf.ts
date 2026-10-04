import dns from 'node:dns'
import net from 'node:net'

/** True for addresses an unfurler must never reach (loopback, private, link-local, CGNAT, multicast, reserved). */
export function isBlockedAddress(address: string): boolean {
  let ip = address
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number) as [number, number]
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19))
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase()
    return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd')
      || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')
      || v.startsWith('ff') || v.startsWith('64:ff9b') || v.startsWith('2001:db8')
  }
  return true
}

/** dns.lookup replacement that refuses blocked addresses, so the checked IP is the one connected to (no rebinding gap). */
export const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, {...(options as dns.LookupOptions), all: true}, (error, addresses) => {
    if (error) return (callback as any)(error)
    const list = addresses as dns.LookupAddress[]
    const allowed = list.find(entry => !isBlockedAddress(entry.address))
    if (!allowed || list.some(entry => isBlockedAddress(entry.address))) {
      return (callback as any)(Object.assign(new Error('Blocked address'), {code: 'EBLOCKED'}))
    }
    if ((options as dns.LookupOptions)?.all) return (callback as any)(null, [allowed])
    return (callback as any)(null, allowed.address, allowed.family)
  })
}
