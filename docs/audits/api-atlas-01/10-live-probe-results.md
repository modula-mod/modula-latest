# Live Production Probe Results

Captured: 2026-10-10T09:11:49.914Z
Policy: anonymous and non-mutating except a schema-invalid registration request that cannot persist
Result: 35/35 requests passed; 26 unique route templates exercised.

The anonymous suite used no bearer token, cookie or real account. The authenticated suite used two reserved non-person audit identities and marker-scoped fixtures with deterministic cleanup.

## Requests

| Method/route | Status | Latency ms | Content type | Request ID | Assertion | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /version.json` | 200 | 385.7 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/health/live` | 200 | 69.8 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/health/live` | 200 | 98 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/health/live` | 200 | 137.1 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/health/ready` | 200 | 107.5 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/status` | 200 | 106.1 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/status` | 200 | 70.7 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/status` | 200 | 88.3 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/meta` | 200 | 116.6 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules` | 200 | 119.9 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules` | 200 | 105.2 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules` | 200 | 89.5 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules/:moduleId` | 200 | 93.1 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules/:moduleId/versions` | 200 | 114 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules/:moduleId/versions/:version` | 200 | 103.6 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/releases/:releaseId/artifact` | 200 | 162.2 | application/gzip | yes | response SHA-256 matches published release digest | PASS |
| `GET /v1/registry/releases/:releaseId/assets/:assetId` | 200 | 361.1 | image/png | yes | asset is available and SHA-256 matches metadata | PASS |
| `GET /v1/registry/modules/:moduleId` | 200 | 79.4 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/releases/:releaseId/assets/:assetId` | 404 | 68.9 | application/json; charset=utf-8 | yes | metadata declares unavailable and delivery returns 404 | PASS |
| `GET /v1/registry/modules/:moduleId` | 404 | 102.9 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/profiles/:handle` | 404 | 101.8 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/accounts/me` | 401 | 96.5 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/modules/installed` | 401 | 101.2 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/intelligence/missions` | 401 | 83.5 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/support/cases` | 401 | 129.2 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/accounts/me/app-preferences` | 401 | 81.8 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `PATCH /v1/accounts/me/app-preferences` | 401 | 80.4 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/accounts/me/mutes` | 401 | 74.9 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/accounts/me/blocks` | 401 | 95.8 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/creator/insights` | 401 | 100.3 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/creator/payouts` | 401 | 89 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/commerce/invoices` | 401 | 112.9 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `POST /v1/auth/step-up/password` | 401 | 79.7 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/account/deletion-requests/current` | 401 | 209.2 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `POST /v1/accounts/register` | 400 | 125 | application/json; charset=utf-8 | yes | status/shape | PASS |

## Lightweight latency snapshot

Three normal serial requests were used for representative endpoints; this was not a load test.

| Path | Samples | Median ms | Max ms |
| --- | --- | --- | --- |
| /v1/health/live | 3 | 98 | 137.1 |
| /v1/status | 3 | 88.3 | 106.1 |
| /v1/registry/modules | 3 | 105.2 | 119.9 |

No multi-second response was observed. Source review nevertheless identifies unbounded/N+1 activity hydration as a growth risk.

## What was verified

- Public version, live, ready, status, meta and module catalogue/detail/version endpoints traverse DNS/TLS/nginx.
- A real release package and artwork object were retrieved and SHA-256 matched their metadata.
- Declared unavailable artwork returned 404; unknown module/profile resources returned 404.
- Account, installed-modules, intelligence and support reads rejected anonymous access with 401.
- Representative malformed registration input returned 400.

## Authenticated, cross-user and write probes

Captured: 2026-10-04T08:59:21.594Z
Result: 82/82 checks passed.

| Probe | Status | Error code | Result |
| --- | --- | --- | --- |
| audit identity login | 200 | success envelope | PASS |
| audit identity login | 200 | success envelope | PASS |
| account A self read | 200 | success envelope | PASS |
| account B self read | 200 | success envelope | PASS |
| profile B owner read | 200 | success envelope | PASS |
| profile B follower-only setup | 200 | success envelope | PASS |
| settings v2 A preferences read | 200 | success envelope | PASS |
| settings v2 B preferences read | 200 | success envelope | PASS |
| settings v2 A preferences write | 200 | success envelope | PASS |
| settings v2 B preferences write | 200 | success envelope | PASS |
| settings v2 A write is account scoped | null | success envelope | PASS |
| settings v2 B write is account scoped | null | success envelope | PASS |
| settings v2 A preferences persistence | 200 | success envelope | PASS |
| settings v2 B preferences persistence | 200 | success envelope | PASS |
| settings v2 A persisted value | null | success envelope | PASS |
| settings v2 B persisted value | null | success envelope | PASS |
| settings v2 query identifier remains self scoped | 200 | success envelope | PASS |
| settings v2 query identifier cannot read B | null | success envelope | PASS |
| settings v2 alternate account route absent | 404 | success envelope | PASS |
| settings v2 body identifier rejected | 400 | VALIDATION_FAILED | PASS |
| settings v2 unknown preference rejected | 400 | VALIDATION_FAILED | PASS |
| settings v2 nested namespace rejected | 400 | VALIDATION_FAILED | PASS |
| settings v2 invalid enum rejected | 400 | VALIDATION_FAILED | PASS |
| settings v2 wrong type rejected | 400 | VALIDATION_FAILED | PASS |
| settings v2 invalid time zone rejected | 400 | VALIDATION_FAILED | PASS |
| settings v2 empty patch rejected | 400 | VALIDATION_FAILED | PASS |
| settings v2 oversized payload rejected | 413 | success envelope | PASS |
| settings v2 A mutes read | 200 | success envelope | PASS |
| settings v2 A blocks read | 200 | success envelope | PASS |
| settings v2 A insights read | 200 | success envelope | PASS |
| settings v2 A payouts read | 200 | success envelope | PASS |
| settings v2 A invoices read | 200 | success envelope | PASS |
| settings v2 A password step-up | 200 | success envelope | PASS |
| settings v2 A deletion status read | 200 | success envelope | PASS |
| settings v2 B mutes read | 200 | success envelope | PASS |
| settings v2 B blocks read | 200 | success envelope | PASS |
| settings v2 B insights read | 200 | success envelope | PASS |
| settings v2 B payouts read | 200 | success envelope | PASS |
| settings v2 B invoices read | 200 | success envelope | PASS |
| settings v2 B password step-up | 200 | success envelope | PASS |
| settings v2 B deletion status read | 200 | success envelope | PASS |
| settings v2 password target identifier rejected | 400 | VALIDATION_FAILED | PASS |
| write fixture B public post | 201 | success envelope | PASS |
| write fixture B private post | 201 | success envelope | PASS |
| write acceptance A post create | 201 | success envelope | PASS |
| write fixture B comment | 201 | success envelope | PASS |
| write fixture B attachment session | 201 | success envelope | PASS |
| write fixture B attachment content | 200 | success envelope | PASS |
| write fixture B private record | 201 | success envelope | PASS |
| account handle history cross-user denial | 403 | FORBIDDEN | PASS |
| session cross-user revoke is owner-scoped | 200 | success envelope | PASS |
| session B remains active after A revoke attempt | 200 | success envelope | PASS |
| account update remains self-scoped | 200 | success envelope | PASS |
| security sessions remain self-scoped | 200 | success envelope | PASS |
| security passkeys remain self-scoped | 200 | success envelope | PASS |
| private profile cross-user denial | 404 | NOT_FOUND | PASS |
| profile update cross-user denial | 403 | FORBIDDEN | PASS |
| avatar cross-user attachment denial | 403 | FORBIDDEN | PASS |
| cover cross-user attachment denial | 403 | FORBIDDEN | PASS |
| private post identifier denial | 404 | NOT_FOUND | PASS |
| post cross-user edit denial | 403 | FORBIDDEN | PASS |
| post cross-user delete denial | 403 | FORBIDDEN | PASS |
| post cross-user media bind denial | 403 | FORBIDDEN | PASS |
| comment cross-user edit denial | 403 | FORBIDDEN | PASS |
| comment cross-user delete denial | 403 | FORBIDDEN | PASS |
| attachment metadata cross-user denial | 403 | FORBIDDEN | PASS |
| attachment content identifier denial | 403 | FORBIDDEN | PASS |
| attachment delete cross-user denial | 403 | FORBIDDEN | PASS |
| private repository record cross-user denial | 404 | NOT_FOUND | PASS |
| private repository record mutation denial | 404 | NOT_FOUND | PASS |
| known gap private follow succeeds immediately | 200 | success envelope | PASS |
| known gap private profile visible immediately after follow | 200 | success envelope | PASS |
| write acceptance A post delete | 200 | success envelope | PASS |

Cleanup outcomes: follow=404, comment=200, post=200, post=200, attachment=200, record=200, settings-preferences=200, settings-preferences=200, profile-visibility=200.

## Controlled exact-schema acceptance

- Ownership/trust cases: 28 passed / 0 failed.
- Legacy function invocation, AI reconnect, AI cancel, manifest-permission fallback, unsigned release trust/installability, reaction 23505, and private-profile immediate follow are executable expected-failure regressions.
- Governed-intelligence mission detail, ledger, evidence, approval, proposal execution and stream ownership are exercised with two accounts without production mission execution.

## Scope boundary

- Production installation mutation and governed-intelligence execution were not used because they would create asynchronous product state; those paths ran against the exact build and migration schema in a disposable controlled database.
- Atlas status is **PASS**. PASS means complete mapping and characterized failures, not zero defects.
