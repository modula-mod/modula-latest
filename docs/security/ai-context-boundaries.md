# AI Context Boundaries

Context construction follows data minimisation. Modules do not receive private context by default merely because they can request AI.

Each context fragment carries:

- Source type.
- Optional source ID.
- Classification.
- Content.
- Optional token estimate.
- Required permissions.
- Retention policy.

Classifications:

- `public`
- `internal`
- `private`
- `sensitive`
- `restricted`

Permission boundaries:

- Public and internal context require `ai.context.public`.
- Private and sensitive context require `ai.context.private`.
- Restricted context requires `ai.context.restricted` and is denied by default.

The context builder evaluates policy per fragment, redacts obvious secret-like fields, enforces fragment and token budgets, and persists only metadata summaries. Ordinary execution, audit and event records do not store unrestricted prompt bodies or response bodies.

Private context requires separate authorization. A module with `ai.request` alone cannot access private profile, module, vault or account data.
