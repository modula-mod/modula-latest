import {gunzipSync} from 'node:zlib'

/**
 * Minimal, defensive reader for npm-style release tarballs (gzip + ustar,
 * with GNU long-name and pax path records). Only regular files are returned;
 * links, devices and paths that escape the archive root are rejected.
 */
export type TarEntries = Map<string, Buffer>

export class TarGzError extends Error {}

export function readTarGz(bytes: Buffer, limits: {maxUncompressedBytes: number; maxEntries?: number; strictUstar?: boolean} ): TarEntries {
  let tar: Buffer
  try {
    tar = gunzipSync(bytes, {maxOutputLength: limits.maxUncompressedBytes})
  } catch (error) {
    throw new TarGzError(`Release package is not a readable gzip archive within ${limits.maxUncompressedBytes} bytes`)
  }
  const entries: TarEntries = new Map()
  const foldedPaths = new Set<string>()
  const maxEntries = limits.maxEntries ?? 10_000
  let offset = 0
  let pendingPath: string | null = null
  let reachedEnd = false
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) { reachedEnd = true; break }
    if (limits.strictUstar && (header.toString('ascii', 257, 263) !== 'ustar\0'
      || (header[156] !== 0 && header[156] !== 48)
      || header.subarray(345, 500).some(byte => byte !== 0))) {
      throw new TarGzError('Web game archive requires regular ustar members')
    }
    if (!checksumOk(header)) throw new TarGzError('Release package tar header checksum mismatch')
    const size = parseOctal(header.subarray(124, 136))
    const type = String.fromCharCode(header[156] || 48)
    const dataStart = offset + 512
    const dataEnd = dataStart + size
    if (dataEnd > tar.length) throw new TarGzError('Release package tar entry is truncated')
    if (limits.strictUstar && size > 30 * 1024 * 1024) throw new TarGzError('Web game member exceeds 30 MiB')
    const data = tar.subarray(dataStart, dataEnd)
    offset = dataStart + Math.ceil(size / 512) * 512
    if (type === 'L') { pendingPath = cString(data); continue }
    if (type === 'x') { pendingPath = paxPath(data) ?? pendingPath; continue }
    if (type === 'g') continue
    const prefix = cString(header.subarray(345, 500))
    const name = cString(header.subarray(0, 100))
    const path = pendingPath ?? (prefix ? `${prefix}/${name}` : name)
    pendingPath = null
    if (type === '5') continue
    if (type !== '0' && type !== '7') throw new TarGzError(`Release package contains a non-regular entry: ${path}`)
    const normalized = safePath(path)
    if (limits.strictUstar) {
      if (normalized.length > 100 || !/^[A-Za-z0-9._/-]+$/.test(normalized)
        || normalized.split('/').some(part => part === '.' || part === '..')) {
        throw new TarGzError('Web game archive path is unsafe: ' + normalized)
      }
      if (foldedPaths.has(normalized.toLowerCase())) {
        throw new TarGzError('Web game archive has a case-conflicting path: ' + normalized)
      }
      foldedPaths.add(normalized.toLowerCase())
    }
    assertPortableModulePayload(normalized, data)
    if (entries.has(normalized)) throw new TarGzError(`Release package contains a duplicate entry: ${normalized}`)
    entries.set(normalized, Buffer.from(data))
    if (entries.size > maxEntries) throw new TarGzError('Release package contains too many entries')
  }
  if (limits.strictUstar && (!reachedEnd || tar.subarray(offset).some(byte => byte !== 0))) {
    throw new TarGzError('Web game archive has an invalid trailer')
  }
  return entries
}

const NATIVE_SUFFIXES = [
  '.dylib', '.so', '.dll', '.exe', '.framework', '.xcframework', '.a', '.o',
  '.node', '.wasm', '.apk', '.aab', '.ipa', '.jar', '.class',
]

/** Downloaded modules are declarative/JavaScript packages, never native code. */
function assertPortableModulePayload(path: string, bytes: Buffer): void {
  const lower = path.toLowerCase()
  if (NATIVE_SUFFIXES.some(suffix => lower.endsWith(suffix) || lower.includes(`${suffix}/`))) {
    throw new TarGzError(`Release package contains a forbidden native payload: ${path}`)
  }
  if (bytes.length >= 4) {
    const magic = bytes.subarray(0, 4)
    const elf = magic.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
    const macho = [
      [0xfe, 0xed, 0xfa, 0xce], [0xce, 0xfa, 0xed, 0xfe],
      [0xfe, 0xed, 0xfa, 0xcf], [0xcf, 0xfa, 0xed, 0xfe],
      [0xca, 0xfe, 0xba, 0xbe], [0xbe, 0xba, 0xfe, 0xca],
    ].some(value => magic.equals(Buffer.from(value)))
    const portableExecutable = bytes[0] === 0x4d && bytes[1] === 0x5a
    if (elf || macho || portableExecutable) {
      throw new TarGzError(`Release package contains native executable bytes: ${path}`)
    }
  }
}

function safePath(path: string): string {
  const normalized = path.replace(/^\.\//, '')
  if (!normalized || normalized.startsWith('/') || normalized.includes('\\') || normalized.split('/').some(part => part === '..' || part === '')) {
    throw new TarGzError(`Release package entry path is unsafe: ${path}`)
  }
  return normalized
}

function parseOctal(field: Buffer): number {
  const text = cString(field).trim()
  if (!text) return 0
  if (!/^[0-7]+$/.test(text)) throw new TarGzError('Release package tar header has a malformed size')
  return parseInt(text, 8)
}

function cString(field: Buffer): string {
  const end = field.indexOf(0)
  return field.subarray(0, end === -1 ? field.length : end).toString('utf8')
}

function checksumOk(header: Buffer): boolean {
  const stored = parseOctal(header.subarray(148, 156))
  let sum = 0
  for (let index = 0; index < 512; index += 1) sum += index >= 148 && index < 156 ? 32 : header[index]!
  return sum === stored
}

function paxPath(data: Buffer): string | null {
  // Records are "<decimal byte length> key=value\n"; lengths count bytes, not characters.
  let cursor = 0
  while (cursor < data.length) {
    const space = data.indexOf(0x20, cursor)
    if (space === -1) break
    const length = Number(data.subarray(cursor, space).toString('ascii'))
    if (!Number.isInteger(length) || length <= 0 || cursor + length > data.length) break
    const record = data.subarray(space + 1, cursor + length - 1).toString('utf8')
    const eq = record.indexOf('=')
    if (eq > 0 && record.slice(0, eq) === 'path') return record.slice(eq + 1)
    cursor += length
  }
  return null
}
