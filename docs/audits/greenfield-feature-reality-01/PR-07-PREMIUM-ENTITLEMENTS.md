# GREENFIELD FEATURE REALITY 01 — PR-07 Premium entitlements and billing QA

Date: 2 November 2026  
Mission item: PR-07  
Repository: `modula-mod/modula-latest`  
Branch: `feat/qa-premium-entitlements`  
Base SHA: `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`  
Environment: isolated disposable PostgreSQL and source-level candidate only  
Production deployment: prohibited and not performed

## Completion record

MISSION ITEM: PR-07 — PREMIUM ENTITLEMENTS AND BILLING QA  
STATUS: PARTIAL  
BRANCH: `feat/qa-premium-entitlements`  
PR URL: https://github.com/modula-mod/modula-latest/pull/158  
BASE SHA: `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`  
HEAD SHA: The draft PR head is authoritative after publication  
ROUTES ADDED: 4  
ROUTES MODIFIED: 6  
ATLAS UPDATED: YES — JSON, CSV, DOCX and generated OpenAPI  
MIGRATIONS: `084_greenfield_premium_apple_sandbox.sql` with QA-only down migration  
TESTS PASSED: 535 full-suite tests; 19 focused database tests; 103 Atlas verification assertions  
TESTS FAILED: 0 in the correctly provisioned acceptance run  
TESTS SKIPPED: 1 pre-existing live-API N4 test requiring `GREENFIELD_API_BASE`  
SECURITY RESULTS: PASS for Apple JWS verification, tamper rejection, replay protection, account binding, authorization and secret redaction; workspace dependency audit remains non-zero for unrelated existing transitive dependencies  
QA INTEGRATION RESULTS: PARTIAL — persistent sandbox lifecycle proven with official Apple cryptographic fixtures and injected signed-data tests, but no live App Store Connect sandbox product or Native StoreKit transaction was available  
NATIVE COMPATIBILITY: PARTIAL — current Native main has Premium UI contracts but no completed StoreKit purchase submission flow and uses placeholder local product identifiers  
BLOCKERS: confirmed App Store Connect product IDs and billing periods; sandbox credentials/root material in QA; live signed sandbox purchase/restore/refund evidence; Native StoreKit handoff  
APPROVAL REQUIRED: Andy for merge, QA release configuration, deployment and any publication

The implementation candidate is source- and database-ready, but the mission item is deliberately not marked PASS because a real Apple sandbox lifecycle and the Native purchase handoff have not been demonstrated.

## User-visible outcome

GreenField now has a server-authoritative, sandbox-only Premium purchase boundary. The API can issue an account-bound App Store account token, verify Apple-signed sandbox transactions and notifications, project membership and entitlements, preserve badge visibility separately from paid status, and process renewal, upgrade, downgrade, grace, expiration and revocation without accepting client-supplied entitlement flags.

The supplied tier prices remain display labels only. The migration deliberately does not seed product identifiers or infer billing periods. An administrator must enter product mappings confirmed in App Store Connect before purchase verification becomes available.

Identity verification remains completely separate. No Premium tier or purchase path grants verification.

## Baseline findings

- The earlier Premium foundation had already shipped on main through migration 076 and exposed the four Native read/settings routes.
- No active, unmerged Premium implementation PR or reusable Premium branch existed when this workstream began.
- The existing implementation supported deterministic QA assignments but did not verify StoreKit transactions or App Store Server Notifications.
- Current Native main `e50fc3916fb4738b7c63b7bed92bef49a8076eb8` contains Premium screens and server reads, but its purchase identifiers are placeholders and it has no complete StoreKit-to-GreenField submission flow.
- The supplied Atlas baseline was 484 application routes. Re-capturing current main produced 535 application routes before PR-07. This branch produces 539 application routes: four additions and no unexplained removals.

## Implemented architecture

### Apple verification boundary

The implementation uses Apple's official `@apple/app-store-server-library` `SignedDataVerifier` in `Environment.SANDBOX`. It verifies the JWS certificate chain, bundle identity, environment and signed data before any billing state is persisted.

QA configuration fails closed unless all required sandbox values are present. Offline certificate checks are permitted only under `NODE_ENV=test`; deployed preview and production processes require online checks. Production billing remains disabled by the feature/environment gates.

### Persistent ownership and audit model

Migration 084 adds:

- a QA-configured Apple product map tied to the existing Premium catalogue;
- one stable `appAccountToken` per Modula account;
- verified transaction projections bound to account, product and original transaction;
- append-only transaction evidence events;
- replay-protected App Store Server Notification records;
- `grace` membership state and the purchase/restoration/upgrade/grace audit event types.

Only SHA-256 evidence hashes are persisted. Full signed transaction or notification bodies are not stored or logged. Database constraints enforce Sandbox environment, purchased ownership, unique transaction identity, active product mappings and chronological state invariants.

### Entitlement projection

Verified transaction state is translated into the existing membership and entitlement model. Active and grace-period policy is explicit; expired and revoked transactions remove paid capabilities. Downgrades update entitlement state without deleting user data. Badge visibility remains an independent user setting.

Client JSON cannot select an account, tier, environment, verification status or entitlement. Unknown request fields are rejected on every changed mutation.

### Notification safety

The notification route is intentionally not session-authenticated because Apple is the caller. It is cryptographically authenticated by the outer signed notification and nested signed transaction, restricted to Sandbox, rate-limited by the existing write policy, replay-protected by notification UUID and evidence hash, and bound back to an existing server-issued account token.

## Route contract changes

