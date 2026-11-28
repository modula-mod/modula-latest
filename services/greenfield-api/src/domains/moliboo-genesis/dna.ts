import {createHash, randomBytes, randomUUID, verify, createPublicKey} from 'node:crypto'

import {canonicalJsonStringify} from '@modula/greenfield-protocol'

/**
 * MOLIBOO-GENESIS-01 — pure Genesis logic (no database access).
 *
 * Digital DNA (§6 of the master doc) is a structured character definition
 * from which a companion's identity can be generated and reproduced. A
 * 32-byte random seed is stored on the DNA row; every trait is derived
 * deterministically from it, so the same seed always reproduces the same
 * companion. The option sets below are the initial Genesis generation
 * options — structural choices, not canon character definitions. They do
 * not name or number any official character.
 */

export type GenesisDna = {
  appearance: {body: string; silhouette: string; eyes: string; palette: {name: string; primary: string; secondary: string; accent: string}}
  temperament: {curiosity: number; energy: number; sociability: number}
  personality: {humour: string; patience: string; communication: string}
  aptitudes: string[]
  lineage: {family: string; origin: string; generation: number; kind: string}
}

const BODIES = ['puff', 'sprite', 'orb', 'wisp', 'cub']
const SILHOUETTES = ['round', 'tall', 'wide', 'small']
const EYES = ['round', 'sparkle', 'sleepy', 'bright']
const PALETTES = [
  {name: 'dawn', primary: '#FFD45C', secondary: '#FF9E7A', accent: '#7A5CFF'},
  {name: 'tide', primary: '#5CC8FF', secondary: '#3A7BFF', accent: '#FFD45C'},
  {name: 'grove', primary: '#7AD67A', secondary: '#2E8B6A', accent: '#FFE89A'},
  {name: 'dusk', primary: '#8A6BE8', secondary: '#3A3FA8', accent: '#FF8AC2'},
  {name: 'ember', primary: '#FF7A59', secondary: '#B23A48', accent: '#FFC9A8'},
]
const HUMOURS = ['playful', 'dry', 'gentle', 'witty']
const PATIENCES = ['low', 'medium', 'high']
const COMMUNICATIONS = ['concise', 'warm', 'detailed', 'playful']
// Specialist tendencies, from the master doc §7.2. A Genesis companion
// starts with two; more are learned, never bought into being.
const APTITUDES = [
  'finance', 'cryptocurrency', 'forex', 'chemistry', 'software-engineering',
  'business', 'creative-arts', 'productivity', 'education', 'research',
  'marketing', 'communication', 'personal-organisation', 'entertainment',
]

const SEED_PATTERN = /^[0-9a-f]{64}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function deriveField(seedHex: string, field: string): bigint {
  const digest = createHash('sha256').update(`${seedHex}:${field}`).digest()
  return digest.readBigUInt64BE(0)
}

function pick<T>(seedHex: string, field: string, options: readonly T[]): T {
  return options[Number(deriveField(seedHex, field) % BigInt(options.length))]!
}

function score(seedHex: string, field: string): number {
  return Number(deriveField(seedHex, field) % 101n)
}

export function generateDnaSeed(): string {
  return randomBytes(32).toString('hex')
}

/** Deterministically derive a companion's DNA from its stored seed. */
export function deriveDna(seedHex: string): GenesisDna {
  if (!SEED_PATTERN.test(seedHex)) {
    throw Object.assign(new Error('Invalid DNA seed'), {code: 'VALIDATION_FAILED'})
  }
  const firstAptitude = pick(seedHex, 'aptitude-0', APTITUDES)
  let secondAptitude = pick(seedHex, 'aptitude-1', APTITUDES)
  if (secondAptitude === firstAptitude) {
    secondAptitude = APTITUDES[(APTITUDES.indexOf(firstAptitude) + 1) % APTITUDES.length]!
  }
  return {
    appearance: {
      body: pick(seedHex, 'body', BODIES),
      silhouette: pick(seedHex, 'silhouette', SILHOUETTES),
      eyes: pick(seedHex, 'eyes', EYES),
      palette: pick(seedHex, 'palette', PALETTES),
    },
    temperament: {
      curiosity: score(seedHex, 'curiosity'),
      energy: score(seedHex, 'energy'),
      sociability: score(seedHex, 'sociability'),
    },
    personality: {
      humour: pick(seedHex, 'humour', HUMOURS),
      patience: pick(seedHex, 'patience', PATIENCES),
      communication: pick(seedHex, 'communication', COMMUNICATIONS),
    },
    aptitudes: [firstAptitude, secondAptitude],
    lineage: {family: 'Unique lineage', origin: 'Modula Genesis', generation: 1, kind: 'personal'},
  }
}

