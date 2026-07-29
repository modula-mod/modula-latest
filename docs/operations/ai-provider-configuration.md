# AI Provider Configuration

Provider configuration is backend-operated in Block 9. There is no end-user provider key UI.

Supported modes:

- `disabled`
- `platform-managed`
- `customer-managed`
- `local`
- `development-mock`

Operational routes:

- `GET /v1/admin/ops/ai/providers`
- `GET /v1/admin/ops/ai/providers/:providerId/health`
- `POST /v1/admin/ops/ai/providers/:providerId/verify`
- `POST /v1/admin/ops/ai/providers/:providerId/disable`
- `POST /v1/admin/ops/ai/providers/:providerId/enable`
- `POST /v1/admin/ops/ai/providers/:providerId/credentials`

Credential writes are operator-protected and never return the credential material. Use `provider:development-mock` for deterministic local verification, `provider:ollama` or `provider:local` for private deployments, and `provider:openai` for the hosted adapter.

Runtime controls are code-configured in Block 9:

- Maximum request input.
- Maximum output.
- Maximum context fragments.
- Maximum tool definitions.
- Maximum prompt variables.
- Per-request timeout.
- Stream lifetime.
- Maximum retries.
- Maximum tool calls.

No production deployment is part of Block 9.
