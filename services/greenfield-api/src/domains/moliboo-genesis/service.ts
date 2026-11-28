import {sql, type Kysely, type Transaction} from 'kysely'

import type {ModulaDb} from '../../database/client.js'
import {uuidv7} from '../../lib/uuidv7.js'
import {
  buildCertificateStatement,
  certificateStatementHash,
  cleanCompanionName,
  deriveDna,
  generateDnaSeed,
  isCertificateRegistryId,
  newCertificateRegistryId,
  newGenesisRegistryId,
  verifyCertificateSignature,
  type CertificateStatement,
  type GenesisDna,
} from './dna.js'

type Exec = Kysely<any> | Transaction<any>

const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), {code})
}

type InstanceRow = {
  instance_id: string
  account_id: string
  registry_id: string
  character_id: string | null
  name: string | null
  origin: string
  bond: string
  transfer_status: string
  born_at: Date
  revealed_at: Date | null
  created_at: Date
  updated_at: Date
}

type DnaRow = {
  instance_id: string
  dna_version: number
  dna_seed: string
  appearance: GenesisDna['appearance']
  temperament: GenesisDna['temperament']
  personality: GenesisDna['personality']
  aptitudes: string[]
  lineage: GenesisDna['lineage']
  created_at: Date
  updated_at: Date
}

type CertificateRow = {
  certificate_id: string
  registry_id: string
  instance_id: string
  certificate_type: string
  instance_registry_id: string
  born_at: Date
  origin: string
  family: string
  bond: string
  transfer_status: string
  immutable_hash: string
  signature: string | null
  signature_key_id: string | null
  signature_state: 'unsigned' | 'signed'
  issued_at: Date
  verified_at: Date | null
  created_at: Date
  updated_at: Date
}

export type GenesisCompanion = {
  instanceId: string
  registryId: string
  name: string | null
  characterId: string | null
  origin: string
  bond: string
  transferStatus: string
  bornAt: string
  revealedAt: string | null
  dna: {
    version: number
    appearance: GenesisDna['appearance']
    temperament: GenesisDna['temperament']
    personality: GenesisDna['personality']
    aptitudes: string[]
    lineage: GenesisDna['lineage']
  }
  certificate: {
    registryId: string
    type: string
    bornAt: string
    origin: string
    family: string
    bond: string
    transferStatus: string
    hash: string
    signatureState: 'unsigned' | 'signed'
    issuedAt: string
  }
}

export type GenesisCertificate = {
  registryId: string
  instanceRegistryId: string
  type: string
  bornAt: string
  origin: string
  family: string
  bond: string
  transferStatus: string
  hash: string
  signatureState: 'unsigned' | 'signed'
  signatureKeyId: string | null
  issuedAt: string
}

export type CertificateVerification = {
  certificate: GenesisCertificate
  verification: {
    recordValid: boolean
    signatureStatus: 'unsigned-awaiting-signature' | 'signed' | 'invalid'
    signatureValid: boolean | null
    verified: boolean
  }
}

function companionDto(instance: InstanceRow, dna: DnaRow, certificate: CertificateRow): GenesisCompanion {
  return {
    instanceId: instance.instance_id,
    registryId: instance.registry_id,
    name: instance.name,
    characterId: instance.character_id,
    origin: instance.origin,
    bond: instance.bond,
    transferStatus: instance.transfer_status,
    bornAt: instance.born_at.toISOString(),
    revealedAt: instance.revealed_at ? instance.revealed_at.toISOString() : null,
    dna: {
      version: dna.dna_version,
      appearance: dna.appearance,
      temperament: dna.temperament,
      personality: dna.personality,
      aptitudes: dna.aptitudes,
      lineage: dna.lineage,
    },
    certificate: {
      registryId: certificate.registry_id,
      type: certificate.certificate_type,
      bornAt: certificate.born_at.toISOString(),
      origin: certificate.origin,
      family: certificate.family,
      bond: certificate.bond,
      transferStatus: certificate.transfer_status,
      hash: certificate.immutable_hash,
      signatureState: certificate.signature_state,
      issuedAt: certificate.issued_at.toISOString(),
    },
  }
}

