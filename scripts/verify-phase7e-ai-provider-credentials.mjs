#!/usr/bin/env node
import {finish, verifierIncludes} from './phase7e-ai-provider-runtime-verifier-utils.mjs'

verifierIncludes('services/greenfield-api/migrations/025_phase7e_ai_provider_runtime.sql', [
  'CREATE TABLE IF NOT EXISTS ai_provider_credentials',
  'encrypted_payload BYTEA NOT NULL',
  'encryption_key_version TEXT NOT NULL',
  'nonce BYTEA NOT NULL',
  'authentication_tag BYTEA NOT NULL',
  'last_verification_code',
], 'AI provider credentials table stores encrypted payload metadata only')

verifierIncludes('services/greenfield-api/src/security/encryption/ai-provider-credentials.ts', [
  'AES-256-GCM',
  'createCipheriv',
  'createDecipheriv',
  'authTag',
  'ai-provider-credentials',
], 'AI provider credential envelope uses AES-256-GCM with authenticated data')

verifierIncludes('services/greenfield-api/src/ai/credential-service.ts', [
  'AIProviderCredentialService',
  'storeCredential',
  'decryptCredentials',
  'ai.provider.credential.created',
  'credential_id',
], 'AI provider credential service stores, resolves and audits redacted credential metadata')

verifierIncludes('services/greenfield-api/src/config/env.ts', [
  'MODULA_AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY',
  'aiProviderCredentialEncryptionKeyIsEphemeral',
  'aiProviderCredentialEncryptionKeysByVersion',
], 'AI credential encryption key configuration is explicit outside test/development')

finish('Phase 7E AI provider credentials verifier')
