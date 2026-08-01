# Phase 7E AI Product Integration Validation

Scope: Vault Notes 1.1 proves user-controlled AI product actions over the Greenfield AI gateway. No production deployment is performed.

Required evidence:

- Module Standard 1.2 owns provider-neutral AI product actions.
- Vault Notes 1.1 validates with optional AI permissions.
- Notes operate without AI grants.
- AI permission review appears and can be declined or granted.
- A deterministic provider executes a Vault Notes action in integration tests.
- The note is unchanged before explicit application.
- Applying an accepted result increments the revision and records AI-assisted provenance.
- Search updates only through the normal note update path.
- Stale, expired, duplicate, disabled-module, revoked-permission and cross-account applications fail.

Default validation uses deterministic provider coverage only. Real-provider smoke is opt-in:

`PHASE7E_REAL_PROVIDER_SMOKE=1 OPENAI_API_KEY=... pnpm smoke:phase7e-vault-notes-ai`

Smoke logs redact note and generated content and report only action id, provider/model metadata, response id, usage, latency, output size and output hash prefix.
