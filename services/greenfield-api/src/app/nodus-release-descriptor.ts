import {createHash} from 'node:crypto'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'

/**
 * Nodus release descriptors, v1 and v2 (model-as-patch pipeline).
 *
 * v1 is the shape the native client decodes today (see
 * NodusModelRelease.validate() in Native) and the shape the env descriptor
 * (MODULA_NODUS_RELEASE_IOS_JSON) carries. v2 is v1 plus the release-registry
 * fields; /latest keeps serving the v1 shape stripped from a v2 release, so
 * today's client keeps working with zero change.
 *
 * Pure functions only: no database, no network. The registry service and the
 * route registration both import from here.
 */

export type NodusReleaseFile = {path: string; url: string; sha256: string; bytes: number}
export type NodusReleaseDescriptor = {
  schemaVersion: 1
  nodusVersion: string
  artifactHash: string
  manifestURL: string
  manifestSHA256: string
  files: NodusReleaseFile[]
}

export type NodusReleaseDescriptorV2 = {
  schemaVersion: 2
  nodusVersion: string
  artifactHash: string
  manifestURL: string
  manifestSHA256: string
  files: NodusReleaseFile[]
  releaseNumber: number
  signature: string
  signingKeyId: string
  publishedAt: string
  supersedes: string | null
}

/**
 * The canonical manifest: the content the Ed25519 signature covers. It
 * describes content only (path/sha256/bytes) — never transport URLs, so the
 * same manifest verifies regardless of where the files are served from. The
 * descriptor's manifestSHA256 is the SHA-256 of exactly these canonical
 * bytes, and the manifest endpoint serves exactly these bytes.
 */
export type NodusModelManifest = {
  schemaVersion: 2
  nodusVersion: string
  artifactHash: string
  files: Array<{path: string; sha256: string; bytes: number}>
}

export const NODUS_MODEL_SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{86}$/
export const NODUS_MODEL_KEY_ID_PATTERN = /^[A-Za-z0-9._:-]{3,160}$/

const HEX64 = /^[0-9a-f]{64}$/
const MAX_FILES = 512

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
    return value
  } catch {
    return null
  }
}

function safeRelativePath(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 512) return false
  if (value.startsWith('/') || value.includes('\\')) return false
  return !value.split('/').some(part => part === '' || part === '.' || part === '..')
}

/**
 * The field rules shared by v1 and v2, mirroring NodusModelRelease.validate()
 * in Native. `value` must already be a parsed JSON object. Returns the first
 * problem, or null when the shared fields are valid.
 */
export function nodusReleaseDescriptorFieldsProblem(value: any): string | null {
  if (typeof value.nodusVersion !== 'string' || !value.nodusVersion.trim() || value.nodusVersion.length > 64) {
    return 'nodusVersion must be a non-empty string of at most 64 characters'
  }
  if (typeof value.artifactHash !== 'string' || !value.artifactHash.startsWith('sha256:') || !HEX64.test(value.artifactHash.slice(7))) {
    return 'artifactHash must be "sha256:" followed by 64 lowercase hex characters'
  }
  if (!httpsUrl(value.manifestURL)) return 'manifestURL must be an https URL without userinfo'
  if (typeof value.manifestSHA256 !== 'string' || !HEX64.test(value.manifestSHA256)) {
    return 'manifestSHA256 must be 64 lowercase hex characters'
  }
  if (!Array.isArray(value.files) || value.files.length === 0 || value.files.length > MAX_FILES) {
    return `files must be a non-empty array of at most ${MAX_FILES} entries`
  }
  const seen = new Set<string>()
  for (const [index, file] of value.files.entries()) {
    if (!file || typeof file !== 'object') return `files[${index}] must be an object`
    if (!safeRelativePath(file.path)) return `files[${index}].path must be a safe relative path`
    if (file.path === 'nodus-manifest.json') return 'files must not contain nodus-manifest.json (it is the manifest itself)'
    if (seen.has(file.path)) return `files[${index}].path is duplicated: ${file.path}`
    seen.add(file.path)
    if (!httpsUrl(file.url)) return `files[${index}].url must be an https URL without userinfo`
    if (typeof file.sha256 !== 'string' || !HEX64.test(file.sha256)) {
      return `files[${index}].sha256 must be 64 lowercase hex characters`
    }
    if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0) {
      return `files[${index}].bytes must be a positive integer`
    }
  }
  return null
}

