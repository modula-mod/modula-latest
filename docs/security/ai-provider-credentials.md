# AI Provider Credentials

Provider credentials are Greenfield runtime credentials. They are not module credentials and must never be stored in module manifests, frontend code, audit payloads or provider registry metadata.

Credentials are stored in `ai_provider_credentials` using AES-256-GCM envelope encryption with:

- Credential ID.
- Provider ID.
- Scope type and scope ID.
- Ciphertext.
- Encryption key version.
- Nonce.
- Authentication tag.
- Created, updated, rotated and verification timestamps.
- Last verification status code.

Scopes supported by the backend are:

- `platform`
- `organisation`
- `account`
- `development`

API responses return metadata only. Secret values are not returned after creation. Logs redact `providerCredential`, `apiKey`, credential, key, token and secret paths. Audit entries use metadata-only actions for creation, rotation, deletion and verification state.

Production-like environments require `MODULA_AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY`. Test uses a deterministic key; development may use an ephemeral process key. Ephemeral keys are not a persistence model.
