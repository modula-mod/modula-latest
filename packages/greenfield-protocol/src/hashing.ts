import {canonicalJsonStringify} from './canonical-json.js'

/**
 * SHA-256 via the platform Web Crypto SubtleCrypto API (standard algorithm).
 * No custom hash construction.
 */

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const encoded = typeof data === 'string' ? new TextEncoder().encode(data) : data
  // Copy into a fresh ArrayBuffer-backed view for SubtleCrypto BufferSource typing.
  const bytes = new Uint8Array(encoded.byteLength)
  bytes.set(encoded)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return bytesToHex(new Uint8Array(digest))
}

export async function hashCanonicalJson(value: unknown): Promise<string> {
  return sha256Hex(canonicalJsonStringify(value))
}

/** Published test vectors for canonical JSON + SHA-256. */
export const GREENFIELD_HASHING_TEST_VECTORS = [
  {
    name: 'empty-object',
    value: {},
    canonicalJson: '{}',
    sha256Hex: '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
  },
  {
    name: 'key-order-independence',
    value: {b: 2, a: 1},
    canonicalJson: '{"a":1,"b":2}',
    sha256Hex: '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777',
  },
  {
    name: 'nested',
    value: {z: {y: 1, x: 2}, a: [3, 1]},
    canonicalJson: '{"a":[3,1],"z":{"x":2,"y":1}}',
    sha256Hex: '3ca4dff6ddb1c5e01cb0ba97b133b6c94a536c50317ead6ce8b87d40ca7bd572',
  },
] as const
