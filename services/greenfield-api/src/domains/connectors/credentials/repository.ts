import type {Kysely, Transaction} from 'kysely'
import type {ConnectorCredentialEnvelope} from '../../../security/encryption/connector-credentials.js'
import type {ModulaDb} from '../../../database/client.js'
import type {Database} from '../../../database/types.js'
import {uuidv7} from '../../../lib/uuidv7.js'
import {connectorError} from '../errors.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>

export type PersistConnectorCredentialInput = {
  accountId: string
  providerId: string
  connectionId: string
  envelope: ConnectorCredentialEnvelope
  tokenType?: string
  expiresAt?: Date | null
}

export type ConnectorCredentialRecord = {
  credentialId: string
  connectionId: string
  keyVersion: string
  algorithm: string
  createdAt: string
  updatedAt: string
  expiresAt: string | null
}

export class ConnectorCredentialRepository {
  constructor(private readonly db: Db) {}

  async persistEncrypted(input: PersistConnectorCredentialInput): Promise<ConnectorCredentialRecord> {
    await this.requireOwnedConnection(input.accountId, input.providerId, input.connectionId)
    const now = new Date()
    const credentialId = uuidv7()
    await this.db
      .insertInto('greenfield_connection_credentials')
      .values({
        credential_id: credentialId,
        connection_id: input.connectionId,
        key_version: input.envelope.keyVersion,
        encryption_algorithm: input.envelope.algorithm,
        nonce: input.envelope.nonce,
        auth_tag: input.envelope.authTag,
        encrypted_payload: input.envelope.ciphertext,
        encrypted_access_token: null,
        encrypted_refresh_token: null,
        encrypted_auxiliary_data: input.envelope.ciphertext,
        token_type: input.tokenType ?? null,
        expires_at: input.expiresAt ?? null,
        created_at: now,
        updated_at: now,
      })
      .execute()
    return this.describe(input.accountId, input.providerId, input.connectionId, credentialId)
  }

  async describe(
    accountId: string,
    providerId: string,
    connectionId: string,
    credentialId?: string,
  ): Promise<ConnectorCredentialRecord> {
    const row = await this.selectCredential(accountId, providerId, connectionId, credentialId)
    if (!row) throw connectorError('NOT_FOUND', 'Connector credential not found')
    return {
      credentialId: row.credential_id,
      connectionId: row.connection_id,
      keyVersion: row.key_version,
      algorithm: row.encryption_algorithm,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      expiresAt: row.expires_at?.toISOString() ?? null,
    }
  }

  async loadEnvelopeForTrustedBackend(
    accountId: string,
    providerId: string,
    connectionId: string,
    credentialId?: string,
  ): Promise<ConnectorCredentialEnvelope> {
    const row = await this.selectCredential(accountId, providerId, connectionId, credentialId)
    if (!row) throw connectorError('NOT_FOUND', 'Connector credential not found')
    if (!row.encrypted_payload || !row.nonce || !row.auth_tag) {
      throw connectorError('SERVER_ERROR', 'Connector credential envelope is incomplete')
    }
    return {
      algorithm: row.encryption_algorithm as ConnectorCredentialEnvelope['algorithm'],
      keyVersion: row.key_version,
      nonce: row.nonce,
      authTag: row.auth_tag,
      ciphertext: row.encrypted_payload,
    }
  }

  private async requireOwnedConnection(accountId: string, providerId: string, connectionId: string): Promise<void> {
    const row = await this.db
      .selectFrom('greenfield_connections')
      .select('connection_id')
      .where('connection_id', '=', connectionId)
      .where('account_id', '=', accountId)
      .where('provider_id', '=', providerId)
      .executeTakeFirst()
    if (!row) throw connectorError('NOT_FOUND', 'Connection not found')
  }

  private async selectCredential(
    accountId: string,
    providerId: string,
    connectionId: string,
    credentialId?: string,
  ) {
    return this.db
      .selectFrom('greenfield_connection_credentials')
      .innerJoin(
        'greenfield_connections',
        'greenfield_connections.connection_id',
        'greenfield_connection_credentials.connection_id',
      )
      .selectAll('greenfield_connection_credentials')
      .where('greenfield_connections.account_id', '=', accountId)
      .where('greenfield_connections.provider_id', '=', providerId)
      .where('greenfield_connections.connection_id', '=', connectionId)
      .$if(Boolean(credentialId), qb => qb.where('greenfield_connection_credentials.credential_id', '=', credentialId!))
      .orderBy('greenfield_connection_credentials.updated_at', 'desc')
      .executeTakeFirst()
  }
}
