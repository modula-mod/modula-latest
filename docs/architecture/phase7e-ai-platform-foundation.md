# Phase 7E Block 8: Greenfield AI Platform Foundation

Block 8 establishes Greenfield AI as a shared platform service, not as module-local provider integrations. Every AI request flows through the Greenfield AI Gateway. Modules request AI through Greenfield contracts. Greenfield owns provider resolution, model selection, prompt registry, context authorization, structured-output schemas, streaming state, tool brokering, usage ledger, audit and policy enforcement.

## Request Path

```
Module
  -> Greenfield AI Gateway
  -> Provider adapter interface
  -> OpenAI / Anthropic / Google / Ollama / LM Studio / Azure OpenAI / local / future providers
  -> structured output, streaming, usage ledger, audit and policy
```

Modules must not construct OpenAI, Anthropic, local-runtime or other provider-specific payloads. The gateway accepts `GreenfieldAIRequestContract` and rejects provider/model/provider-payload fields outside the platform registry.

## Implemented Foundation

- Shared contracts: `packages/greenfield-contracts/src/ai.ts`.
- Module AI declarations: `packages/greenfield-module-manifest/src/ai.ts`.
- Module SDK helper: `packages/greenfield-module-sdk/src/define-ai.ts`.
- Storage migration: `services/greenfield-api/migrations/024_phase7e_ai_platform_foundation.sql`.
- Backend services:
  - provider/model registry and prompt registry;
  - AI gateway request validation and ledger writes;
  - context builder with policy-based resource filtering;
  - tool broker with schema, permission, side-effect and confirmation checks;
  - generic streaming state with token/progress metadata and reconnect/cancel hooks.
- API surfaces:
  - `/v1/ai/providers`;
  - `/v1/ai/models`;
  - `/v1/ai/requests`;
  - `/v1/modules/:moduleId/ai/requests`;
  - `/v1/ai/streams/:streamId/reconnect`;
  - `/v1/ai/streams/:streamId/cancel`;
  - `/v1/ai/tools/:toolId/validate`;
  - `/v1/admin/ai/providers`;
  - `/v1/admin/ai/models`;
  - `/v1/admin/ai/prompts`;
  - `/v1/admin/ai/tools`.

## Data Boundary

The request ledger records provider, model, prompt reference, module, account, actor, installation, latency, token counts, cost estimate, status, retries and correlation data. It does not store provider payloads, prompt templates, note content, response bodies or streamed tokens.

Domain events and audit records use metadata-only payloads. Streaming progress stores token length and sequence metadata, not token text.

## Policy Boundary

The gateway uses the existing `GreenfieldPolicyEngine` for `ai.*` decisions. Context assembly uses `ai.context.build` decisions per resource. Tool validation uses `ai.tool.call` decisions and records confirmation requirements before execution.

## Module Standard Addition

Modules declare AI capabilities, not providers:

```json
{
  "ai": {
    "features": ["summarise", "classify", "extract", "generate"],
    "tools": ["note.search", "note.create"],
    "requiredCapabilities": ["chat", "structured-output"]
  }
}
```

Provider names, provider IDs, model IDs and provider payloads are rejected from module AI declarations.

## Module Service Mesh Direction

Block 8 records the long-term Module Service Mesh requirement introduced after module-managed backends. Modules should not call each other directly:

```
CRM -> Greenfield Service Gateway -> Notes
```

The service gateway should enforce installation checks, version compatibility, permissions, audit logging, request tracing, rate limiting and policy evaluation across greenfield-managed, module-managed, hybrid and frontend-only modules. This gateway is not implemented in Block 8; it is a required architecture addition before future inter-module workflows depend on module-managed backends.

## Explicit Deferrals

Block 8 does not implement Gaia autonomous planning, multi-agent orchestration, autonomous background execution, AI inside Vault Notes, AI inside CRM, embeddings, vector search, RAG, long-term autonomous memory, AI billing, fine-tuning, model training or provider API calls.
