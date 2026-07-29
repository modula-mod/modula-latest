# Phase 7E AI Provider Runtime Validation

Scope: Block 9, Greenfield AI Provider Runtime and Secure Execution Gateway.

Definition of Done evidence comes from:

- Deterministic provider runtime tests with an isolated database.
- Provider registry, credential, routing, streaming, structured output, usage ledger, quota, tool, health and security focused verifiers.
- Prior Block 8 AI platform foundation verifier.
- Migration apply, rollback and reapply of `025_phase7e_ai_provider_runtime`.

Commands:

```bash
pnpm --filter @modula/greenfield-contracts build
pnpm --filter @modula/greenfield-api build
pnpm --filter @modula/greenfield-api exec vitest run tests/phase7e.ai-provider-runtime.test.ts
node scripts/verify-phase7e-ai-platform-foundation.mjs
node scripts/verify-phase7e-ai-provider-runtime.mjs
```

Opt-in hosted smoke:

```bash
PHASE7E_REAL_PROVIDER_SMOKE=1 OPENAI_API_KEY=... pnpm smoke:phase7e-openai-provider
```

The hosted smoke is intentionally excluded from the default verifier. It sends one minimal structured request, validates output and token usage, and redacts output content in logs.

Assertions:

- Provider configured.
- Credentials encrypted.
- Provider health verified.
- Module AI request accepted only when policy and installation permissions allow it.
- Prompt resolved by immutable version.
- Model selected by capability-aware routing.
- Context minimized.
- Deterministic provider invoked.
- Stream delivered and replayed.
- Usage recorded in the existing ledger.
- Structured output validated and invalid output fails closed.
- Cancellation works.
- Quota blocks an excess request before provider cost.
- Provider failure triggers bounded fallback.
- Disabled module cannot execute AI request.

No production deployment is part of this block.

Explicitly not implemented:

- Vault Notes AI product actions.
- Social AI product actions.
- GAIA orchestration.
- RAG, embeddings, vector search or long-term memory.
- AI billing.
- End-user provider credential entry UI.

Provider credentials are not module credentials. Providers are interchangeable implementations. Usage estimates are not billing. Private context requires separate authorization. Hidden model reasoning is never exposed.
