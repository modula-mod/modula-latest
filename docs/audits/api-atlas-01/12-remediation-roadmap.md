# Remediation Roadmap

API-ATLAS-01 made no product, schema, nginx or production changes. The following missions are ordered by security boundary and dependency, not by implementation convenience.

## API-FIX-01 — Trust, privacy and permission fail-closed controls

Require signed production releases, backfill publisher keys/signatures, remove the manifest-permission fallback, create recorded grants for active installs, implement follower requests, account-scope legacy function/AI-stream operations and apply uniform private-resource 404 semantics. Add isolated cross-user/module/intelligence acceptance identities. Covers the P1 trust, ownership and privacy findings.

## API-FIX-02 — Registry bytes, ingestion and Product Hub integrity

Make package/artwork blob presence a publication gate; backfill or withdraw incomplete releases; enable a reviewed signed GitHub source; publish non-development artwork; normalize historical descriptors. Depends on FIX-01 signing policy.

## API-FIX-03 — Media integrity and recovery

Move legacy post upload to canonical attachments, align narrow nginx limits, enforce byte-signature validation for stories, schedule orphan/expired cleanup, canonicalize profile media and prove media backup/restore. Includes storage readiness.

## API-FIX-04 — Social contract and delivery reliability

Fix idempotent reaction notification creation and replay dead letters; make follow/reaction/comment counter mutations conflict-safe; validate feed mode; paginate and batch Discover/activity; define notifications polling/SSE/push expectations; add profile link CRUD.

## API-FIX-05 — Post/composer contract completion

Choose explicit link and poll product support. Either add schema/storage/serialization/tests or remove the client affordances. Consolidate legacy sessions/likes/media behind declared canonical routes and deprecation windows.

## API-FIX-06 — Generic module runtime completion

Move Vault-specific intelligence, AI, search, Board and presentation branches into module declarations/projectors/actions. Exercise record CRUD, settings, references, sensitive fields and function paths with a neutral third-party reference module. Enable community/remote execution only after sandbox and outbound policy review.

## API-FIX-07 — Operational intelligence and Nodus boundary

Replace fixture-only GAIA planning with a governed operational provider/local planner; define Nodus local handshake, offline proposal and ledger synchronization; preserve AKI DENY/ABSTAIN behavior and human approval gates. Run production-safe mission acceptance with a non-mock provider.

## API-FIX-08 — Contracts, health and observability

Introduce shared request/response schemas at auth, admin, upload, module and intelligence boundaries; promote generated OpenAPI to canonical only after schema coverage; add worker/storage readiness, edge-to-worker correlation, metrics/alerts, dead-letter tooling and effect assertions for no-op jobs.

## Release-governance follow-up

Converge the running feature revision through reviewed `origin/main` history while preserving the dirty canonical checkout. Rebuild/deploy exact reviewed main, verify OCI/version/route/migration identity and retain rollback. This is deliberately not performed by the audit mission.
