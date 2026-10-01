import {gunzipSync} from 'node:zlib'

/**
 * Minimal, defensive reader for npm-style release tarballs (gzip + ustar,
 * with GNU long-name and pax path records). Only regular files are returned;
 * links, devices and paths that escape the archive root are rejected.
 */
export type TarEntries = Map<string, Buffer>

export class TarGzError extends Error {}

export function readTarGz(bytes: Buffer, limits: {maxUncompressedBytes: number; maxEntries?: number} ): TarEntries {
  let tar: Buffer
  try {
    tar = gunzipSync(bytes, {maxOutputLength: limits.maxUncompressedBytes})
  } catch (error) {
    throw new TarGzError(`Release package is not a readable gzip archive within ${limits.maxUncompressedBytes} bytes`)
  }
  const entries: TarEntries = new Map()
  const maxEntries = limits.maxEntries ?? 10_000
  let offset = 0
  let pendingPath: string | null = null
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break
    if (!checksumOk(header)) throw new TarGzError('Release package tar header checksum mismatch')
    const size = parseOctal(header.subarray(124, 136))
    const type = String.fromCharCode(header[156] || 48)
    const dataStart = offset + 512
    const dataEnd = dataStart + size
    if (dataEnd > tar.length) throw new TarGzError('Release package tar entry is truncated')
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
    if (entries.has(normalized)) throw new TarGzError(`Release package contains a duplicate entry: ${normalized}`)
    entries.set(normalized, Buffer.from(data))
    if (entries.size > maxEntries) throw new TarGzError('Release package contains too many entries')
  }
  return entries
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
