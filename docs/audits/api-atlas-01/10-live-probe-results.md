# Live Production Probe Results

Captured: 2026-10-04T08:23:43.617Z
Policy: anonymous and non-mutating except a schema-invalid registration request that cannot persist
Result: 35/35 requests passed; 26 unique route templates exercised.

The anonymous suite used no bearer token, cookie or real account. The authenticated suite used two reserved non-person audit identities and marker-scoped fixtures with deterministic cleanup.

## Requests

| Method/route | Status | Latency ms | Content type | Request ID | Assertion | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /version.json` | 200 | 114.5 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/health/live` | 200 | 42.8 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/health/live` | 200 | 19.7 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/health/live` | 200 | 20.3 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/health/ready` | 200 | 38.6 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/status` | 200 | 32.9 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/status` | 200 | 23.5 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/status` | 200 | 21.7 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/meta` | 200 | 31.3 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules` | 200 | 46.2 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules` | 200 | 37.2 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules` | 200 | 34.9 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules/:moduleId` | 200 | 36.7 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules/:moduleId/versions` | 200 | 28 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/modules/:moduleId/versions/:version` | 200 | 34.6 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/releases/:releaseId/artifact` | 200 | 43.9 | application/gzip | yes | response SHA-256 matches published release digest | PASS |
| `GET /v1/registry/releases/:releaseId/assets/:assetId` | 200 | 79.9 | image/png | yes | asset is available and SHA-256 matches metadata | PASS |
| `GET /v1/registry/modules/:moduleId` | 200 | 25.7 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/registry/releases/:releaseId/assets/:assetId` | 404 | 29 | application/json; charset=utf-8 | yes | metadata declares unavailable and delivery returns 404 | PASS |
| `GET /v1/registry/modules/:moduleId` | 404 | 21 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/profiles/:handle` | 404 | 22.4 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/accounts/me` | 401 | 19.5 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/modules/installed` | 401 | 16.8 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/intelligence/missions` | 401 | 25.4 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/support/cases` | 401 | 17.2 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/accounts/me/app-preferences` | 401 | 34.3 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `PATCH /v1/accounts/me/app-preferences` | 401 | 20.8 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/accounts/me/mutes` | 401 | 26.1 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/accounts/me/blocks` | 401 | 17.9 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/creator/insights` | 401 | 19.7 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/creator/payouts` | 401 | 17.7 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/commerce/invoices` | 401 | 18.4 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `POST /v1/auth/step-up/password` | 401 | 16.6 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `GET /v1/account/deletion-requests/current` | 401 | 18.9 | application/json; charset=utf-8 | yes | status/shape | PASS |
| `POST /v1/accounts/register` | 400 | 16.3 | application/json; charset=utf-8 | yes | status/shape | PASS |

## Lightweight latency snapshot

Three normal serial requests were used for representative endpoints; this was not a load test.

| Path | Samples | Median ms | Max ms |
| --- | --- | --- | --- |
| /v1/health/live | 3 | 20.3 | 42.8 |
| /v1/status | 3 | 23.5 | 32.9 |
| /v1/registry/modules | 3 | 37.2 | 46.2 |

No multi-second response was observed. Source review nevertheless identifies unbounded/N+1 activity hydration as a growth risk.

## What was verified

- Public version, live, ready, status, meta and module catalogue/detail/version endpoints traverse DNS/TLS/nginx.
- A real release package and artwork object were retrieved and SHA-256 matched their metadata.
- Declared unavailable artwork returned 404; unknown module/profile resources returned 404.
- Account, installed-modules, intelligence and support reads rejected anonymous access with 401.
- Representative malformed registration input returned 400.

## Authenticated, cross-user and write probes

Captured: 2026-10-03T18:23:49.727Z
Result: 46/46 checks passed.

| Probe | Status | Error code | Result |
| --- | --- | --- | --- |
| audit identity login | 200 | success envelope | PASS |
| audit identity login | 200 | success envelope | PASS |
| account A self read | 200 | success envelope | PASS |
| account B self read | 200 | success envelope | PASS |
| profile B owner read | 200 | success envelope | PASS |
| profile B follower-only setup | 200 | success envelope | PASS |
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

Cleanup outcomes: recovered-record=200, recovered-record=200, follow=404, comment=200, post=200, post=200, attachment=200, record=200, profile-visibility=200.

## Controlled exact-schema acceptance

- Ownership/trust cases: 28 passed / 0 failed.
- Legacy function invocation, AI reconnect, AI cancel, manifest-permission fallback, unsigned release trust/installability, reaction 23505, and private-profile immediate follow are executable expected-failure regressions.
- Governed-intelligence mission detail, ledger, evidence, approval, proposal execution and stream ownership are exercised with two accounts without production mission execution.

## Scope boundary

- Production installation mutation and governed-intelligence execution were not used because they would create asynchronous product state; those paths ran against the exact build and migration schema in a disposable controlled database.
- Atlas status is **PASS**. PASS means complete mapping and characterized failures, not zero defects.
