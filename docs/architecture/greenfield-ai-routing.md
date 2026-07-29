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
- Provider health and circuit state.
- Structured output and streaming requirements.
- Quota preflight status.

Resolver output:

- Selected provider ID.
- Selected model ID.
- Human-readable reason.
- Bounded fallback targets.

Resolution fails closed. A request that requires structured output cannot select a model without reliable structured output support. A streaming request cannot select a non-streaming model. A module that declares text generation does not implicitly gain vision, audio, embeddings or tool-calling access.

Failover is allowed only when the failure is retryable, no stream has materially progressed, policy permits alternatives, the output contract remains satisfiable and the retry budget is not exhausted.
