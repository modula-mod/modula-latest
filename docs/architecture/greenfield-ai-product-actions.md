# Greenfield AI Product Actions

Phase 7E Block 10 adds provider-neutral AI product actions as a module capability. A module declares bounded actions, schema refs and context policy; the host resolves prompts, permissions, model capabilities and provider runtime details.

The canonical declaration belongs to the external Modula Module Standard 1.2 repository. The main app package is only a compatibility facade and must not become the source of truth.

## Execution Shape

The product action route is:

`POST /v1/modules/:moduleId/ai/actions/:actionId/executions`

The route resolves the installed module, validates the declaration, checks the permission review, loads the immutable prompt, builds server-side context and submits a provider-neutral request through the Greenfield AI gateway. It never accepts arbitrary system prompts from the frontend.

Modules may declare action ids, labels, prompt ids, schema refs, required permissions, required capabilities, context limits, streaming mode and application mode. They must not declare provider ids, provider URLs, API keys, provider payloads, model-specific request bodies or response parsing.

Vault Notes 1.1 declares:

- `vault-notes.ai.summarise`
- `vault-notes.ai.suggest-title`
- `vault-notes.ai.rewrite-selection`
- `vault-notes.ai.extract-action-items`
- `vault-notes.ai.suggest-tags`

AI remains optional. Vault Notes 1.0 and Vault Notes 1.1 without AI permissions still perform ordinary note operations.

## Events

Product action events are metadata-only: `ai.product-action.requested`, `ai.product-action.completed`, `ai.product-action.rejected`, `ai.product-action.applied` and `ai.product-action.expired`. Payloads may include action ids, execution ids, provider/model metadata, status and usage. They must not include note body, selected text, generated text, credentials or system instructions.