export function newGenesisRegistryId(): string {
  return `MLB-GEN-${randomUUID()}`
}

export function newCertificateRegistryId(): string {
  return `MLB-CERT-${randomUUID()}`
}

export function isGenesisRegistryId(value: unknown): value is string {
  return typeof value === 'string' && /^MLB-GEN-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
}

export function isCertificateRegistryId(value: unknown): value is string {
  return typeof value === 'string' && /^MLB-CERT-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/**
 * The certificate's canonical statement: the IMMUTABLE fields only.
 * A name, wardrobe or personality change never touches these, so it never
 * invalidates the certificate. The statement is hashed with SHA-256 over
 * its canonical JSON form (sorted keys, @modula/greenfield-protocol).
 */
export type CertificateStatement = {
  bond: 'Original'
  born: string
  certificateRegistryId: string
  instanceId: string
  instanceRegistryId: string
  origin: 'Modula Genesis'
  transferStatus: 'non-transferable'
  type: 'origin'
}

export function buildCertificateStatement(input: {
  certificateRegistryId: string
  instanceRegistryId: string
  instanceId: string
  origin: 'Modula Genesis'
  born: Date | string
}): CertificateStatement {
  const born = input.born instanceof Date ? input.born.toISOString() : input.born
  return {
    bond: 'Original',
    born,
    certificateRegistryId: input.certificateRegistryId,
    instanceId: input.instanceId,
    instanceRegistryId: input.instanceRegistryId,
    origin: input.origin,
    transferStatus: 'non-transferable',
    type: 'origin',
  }
}

export function certificateStatementBytes(statement: CertificateStatement): Buffer {
  return Buffer.from(canonicalJsonStringify(statement), 'utf8')
}

export function certificateStatementHash(statement: CertificateStatement): string {
  return createHash('sha256').update(certificateStatementBytes(statement)).digest('hex')
}

/**
 * Verify an Ed25519 signature over the canonical statement bytes against a
 * registered public key (PEM). The server never holds the private half:
 * the offline key lives on Andrei's Mac, the online key (when configured)
 * lives inside Vault. A bad key, bad signature encoding, or tampered
 * statement verifies as false — never throws.
 */
export function verifyCertificateSignature(input: {
  statement: CertificateStatement
  signature: string
  publicKeyPem: string
}): boolean {
  try {
    if (!/^[A-Za-z0-9_-]{86}$/.test(input.signature)) return false
    return verify(
      null,
      certificateStatementBytes(input.statement),
      createPublicKey(input.publicKeyPem),
      Buffer.from(input.signature, 'base64url'),
    )
  } catch {
    return false
  }
}

const NAME_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/
const NAME_MAX_LENGTH = 80

/** A companion's name is mutable and never affects its certificate. */
export function cleanCompanionName(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw Object.assign(new Error('Name is required'), {code: 'VALIDATION_FAILED'})
  }
  const name = raw.trim()
  if (name.length < 1 || name.length > NAME_MAX_LENGTH) {
    throw Object.assign(new Error('Name must be between 1 and 80 characters'), {code: 'VALIDATION_FAILED'})
  }
  if (NAME_CONTROL_PATTERN.test(name)) {
    throw Object.assign(new Error('Name must not contain control characters'), {code: 'VALIDATION_FAILED'})
  }
  return name
}