### Added

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/me/membership/apple-purchase-context` | Return the authenticated account's stable `appAccountToken` and confirmed active sandbox product mappings. |
| POST | `/v1/premium/apple/transactions` | Verify an authenticated user's Apple-signed Sandbox transaction and project membership. |
| POST | `/v1/premium/apple/notifications` | Verify and idempotently process an Apple-signed Sandbox server notification. |
| PUT | `/v1/admin/qa/premium/apple-products/:productId` | Configure or disable a confirmed QA product-to-tier/billing-period mapping. |

### Modified

| Method | Path | Change |
|---|---|---|
| GET | `/v1/premium/tiers` | Return supplied display labels and explicit purchase/configuration availability; disable caching. |
| GET | `/v1/me/membership` | Return verified billing-derived state, expiry and grace metadata; disable caching. |
| GET | `/v1/me/entitlements` | Return server-derived effective entitlements; disable caching. |
| GET | `/v1/me/entitlements/:capabilityId` | Return server-derived capability state; disable caching. |
| PATCH | `/v1/me/membership/badge-visibility` | Enforce exact schema and preserve separation from membership entitlement. |
| PUT | `/v1/admin/qa/premium/:handle` | Enforce an exact, bounded QA-fixture schema without accepting arbitrary privileged fields. |

All ten contracts include purpose, ownership domain, authentication/authorization, request validation, responses, machine-readable errors, pagination, idempotency/concurrency and compatibility notes in `contract-overrides.json`. Atlas generation now applies these maintained overrides consistently to JSON, CSV, DOCX and generated OpenAPI.

## Test evidence

### Canonical full regression run

The suite ran serially against `modula_pr07_regression2`, a new database owned by the disposable PostgreSQL test administrator in container `modula-feature-reality-01-pg`, published only on `127.0.0.1:55483`.

```text
CI=true pnpm --dir services/greenfield-api exec vitest run --no-file-parallelism

Test Files  96 passed (96)
Tests       535 passed | 1 skipped (536)
Duration    115.99s
```

The one skip is the pre-existing `N4 For You private-author hydrate` live-API case, which requires both a database URL and a running `GREENFIELD_API_BASE`. Its always-on source contract test passed. It is not counted as acceptance evidence.

An earlier diagnostic run used the migrator role where legacy suites require the test administrator to create roles/databases and use `SET ROLE`. Its permission failures were discarded rather than reported as product failures. Re-running with the canonical disposable test-administrator model cleared all affected suites, including Vault Notes, module-owned backend, MPS ACL and Standard 2 migration rollback tests.

### Focused Premium and migration tests

```text
CI=true pnpm --dir services/greenfield-api exec vitest run \
  tests/premium.config.test.ts \
  tests/premium.apple-verifier.test.ts \
  tests/premium.apple-sandbox.integration.test.ts \
  tests/premium.integration.test.ts \
  tests/api-fix-01.migration.test.ts

Test Files  5 passed (5)
Tests       19 passed (19)
```

Coverage includes free membership, exact tier display labels, configuration fail-closed behavior, official Apple JWS fixture verification, one-byte tamper rejection, wrong bundle rejection, missing certificate rejection, account-token binding, client replay, notification replay, upgrade, grace, downgrade, expiration, refund/revocation, forged entitlement rejection, badge visibility, data preservation and fresh/legacy/up/down migration paths.

### Type, build and Atlas gates

```text
CI=true pnpm typecheck
```

PASS across the workspace.

```text
GITHUB_HEAD_REF=main API_ATLAS_RUNTIME_EVIDENCE=candidate pnpm api:atlas:verify
```

PASS: 103/103 assertions, 539 application routes, 223 framework routes, zero source/runtime gaps, valid DOCX and passing secret scan.

```text
git diff --check
```

PASS.

### Dependency audit

```text
pnpm audit --prod
```

The workspace gate remains non-zero with 69 advisories in existing transitive dependency paths, primarily the Expo toolchain. Filtering the same audit result for paths through `@apple/app-store-server-library` returned zero advisories. This PR does not broaden into unrelated dependency upgrades.

## QA isolation and production protection

- All migrations and database tests ran only in the labeled disposable PostgreSQL container.
- No production database, storage, signing key, App Store credential or billing record was read or changed.
- No App Store product identifiers were invented or seeded.
- No package or application was published.
- No Native repository file was modified.
- `/root/modula-latest` remained read/deploy-only and unmodified.
- No branch was merged and auto-merge remains disabled.

## Rollback and recovery

Before verified billing evidence exists, migration 084 can be rolled down in disposable QA and was tested up/down/up. Once purchase/audit evidence exists, the down migration refuses lossy rollback. Recovery must preserve the database, restore a pre-migration backup if rollback is explicitly approved, and run the previous application image. Production rollback is not authorized by this PR.

## Native handoff

Native must still:

1. replace placeholder product identifiers with the server-returned, App Store Connect-confirmed mappings;
2. pass the server-issued `appAccountToken` to StoreKit 2 purchases;
3. submit the signed transaction to `/v1/premium/apple/transactions` after purchase and restoration;
4. refresh `/v1/me/membership` and `/v1/me/entitlements` after verification;
5. display structured verification failures without granting local Premium state;
6. demonstrate purchase, restore, upgrade, downgrade, expiry and refund on an Apple sandbox account.

The backend contract is documented for this work, but those Native and live-sandbox gates are outside this server PR and remain required before PR-07 can become PASS.

## Known limitations and blockers

- No confirmed App Store Connect product IDs or billing periods were available; purchase mapping therefore remains disabled by default.
- No live Apple sandbox credentials or signed customer transaction were used.
- No Native simulator or physical-device StoreKit acceptance was performed.
- App Store Server Notification URL registration was not changed.
- The workspace-wide pre-existing dependency audit is not clean, although the new Apple dependency path has no reported advisory.
- Production acceptance, real billing and deployment are explicitly excluded.
