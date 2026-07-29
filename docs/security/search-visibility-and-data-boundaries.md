# Search Visibility And Data Boundaries

Unified search is allowed to discover Greenfield content only through permission-aware projections. It must not become a secondary copy of private account data.

## Data Classification

Search documents store discovery fields only:

- title, body, summary, keywords, tags and language where the source entity permits indexing;
- visibility, status, owner and account identifiers for enforcement;
- redacted metadata needed for result rendering, diagnostics and ranking.

Projection failure records store sanitized details only. They do not store raw post bodies, private profile fields, connector payloads, secrets or provider responses.

## Source Event Boundary

Domain events that feed search are metadata-only facts. They identify the entity and source version but do not carry private body content. Projectors read the current source record and apply the per-entity indexing rules.

## Post Indexing

Permitted:

- post text for non-draft records;
- safe link title and description;
- hashtags;
- permitted media descriptions;
- language;
- public author display metadata.

Excluded:

- private drafts;
- hidden moderation data;
- internal moderation notes;
- inaccessible media metadata;
- private account fields.

Deleted posts become tombstones and cannot remain active searchable content.

## Profile Indexing

Permitted:

- display name;
- handle;
- bio;
- public location when enabled;
- public links;
- public profile tags;
- profile/module tab metadata intended for discovery.

Excluded:

- email;
- phone number;
- private birthday;
- internal account IDs as visible content;
- private profile fields;
- security metadata.

Account deactivation and deletion-request events tombstone profile search documents.

## Module Indexing

Permitted:

- name and description;
- publisher;
- categories and capabilities;
- supported platforms;
- trust state;
- standard and module versions;
- compatibility metadata;
- status.

Quarantined, revoked or unavailable modules are not returned as normal installable results.

## Query Enforcement

Search enforcement order is:

```
parse request
  -> resolve actor/account context
  -> exclude obviously inaccessible candidates in SQL
  -> evaluate central policy for candidate results
  -> redact metadata
  -> return results
```

The database query excludes active private/account/follower records that are outside the actor's scope. The policy engine remains the final authority for ambiguous visibility and module states.

Inaccessible results are normally omitted. The platform uses stable internal denial codes such as `RESOURCE_NOT_VISIBLE`, `ACCOUNT_SCOPE_REQUIRED`, `MODULE_NOT_ENABLED`, `MODULE_QUARANTINED`, `SEARCH_ENTITY_NOT_SUPPORTED` and `SEARCH_FILTER_NOT_ALLOWED`.

## Query Safety

The parser enforces:

- Unicode normalization;
- whitespace normalization;
- control-character rejection;
- query length bounds;
- entity type and tag count limits;
- limit bounds;
- safe cursor decoding;
- configured timeout;
- no raw SQL fragments from user input;
- no user-defined rank expressions;
- no untrusted regex execution.

## Autocomplete And Recent Searches

Suggestions are restricted to public profile handles, public module names and the current account's recent exact searches. Private post content is not used for autocomplete.

Recent searches are account-scoped, deduped by normalized query and bounded by configuration. Unauthenticated searches are not persisted.

## Operator Diagnostics

Operator diagnostics expose counts, lag, failures and latency. They do not expose private query text, post bodies or raw search vectors by default.
