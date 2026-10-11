# MODULE-PLATFORM-02 repository truth

Frozen base: `d13bb309fd09a8025733bf44fab4033591b485b6`

The hard-start capture on 2026-10-11 found a clean production checkout on
`main`; checkout `HEAD`, `origin/main`, API OCI revision and worker OCI revision
all matched the frozen base. Production was at migration
`067_legacy_duplicate_installation_versions`; public live and ready probes
returned 200; the database worker heartbeat was current; and the committed API
Atlas verifier passed 92/92 checks with no source-only or runtime-only routes.

State meanings:

- **EXISTS**: generic, exposed and adequately governed for the requested use.
- **PARTIAL**: reusable implementation exists but the listed gap prevents the
  complete generic contract.
- **MISSING**: no reusable implementation of the requested primitive.
- **BROKEN**: an exposed implementation violates required semantics/security.
- **SPECIAL-CASED**: production behavior branches on a product rather than a
  generic declaration or immutable historical adapter.

| Capability | State | Existing implementation | Gap preventing generic module use | Frozen generic direction |
| --- | --- | --- | --- | --- |
| Records | PARTIAL | Generic module CRUD, schemas, permissions, trust boundary, filtering and soft deletion in `modules/record-service.ts`; transactional row/event/audit writes | Two record substrates; no public stable DTO, mutation identity or shared-access policy; pre-read concurrency race | Canonical module record identity plus mutation ledger, revision-safe writes and shared access evaluator |
| Structured properties | PARTIAL | Product UI field declarations include rich text, record and asset references | Runtime validates shallow field shapes and does not enforce persisted schema definitions | Portable property value schemas; record/asset references become typed identities |
| Relationships | PARTIAL | Collections declare `referenceFields` | No normalized edge, target validation or access enforcement | Revision-derived forward edges with source field path and ordinal |
| Reverse references | MISSING | None | No query/index and no visibility-safe backlink policy | Target-indexed edge query; return only source records readable at query time |
| History | PARTIAL / BROKEN | Current revision, hash-chained events and prior snapshots exist | No list/get API; incomplete actor/base/result/mutation metadata; pruning and grants violate append-only requirement | Immutable revision rows for every mutation; list/get/current/restore API |
| Restore | BROKEN | Existing restore only undeletes current state | Cannot restore a selected historical revision | Restore revision K as a new mutation producing revision N+1 |
| Optimistic concurrency | PARTIAL / BROKEN | `expectedRevision` exists | Check occurs before transaction/lock and uses Vault-named error | Atomic compare-and-swap or row lock; `REVISION_CONFLICT` |
| Mutation idempotency | PARTIAL | Module actions and multiple platform domains have idempotency ledgers | Direct record/media/share mutations lack it; action effect and ledger are not atomic | Required `mutationId`/`Idempotency-Key`, payload hash, transactional replay ledger |
| Incremental sync | MISSING | Record events and soft-deleted rows are reusable raw material | List cursor is OFFSET; no durable change cursor, tombstone or revocation signal | Opaque account/install/module-scoped cursor over monotonic change sequence |
| Tombstones | PARTIAL | Soft deletion plus delete events | No exposed sync tombstone/retention rule; purge erases current row | Durable sync tombstone subject to explicit retention/privacy purge |
| Media | PARTIAL | Generic upload, ownership, checksum/MIME validation and delivery paths | Bindings only cover platform post/profile/comment use; module asset references are strings | Module-record/media binding with role/path/order/caption and record-aware authorization |
| Sharing | MISSING | Post share intent log; declarative share action payload | No record access grant, expiry or revoke semantics | Recipient record grant (`read`/`edit`) scoped to record only |
| Settings capabilities | BROKEN | Explicit permission review storage and reusable runtime access boundary | Only `settings:register` validates; settings routes do not enforce enabled/trust/review/effective read/write permission | Separate `settings:register`, `settings:read`, `settings:write`; no implicit conversion |
| Functions | PARTIAL | Manifest definitions, legacy installed function table, safe remote fetch, queued first-party functions | Fragmented runtimes; no unified trust/review/schema/required-permission/audit gate; declarative invocation disabled | Declared function identity/version and governed invocation; unsupported execution modes fail explicitly |
| Inter-module actions | PARTIAL | Service invocation ledger and extension fabric provide account, grant, rate and idempotency foundations | Caller can be self-asserted on one route; no normalized target action contract or symmetric trust/review gate | Source installation requests a declared target action; target executes after both-sided governance |
| Search projection | SPECIAL-CASED / PARTIAL | Search documents, idempotent projection/tombstones and result visibility checks | Closed entity union and worker routing hard-code Vault note/folder | Generic module-record projection from release-declared fields; legacy Vault event aliases only as adapters |
| Intelligence broker | PARTIAL / SPECIAL-CASED | Provider-neutral tasks and fail-closed local-only/prefer-local/allow-remote routing | Server request contract lacks policy/discovery; no host Nodus bridge; product actions and GAIA enumerate Vault | Unified request/capability DTO; `localOnly` never reaches GreenField; dynamic declared actions |
| Product UI | PARTIAL | Safe declarative frontend artifact and typed fields/actions | Serious primitives missing; adapter drops/collapses semantics and marks views available without renderer proof | Versioned renderer-neutral primitives plus truthful availability/fallback negotiation |
| Host capability discovery | MISSING | Modules can declare required/optional capabilities | No host/runtime support response | Versioned `host.capabilities` response with status, renderer, fallback and limits |
| Error contract | PARTIAL | Shared envelopes include review, permission, disabled and trust errors | Vault-specific revision code and missing cursor/function/capability codes; duplicated mappings | Canonical platform codes with bounded compatibility aliases |
| Auditability | PARTIAL | Record/action/service success paths use transactional audit/ledgers | Settings, legacy functions and permission denials lack structured audit evidence | Redacted structured audit for denied and security-sensitive mutations |
| Synthetic fixtures | MISSING | Several reference fixtures exist | No neutral alpha/beta cross-module capability acceptance | `audit.module.alpha` and `audit.module.beta` fixtures cover records through actions |

## Reuse decisions

The implementation MUST extend the existing runtime access resolver, module
record tables/services, attachment platform, action/service ledgers, search
document projector, intelligence router and product frontend validators. It MUST
NOT introduce a parallel module database, media store, search engine or AI
provider binding.

## Vault-specific behavior disposition

| Area | Decision | Reason |
| --- | --- | --- |
| Search note/folder projector and closed entity union | GENERALIZE | Searchable module records are a platform concept |
| AI product-action service and GAIA action selection | GENERALIZE; fixture planner moves to tests | Action discovery must come from owned, enabled, trusted declarations |
| Board defaults and routing | GENERALIZE | Consume declared widget/contribution metadata |
| Composer/feed save-to-Vault | GENERALIZE | Use a declared inter-module action |
| Presentation covers/previews | GENERALIZE | Use immutable release assets and neutral fallbacks |
| Deprecated canonical manifest overlay | REMOVE | It is not a runtime contract |
| Canonical identity aliases and legacy data conversion | KEEP TEMPORARILY | They interpret immutable historical data; they must remain bounded migration adapters, not new dispatch branches |
| Migration 022 Vault event names | KEEP AS HISTORY; add generic events | Applied migrations are immutable |

No new generic runtime code may branch on
`digital.modula.vault-notes`. Historical migrations, identity aliases, fixtures
and regression tests may name it when the reference is literal and documented.
