import type {AppConfig} from '../../../config/index.js'
import type {ModulaDb} from '../../../database/client.js'
import {
  ConnectorCredentialEncryptionService,
  type ConnectorCredentialPlaintext,
} from '../../../security/encryption/connector-credentials.js'
import {
  ConnectorCredentialRepository,
  type ConnectorCredentialRecord,
} from './repository.js'

export type StoreConnectorCredentialInput = {
  accountId: string
  providerId: string
  connectionId: string
  credentials: ConnectorCredentialPlaintext
}

export class ConnectorCredentialService {
  private readonly encryption: ConnectorCredentialEncryptionService
  private readonly repository: ConnectorCredentialRepository

  constructor(db: ModulaDb, config: AppConfig) {
    this.encryption = new ConnectorCredentialEncryptionService(config)
    this.repository = new ConnectorCredentialRepository(db)
  }

  async storeEncrypted(input: StoreConnectorCredentialInput): Promise<ConnectorCredentialRecord> {
    const envelope = this.encryption.encryptCredentials(
      {
        accountId: input.accountId,
        providerId: input.providerId,
        connectionId: input.connectionId,
        purpose: 'connector-credentials',
      },
      input.credentials,
    )
    return this.repository.persistEncrypted({
      accountId: input.accountId,
      providerId: input.providerId,
      connectionId: input.connectionId,
      envelope,
      tokenType: input.credentials.tokenType,
      expiresAt: input.credentials.expiresAt ? new Date(input.credentials.expiresAt) : null,
    })
  }

  async decryptForTrustedBackend(input: {
    accountId: string
    providerId: string
    connectionId: string
    credentialId?: string
  }): Promise<ConnectorCredentialPlaintext> {
    const envelope = await this.repository.loadEnvelopeForTrustedBackend(
      input.accountId,
      input.providerId,
      input.connectionId,
      input.credentialId,
    )
    return this.encryption.decryptCredentials(
      {
        accountId: input.accountId,
        providerId: input.providerId,
        connectionId: input.connectionId,
        purpose: 'connector-credentials',
      },
      envelope,
    )
  }
}