function certificateDto(row: CertificateRow): GenesisCertificate {
  return {
    registryId: row.registry_id,
    instanceRegistryId: row.instance_registry_id,
    type: row.certificate_type,
    bornAt: row.born_at.toISOString(),
    origin: row.origin,
    family: row.family,
    bond: row.bond,
    transferStatus: row.transfer_status,
    hash: row.immutable_hash,
    signatureState: row.signature_state,
    signatureKeyId: row.signature_key_id,
    issuedAt: row.issued_at.toISOString(),
  }
}

function statementFor(row: CertificateRow): CertificateStatement {
  return buildCertificateStatement({
    certificateRegistryId: row.registry_id,
    instanceRegistryId: row.instance_registry_id,
    instanceId: row.instance_id,
    origin: 'Modula Genesis',
    born: row.born_at,
  })
}

/**
 * Moliboo Genesis — the birth, naming and certification of a Personal
 * Moliboo. One companion per account, ever; non-transferable; private
 * memory never appears in a certificate or its verification response.
 *
 * Birth is idempotent and race-safe: concurrent births for the same
 * account serialize on a per-account advisory lock inside one
 * transaction, and the account's UNIQUE constraint is the final guard.
 */
export class MolibooGenesisService {
  constructor(private readonly db: ModulaDb) {}

  private get exec(): Exec {
    return this.db as unknown as Kysely<any>
  }