function parseDescriptorObject(raw: string | undefined | null): {value: any; problem: string | null} {
  if (!raw || !raw.trim()) return {value: null, problem: 'descriptor is unset or blank (no release will be served)'}
  let value: any
  try {
    value = JSON.parse(raw)
  } catch {
    return {value: null, problem: 'descriptor is not valid JSON'}
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {value: null, problem: 'descriptor must be a JSON object'}
  return {value, problem: null}
}

/**
 * First problem with a v1 Nodus release descriptor, or null when it is valid.
 * The server-side check mirrors NodusModelRelease.validate() in Native, so
 * the server never serves a descriptor the client would reject.
 */
export function nodusReleaseDescriptorProblem(raw: string | undefined | null): string | null {
  const {value, problem} = parseDescriptorObject(raw)
  if (problem !== null) return problem
  if (value.schemaVersion !== 1) return 'schemaVersion must be 1'
  return nodusReleaseDescriptorFieldsProblem(value)
}

/**
 * Mirrors NodusModelRelease.validate() in Native so the server never serves a
 * descriptor the client would reject. Returns null for anything invalid.
 */
export function parseNodusReleaseDescriptor(raw: string | undefined | null): NodusReleaseDescriptor | null {
  if (nodusReleaseDescriptorProblem(raw) !== null) return null
  const value = JSON.parse(raw as string)
  const files: NodusReleaseFile[] = value.files.map((file: any) => ({
    path: file.path,
    url: file.url,
    sha256: file.sha256,
    bytes: file.bytes,
  }))
  return {
    schemaVersion: 1,
    nodusVersion: value.nodusVersion,
    artifactHash: value.artifactHash,
    manifestURL: value.manifestURL,
    manifestSHA256: value.manifestSHA256,
    files,
  }
}

/**
 * First problem with a v2 Nodus release descriptor, or null when it is valid.
 * v2 is the v1 shape plus the release-registry fields: releaseNumber (the
 * client's ordering signal), the Ed25519 manifest signature (base64url,
 * 86 chars, no padding) with its signing key id, the publication timestamp,
 * and the version this release supersedes (null for the first release).
 */
export function nodusReleaseDescriptorV2Problem(raw: string | undefined | null): string | null {
  const {value, problem} = parseDescriptorObject(raw)
  if (problem !== null) return problem
  if (value.schemaVersion !== 2) return 'schemaVersion must be 2'
  const fieldsProblem = nodusReleaseDescriptorFieldsProblem(value)
  if (fieldsProblem !== null) return fieldsProblem
  if (!Number.isSafeInteger(value.releaseNumber) || value.releaseNumber <= 0) {
    return 'releaseNumber must be a positive integer'
  }
  if (typeof value.signature !== 'string' || !NODUS_MODEL_SIGNATURE_PATTERN.test(value.signature)) {
    return 'signature must be a base64url Ed25519 signature (86 characters, no padding)'
  }
  if (typeof value.signingKeyId !== 'string' || !NODUS_MODEL_KEY_ID_PATTERN.test(value.signingKeyId)) {
    return 'signingKeyId must be a valid publisher signing key id'
  }
  if (typeof value.publishedAt !== 'string' || Number.isNaN(Date.parse(value.publishedAt))) {
    return 'publishedAt must be an ISO timestamp'
  }
  if (value.supersedes !== null && (typeof value.supersedes !== 'string' || !value.supersedes.trim() || value.supersedes.length > 64)) {
    return 'supersedes must be null or a non-empty string of at most 64 characters'
  }
  return null
}

export function parseNodusReleaseDescriptorV2(raw: string | undefined | null): NodusReleaseDescriptorV2 | null {
  if (nodusReleaseDescriptorV2Problem(raw) !== null) return null
  const value = JSON.parse(raw as string)
  const files: NodusReleaseFile[] = value.files.map((file: any) => ({
    path: file.path,
    url: file.url,
    sha256: file.sha256,
    bytes: file.bytes,
  }))
  return {
    schemaVersion: 2,
    nodusVersion: value.nodusVersion,
    artifactHash: value.artifactHash,
    manifestURL: value.manifestURL,
    manifestSHA256: value.manifestSHA256,
    files,
    releaseNumber: value.releaseNumber,
    signature: value.signature,
    signingKeyId: value.signingKeyId,
    publishedAt: value.publishedAt,
    supersedes: value.supersedes,
  }
}

/** A v2 descriptor stripped to the v1 shape today's native client decodes. */
export function stripNodusReleaseDescriptorV2ToV1(descriptor: NodusReleaseDescriptorV2): NodusReleaseDescriptor {
  return {
    schemaVersion: 1,
    nodusVersion: descriptor.nodusVersion,
    artifactHash: descriptor.artifactHash,
    manifestURL: descriptor.manifestURL,
    manifestSHA256: descriptor.manifestSHA256,
    files: descriptor.files.map(file => ({path: file.path, url: file.url, sha256: file.sha256, bytes: file.bytes})),
  }
}

/** The canonical manifest for a v2 descriptor (content only, no URLs). */
export function nodusModelManifest(descriptor: NodusReleaseDescriptorV2): NodusModelManifest {
  return {
    schemaVersion: 2,
    nodusVersion: descriptor.nodusVersion,
    artifactHash: descriptor.artifactHash,
    files: descriptor.files.map(file => ({path: file.path, sha256: file.sha256, bytes: file.bytes})),
  }
}

/** The exact bytes the Ed25519 signature covers and the manifest endpoint serves. */
export function nodusModelManifestBytes(descriptor: NodusReleaseDescriptorV2): Buffer {
  return Buffer.from(canonicalJsonStringify(nodusModelManifest(descriptor)), 'utf8')
}

export function nodusModelManifestSha256(descriptor: NodusReleaseDescriptorV2): string {
  return createHash('sha256').update(nodusModelManifestBytes(descriptor)).digest('hex')
}

/**
 * The artifact origin a release's bytes are proxied from. HTTPS without
 * userinfo, always — except loopback http, which exists only so tests can
 * point a release at a local fixture origin. A non-loopback http origin is
 * never accepted.
 */
export function validNodusModelOriginUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 2048) return false
  try {
    const url = new URL(value)
    if (url.username || url.password) return false
    if (url.protocol === 'https:') return Boolean(url.hostname)
    if (url.protocol === 'http:') {
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
    }
    return false
  } catch {
    return false
  }
}
