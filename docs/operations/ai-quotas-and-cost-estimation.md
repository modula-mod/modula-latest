# AI Quotas And Cost Estimation

Quotas are generic controls, not billing.

Supported scopes:

- Platform.
- Organisation.
- Account.
- Module.
- Installation.
- Provider.
- Model.

Initial limit kinds:

- Requests per minute.
- Concurrent executions.
- Daily input units.
- Daily output units.
- Estimated spend.
- Maximum single-request size.

Usage units are provider-neutral:

- Input tokens.
- Output tokens.
- Cached input tokens.
- Image units.
- Audio seconds.
- Provider cost minor units.
- Currency.

The existing AI request ledger remains authoritative for completed usage. `ai_quota_consumption` records quota buckets and metadata needed to enforce limits. Cost estimates are stored as metadata and must not be presented as exact charges. When cost values exist, currency is recorded explicitly and integer minor units are preferred.
