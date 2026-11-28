// Shared test-only Nodus release descriptor (fake digests, example.test hosts).
import {createHash, generateKeyPairSync, sign, type KeyObject} from 'node:crypto'
import {
  nodusModelManifestBytes,
  nodusModelManifestSha256,
  type NodusReleaseDescriptorV2,
} from '../../src/app/nodus-release-descriptor.js'

export const hex = (c: string) => c.repeat(64)
export const validDescriptor = {
  schemaVersion: 1,
  nodusVersion: '1.0.0',
  artifactHash: `sha256:${hex('a')}`,
  manifestURL: 'https://cdn.example.test/nodus/1.0.0/nodus-manifest.json',
  manifestSHA256: hex('b'),
  files: [
    {path: 'weights/model.safetensors', url: 'https://cdn.example.test/nodus/1.0.0/weights/model.safetensors', sha256: hex('c'), bytes: 1024},
    {path: 'config.json', url: 'https://cdn.example.test/nodus/1.0.0/config.json', sha256: hex('d'), bytes: 12},
  ],
}

/** Deterministic fake model blob (64 KiB of a repeating pattern). Never real weights. */
export function fakeModelBlob(): Buffer {
  const blob = Buffer.alloc(64 * 1024)
  for (let i = 0; i < blob.length; i++) blob[i] = i % 251
  return blob
}

export function fakeFileSha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function makeNodusTestKey(keyId = 'test-nodus-key-01') {
  const keys = generateKeyPairSync('ed25519')
  return {
    keyId,
    privateKey: keys.privateKey,
    publicKeyPem: keys.publicKey.export({format: 'pem', type: 'spki'}).toString(),
  }
}

export type NodusTestFileSpec = {path: string; bytes: Buffer}

/**
 * Builds a v2 descriptor whose manifest hash and Ed25519 signature are real:
 * the manifest is the canonical JSON of {schemaVersion, nodusVersion,
 * artifactHash, files[]} and the signature is over exactly those bytes.
 * file urls point at this server's own endpoints under publicApiUrl.
 */
export function buildSignedV2Descriptor(input: {
  key: {keyId: string; privateKey: KeyObject}
  publicApiUrl: string
  version: string
  files: NodusTestFileSpec[]
  releaseNumber?: number
  supersedes?: string | null
  artifactHash?: string
}): NodusReleaseDescriptorV2 {
  const artifactHash = input.artifactHash ?? `sha256:${hex('e')}`
  const base = `${input.publicApiUrl.replace(/\/$/, '')}/v1/intelligence/nodus/releases/${input.version}`
  const partial = {
    schemaVersion: 2 as const,
    nodusVersion: input.version,
    artifactHash,
    manifestURL: `${base}/manifest`,
    manifestSHA256: '',
    files: input.files.map(file => ({
      path: file.path,
      url: `${base}/files/${file.path}`,
      sha256: fakeFileSha256(file.bytes),
      bytes: file.bytes.length,
    })),
  }
  const manifestSHA256 = nodusModelManifestSha256(partial as NodusReleaseDescriptorV2)
  const signature = sign(null, nodusModelManifestBytes(partial as NodusReleaseDescriptorV2), input.key.privateKey).toString('base64url')
  return {
    ...partial,
    manifestSHA256,
    releaseNumber: input.releaseNumber ?? 1,
    signature,
    signingKeyId: input.key.keyId,
    publishedAt: '2026-11-28T00:00:00.000Z',
    supersedes: input.supersedes ?? null,
  }
}

const staticKey = makeNodusTestKey()

/** A valid v2 descriptor with a real signature (shape tests only). */
export function validDescriptorV2(publicApiUrl = 'https://api.test.modula.digital'): NodusReleaseDescriptorV2 {
  return buildSignedV2Descriptor({
    key: staticKey,
    publicApiUrl,
    version: '1.0.0',
    files: [
      {path: 'weights/model.safetensors', bytes: Buffer.alloc(1024, 7)},
      {path: 'config.json', bytes: Buffer.alloc(12, 3)},
    ],
  })
}
