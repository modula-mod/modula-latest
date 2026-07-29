# Greenfield AI Provider Runtime

Phase 7E Block 9 connects the provider-neutral AI substrate to real provider adapters without adding product AI features. The runtime remains below Vault Notes, social assistance, GAIA and future RAG/memory layers.

The execution flow is:

1. Authenticated module request.
2. Module declaration and installation permission check.
3. Policy evaluation and audit.
4. Immutable prompt version resolution.
5. Context minimisation and redaction.
6. Model capability resolution.
7. Deterministic provider routing.
8. Provider adapter execution or stream.
9. Structured output validation.
10. Usage ledger and quota accounting.
11. Metadata-only event publication.
12. Redacted response.

Provider-specific request and response payloads are contained in `services/greenfield-api/src/ai/providers/*`. Module contracts, route contracts, prompt registry records, usage ledger rows and frontend code only see provider-neutral contracts from `packages/greenfield-contracts/src/ai.ts`.

Implemented adapters:

- `provider:development-mock`: deterministic local provider for verifiers.
- `provider:openai`: hosted provider adapter using server-side credentials and the OpenAI Responses API.
- `provider:ollama` and `provider:local`: local adapter path for private Ollama deployments.

Explicit deferrals:

- No Vault Notes AI rewriting.
- No social AI assistance.
- No GAIA orchestration.
- No RAG, embeddings, vector search or long-term memory.
- No autonomous tool loops.
- No AI billing.
- No end-user provider key entry UI.

The OpenAI adapter follows the official Responses API, streaming events, cancellation and structured output guidance:

- https://developers.openai.com/api/reference/overview
- https://developers.openai.com/api/reference/resources/responses/streaming-events
- https://developers.openai.com/api/docs/guides/structured-outputs
