# Phase 7D Connector Credential Key Rotation

Status: prepared, not yet applied to production.

Connector credentials are encrypted server-side with AES-256-GCM envelopes. Each stored credential record carries:

- `encryption_algorithm`
- `key_version`
- `nonce`
- `auth_tag`
- `encrypted_payload`

Plaintext access tokens, refresh tokens, PKCE verifiers, client secrets and provider error bodies must not be written to database rows, logs, queue payloads or frontend responses.

## Required Environment

`MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY` must be a base64-encoded 32-byte key outside development/test.

`MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS` may be set during rotation and is decrypt-only. It must be removed after all rows have been re-encrypted with the current key version and the deployment has passed acceptance.

Tests use deterministic key material only under `NODE_ENV=test`.

## Rotation Procedure

1. Generate a new 32-byte key on a trusted operator machine.
2. Move the current production key into `MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS`.
3. Set the new key as `MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY`.
4. Restart the trusted backend only; do not expose either key to frontend, workers, shell history or logs.
5. Run the connector security verifier and targeted credential round-trip tests.
6. Run a controlled re-encryption job that decrypts each credential with its stored key version and writes a new envelope using the current key version.
7. Confirm no credential rows remain on the previous key version.
8. Remove `MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS`.
9. Restart services and rerun connector security and lifecycle verifiers.

The re-encryption job must process credentials inside trusted backend code and must not place plaintext credentials in queue payloads or audit metadata.
