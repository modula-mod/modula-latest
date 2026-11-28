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
- `provider:anthropic`: direct adapter for the Anthropic Messages API (`x-api-key`, `anthropic-version: 2023-06-01`; streaming SSE; structured output via a forced `greenfield_response` tool).
- `provider:gemini`: direct adapter for the Google Generative Language API (`x-goog-api-key`; `:generateContent` / `:streamGenerateContent`; structured output via `responseMimeType: application/json` + `responseSchema`).
- `provider:ollama` and `provider:local`: local adapter path for private Ollama deployments.

When `MODULA_AI_BACKEND_URL` is configured, the registry instead wires all hosted providers through the Modula AI backend proxy (`ModulaAIBackendProviderAdapter`); the direct adapters above are used when it is not. Either way the provider is interchangeable: identity, personality and memory are assembled provider-neutrally in `buildProviderMessages` (system + developer + fragments + prompt) and adapters only translate messages, so the Moliboo answering is the same regardless of which model answers. Both direct adapters merge consecutive same-role messages (Anthropic/Gemini require strictly alternating roles) and map `system` to Anthropic's top-level `system` / Gemini's `systemInstruction`. Neither API offers a server-side cancel; `cancel()` is an explicit no-op and the runtime aborts via `AbortSignal`.

Cloud use is gated per account (see `greenfield-ai-routing.md`): local-first by default, cloud only when the account opts in. Credentials are scoped encrypted credentials (account → platform → development resolution); account keys are managed through the self-service routes, never stored in code, and revocable.

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

The Anthropic adapter follows the Messages API:

- https://docs.anthropic.com/en/api/messages
- https://docs.anthropic.com/en/api/messages-streaming

The Gemini adapter follows the Generative Language API:

- https://ai.google.dev/api/generate-content
- https://ai.google.dev/api/generate-content#method:-models.streamgeneratecontent