  /**
   * Birth a companion for the account if none exists; otherwise return the
   * existing one. `created` tells the caller whether this call performed
   * the birth (the reveal) or returned an already-born companion.
   */
  async ensureGenesisForAccount(accountId: string): Promise<{companion: GenesisCompanion; created: boolean}> {
    const created = await this.db.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${'moliboo-genesis:' + accountId})::bigint)`.execute(trx)
      const existing = await trx
        .selectFrom('greenfield_moliboo_genesis_instances')
        .selectAll()
        .where('account_id', '=', accountId)
        .executeTakeFirst()
      if (existing) return false

      const now = new Date()
      const instanceId = uuidv7()
      const instanceRegistryId = newGenesisRegistryId()
      const certificateRegistryId = newCertificateRegistryId()
      const dnaSeed = generateDnaSeed()
      const dna = deriveDna(dnaSeed)
      const statement = buildCertificateStatement({
        certificateRegistryId,
        instanceRegistryId,
        instanceId,
        origin: 'Modula Genesis',
        born: now,
      })
      await trx
        .insertInto('greenfield_moliboo_genesis_instances')
        .values({
          instance_id: instanceId,
          account_id: accountId,
          registry_id: instanceRegistryId,
          character_id: null,
          name: null,
          origin: 'Modula Genesis',
          bond: 'Original',
          transfer_status: 'non-transferable',
          born_at: now,
          created_at: now,
          updated_at: now,
        })
        .execute()
      await trx
        .insertInto('greenfield_moliboo_genesis_dna')
        .values({
          instance_id: instanceId,
          dna_version: 1,
          dna_seed: dnaSeed,
          appearance: jsonb(dna.appearance),
          temperament: jsonb(dna.temperament),
          personality: jsonb(dna.personality),
          aptitudes: jsonb(dna.aptitudes),
          lineage: jsonb(dna.lineage),
          created_at: now,
          updated_at: now,
        })
        .execute()
      await trx
        .insertInto('greenfield_moliboo_genesis_certificates')
        .values({
          certificate_id: uuidv7(),
          registry_id: certificateRegistryId,
          instance_id: instanceId,
          certificate_type: 'origin',
          instance_registry_id: instanceRegistryId,
          born_at: now,
          origin: 'Modula Genesis',
          family: 'Unique lineage',
          bond: 'Original',
          transfer_status: 'non-transferable',
          immutable_hash: certificateStatementHash(statement),
          signature: null,
          signature_key_id: null,
          signature_state: 'unsigned',
          issued_at: now,
          created_at: now,
          updated_at: now,
        })
        .execute()
      return true
    })

    const companion = await this.getGenesisForAccount(accountId)
    if (!companion) fail('SERVER_ERROR', 'Genesis companion could not be loaded after birth')
    return {companion, created}
  }

  /** Load the account's companion, or null when none was ever born. */
  async getGenesisForAccount(accountId: string): Promise<GenesisCompanion | null> {
    const instance = await this.exec
      .selectFrom('greenfield_moliboo_genesis_instances')
      .selectAll()
      .where('account_id', '=', accountId)
      .executeTakeFirst()
    if (!instance) return null
    return this.loadCompanion(instance as InstanceRow)
  }

  private async loadCompanion(instance: InstanceRow): Promise<GenesisCompanion> {
    const [dna, certificate] = await Promise.all([
      this.exec
        .selectFrom('greenfield_moliboo_genesis_dna')
        .selectAll()
        .where('instance_id', '=', instance.instance_id)
        .executeTakeFirstOrThrow(),
      this.exec
        .selectFrom('greenfield_moliboo_genesis_certificates')
        .selectAll()
        .where('instance_id', '=', instance.instance_id)
        .executeTakeFirstOrThrow(),
    ])
    return companionDto(instance, dna as unknown as DnaRow, certificate as unknown as CertificateRow)
  }

  /**
   * Name (or rename) the companion. The name is mutable and never affects
   * the certificate: the birth hash covers immutable fields only. Accounts
   * born before Genesis shipped are backfilled here — naming births the
   * companion first, exactly like the GET endpoint does.
   */
  async nameCompanion(accountId: string, rawName: unknown): Promise<GenesisCompanion> {
    const name = cleanCompanionName(rawName)
    await this.ensureGenesisForAccount(accountId)
    await this.exec
      .updateTable('greenfield_moliboo_genesis_instances')
      .set({name, updated_at: new Date()})
      .where('account_id', '=', accountId)
      .execute()
    const companion = await this.getGenesisForAccount(accountId)
    if (!companion) fail('SERVER_ERROR', 'Genesis companion could not be loaded after naming')
    return companion
  }

  /** The account's certificates (today at most one: the birth certificate). */
  async listCertificatesForAccount(accountId: string): Promise<GenesisCertificate[]> {
    await this.ensureGenesisForAccount(accountId)
    const rows = await this.exec
      .selectFrom('greenfield_moliboo_genesis_certificates as certificate')
      .innerJoin(
        'greenfield_moliboo_genesis_instances as instance',
        'instance.instance_id',
        'certificate.instance_id',
      )
      .selectAll('certificate')
      .where('instance.account_id', '=', accountId)
      .orderBy('certificate.issued_at', 'asc')
      .execute()
    return (rows as unknown as CertificateRow[]).map(certificateDto)
  }

  /**
   * Public verification (the QR-code target). Returns registry facts only:
   * never the companion's name, never the account, never private memory.
   * An unsigned certificate reports honestly as
   * `unsigned-awaiting-signature` — unsigned is not a failure of the
   * record, it means no signing path has applied a signature yet.
   */
  async verifyCertificateByRegistryId(registryId: string): Promise<CertificateVerification> {
    if (!isCertificateRegistryId(registryId)) fail('NOT_FOUND', 'Certificate not found')
    const row = await this.exec
      .selectFrom('greenfield_moliboo_genesis_certificates')
      .selectAll()
      .where('registry_id', '=', registryId)
      .executeTakeFirst()
    if (!row) fail('NOT_FOUND', 'Certificate not found')
    const certificate = row as unknown as CertificateRow
    const recordValid = certificateStatementHash(statementFor(certificate)) === certificate.immutable_hash
    if (certificate.signature_state === 'unsigned' || !certificate.signature) {
      return {
        certificate: certificateDto(certificate),
        verification: {
          recordValid,
          signatureStatus: 'unsigned-awaiting-signature',
          signatureValid: null,
          verified: false,
        },
      }
    }
    const key = await this.exec
      .selectFrom('greenfield_publisher_signing_keys')
      .select(['public_key_pem', 'state'])
      .where('key_id', '=', certificate.signature_key_id)
      .executeTakeFirst()
    const signatureValid =
      key?.state === 'ACTIVE'
        ? verifyCertificateSignature({
            statement: statementFor(certificate),
            signature: certificate.signature,
            publicKeyPem: key.public_key_pem,
          })
        : false
    return {
      certificate: certificateDto(certificate),
      verification: {
        recordValid,
        signatureStatus: signatureValid ? 'signed' : 'invalid',
        signatureValid,
        verified: recordValid && signatureValid,
      },
    }
  }

  /**
   * Apply an Ed25519 signature to an unsigned birth certificate. This is
   * the server side of the signing ceremony only: the caller supplies a
   * signature made elsewhere (offline, on Andrei's Mac, with the private
   * half of a registered key). The server verifies the signature against
   * the registered public key and refuses anything else — it can never
   * create a signature itself. The database guard additionally permits
   * this one update and no other.
   */
  async applySignature(input: {
    certificateRegistryId: string
    signature: string
    keyId: string
  }): Promise<GenesisCertificate> {
    if (!isCertificateRegistryId(input.certificateRegistryId)) fail('NOT_FOUND', 'Certificate not found')
    if (typeof input.signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(input.signature)) {
      fail('VALIDATION_FAILED', 'Signature must be a base64url Ed25519 signature')
    }
    if (typeof input.keyId !== 'string' || input.keyId.length < 1 || input.keyId.length > 128) {
      fail('VALIDATION_FAILED', 'Signing key id is required')
    }
    const row = await this.exec
      .selectFrom('greenfield_moliboo_genesis_certificates')
      .selectAll()
      .where('registry_id', '=', input.certificateRegistryId)
      .executeTakeFirst()
    if (!row) fail('NOT_FOUND', 'Certificate not found')
    const certificate = row as unknown as CertificateRow
    if (certificate.signature_state === 'signed') fail('CONFLICT', 'Certificate is already signed')
    const key = await this.exec
      .selectFrom('greenfield_publisher_signing_keys')
      .select(['public_key_pem', 'state'])
      .where('key_id', '=', input.keyId)
      .executeTakeFirst()
    if (!key) fail('NOT_FOUND', 'Signing key not found')
    if (key.state !== 'ACTIVE') fail('VALIDATION_FAILED', 'Signing key is not active')
    const valid = verifyCertificateSignature({
      statement: statementFor(certificate),
      signature: input.signature,
      publicKeyPem: key.public_key_pem,
    })
    if (!valid) fail('VALIDATION_FAILED', 'Signature does not match the certificate statement')
    const now = new Date()
    const updated = await this.exec
      .updateTable('greenfield_moliboo_genesis_certificates')
      .set({
        signature: input.signature,
        signature_key_id: input.keyId,
        signature_state: 'signed',
        verified_at: now,
        updated_at: now,
      })
      .where('registry_id', '=', input.certificateRegistryId)
      .where('signature_state', '=', 'unsigned')
      .executeTakeFirst()
    if (Number(updated.numUpdatedRows) !== 1) fail('CONFLICT', 'Certificate is already signed')
    const reloaded = await this.exec
      .selectFrom('greenfield_moliboo_genesis_certificates')
      .selectAll()
      .where('registry_id', '=', input.certificateRegistryId)
      .executeTakeFirstOrThrow()
    return certificateDto(reloaded as unknown as CertificateRow)
  }
}
