# Greenfield AI Routing

AI routing is deterministic and explainable. Modules cannot bind directly to a provider. A module declares capabilities and permissions; Greenfield resolves the target provider and model from policy, registry state, health and quota.

Supported strategies in Block 9:

- `fixed`: use the preferred provider/model only when all required capabilities match.
- `capability-first`: sort eligible targets by capability fit and stable registry order.
- `local-first`: prefer local/private providers, then fall back to eligible hosted providers.

Resolver inputs:

- Required model capabilities.
- Preferred model and provider.
- Permitted provider list.
- Account and module policy context.
- Account cloud preferences (`allowRemoteCloud`, default routing strategy, preferred provider, monthly budget).
- Provider health and circuit state.
- Structured output and streaming requirements.
- Quota preflight status.

## Account cloud gate

Routing is local-first by default and cloud is opt-in per account (`greenfield_ai_account_preferences`, migration 102). The runtime and gateway load the account's preferences before resolution:

- `allowRemoteCloud` defaults to `false`. While false, non-local providers are excluded from resolution entirely — a request that can only be served by a cloud model fails closed (`CAPABILITY_DISABLED`), it never silently falls back to cloud.
- `defaultRoutingStrategy` defaults to `local-first`. A module manifest's declared strategy overrides the account default; an explicit per-request strategy overrides both.
- `preferredProviderId` (optional) scores that provider's models first; with strategy `fixed` it is the only eligible provider.
- `monthlyBudgetMinorUnits` (optional) is mirrored into an `estimated-spend` usage-limit row, so the existing quota machinery enforces it. The quota preflight refuses a call when accrued spend already meets the budget. Cost accrues post-call from operator-set per-model pricing in the model row's `limits` metadata (`inputPricePerMillionMinorUnits` / `outputPricePerMillionMinorUnits`); a model without pricing accrues no cost and a budget does not bind for it. Known limitation: quota buckets reset daily (see `bucketStartFor` in `quota-service.ts`), so a "monthly" budget currently counts only today's spend — it under-enforces across days and must be fixed before budgets are offered as a billing control.

Resolver output:

- Selected provider ID.
- Selected model ID.
- Human-readable reason.
- Bounded fallback targets.

Resolution fails closed. A request that requires structured output cannot select a model without reliable structured output support. A streaming request cannot select a non-streaming model. A module that declares text generation does not implicitly gain vision, audio, embeddings or tool-calling access.

Failover is allowed only when the failure is retryable, no stream has materially progressed, policy permits alternatives, the output contract remains satisfiable and the retry budget is not exhausted.
