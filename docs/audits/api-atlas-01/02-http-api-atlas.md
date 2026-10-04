# Complete HTTP API Atlas

Captured: 2026-10-04T08:58:59.613Z

- Runtime method routes: 551
- Application routes: 393
- Automatically generated HEAD routes: 157
- Framework CORS routes: 1
- Source-only: 0
- Runtime-only: 0
- Reconciliation: `551 = 393 application + 158 framework-derived`

Every runtime method route is either represented below or explicitly listed as framework-derived in `api-atlas.json`. The JSON file is canonical for machine use.

## Three-way reconciliation

| Source | Runtime | Public edge | Status | Count |
| --- | --- | --- | --- | ---: |
| yes | yes | yes | reachable or feature-gated | 393 |
| yes | no | no | source-only | 0 |
| no | yes | yes | dynamically registered / investigate | 0 |
| framework | yes | edge-dependent | explicitly excluded Fastify/CORS route | 158 |

## Error contract

The canonical envelope is `{ok,data,meta:{requestId,serverTime}}` or `{ok:false,error:{code,message,requestId,retryable,fieldErrors?,details?},meta}` (`services/greenfield-api/src/transport/envelope.ts:9`). Status mapping is 400 for validation/schema/abstention, 401 for authentication/session/step-up, 403 for authorization/policy denial, 404 for unknown resources, 409 for conflicts/approval state, 429 for explicit rate-limit codes and 500 by default. Fastify-generated 413 body-limit and 415 content-parser errors can bypass this envelope because no global custom error handler exists. No canonical 422 mapping was found. Binary media, OAuth redirects and SSE are deliberate specialized responses.

## Pagination contract

Shared cursor pagination uses default 20, maximum 50, a maximum 512-byte opaque cursor, stable route-specific ordering, `nextCursor`, and no previous cursor (`services/greenfield-api/src/transport/pagination.ts:1`). Every route's machine record includes `request.pagination`; `none observed` exposes unpaginated or non-list handlers rather than inventing a contract. Discover/activity unbounded behavior is a registered gap.

## Endpoint index

| Domain | Method | Effective route | Access | Rate | Source | Runtime status |
| --- | --- | --- | --- | --- | --- | --- |
| AT Protocol | GET | `/oauth/atproto/native-client-metadata.json` | PUBLIC | none | `services/greenfield-api/src/app/register-routes.ts:309` | reachable |
| AT Protocol | GET | `/oauth/atproto/web-client-metadata.json` | PUBLIC | none | `services/greenfield-api/src/app/register-routes.ts:305` | reachable |
| Account | POST | `/v1/account/data-exports` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/account-data/routes.ts:38` | reachable |
| Account | GET | `/v1/account/data-requests/:requestId` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/account-data/routes.ts:46` | reachable |
| Account | POST | `/v1/account/data-requests/:requestId/advance` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/account-data/routes.ts:48` | reachable |
| Account | GET | `/v1/account/data-requests/:requestId/artifacts` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/account-data/routes.ts:47` | reachable |
| Account | POST | `/v1/account/data-requests/:requestId/cancel` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/account-data/routes.ts:52` | reachable |
| Account | POST | `/v1/account/deletion-requests` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/account-data/routes.ts:42` | reachable |
| Account | GET | `/v1/account/deletion-requests/current` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/settings-v2/routes.ts:48` | reachable |
| Authentication | GET | `/v1/accounts/:accountId/handle-history` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:580` | reachable |
| Authentication | POST | `/v1/accounts/forgot-password` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:469` | reachable |
| Authentication | GET | `/v1/accounts/handles/:handle/availability` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:485` | reachable |
| Authentication | GET | `/v1/accounts/mail-local-parts/:localPart/availability` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:489` | reachable |
| Authentication | GET | `/v1/accounts/me` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:497` | reachable |
| Authentication | PATCH | `/v1/accounts/me` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:543` | reachable |
| Authentication | GET | `/v1/accounts/me/app-preferences` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/settings-v2/routes.ts:40` | reachable |
| Authentication | PATCH | `/v1/accounts/me/app-preferences` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/settings-v2/routes.ts:41` | reachable |
| Authentication | GET | `/v1/accounts/me/appearance` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:237` | reachable |
| Authentication | PATCH | `/v1/accounts/me/appearance` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:242` | reachable |
| Authentication | GET | `/v1/accounts/me/blocks` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/settings-v2/routes.ts:43` | reachable |
| Authentication | POST | `/v1/accounts/me/handle` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:552` | reachable |
| Authentication | GET | `/v1/accounts/me/modula-mail` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:502` | reachable |
| Authentication | POST | `/v1/accounts/me/modula-mail/forwarding` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:517` | reachable |
| Authentication | POST | `/v1/accounts/me/modula-mail/provision` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:507` | reachable |
| Authentication | GET | `/v1/accounts/me/mutes` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/settings-v2/routes.ts:42` | reachable |
| Authentication | GET | `/v1/accounts/me/notification-preferences` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1953` | reachable |
| Authentication | PATCH | `/v1/accounts/me/notification-preferences` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1963` | reachable |
| Authentication | POST | `/v1/accounts/me/password` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:563` | reachable |
| Authentication | DELETE | `/v1/accounts/me/sessions` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:594` | reachable |
| Authentication | GET | `/v1/accounts/me/sessions` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:589` | reachable |
| Authentication | POST | `/v1/accounts/recovery/complete` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:263` | reachable |
| Authentication | POST | `/v1/accounts/recovery/request` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:255` | reachable |
| Authentication | POST | `/v1/accounts/register` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:418` | reachable |
| Authentication | POST | `/v1/accounts/resend-verification` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:454` | reachable |
| Authentication | POST | `/v1/accounts/reset-password` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:476` | reachable |
| Authentication | POST | `/v1/accounts/verify-email` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:440` | reachable |
| Activity | GET | `/v1/activity` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-routes.ts:2101` | reachable |
| Admin | POST | `/v1/admin/ai/models` | ADMIN | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:235` | reachable |
| Admin | POST | `/v1/admin/ai/prompts` | ADMIN | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:239` | reachable |
| Admin | POST | `/v1/admin/ai/providers` | ADMIN | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:231` | reachable |
| Admin | POST | `/v1/admin/ai/tools` | ADMIN | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:243` | reachable |
| Admin | POST | `/v1/admin/commerce/entitlements` | ADMIN | 30/1 minute | `services/greenfield-api/src/entitlements/routes.ts:34` | reachable |
| Admin | POST | `/v1/admin/commerce/entitlements/:entitlementId/transitions` | ADMIN | 30/1 minute | `services/greenfield-api/src/entitlements/routes.ts:35` | reachable |
| Admin | PUT | `/v1/admin/commerce/offers/:offerId` | ADMIN | 30/1 minute | `services/greenfield-api/src/entitlements/routes.ts:33` | reachable |
| Admin | PUT | `/v1/admin/commerce/quotas/:quotaPolicyId` | ADMIN | 30/1 minute | `services/greenfield-api/src/entitlements/routes.ts:36` | reachable |
| Admin | PUT | `/v1/admin/developer/build-services/:serviceId` | ADMIN | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:47` | reachable |
| Admin | POST | `/v1/admin/developer/namespaces/:namespace/verify` | ADMIN | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:46` | reachable |
| Admin | PATCH | `/v1/admin/developer/programme/:accountId` | ADMIN | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:45` | reachable |
| Admin | GET | `/v1/admin/moderation/reports` | ADMIN | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1857` | reachable |
| Admin | GET | `/v1/admin/moderation/reports/:reportId` | ADMIN | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1875` | reachable |
| Admin | PATCH | `/v1/admin/moderation/reports/:reportId` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1886` | reachable |
| Admin | POST | `/v1/admin/moderation/reports/:reportId/actions` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1904` | reachable |
| Admin | GET | `/v1/admin/ops/ai/executions` | ADMIN | 120/1 minute | `services/greenfield-api/src/ai/routes.ts:282` | reachable |
| Admin | GET | `/v1/admin/ops/ai/providers` | ADMIN | 120/1 minute | `services/greenfield-api/src/ai/routes.ts:247` | reachable |
| Admin | POST | `/v1/admin/ops/ai/providers/:providerId/credentials` | ADMIN | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:271` | reachable |
| Admin | POST | `/v1/admin/ops/ai/providers/:providerId/disable` | ADMIN | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:263` | reachable |
| Admin | POST | `/v1/admin/ops/ai/providers/:providerId/enable` | ADMIN | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:267` | reachable |
| Admin | GET | `/v1/admin/ops/ai/providers/:providerId/health` | ADMIN | 120/1 minute | `services/greenfield-api/src/ai/routes.ts:251` | reachable |
| Admin | POST | `/v1/admin/ops/ai/providers/:providerId/verify` | ADMIN | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:255` | reachable |
| Admin | GET | `/v1/admin/ops/ai/usage` | ADMIN | 120/1 minute | `services/greenfield-api/src/ai/routes.ts:286` | reachable |
| Admin | POST | `/v1/admin/ops/atproto/connections/:connectionId/revoke` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2264` | reachable |
| Admin | POST | `/v1/admin/ops/atproto/ingest` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2256` | reachable |
| Admin | POST | `/v1/admin/ops/atproto/lexicons/:collection/disable` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2542` | reachable |
| Admin | POST | `/v1/admin/ops/atproto/publish` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2248` | reachable |
| Admin | GET | `/v1/admin/ops/engines` | ADMIN | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:2386` | reachable |
| Admin | GET | `/v1/admin/ops/engines/:engineId` | ADMIN | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:2396` | reachable |
| Admin | POST | `/v1/admin/ops/events/dead-letters/retry` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2509` | reachable |
| Admin | POST | `/v1/admin/ops/events/replay` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2484` | reachable |
| Admin | POST | `/v1/admin/ops/events/replay/:replayId/cancel` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2529` | reachable |
| Admin | GET | `/v1/admin/ops/events/subscriber-failures` | ADMIN | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:2365` | reachable |
| Admin | POST | `/v1/admin/ops/mail/identities/adopt` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2290` | reachable |
| Admin | GET | `/v1/admin/ops/mail/summary` | ADMIN | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:2284` | reachable |
| Admin | POST | `/v1/admin/ops/policy/evaluate` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2454` | reachable |
| Admin | POST | `/v1/admin/ops/queue/dead-letters/:deadLetterId/retry` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2319` | reachable |
| Admin | POST | `/v1/admin/ops/queue/drain` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2276` | reachable |
| Admin | GET | `/v1/admin/ops/search/failures` | ADMIN | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:2419` | reachable |
| Admin | POST | `/v1/admin/ops/search/failures/:failureId/retry` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2441` | reachable |
| Admin | GET | `/v1/admin/ops/search/health` | ADMIN | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:2376` | reachable |
| Admin | GET | `/v1/admin/ops/search/projections` | ADMIN | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:2409` | reachable |
| Admin | POST | `/v1/admin/ops/search/reindex` | ADMIN | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2429` | reachable |
| Admin | POST | `/v1/admin/product-standard/ingest` | ADMIN | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:165` | reachable |
| Admin | POST | `/v1/admin/registry/modules/import` | ADMIN | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:958` | reachable |
| Admin | POST | `/v1/admin/registry/publishers/:publisherId/revoke` | ADMIN | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:1021` | reachable |
| Admin | POST | `/v1/admin/registry/publishers/:publisherId/signing-keys` | ADMIN | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:1026` | reachable |
| Admin | POST | `/v1/admin/registry/publishers/:publisherId/signing-keys/:keyId/revoke` | ADMIN | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:1037` | reachable |
| Admin | POST | `/v1/admin/registry/publishers/:publisherId/suspend` | ADMIN | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:1018` | reachable |
| Admin | POST | `/v1/admin/registry/publishers/:publisherId/verify` | ADMIN | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:1015` | reachable |
| Admin | POST | `/v1/admin/registry/releases/:releaseId/publish` | ADMIN | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:1005` | reachable |
| Admin | POST | `/v1/admin/registry/releases/:releaseId/quarantine` | ADMIN | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:1008` | reachable |
| Admin | POST | `/v1/admin/registry/releases/:releaseId/revoke` | ADMIN | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:1011` | reachable |
| Admin | POST | `/v1/admin/registry/releases/:releaseId/verify` | ADMIN | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:1002` | reachable |
| Admin | POST | `/v1/admin/registry/sync` | ADMIN | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:971` | reachable |
| Admin | GET | `/v1/admin/registry/sync-runs` | ADMIN | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:991` | reachable |
| Intelligence | GET | `/v1/ai/executions/:executionId` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/ai/routes.ts:119` | reachable |
| Intelligence | POST | `/v1/ai/executions/:executionId/cancel` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:155` | reachable |
| Intelligence | GET | `/v1/ai/executions/:executionId/stream` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/ai/routes.ts:130` | reachable |
| Intelligence | GET | `/v1/ai/models` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/ai/routes.ts:55` | reachable |
| Intelligence | GET | `/v1/ai/providers` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/ai/routes.ts:48` | reachable |
| Intelligence | POST | `/v1/ai/requests` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:166` | reachable |
| Intelligence | POST | `/v1/ai/streams/:streamId/cancel` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:186` | reachable |
| Intelligence | POST | `/v1/ai/streams/:streamId/reconnect` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:198` | reachable |
| Intelligence | POST | `/v1/ai/tools/:toolId/validate` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:209` | reachable |
| AT Protocol | GET | `/v1/atproto/connections` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:2111` | registered-feature-disabled |
| AT Protocol | POST | `/v1/atproto/connections/:connectionId/disconnect` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2176` | registered-feature-disabled |
| AT Protocol | POST | `/v1/atproto/connections/:connectionId/refresh` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2188` | registered-feature-disabled |
| AT Protocol | GET | `/v1/atproto/connections/:connectionId/status` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:2200` | registered-feature-disabled |
| AT Protocol | GET | `/v1/atproto/feed` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-routes.ts:2223` | registered-feature-disabled |
| AT Protocol | GET | `/v1/atproto/oauth/callback` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2143` | registered-feature-disabled |
| AT Protocol | POST | `/v1/atproto/oauth/start` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2118` | registered-feature-disabled |
| AT Protocol | GET | `/v1/atproto/preferences` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:2209` | registered-feature-disabled |
| AT Protocol | PATCH | `/v1/atproto/preferences` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2216` | registered-feature-disabled |
| Media | DELETE | `/v1/attachments/:attachmentId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-attachment-routes.ts:76` | reachable |
| Media | GET | `/v1/attachments/:attachmentId` | AUTHENTICATED | 60/1 minute | `services/greenfield-api/src/app/register-attachment-routes.ts:65` | reachable |
| Media | GET | `/v1/attachments/:attachmentId/content` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-attachment-routes.ts:89` | reachable |
| Media | POST | `/v1/attachments/uploads` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-attachment-routes.ts:34` | reachable |
| Media | PUT | `/v1/attachments/uploads/:uploadId/content` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-attachment-routes.ts:47` | reachable |
| Authentication | POST | `/v1/auth/apple/link` | AUTHENTICATED | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:707` | reachable |
| Authentication | POST | `/v1/auth/apple/link/options` | AUTHENTICATED | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:697` | reachable |
| Authentication | GET | `/v1/auth/apple/status` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:694` | reachable |
| Authentication | GET | `/v1/auth/passkeys` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:688` | reachable |
| Authentication | DELETE | `/v1/auth/passkeys/:passkeyId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:773` | reachable |
| Authentication | POST | `/v1/auth/passkeys/registration/options` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:730` | reachable |
| Authentication | POST | `/v1/auth/passkeys/registration/verify` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:745` | reachable |
| Authentication | POST | `/v1/auth/preview/session` | PUBLIC | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:313` | reachable |
| Authentication | GET | `/v1/auth/recovery-codes` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:794` | reachable |
| Authentication | POST | `/v1/auth/recovery-codes/regenerate` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:799` | reachable |
| Authentication | POST | `/v1/auth/step-up/password` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/settings-v2/routes.ts:47` | reachable |
| Authentication | POST | `/v1/auth/step-up/totp` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:668` | reachable |
| Authentication | POST | `/v1/auth/totp/disable` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:643` | reachable |
| Authentication | POST | `/v1/auth/totp/enroll` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:602` | reachable |
| Authentication | POST | `/v1/auth/totp/verify` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:617` | reachable |
| Module Runtime | GET | `/v1/backend/products/:productId/accounts/:accountId` | SERVICE/WORKER | 240/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:81` | registered-feature-disabled |
| Module Runtime | GET | `/v1/backend/products/:productId/accounts/:accountId/entitlements` | SERVICE/WORKER | 240/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:320` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/capabilities/check` | SERVICE/WORKER | 240/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:115` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/data-request-domains/:domainId/complete` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:380` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/data-requests/claim` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:369` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/entitlements/check` | SERVICE/WORKER | 240/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:330` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/events` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:237` | registered-feature-disabled |
| Module Runtime | GET | `/v1/backend/products/:productId/identity/context` | SERVICE/WORKER | 240/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:65` | registered-feature-disabled |
| Module Runtime | GET | `/v1/backend/products/:productId/installations/:installationId` | SERVICE/WORKER | 240/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:101` | registered-feature-disabled |
| Module Runtime | GET | `/v1/backend/products/:productId/installations/:installationId/capabilities` | SERVICE/WORKER | 240/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:108` | registered-feature-disabled |
| Module Runtime | GET | `/v1/backend/products/:productId/installations/:installationId/resources` | SERVICE/WORKER | 240/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:186` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/jobs` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:248` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/jobs/:jobId/cancel` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:311` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/jobs/:jobId/fail` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:287` | registered-feature-disabled |
| Module Runtime | GET | `/v1/backend/products/:productId/jobs/:jobId/result` | SERVICE/WORKER | 240/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:303` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/jobs/:jobId/start` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:268` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/jobs/:jobId/succeed` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:277` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/jobs/claim` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:259` | registered-feature-disabled |
| Module Runtime | GET | `/v1/backend/products/:productId/records/:collection` | SERVICE/WORKER | 240/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:126` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/records/:collection` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:150` | registered-feature-disabled |
| Module Runtime | DELETE | `/v1/backend/products/:productId/records/:collection/:recordId` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:174` | registered-feature-disabled |
| Module Runtime | GET | `/v1/backend/products/:productId/records/:collection/:recordId` | SERVICE/WORKER | 240/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:141` | registered-feature-disabled |
| Module Runtime | PUT | `/v1/backend/products/:productId/records/:collection/:recordId` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:162` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/resources` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:208` | registered-feature-disabled |
| Module Runtime | GET | `/v1/backend/products/:productId/resources/:resourceId` | SERVICE/WORKER | 240/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:200` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/resources/:resourceId/migrations` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:228` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/resources/:resourceId/schemas` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:219` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/secrets/lease` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:352` | registered-feature-disabled |
| Module Runtime | POST | `/v1/backend/products/:productId/usage` | SERVICE/WORKER | 120/1 minute | `services/greenfield-api/src/backend-fabric/routes.ts:341` | registered-feature-disabled |
| Account | GET | `/v1/board/layout` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1045` | reachable |
| Account | PATCH | `/v1/board/layout` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1055` | reachable |
| Comments | DELETE | `/v1/comments/:commentId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:172` | reachable |
| Comments | PATCH | `/v1/comments/:commentId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:154` | reachable |
| Comments | DELETE | `/v1/comments/:commentId/reaction` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:197` | reachable |
| Comments | PUT | `/v1/comments/:commentId/reaction` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:184` | reachable |
| Comments | GET | `/v1/comments/:commentId/replies` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:131` | reachable |
| Comments | POST | `/v1/comments/:commentId/replies` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:140` | reachable |
| Commerce | GET | `/v1/commerce/billing-adapters` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/entitlements/routes.ts:32` | reachable |
| Commerce | GET | `/v1/commerce/entitlements` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/entitlements/routes.ts:30` | reachable |
| Commerce | POST | `/v1/commerce/entitlements/check` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/entitlements/routes.ts:31` | reachable |
| Commerce | GET | `/v1/commerce/invoices` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/settings-v2/routes.ts:46` | reachable |
| Connectors | GET | `/v1/connections` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1309` | reachable |
| Connectors | DELETE | `/v1/connections/:connectionId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1393` | reachable |
| Connectors | GET | `/v1/connections/:connectionId` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1318` | reachable |
| Connectors | POST | `/v1/connections/:connectionId/disable` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1336` | reachable |
| Connectors | POST | `/v1/connections/:connectionId/enable` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1327` | reachable |
| Connectors | POST | `/v1/connections/:connectionId/refresh` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1345` | reachable |
| Connectors | GET | `/v1/connectors` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1262` | reachable |
| Connectors | GET | `/v1/connectors/:providerId` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1265` | reachable |
| Connectors | POST | `/v1/connectors/:providerId/authorise` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1270` | reachable |
| Platform | GET | `/v1/creator/insights` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/settings-v2/routes.ts:44` | reachable |
| Platform | GET | `/v1/creator/payouts` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/settings-v2/routes.ts:45` | reachable |
| Developer | POST | `/v1/developer/agreements/:agreementId/:version/accept` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:43` | reachable |
| Developer | GET | `/v1/developer/board` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/developers/routes.ts:36` | reachable |
| Developer | POST | `/v1/developer/organisations` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:38` | reachable |
| Developer | POST | `/v1/developer/organisations/:organisationId/invitations/accept` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:40` | reachable |
| Developer | POST | `/v1/developer/organisations/:organisationId/members` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:39` | reachable |
| Developer | GET | `/v1/developer/products` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/developers/routes.ts:48` | reachable |
| Developer | POST | `/v1/developer/products` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:49` | reachable |
| Developer | GET | `/v1/developer/products/:productId` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/developers/routes.ts:50` | reachable |
| Developer | POST | `/v1/developer/products/:productId/builds` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:52` | reachable |
| Developer | POST | `/v1/developer/products/:productId/releases` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:53` | reachable |
| Developer | PUT | `/v1/developer/products/:productId/releases/:releaseId/test-groups/:testGroupId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:55` | reachable |
| Developer | POST | `/v1/developer/products/:productId/reviews` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:56` | reachable |
| Developer | POST | `/v1/developer/products/:productId/sources` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:51` | reachable |
| Developer | POST | `/v1/developer/products/:productId/test-groups` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:54` | reachable |
| Developer | PUT | `/v1/developer/profile` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:37` | reachable |
| Developer | POST | `/v1/developer/programme/enrol` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:44` | reachable |
| Developer | POST | `/v1/developer/publishers` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:41` | reachable |
| Developer | POST | `/v1/developer/publishers/:publisherId/namespaces` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:42` | reachable |
| Discover | GET | `/v1/discover` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-routes.ts:2096` | reachable |
| Modules | GET | `/v1/extensions` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1175` | reachable |
| Modules | GET | `/v1/extensions/:extensionId` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1183` | reachable |
| Modules | PATCH | `/v1/extensions/:extensionId/configuration` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:294` | reachable |
| Modules | POST | `/v1/extensions/:extensionId/disable` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:284` | reachable |
| Modules | POST | `/v1/extensions/:extensionId/enable` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:274` | reachable |
| Modules | DELETE | `/v1/extensions/:extensionId/install` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1207` | reachable |
| Modules | POST | `/v1/extensions/:extensionId/install` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1195` | reachable |
| Modules | PATCH | `/v1/extensions/:extensionId/preferences` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1217` | reachable |
| Modules | GET | `/v1/extensions/:extensionProductId/capabilities` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:318` | reachable |
| Modules | POST | `/v1/extensions/:extensionProductId/capabilities/review` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:328` | reachable |
| Modules | POST | `/v1/extensions/:extensionProductId/contributions/:contributionId/fail` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:394` | reachable |
| Modules | POST | `/v1/extensions/:extensionProductId/contributions/:contributionId/invoke` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:340` | reachable |
| Modules | GET | `/v1/extensions/:extensionProductId/inspector` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:431` | reachable |
| Modules | POST | `/v1/extensions/:extensionProductId/jobs` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:411` | reachable |
| Modules | GET | `/v1/extensions/catalogue` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1178` | reachable |
| Modules | GET | `/v1/extensions/installed` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1190` | reachable |
| Feed | GET | `/v1/feed/home` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-routes.ts:1441` | reachable |
| Feed | GET | `/v1/feed/profile/:profileId` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-routes.ts:1472` | reachable |
| Modules | GET | `/v1/function-jobs/:jobId` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:311` | reachable |
| Modules | POST | `/v1/function-jobs/:jobId/cancel` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:321` | reachable |
| Modules | GET | `/v1/functions` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1243` | reachable |
| Modules | POST | `/v1/functions/:functionId/invoke` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1247` | reachable |
| Modules | POST | `/v1/functions/:functionId/jobs` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:333` | reachable |
| Operations | GET | `/v1/health/live` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:236` | reachable |
| Operations | GET | `/v1/health/ready` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:240` | reachable |
| Intelligence | GET | `/v1/intelligence/missions` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/intelligence/routes.ts:22` | reachable |
| Intelligence | POST | `/v1/intelligence/missions` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/intelligence/routes.ts:13` | reachable |
| Intelligence | GET | `/v1/intelligence/missions/:missionId` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/intelligence/routes.ts:28` | reachable |
| Intelligence | GET | `/v1/intelligence/missions/:missionId/approvals` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/intelligence/routes.ts:56` | reachable |
| Intelligence | POST | `/v1/intelligence/missions/:missionId/approvals/:approvalId/approve` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/intelligence/routes.ts:70` | reachable |
| Intelligence | POST | `/v1/intelligence/missions/:missionId/approvals/:approvalId/reject` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/intelligence/routes.ts:77` | reachable |
| Intelligence | GET | `/v1/intelligence/missions/:missionId/decisions` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/intelligence/routes.ts:49` | reachable |
| Intelligence | GET | `/v1/intelligence/missions/:missionId/evidence` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/intelligence/routes.ts:63` | reachable |
| Intelligence | GET | `/v1/intelligence/missions/:missionId/ledger` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/intelligence/routes.ts:42` | reachable |
| Intelligence | POST | `/v1/intelligence/missions/:missionId/proposals/:proposalId/execute` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/intelligence/routes.ts:84` | reachable |
| Intelligence | POST | `/v1/intelligence/missions/:missionId/start` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/intelligence/routes.ts:35` | reachable |
| Internal | POST | `/v1/internal/build-service/builds/:buildId/result` | INTERNAL (nginx-reachable; handler/service guard applies) | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:72` | reachable |
| Internal | POST | `/v1/internal/build-service/claims` | INTERNAL (nginx-reachable; handler/service guard applies) | 30/1 minute | `services/greenfield-api/src/developers/routes.ts:71` | reachable |
| Internal | GET | `/v1/internal/ssrf-check` | INTERNAL (nginx-reachable; handler/service guard applies) | none | `services/greenfield-api/src/app/register-routes.ts:2577` | registered-but-production-hidden |
| Media | GET | `/v1/media/:mediaFile` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-routes.ts:2069` | reachable |
| Media | GET | `/v1/media/stories/:mediaFile` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-phase7f-stories-routes.ts:133` | reachable |
| Operations | GET | `/v1/meta` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:252` | reachable |
| Modules | GET | `/v1/module-host/:targetProductId/composition` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:303` | reachable |
| Modules | GET | `/v1/modules` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1412` | reachable |
| Modules | POST | `/v1/modules/:moduleId/actions/:actionId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:854` | reachable |
| Modules | POST | `/v1/modules/:moduleId/ai/actions/:actionId/executions` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:62` | reachable |
| Modules | POST | `/v1/modules/:moduleId/ai/executions/:executionId/apply` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:78` | reachable |
| Modules | POST | `/v1/modules/:moduleId/ai/requests` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/ai/routes.ts:94` | reachable |
| Modules | GET | `/v1/modules/:moduleId/backend` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:896` | reachable |
| Modules | POST | `/v1/modules/:moduleId/backend/disable` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:929` | reachable |
| Modules | POST | `/v1/modules/:moduleId/backend/discover` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:907` | reachable |
| Modules | POST | `/v1/modules/:moduleId/backend/events` | SERVICE/WORKER | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:940` | reachable |
| Modules | POST | `/v1/modules/:moduleId/backend/health` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:918` | reachable |
| Modules | POST | `/v1/modules/:moduleId/backend/webhooks/modula` | SERVICE/WORKER | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:949` | reachable |
| Modules | GET | `/v1/modules/:moduleId/data-resources` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:452` | reachable |
| Modules | POST | `/v1/modules/:moduleId/data-resources` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:467` | reachable |
| Modules | GET | `/v1/modules/:moduleId/data-resources/:resourceId` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:482` | reachable |
| Modules | POST | `/v1/modules/:moduleId/data-resources/:resourceId/migrations` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:496` | reachable |
| Modules | POST | `/v1/modules/:moduleId/data-resources/:resourceId/schemas` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:512` | reachable |
| Modules | POST | `/v1/modules/:moduleId/disable` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:603` | reachable |
| Modules | POST | `/v1/modules/:moduleId/enable` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:593` | reachable |
| Modules | POST | `/v1/modules/:moduleId/export` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:875` | reachable |
| Modules | GET | `/v1/modules/:moduleId/frontend` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:756` | reachable |
| Modules | GET | `/v1/modules/:moduleId/health` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:886` | reachable |
| Modules | DELETE | `/v1/modules/:moduleId/install` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:688` | reachable |
| Modules | POST | `/v1/modules/:moduleId/install` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:560` | reachable |
| Modules | GET | `/v1/modules/:moduleId/install-descriptor` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:582` | reachable |
| Modules | POST | `/v1/modules/:moduleId/install-preview` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:549` | reachable |
| Modules | POST | `/v1/modules/:moduleId/permissions/review` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:664` | reachable |
| Modules | GET | `/v1/modules/:moduleId/records/:collection` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:777` | reachable |
| Modules | POST | `/v1/modules/:moduleId/records/:collection` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:788` | reachable |
| Modules | DELETE | `/v1/modules/:moduleId/records/:collection/:recordId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:821` | reachable |
| Modules | GET | `/v1/modules/:moduleId/records/:collection/:recordId` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:799` | reachable |
| Modules | PATCH | `/v1/modules/:moduleId/records/:collection/:recordId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:810` | reachable |
| Modules | DELETE | `/v1/modules/:moduleId/records/:collection/:recordId/permanent` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:843` | reachable |
| Modules | POST | `/v1/modules/:moduleId/records/:collection/:recordId/restore` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:832` | reachable |
| Modules | GET | `/v1/modules/:moduleId/runtime` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:442` | reachable |
| Modules | POST | `/v1/modules/:moduleId/services/:serviceId/invoke` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:528` | reachable |
| Modules | GET | `/v1/modules/:moduleId/settings` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:720` | reachable |
| Modules | PATCH | `/v1/modules/:moduleId/settings` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:730` | reachable |
| Modules | GET | `/v1/modules/:moduleId/settings-schema` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:710` | reachable |
| Modules | POST | `/v1/modules/:moduleId/uninstall-preview` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:678` | reachable |
| Modules | POST | `/v1/modules/:moduleId/update` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:641` | reachable |
| Modules | POST | `/v1/modules/:moduleId/version-preview` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:627` | reachable |
| Modules | GET | `/v1/modules/:moduleId/versions` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:615` | reachable |
| Modules | GET | `/v1/modules/:moduleId/views` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:746` | reachable |
| Modules | GET | `/v1/modules/:moduleId/views/:viewId` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:766` | reachable |
| Modules | GET | `/v1/modules/contributions` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:740` | reachable |
| Modules | GET | `/v1/modules/installed` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:289` | reachable |
| Modules | GET | `/v1/modules/installed/:moduleId` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:295` | reachable |
| Activity | GET | `/v1/notifications` | AUTHENTICATED | 60/1 minute | `services/greenfield-api/src/app/register-routes.ts:1922` | reachable |
| Activity | POST | `/v1/notifications/:notificationId/read` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1937` | reachable |
| Activity | POST | `/v1/notifications/read-all` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1946` | reachable |
| Modules | GET | `/v1/plugins` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1259` | reachable |
| Posts | POST | `/v1/posts` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1501` | reachable |
| Posts | DELETE | `/v1/posts/:postId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1537` | reachable |
| Posts | GET | `/v1/posts/:postId` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1494` | reachable |
| Posts | PATCH | `/v1/posts/:postId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1520` | reachable |
| Comments | GET | `/v1/posts/:postId/comments` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:108` | reachable |
| Comments | POST | `/v1/posts/:postId/comments` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:117` | reachable |
| Reactions | DELETE | `/v1/posts/:postId/like` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1561` | reachable |
| Reactions | POST | `/v1/posts/:postId/like` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1561` | reachable |
| Sharing | POST | `/v1/posts/:postId/quote` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:211` | reachable |
| Reactions | DELETE | `/v1/posts/:postId/reaction` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:85` | reachable |
| Reactions | PUT | `/v1/posts/:postId/reaction` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:72` | reachable |
| Reactions | GET | `/v1/posts/:postId/reactions` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:96` | reachable |
| Sharing | DELETE | `/v1/posts/:postId/repost` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1561` | reachable |
| Sharing | POST | `/v1/posts/:postId/repost` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1561` | reachable |
| Posts | DELETE | `/v1/posts/:postId/save` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1561` | reachable |
| Posts | POST | `/v1/posts/:postId/save` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1561` | reachable |
| Sharing | POST | `/v1/posts/:postId/share` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1598` | reachable |
| Modules | GET | `/v1/product-standard/products/:productId` | PUBLIC | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:141` | reachable |
| Modules | GET | `/v1/product-standard/products/:productId/versions/:version` | PUBLIC | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:153` | reachable |
| Profile | GET | `/v1/profiles/:handle` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1617` | reachable |
| Social | GET | `/v1/profiles/:handle/followers` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1641` | reachable |
| Social | GET | `/v1/profiles/:handle/following` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1657` | reachable |
| Profile | GET | `/v1/profiles/:handle/posts` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-routes.ts:1625` | reachable |
| Social | DELETE | `/v1/profiles/:profileId/block` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1788` | reachable |
| Social | POST | `/v1/profiles/:profileId/block` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1773` | reachable |
| Social | DELETE | `/v1/profiles/:profileId/follow` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1693` | reachable |
| Social | POST | `/v1/profiles/:profileId/follow` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1673` | reachable |
| Social | DELETE | `/v1/profiles/:profileId/mute` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1818` | reachable |
| Social | POST | `/v1/profiles/:profileId/mute` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1803` | reachable |
| Profile | PATCH | `/v1/profiles/me` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1713` | reachable |
| Profile | DELETE | `/v1/profiles/me/avatar` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1758` | reachable |
| Profile | POST | `/v1/profiles/me/avatar` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1741` | reachable |
| Profile | DELETE | `/v1/profiles/me/cover` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1758` | reachable |
| Profile | POST | `/v1/profiles/me/cover` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1741` | reachable |
| Modules | GET | `/v1/providers/:capabilityRole` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/providers/routes.ts:28` | reachable |
| Modules | PUT | `/v1/providers/:capabilityRole/default` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/providers/routes.ts:32` | reachable |
| Modules | GET | `/v1/providers/:capabilityRole/resolve` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/providers/routes.ts:30` | reachable |
| Feed | GET | `/v1/reels` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-routes.ts:2106` | reachable |
| Modules | GET | `/v1/registry/modules` | PUBLIC | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:96` | reachable |
| Modules | GET | `/v1/registry/modules/:moduleId` | PUBLIC | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:114` | reachable |
| Modules | PUT | `/v1/registry/modules/:moduleId/rating` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/modules/routes/index.ts:270` | reachable |
| Modules | GET | `/v1/registry/modules/:moduleId/versions` | PUBLIC | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:200` | reachable |
| Modules | GET | `/v1/registry/modules/:moduleId/versions/:version` | PUBLIC | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:209` | reachable |
| Modules | GET | `/v1/registry/products` | PUBLIC | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:105` | reachable |
| Modules | GET | `/v1/registry/products/:productId` | PUBLIC | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:123` | reachable |
| Social | GET | `/v1/registry/products/:productId/relationships` | PUBLIC | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:132` | reachable |
| Modules | GET | `/v1/registry/publishers/:publisherId` | PUBLIC | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:282` | reachable |
| Modules | GET | `/v1/registry/publishers/:publisherId/signing-keys` | PUBLIC | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:219` | reachable |
| Modules | GET | `/v1/registry/releases/:releaseId/artifact` | PUBLIC | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:229` | reachable |
| Modules | GET | `/v1/registry/releases/:releaseId/assets/:assetId` | PUBLIC | 120/1 minute | `services/greenfield-api/src/modules/routes/index.ts:248` | reachable |
| Moderation | POST | `/v1/reports` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1833` | reachable |
| Moderation | GET | `/v1/reports/me` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1846` | reachable |
| Account | GET | `/v1/repositories/me` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1066` | reachable |
| Account | POST | `/v1/repositories/me/exports` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1155` | reachable |
| Account | GET | `/v1/repositories/me/exports/:exportId` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1164` | reachable |
| Account | GET | `/v1/repositories/me/records` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1075` | reachable |
| Account | POST | `/v1/repositories/me/records` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1089` | reachable |
| Account | DELETE | `/v1/repositories/me/records/:recordId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1132` | reachable |
| Account | GET | `/v1/repositories/me/records/:recordId` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1081` | reachable |
| Account | PATCH | `/v1/repositories/me/records/:recordId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1108` | reachable |
| Posts | GET | `/v1/saves` | AUTHENTICATED | 60/1 minute | `services/greenfield-api/src/app/register-phase6s-routes.ts:225` | reachable |
| Search | GET | `/v1/search` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-routes.ts:1979` | reachable |
| Search | DELETE | `/v1/search/recent` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2016` | reachable |
| Search | GET | `/v1/search/recent` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1996` | reachable |
| Search | POST | `/v1/search/recent` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2006` | reachable |
| Search | GET | `/v1/search/saved` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:2027` | reachable |
| Search | POST | `/v1/search/saved` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2037` | reachable |
| Search | DELETE | `/v1/search/saved/:savedSearchId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2058` | reachable |
| Search | PATCH | `/v1/search/saved/:savedSearchId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:2047` | reachable |
| Search | GET | `/v1/search/suggestions` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-routes.ts:1988` | reachable |
| Authentication | POST | `/v1/sessions` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:815` | reachable |
| Authentication | DELETE | `/v1/sessions/:sessionId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1037` | reachable |
| Authentication | POST | `/v1/sessions/apple` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:976` | reachable |
| Authentication | POST | `/v1/sessions/apple/options` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:964` | reachable |
| Authentication | DELETE | `/v1/sessions/current` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1031` | reachable |
| Authentication | POST | `/v1/sessions/email-code` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:852` | reachable |
| Authentication | POST | `/v1/sessions/email-code/request` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:837` | reachable |
| Authentication | DELETE | `/v1/sessions/me` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-routes.ts:1434` | reachable |
| Authentication | GET | `/v1/sessions/me` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1428` | reachable |
| Authentication | POST | `/v1/sessions/passkey` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:923` | reachable |
| Authentication | POST | `/v1/sessions/passkey/options` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:908` | reachable |
| Authentication | POST | `/v1/sessions/recovery-code` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:880` | reachable |
| Authentication | POST | `/v1/sessions/refresh` | PUBLIC | 10/1 minute | `services/greenfield-api/src/app/register-routes.ts:1012` | reachable |
| Operations | GET | `/v1/status` | PUBLIC | 120/1 minute | `services/greenfield-api/src/support/routes.ts:20` | reachable |
| Media | POST | `/v1/stories` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase7f-stories-routes.ts:79` | reachable |
| Media | GET | `/v1/stories/:groupId` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-phase7f-stories-routes.ts:67` | reachable |
| Media | DELETE | `/v1/stories/items/:itemId` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase7f-stories-routes.ts:121` | reachable |
| Media | POST | `/v1/stories/items/:itemId/viewed` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/app/register-phase7f-stories-routes.ts:109` | reachable |
| Media | GET | `/v1/stories/rail` | PUBLIC | 60/1 minute | `services/greenfield-api/src/app/register-phase7f-stories-routes.ts:61` | reachable |
| Support | GET | `/v1/support/cases` | AUTHENTICATED | 120/1 minute | `services/greenfield-api/src/support/routes.ts:53` | reachable |
| Support | POST | `/v1/support/cases` | AUTHENTICATED | 30/1 minute | `services/greenfield-api/src/support/routes.ts:54` | reachable |
| Support | GET | `/v1/support/contact` | PUBLIC | 120/1 minute | `services/greenfield-api/src/support/routes.ts:29` | reachable |
| Modules | GET | `/v1/tools` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1229` | reachable |
| Modules | GET | `/v1/tools/:toolId` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1233` | reachable |
| Operations | GET | `/v1/version` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:232` | reachable |
| Modules | GET | `/v1/widgets` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:1409` | reachable |
| Operations | GET | `/version.json` | PUBLIC | 120/1 minute | `services/greenfield-api/src/app/register-routes.ts:228` | reachable |

## Endpoint records

<details>
<summary><code>GET /oauth/atproto/native-client-metadata.json</code> — reachable</summary>

- Domain: AT Protocol
- Method: GET
- Effective route: `/oauth/atproto/native-client-metadata.json`
- Public URL: `https://api.modula.digital/oauth/atproto/native-client-metadata.json`
- API version: versionless
- Source file: `services/greenfield-api/src/app/register-routes.ts:309`
- Handler: inline
- Controller/service calls: `atproto.nativeClientMetadata`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: none registered
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`, `Connector/OAuth provider`
- Known clients: `src/features/atproto/oauth/atprotoOAuthClient.shared.ts`
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /oauth/atproto/web-client-metadata.json</code> — reachable</summary>

- Domain: AT Protocol
- Method: GET
- Effective route: `/oauth/atproto/web-client-metadata.json`
- Public URL: `https://api.modula.digital/oauth/atproto/web-client-metadata.json`
- API version: versionless
- Source file: `services/greenfield-api/src/app/register-routes.ts:305`
- Handler: inline
- Controller/service calls: `atproto.webClientMetadata`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: none registered
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`, `Connector/OAuth provider`
- Known clients: `src/features/atproto/oauth/atprotoOAuthClient.shared.ts`
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/account/data-exports</code> — reachable</summary>

- Domain: Account
- Method: POST
- Effective route: `/v1/account/data-exports`
- Public URL: `https://api.modula.digital/v1/account/data-exports`
- API version: v1
- Source file: `services/greenfield-api/src/account-data/routes.ts:38`
- Handler: inline
- Controller/service calls: `service.requestExport`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_account_data_requests`, `greenfield_accounts`, `greenfield_data_resources`, `greenfield_data_retention_policies`
- Database writes: `greenfield_account_data_request_domains`, `greenfield_account_data_requests`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-account-data.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/account/data-requests/:requestId</code> — reachable</summary>

- Domain: Account
- Method: GET
- Effective route: `/v1/account/data-requests/:requestId`
- Public URL: `https://api.modula.digital/v1/account/data-requests/:requestId`
- API version: v1
- Source file: `services/greenfield-api/src/account-data/routes.ts:46`
- Handler: inline
- Controller/service calls: `service.get`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_account_data_request_domains`, `greenfield_account_data_requests`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/account/data-requests/:requestId/advance</code> — reachable</summary>

- Domain: Account
- Method: POST
- Effective route: `/v1/account/data-requests/:requestId/advance`
- Public URL: `https://api.modula.digital/v1/account/data-requests/:requestId/advance`
- API version: v1
- Source file: `services/greenfield-api/src/account-data/routes.ts:48`
- Handler: inline
- Controller/service calls: `service.advance`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `greenfield_account_data_artifacts`, `greenfield_account_data_request_domains`, `greenfield_account_data_requests`, `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_comments`, `greenfield_connections`, `greenfield_developer_products`, `greenfield_developer_profiles`, `greenfield_entitlements`, `greenfield_module_records`, `greenfield_sessions`, `greenfield_usage_events`, `posts`, `profiles`
- Database writes: `actors`, `greenfield_account_data_artifacts`, `greenfield_account_data_request_domains`, `greenfield_account_data_requests`, `greenfield_account_deletion_tombstones`, `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_authentication_methods`, `greenfield_comments`, `greenfield_connection_credentials`, `greenfield_connections`, `greenfield_data_resource_owners`, `greenfield_data_resources`, `greenfield_data_storage_bindings`, `greenfield_developer_products`, `greenfield_developer_profiles`, `greenfield_email_verifications`, `greenfield_external_identities`, `greenfield_module_records`, `greenfield_passkeys`, `greenfield_password_credentials`, `greenfield_recovery_code_sets`, `greenfield_recovery_codes`, `greenfield_recovery_tokens`, `greenfield_session_tokens`, `greenfield_sessions`, `greenfield_story_groups`, `greenfield_totp_credentials`, `posts`, `profiles`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/account/data-requests/:requestId/artifacts</code> — reachable</summary>

- Domain: Account
- Method: GET
- Effective route: `/v1/account/data-requests/:requestId/artifacts`
- Public URL: `https://api.modula.digital/v1/account/data-requests/:requestId/artifacts`
- API version: v1
- Source file: `services/greenfield-api/src/account-data/routes.ts:47`
- Handler: inline
- Controller/service calls: `service.artifacts`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_account_data_artifacts`, `greenfield_account_data_request_domains`, `greenfield_account_data_requests`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/account/data-requests/:requestId/cancel</code> — reachable</summary>

- Domain: Account
- Method: POST
- Effective route: `/v1/account/data-requests/:requestId/cancel`
- Public URL: `https://api.modula.digital/v1/account/data-requests/:requestId/cancel`
- API version: v1
- Source file: `services/greenfield-api/src/account-data/routes.ts:52`
- Handler: inline
- Controller/service calls: `service.cancel`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_account_data_request_domains`, `greenfield_account_data_requests`
- Database writes: `greenfield_account_data_requests`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/account/deletion-requests</code> — reachable</summary>

- Domain: Account
- Method: POST
- Effective route: `/v1/account/deletion-requests`
- Public URL: `https://api.modula.digital/v1/account/deletion-requests`
- API version: v1
- Source file: `services/greenfield-api/src/account-data/routes.ts:42`
- Handler: inline
- Controller/service calls: `service.requestDeletion`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_account_data_requests`, `greenfield_accounts`, `greenfield_data_resources`, `greenfield_data_retention_policies`
- Database writes: `greenfield_account_data_request_domains`, `greenfield_account_data_requests`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-account-data.mjs`, `services/greenfield-api/tests/settings-v2.integration.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/account/deletion-requests/current</code> — reachable</summary>

- Domain: Account
- Method: GET
- Effective route: `/v1/account/deletion-requests/current`
- Public URL: `https://api.modula.digital/v1/account/deletion-requests/current`
- API version: v1
- Source file: `services/greenfield-api/src/settings-v2/routes.ts:48`
- Handler: inline
- Controller/service calls: `service.currentDeletion`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_account_data_requests`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/settings-v2.integration.test.ts`
- Runtime registration: yes
- Live probe: PASS (401)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/accounts/:accountId/handle-history</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/accounts/:accountId/handle-history`
- Public URL: `https://api.modula.digital/v1/accounts/:accountId/handle-history`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:580`
- Handler: inline
- Controller/service calls: `accounts.handleHistory`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{accountId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_handle_history`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/LocalApiServer.ts`, `src/api/local/routes/appearanceRoutes.ts`, `src/api/local/routes/authRoutes.ts`, `src/api/local/routes/notificationRoutes.ts`, `src/data/repositories/api/ApiActivityRepository.ts`, `src/data/repositories/api/ApiAppearanceRepository.ts`, `src/data/repositories/api/ApiAuthRepository.ts`, `src/features/settings/screens/ModulaMailSettingsScreen.tsx`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6-greenfield-frontend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-founder-alpha.mjs`, `scripts/verify-phase7c-product-complete.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7e-real-auth.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-backend-v1.provider-fabric.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/helpers/registry-fixtures.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/settings-v2.integration.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/accounts/forgot-password</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/accounts/forgot-password`
- Public URL: `https://api.modula.digital/v1/accounts/forgot-password`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:469`
- Handler: inline
- Controller/service calls: `recovery.requestRecovery`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any).email ?? '', {correlationId: request.id}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_recovery_tokens`
- Database writes: `greenfield_recovery_tokens`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `scripts/verify-phase7e-real-auth.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/accounts/handles/:handle/availability</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/accounts/handles/:handle/availability`
- Public URL: `https://api.modula.digital/v1/accounts/handles/:handle/availability`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:485`
- Handler: inline
- Controller/service calls: `accounts.handleAvailability`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{handle: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `services/greenfield-api/tests/greenfield.accounts.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/accounts/mail-local-parts/:localPart/availability</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/accounts/mail-local-parts/:localPart/availability`
- Public URL: `https://api.modula.digital/v1/accounts/mail-local-parts/:localPart/availability`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:489`
- Handler: inline
- Controller/service calls: `mailIdentities.availability`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{localPart: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_mail_identities`, `greenfield_reserved_identifiers`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/accounts/me</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/accounts/me`
- Public URL: `https://api.modula.digital/v1/accounts/me`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:497`
- Handler: inline
- Controller/service calls: `accounts.getMe`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/appearanceRoutes.ts`, `src/api/local/routes/authRoutes.ts`, `src/api/local/routes/notificationRoutes.ts`, `src/data/repositories/api/ApiActivityRepository.ts`, `src/data/repositories/api/ApiAppearanceRepository.ts`, `src/data/repositories/api/ApiAuthRepository.ts`, `src/features/settings/screens/ModulaMailSettingsScreen.tsx`
- Tests: `scripts/verify-phase6-greenfield-frontend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-product-complete.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/settings-v2.integration.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: PASS (401)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/accounts/me</code> — reachable</summary>

- Domain: Authentication
- Method: PATCH
- Effective route: `/v1/accounts/me`
- Public URL: `https://api.modula.digital/v1/accounts/me`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:543`
- Handler: inline
- Controller/service calls: `accounts.patchMe`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`
- Database writes: `failed`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/appearanceRoutes.ts`, `src/api/local/routes/authRoutes.ts`, `src/api/local/routes/notificationRoutes.ts`, `src/data/repositories/api/ApiActivityRepository.ts`, `src/data/repositories/api/ApiAppearanceRepository.ts`, `src/data/repositories/api/ApiAuthRepository.ts`, `src/features/settings/screens/ModulaMailSettingsScreen.tsx`
- Tests: `scripts/verify-phase6-greenfield-frontend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-product-complete.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/settings-v2.integration.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/accounts/me/app-preferences</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/accounts/me/app-preferences`
- Public URL: `https://api.modula.digital/v1/accounts/me/app-preferences`
- API version: v1
- Source file: `services/greenfield-api/src/settings-v2/routes.ts:40`
- Handler: inline
- Controller/service calls: `service.preferences`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_account_app_preferences`, `greenfield_auth_identities`, `greenfield_digest_deliveries`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/settings-v2.integration.test.ts`
- Runtime registration: yes
- Live probe: PASS (401)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/accounts/me/app-preferences</code> — reachable</summary>

- Domain: Authentication
- Method: PATCH
- Effective route: `/v1/accounts/me/app-preferences`
- Public URL: `https://api.modula.digital/v1/accounts/me/app-preferences`
- API version: v1
- Source file: `services/greenfield-api/src/settings-v2/routes.ts:41`
- Handler: inline
- Controller/service calls: `service.updatePreferences`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_account_app_preferences`, `greenfield_auth_identities`, `greenfield_digest_deliveries`
- Database writes: `greenfield_account_app_preferences`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/settings-v2.integration.test.ts`
- Runtime registration: yes
- Live probe: PASS (401)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/accounts/me/appearance</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/accounts/me/appearance`
- Public URL: `https://api.modula.digital/v1/accounts/me/appearance`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:237`
- Handler: inline
- Controller/service calls: `appearance.get`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_appearance_preferences`
- Database writes: `greenfield_appearance_preferences`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/appearanceRoutes.ts`, `src/data/repositories/api/ApiAppearanceRepository.ts`
- Tests: `scripts/verify-phase6s-social-backend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/accounts/me/appearance</code> — reachable</summary>

- Domain: Authentication
- Method: PATCH
- Effective route: `/v1/accounts/me/appearance`
- Public URL: `https://api.modula.digital/v1/accounts/me/appearance`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:242`
- Handler: inline
- Controller/service calls: `appearance.patch`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}), request.id),`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_appearance_preferences`
- Database writes: `failed`, `greenfield_appearance_preferences`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/appearanceRoutes.ts`, `src/data/repositories/api/ApiAppearanceRepository.ts`
- Tests: `scripts/verify-phase6s-social-backend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/accounts/me/blocks</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/accounts/me/blocks`
- Public URL: `https://api.modula.digital/v1/accounts/me/blocks`
- API version: v1
- Source file: `services/greenfield-api/src/settings-v2/routes.ts:43`
- Handler: inline
- Controller/service calls: `service.blocks`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `actors`, `blocks`, `profiles`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/settings-v2.integration.test.ts`
- Runtime registration: yes
- Live probe: PASS (401)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/accounts/me/handle</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/accounts/me/handle`
- Public URL: `https://api.modula.digital/v1/accounts/me/handle`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:552`
- Handler: inline
- Controller/service calls: `accounts.changeHandle`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any).handle ?? ''), request.id),`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `greenfield_accounts`
- Database writes: `greenfield_accounts`, `greenfield_handle_history`, `greenfield_handles`, `profiles`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/accounts/me/modula-mail</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/accounts/me/modula-mail`
- Public URL: `https://api.modula.digital/v1/accounts/me/modula-mail`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:502`
- Handler: inline
- Controller/service calls: `mailIdentities.getForAccount`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_mail_identities`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/features/settings/screens/ModulaMailSettingsScreen.tsx`
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/accounts/me/modula-mail/forwarding</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/accounts/me/modula-mail/forwarding`
- Public URL: `https://api.modula.digital/v1/accounts/me/modula-mail/forwarding`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:517`
- Handler: inline
- Controller/service calls: `mail.queueMailForwardingChanged`, `mailIdentities.updateForwarding`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}) as {enabled?: boolean`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_mail_identities`
- Database writes: `background_jobs`, `failed`, `greenfield_mail_identities`, `greenfield_mail_identity_events`, `greenfield_mail_identity_requests`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/accounts/me/modula-mail/provision</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/accounts/me/modula-mail/provision`
- Public URL: `https://api.modula.digital/v1/accounts/me/modula-mail/provision`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:507`
- Handler: inline
- Controller/service calls: `db.transaction`, `mailIdentities.queueProvisioningForVerifiedAccount`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `202`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_mail_identities`
- Database writes: `background_jobs`, `greenfield_mail_identities`, `greenfield_mail_identity_events`, `greenfield_mail_identity_requests`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/accounts/me/mutes</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/accounts/me/mutes`
- Public URL: `https://api.modula.digital/v1/accounts/me/mutes`
- API version: v1
- Source file: `services/greenfield-api/src/settings-v2/routes.ts:42`
- Handler: inline
- Controller/service calls: `service.mutes`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `actors`, `mutes`, `profiles`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/settings-v2.integration.test.ts`
- Runtime registration: yes
- Live probe: PASS (401)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/accounts/me/notification-preferences</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/accounts/me/notification-preferences`
- Public URL: `https://api.modula.digital/v1/accounts/me/notification-preferences`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1953`
- Handler: inline
- Controller/service calls: `notificationPreferences.get`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `actors`, `notification_preferences`
- Database writes: `notification_preferences`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/notificationRoutes.ts`, `src/data/repositories/api/ApiActivityRepository.ts`
- Tests: `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-product-complete.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/accounts/me/notification-preferences</code> — reachable</summary>

- Domain: Authentication
- Method: PATCH
- Effective route: `/v1/accounts/me/notification-preferences`
- Public URL: `https://api.modula.digital/v1/accounts/me/notification-preferences`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1963`
- Handler: inline
- Controller/service calls: `notificationPreferences.patch`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}),`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `notification_preferences`
- Database writes: `failed`, `notification_preferences`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/notificationRoutes.ts`, `src/data/repositories/api/ApiActivityRepository.ts`
- Tests: `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-product-complete.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/accounts/me/password</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/accounts/me/password`
- Public URL: `https://api.modula.digital/v1/accounts/me/password`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:563`
- Handler: inline
- Controller/service calls: `accounts.changePassword`, `greenfieldSessions.revokeOtherSessions`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}) as {currentPassword?: string`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_password_credentials`, `greenfield_sessions`
- Database writes: `greenfield_password_credentials`, `greenfield_session_events`, `greenfield_session_tokens`, `greenfield_sessions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/accounts/me/sessions</code> — reachable</summary>

- Domain: Authentication
- Method: DELETE
- Effective route: `/v1/accounts/me/sessions`
- Public URL: `https://api.modula.digital/v1/accounts/me/sessions`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:594`
- Handler: inline
- Controller/service calls: `greenfieldSessions.revokeAllForAccount`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_sessions`
- Database writes: `greenfield_session_events`, `greenfield_session_tokens`, `greenfield_sessions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/accounts/me/sessions</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/accounts/me/sessions`
- Public URL: `https://api.modula.digital/v1/accounts/me/sessions`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:589`
- Handler: inline
- Controller/service calls: `greenfieldSessions.listSessions`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_sessions`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/accounts/recovery/complete</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/accounts/recovery/complete`
- Public URL: `https://api.modula.digital/v1/accounts/recovery/complete`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:263`
- Handler: inline
- Controller/service calls: `recovery.completeRecovery`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `{token?: string`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_recovery_tokens`
- Database writes: `greenfield_password_credentials`, `greenfield_recovery_tokens`, `greenfield_session_events`, `greenfield_sessions`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/accounts/recovery/request</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/accounts/recovery/request`
- Public URL: `https://api.modula.digital/v1/accounts/recovery/request`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:255`
- Handler: inline
- Controller/service calls: `recovery.requestRecovery`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any)?.email ?? '')`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_recovery_tokens`
- Database writes: `greenfield_recovery_tokens`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/accounts/register</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/accounts/register`
- Public URL: `https://api.modula.digital/v1/accounts/register`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:418`
- Handler: inline
- Controller/service calls: `accounts.register`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}) as Record<string, unknown>`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_auth_identities`
- Database writes: `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_email_verifications`, `greenfield_handle_history`, `greenfield_handles`, `greenfield_password_credentials`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6-greenfield-frontend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7e-real-auth.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.provider-fabric.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/helpers/registry-fixtures.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: PASS (400)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/accounts/resend-verification</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/accounts/resend-verification`
- Public URL: `https://api.modula.digital/v1/accounts/resend-verification`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:454`
- Handler: inline
- Controller/service calls: `accounts.resendVerification`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any).email ?? '', {`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-frontend.mjs`, `scripts/verify-phase7e-real-auth.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/accounts/reset-password</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/accounts/reset-password`
- Public URL: `https://api.modula.digital/v1/accounts/reset-password`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:476`
- Handler: inline
- Controller/service calls: `recovery.completeRecovery`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}) as {token?: string`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_recovery_tokens`
- Database writes: `greenfield_password_credentials`, `greenfield_recovery_tokens`, `greenfield_session_events`, `greenfield_sessions`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `scripts/verify-phase7e-real-auth.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/accounts/verify-email</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/accounts/verify-email`
- Public URL: `https://api.modula.digital/v1/accounts/verify-email`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:440`
- Handler: inline
- Controller/service calls: `accounts.verifyEmail`, `accounts.verifyEmailCode`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_email_verifications`, `greenfield_repositories`
- Database writes: `actors`, `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_collections`, `greenfield_email_verifications`, `greenfield_records`, `greenfield_repositories`, `profiles`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6-greenfield-frontend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7e-real-auth.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.provider-fabric.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/helpers/registry-fixtures.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/activity</code> — reachable</summary>

- Domain: Activity
- Method: GET
- Effective route: `/v1/activity`
- Public URL: `https://api.modula.digital/v1/activity`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2101`
- Handler: inline
- Controller/service calls: `discovery.listActivity`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `activity_items`, `mutes`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/activityRoutes.ts`, `src/data/repositories/api/ApiActivityRepository.ts`
- Tests: `scripts/verify-phase7e-no-product-mocks.mjs`, `services/greenfield-api/tests/api.integration.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ai/models</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ai/models`
- Public URL: `https://api.modula.digital/v1/admin/ai/models`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:235`
- Handler: inline
- Controller/service calls: `repository.upsertModel`
- Authentication: none
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}),`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_ai_models`, `greenfield_ai_providers`
- Database writes: `greenfield_ai_models`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ai/prompts</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ai/prompts`
- Public URL: `https://api.modula.digital/v1/admin/ai/prompts`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:239`
- Handler: inline
- Controller/service calls: `repository.registerPrompt`
- Authentication: none
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}),`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_ai_prompts`
- Database writes: `greenfield_ai_prompts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ai/providers</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ai/providers`
- Public URL: `https://api.modula.digital/v1/admin/ai/providers`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:231`
- Handler: inline
- Controller/service calls: `repository.upsertProvider`
- Authentication: none
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}),`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_ai_providers`
- Database writes: `greenfield_ai_providers`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ai/tools</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ai/tools`
- Public URL: `https://api.modula.digital/v1/admin/ai/tools`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:243`
- Handler: inline
- Controller/service calls: `tools.declareTool`
- Authentication: none
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}),`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/commerce/entitlements</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/commerce/entitlements`
- Public URL: `https://api.modula.digital/v1/admin/commerce/entitlements`
- API version: v1
- Source file: `services/greenfield-api/src/entitlements/routes.ts:34`
- Handler: inline
- Controller/service calls: `service.grant`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_developer_organisations`, `greenfield_entitlement_capabilities`, `greenfield_entitlements`, `greenfield_external_billing_receipts`, `greenfield_offers`
- Database writes: `greenfield_entitlement_capabilities`, `greenfield_entitlement_events`, `greenfield_entitlements`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/commerce/entitlements/:entitlementId/transitions</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/commerce/entitlements/:entitlementId/transitions`
- Public URL: `https://api.modula.digital/v1/admin/commerce/entitlements/:entitlementId/transitions`
- API version: v1
- Source file: `services/greenfield-api/src/entitlements/routes.ts:35`
- Handler: inline
- Controller/service calls: `service.transition`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_entitlement_capabilities`, `greenfield_entitlements`
- Database writes: `greenfield_entitlement_events`, `greenfield_entitlements`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PUT /v1/admin/commerce/offers/:offerId</code> — reachable</summary>

- Domain: Admin
- Method: PUT
- Effective route: `/v1/admin/commerce/offers/:offerId`
- Public URL: `https://api.modula.digital/v1/admin/commerce/offers/:offerId`
- API version: v1
- Source file: `services/greenfield-api/src/entitlements/routes.ts:33`
- Handler: inline
- Controller/service calls: `service.upsertOffer`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `greenfield_offers`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PUT /v1/admin/commerce/quotas/:quotaPolicyId</code> — reachable</summary>

- Domain: Admin
- Method: PUT
- Effective route: `/v1/admin/commerce/quotas/:quotaPolicyId`
- Public URL: `https://api.modula.digital/v1/admin/commerce/quotas/:quotaPolicyId`
- API version: v1
- Source file: `services/greenfield-api/src/entitlements/routes.ts:36`
- Handler: inline
- Controller/service calls: `service.upsertQuota`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `greenfield_quota_policies`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PUT /v1/admin/developer/build-services/:serviceId</code> — reachable</summary>

- Domain: Admin
- Method: PUT
- Effective route: `/v1/admin/developer/build-services/:serviceId`
- Public URL: `https://api.modula.digital/v1/admin/developer/build-services/:serviceId`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:47`
- Handler: inline
- Controller/service calls: `developers.registerBuildService`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`
- Database writes: `greenfield_build_service_registrations`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/developer/namespaces/:namespace/verify</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/developer/namespaces/:namespace/verify`
- Public URL: `https://api.modula.digital/v1/admin/developer/namespaces/:namespace/verify`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:46`
- Handler: inline
- Controller/service calls: `developers.verifyNamespace`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`
- Database writes: `greenfield_publisher_namespaces`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/admin/developer/programme/:accountId</code> — reachable</summary>

- Domain: Admin
- Method: PATCH
- Effective route: `/v1/admin/developer/programme/:accountId`
- Public URL: `https://api.modula.digital/v1/admin/developer/programme/:accountId`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:45`
- Handler: inline
- Controller/service calls: `developers.setProgrammeState`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`
- Database writes: `greenfield_developer_programme_memberships`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-developer.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/moderation/reports</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/moderation/reports`
- Public URL: `https://api.modula.digital/v1/admin/moderation/reports`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1857`
- Handler: inline
- Controller/service calls: `moderation.listReports`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:moderation`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: `Record<string, unknown>`
- Request body: none observed
- Pagination: cursor; default 20, max 50, next cursor yes
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `reports`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/moderation/reports/:reportId</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/moderation/reports/:reportId`
- Public URL: `https://api.modula.digital/v1/admin/moderation/reports/:reportId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1875`
- Handler: inline
- Controller/service calls: `moderation.getReport`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:moderation`
- Rate limit: 120 per 1 minute
- Request params: `{reportId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `reports`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/admin/moderation/reports/:reportId</code> — reachable</summary>

- Domain: Admin
- Method: PATCH
- Effective route: `/v1/admin/moderation/reports/:reportId`
- Public URL: `https://api.modula.digital/v1/admin/moderation/reports/:reportId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1886`
- Handler: inline
- Controller/service calls: `moderation.reviewReport`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:moderation`
- Rate limit: 30 per 1 minute
- Request params: `{reportId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `reports`
- Database writes: `moderation_actions`, `reports`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/moderation/reports/:reportId/actions</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/moderation/reports/:reportId/actions`
- Public URL: `https://api.modula.digital/v1/admin/moderation/reports/:reportId/actions`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1904`
- Handler: inline
- Controller/service calls: `moderation.applyAction`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:moderation`
- Rate limit: 30 per 1 minute
- Request params: `{reportId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_comments`, `reports`
- Database writes: `greenfield_comments`, `greenfield_story_groups`, `greenfield_story_items`, `moderation_actions`, `posts`, `reports`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/ops/ai/executions</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/ops/ai/executions`
- Public URL: `https://api.modula.digital/v1/admin/ops/ai/executions`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:282`
- Handler: inline
- Controller/service calls: `providerRuntime.diagnostics`
- Authentication: none
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/ops/ai/providers</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/ops/ai/providers`
- Public URL: `https://api.modula.digital/v1/admin/ops/ai/providers`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:247`
- Handler: inline
- Controller/service calls: `repository.listProviders`
- Authentication: none
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: `greenfield_ai_providers`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/ai/providers/:providerId/credentials</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/ai/providers/:providerId/credentials`
- Public URL: `https://api.modula.digital/v1/admin/ops/ai/providers/:providerId/credentials`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:271`
- Handler: inline
- Controller/service calls: `credentials.store`
- Authentication: none
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{providerId: string}).providerId,`
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/ai/providers/:providerId/disable</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/ai/providers/:providerId/disable`
- Public URL: `https://api.modula.digital/v1/admin/ops/ai/providers/:providerId/disable`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:263`
- Handler: inline
- Controller/service calls: `providerRuntime.setProviderEnabled`
- Authentication: none
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{providerId: string}).providerId, enabled: false, requestId: request.id}),`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/ai/providers/:providerId/enable</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/ai/providers/:providerId/enable`
- Public URL: `https://api.modula.digital/v1/admin/ops/ai/providers/:providerId/enable`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:267`
- Handler: inline
- Controller/service calls: `providerRuntime.setProviderEnabled`
- Authentication: none
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{providerId: string}).providerId, enabled: true, requestId: request.id}),`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/ops/ai/providers/:providerId/health</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/ops/ai/providers/:providerId/health`
- Public URL: `https://api.modula.digital/v1/admin/ops/ai/providers/:providerId/health`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:251`
- Handler: inline
- Controller/service calls: `providerRuntime.verifyProvider`
- Authentication: none
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{providerId: string}).providerId, {scopeType: 'platform'}),`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/ai/providers/:providerId/verify</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/ai/providers/:providerId/verify`
- Public URL: `https://api.modula.digital/v1/admin/ops/ai/providers/:providerId/verify`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:255`
- Handler: inline
- Controller/service calls: `providerRuntime.verifyProvider`
- Authentication: none
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{providerId: string}).providerId, {`
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/ops/ai/usage</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/ops/ai/usage`
- Public URL: `https://api.modula.digital/v1/admin/ops/ai/usage`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:286`
- Handler: inline
- Controller/service calls: `providerRuntime.diagnostics`
- Authentication: none
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/atproto/connections/:connectionId/revoke</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/atproto/connections/:connectionId/revoke`
- Public URL: `https://api.modula.digital/v1/admin/ops/atproto/connections/:connectionId/revoke`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2264`
- Handler: inline
- Controller/service calls: `atproto.adminRevokeConnection`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:moderation`
- Rate limit: 30 per 1 minute
- Request params: `{connectionId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `atproto_connections`
- Database writes: `atproto_connections`, `atproto_oauth_sessions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/atproto/ingest</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/atproto/ingest`
- Public URL: `https://api.modula.digital/v1/admin/ops/atproto/ingest`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2256`
- Handler: inline
- Controller/service calls: none observed
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:moderation`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `{paused?: boolean}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/atproto/lexicons/:collection/disable</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/atproto/lexicons/:collection/disable`
- Public URL: `https://api.modula.digital/v1/admin/ops/atproto/lexicons/:collection/disable`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2542`
- Handler: inline
- Controller/service calls: none observed
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:moderation`
- Rate limit: 30 per 1 minute
- Request params: `{collection: string}`
- Request query: none observed
- Request body: `{disabled?: boolean}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/atproto/publish</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/atproto/publish`
- Public URL: `https://api.modula.digital/v1/admin/ops/atproto/publish`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2248`
- Handler: inline
- Controller/service calls: none observed
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:moderation`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `{enabled?: boolean}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/ops/engines</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/ops/engines`
- Public URL: `https://api.modula.digital/v1/admin/ops/engines`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2386`
- Handler: inline
- Controller/service calls: `engines.list`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:ops`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `greenfield_engine_capability_registrations`, `greenfield_engine_event_consumer_registrations`, `greenfield_engine_job_registrations`, `greenfield_engine_registrations`, `greenfield_engine_service_registrations`, `greenfield_engine_usage_metric_registrations`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-engine-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.engine-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/ops/engines/:engineId</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/ops/engines/:engineId`
- Public URL: `https://api.modula.digital/v1/admin/ops/engines/:engineId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2396`
- Handler: inline
- Controller/service calls: `engines.get`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:ops`
- Rate limit: 120 per 1 minute
- Request params: `{engineId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `greenfield_engine_capability_registrations`, `greenfield_engine_event_consumer_registrations`, `greenfield_engine_job_registrations`, `greenfield_engine_registrations`, `greenfield_engine_service_registrations`, `greenfield_engine_usage_metric_registrations`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-engine-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.engine-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/events/dead-letters/retry</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/events/dead-letters/retry`
- Public URL: `https://api.modula.digital/v1/admin/ops/events/dead-letters/retry`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2509`
- Handler: inline
- Controller/service calls: `eventReplays.retryDeadLetters`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:ops`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `Record<string, unknown>`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_domain_events`, `greenfield_event_subscriptions`
- Database writes: `greenfield_event_deliveries`, `greenfield_event_replay_requests`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7e-event-platform.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/events/replay</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/events/replay`
- Public URL: `https://api.modula.digital/v1/admin/ops/events/replay`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2484`
- Handler: inline
- Controller/service calls: `eventReplays.replay`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:ops`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `Record<string, unknown>`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_domain_events`, `greenfield_event_subscriptions`
- Database writes: `greenfield_event_deliveries`, `greenfield_event_replay_requests`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7e-event-platform.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/events/replay/:replayId/cancel</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/events/replay/:replayId/cancel`
- Public URL: `https://api.modula.digital/v1/admin/ops/events/replay/:replayId/cancel`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2529`
- Handler: inline
- Controller/service calls: `eventReplays.cancelReplay`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:ops`
- Rate limit: 30 per 1 minute
- Request params: `{replayId: string}`
- Request query: none observed
- Request body: `{reason?: string}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `greenfield_event_deliveries`, `greenfield_event_replay_requests`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7e-event-platform.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/ops/events/subscriber-failures</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/ops/events/subscriber-failures`
- Public URL: `https://api.modula.digital/v1/admin/ops/events/subscriber-failures`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2365`
- Handler: inline
- Controller/service calls: `eventReplays.inspectSubscriberFailures`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:ops`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: `{subscriberId?: string}`
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `greenfield_domain_events`, `greenfield_event_deliveries`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7e-event-platform.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/mail/identities/adopt</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/mail/identities/adopt`
- Public URL: `https://api.modula.digital/v1/admin/ops/mail/identities/adopt`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2290`
- Handler: inline
- Controller/service calls: `mailIdentities.adopt`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:ops`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}) as {`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_mail_identities`
- Database writes: `greenfield_mail_identities`, `greenfield_mail_identity_events`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/ops/mail/summary</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/ops/mail/summary`
- Public URL: `https://api.modula.digital/v1/admin/ops/mail/summary`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2284`
- Handler: inline
- Controller/service calls: `mail.summary`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:ops`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `greenfield_mail_jobs`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/policy/evaluate</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/policy/evaluate`
- Public URL: `https://api.modula.digital/v1/admin/ops/policy/evaluate`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2454`
- Handler: inline
- Controller/service calls: `policies.evaluateAndAudit`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: workspace identifier observed; downstream enforcement requires service evidence
- Capability/permission: `admin:ops`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `Record<string, unknown>) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `blocks`, `follows`, `greenfield_comments`, `greenfield_connections`, `greenfield_extension_capabilities`, `greenfield_extension_installations`, `greenfield_extension_versions`, `greenfield_extensions`, `greenfield_records`, `greenfield_repositories`, `posts`, `profiles`
- Database writes: `greenfield_policy_decision_audit`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7e-policy-engine.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/queue/dead-letters/:deadLetterId/retry</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/queue/dead-letters/:deadLetterId/retry`
- Public URL: `https://api.modula.digital/v1/admin/ops/queue/dead-letters/:deadLetterId/retry`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2319`
- Handler: inline
- Controller/service calls: `db.transaction`, `now.getTime`, `trx.updateTable`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:moderation`
- Rate limit: 30 per 1 minute
- Request params: `{deadLetterId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `atproto_dead_letters`
- Database writes: `atproto_dead_letters`, `background_jobs`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/queue/drain</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/queue/drain`
- Public URL: `https://api.modula.digital/v1/admin/ops/queue/drain`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2276`
- Handler: inline
- Controller/service calls: none observed
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:moderation`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `{drained?: boolean}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/ops/search/failures</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/ops/search/failures`
- Public URL: `https://api.modula.digital/v1/admin/ops/search/failures`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2419`
- Handler: inline
- Controller/service calls: `search.projectionFailures`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:ops`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7e-search-platform.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/search/failures/:failureId/retry</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/search/failures/:failureId/retry`
- Public URL: `https://api.modula.digital/v1/admin/ops/search/failures/:failureId/retry`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2441`
- Handler: inline
- Controller/service calls: `search.retryFailure`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:ops`
- Rate limit: 30 per 1 minute
- Request params: `{failureId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7e-search-platform.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/ops/search/health</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/ops/search/health`
- Public URL: `https://api.modula.digital/v1/admin/ops/search/health`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2376`
- Handler: inline
- Controller/service calls: `search.health`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:ops`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7e-search-platform.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/ops/search/projections</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/ops/search/projections`
- Public URL: `https://api.modula.digital/v1/admin/ops/search/projections`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2409`
- Handler: inline
- Controller/service calls: `search.projectionStates`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:ops`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7e-search-platform.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/ops/search/reindex</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/ops/search/reindex`
- Public URL: `https://api.modula.digital/v1/admin/ops/search/reindex`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2429`
- Handler: inline
- Controller/service calls: `search.requestReindex`
- Authentication: legacy or bridged bearer session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: `admin:ops`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `202`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7e-search-platform.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/product-standard/ingest</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/product-standard/ingest`
- Public URL: `https://api.modula.digital/v1/admin/product-standard/ingest`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:165`
- Handler: inline
- Controller/service calls: `filename.trim`, `mpsIngest.ingest`, `publishers.requireAdminAccount`, `releaseId.trim`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `{`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_mps_ingestions`, `greenfield_product_family_members`, `greenfield_product_privacy_declarations`, `greenfield_release_frontends`, `greenfield_release_presentation_assets`
- Database writes: `greenfield_mps_ingestions`, `greenfield_product_families`, `greenfield_product_family_members`, `greenfield_product_identity_aliases`, `greenfield_product_privacy_declarations`, `greenfield_product_relationships`, `greenfield_release_frontends`, `greenfield_release_presentation_assets`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-mps-v1.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/registry/modules/import</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/registry/modules/import`
- Public URL: `https://api.modula.digital/v1/admin/registry/modules/import`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:958`
- Handler: inline
- Controller/service calls: `publishers.requireAdminAccount`, `releases.importPendingReview`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_module_releases`, `greenfield_module_versions`
- Database writes: `greenfield_extension_points`, `greenfield_extension_targets`, `greenfield_extension_versions`, `greenfield_extensions`, `greenfield_module_contributions`, `greenfield_module_dependencies`, `greenfield_module_license_evidence`, `greenfield_module_permissions`, `greenfield_module_release_integrity`, `greenfield_module_release_signatures`, `greenfield_module_releases`, `greenfield_module_sources`, `greenfield_module_versions`, `module_backend_definitions`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/registry/publishers/:publisherId/revoke</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/registry/publishers/:publisherId/revoke`
- Public URL: `https://api.modula.digital/v1/admin/registry/publishers/:publisherId/revoke`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:1021`
- Handler: inline
- Controller/service calls: `publishers.revokePublisher`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).publisherId),`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_publishers`
- Database writes: `greenfield_publisher_namespaces`, `greenfield_publishers`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/registry/publishers/:publisherId/signing-keys</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/registry/publishers/:publisherId/signing-keys`
- Public URL: `https://api.modula.digital/v1/admin/registry/publishers/:publisherId/signing-keys`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:1026`
- Handler: inline
- Controller/service calls: `publishers.requireAdminAccount`, `signingKeys.register`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).publisherId), body, auth.accountId), request.id))`
- Request query: none observed
- Request body: `Record<string, unknown> | undefined) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_publisher_signing_keys`, `greenfield_publishers`
- Database writes: `greenfield_publisher_signing_key_events`, `greenfield_publisher_signing_keys`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/registry/publishers/:publisherId/signing-keys/:keyId/revoke</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/registry/publishers/:publisherId/signing-keys/:keyId/revoke`
- Public URL: `https://api.modula.digital/v1/admin/registry/publishers/:publisherId/signing-keys/:keyId/revoke`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:1037`
- Handler: inline
- Controller/service calls: `publishers.requireAdminAccount`, `signingKeys.revoke`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{publisherId: string`
- Request query: none observed
- Request body: `any)?.reason, auth.accountId), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_publisher_signing_keys`
- Database writes: `greenfield_module_release_signatures`, `greenfield_module_revocations`, `greenfield_publisher_signing_key_events`, `greenfield_publisher_signing_keys`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/registry/publishers/:publisherId/suspend</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/registry/publishers/:publisherId/suspend`
- Public URL: `https://api.modula.digital/v1/admin/registry/publishers/:publisherId/suspend`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:1018`
- Handler: inline
- Controller/service calls: `publishers.suspendPublisher`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).publisherId),`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_publishers`
- Database writes: `greenfield_publishers`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/registry/publishers/:publisherId/verify</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/registry/publishers/:publisherId/verify`
- Public URL: `https://api.modula.digital/v1/admin/registry/publishers/:publisherId/verify`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:1015`
- Handler: inline
- Controller/service calls: `publishers.verifyPublisher`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).publisherId),`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_publishers`
- Database writes: `greenfield_publishers`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/registry/releases/:releaseId/publish</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/registry/releases/:releaseId/publish`
- Public URL: `https://api.modula.digital/v1/admin/registry/releases/:releaseId/publish`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:1005`
- Handler: inline
- Controller/service calls: none observed
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).releaseId),`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/registry/releases/:releaseId/quarantine</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/registry/releases/:releaseId/quarantine`
- Public URL: `https://api.modula.digital/v1/admin/registry/releases/:releaseId/quarantine`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:1008`
- Handler: inline
- Controller/service calls: `releases.quarantineRelease`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).releaseId, ((request.body as any)?.reason ?? 'administrative quarantine') as string, ((request.body as any)?.policyAction ?? 'block') as any),`
- Request query: none observed
- Request body: `any)?.reason ?? 'administrative quarantine') as string, ((request.body as any)?.policyAction ?? 'block') as any),`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_releases`
- Database writes: `greenfield_module_contributions`, `greenfield_module_quarantines`, `greenfield_module_releases`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/registry/releases/:releaseId/revoke</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/registry/releases/:releaseId/revoke`
- Public URL: `https://api.modula.digital/v1/admin/registry/releases/:releaseId/revoke`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:1011`
- Handler: inline
- Controller/service calls: `releases.revokeRelease`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).releaseId, ((request.body as any)?.reason ?? 'administrative revocation') as string),`
- Request query: none observed
- Request body: `any)?.reason ?? 'administrative revocation') as string),`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_releases`
- Database writes: `greenfield_module_releases`, `greenfield_module_revocations`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/registry/releases/:releaseId/verify</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/registry/releases/:releaseId/verify`
- Public URL: `https://api.modula.digital/v1/admin/registry/releases/:releaseId/verify`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:1002`
- Handler: inline
- Controller/service calls: `releases.verifyReleaseFromId`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).releaseId),`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_release_signatures`, `greenfield_module_releases`, `greenfield_module_versions`, `greenfield_mps_ingestions`, `greenfield_release_frontends`
- Database writes: `greenfield_module_contributions`, `greenfield_module_quarantines`, `greenfield_module_release_signatures`, `greenfield_module_releases`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/admin/registry/sync</code> — reachable</summary>

- Domain: Admin
- Method: POST
- Effective route: `/v1/admin/registry/sync`
- Public URL: `https://api.modula.digital/v1/admin/registry/sync`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:971`
- Handler: inline
- Controller/service calls: `githubSync.sync`, `publishers.requireAdminAccount`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `Record<string, unknown> | undefined) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`
- Database writes: `greenfield_module_sync_failures`, `greenfield_module_sync_runs`, `greenfield_release_asset_blobs`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `GitHub release source (automation disabled in production)`
- Known clients: none observed
- Tests: `services/greenfield-api/tests/registry-trust.github-sync.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/admin/registry/sync-runs</code> — reachable</summary>

- Domain: Admin
- Method: GET
- Effective route: `/v1/admin/registry/sync-runs`
- Public URL: `https://api.modula.digital/v1/admin/registry/sync-runs`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:991`
- Handler: inline
- Controller/service calls: `db.selectFrom`, `publishers.requireAdminAccount`
- Authentication: greenfield bearer access session
- Authorization: ADMIN
- Ownership rule: admin capability is the resource boundary; per-user ownership is not applicable
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_module_sync_runs`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `GitHub release source (automation disabled in production)`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/ai/executions/:executionId</code> — reachable</summary>

- Domain: Intelligence
- Method: GET
- Effective route: `/v1/ai/executions/:executionId`
- Public URL: `https://api.modula.digital/v1/ai/executions/:executionId`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:119`
- Handler: inline
- Controller/service calls: `providerRuntime.getExecution`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{executionId: string}).executionId, auth.accountId), request.id))`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: `scripts/verify-phase7e-ai-product-streaming.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-ai-streaming.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/ai/executions/:executionId/cancel</code> — reachable</summary>

- Domain: Intelligence
- Method: POST
- Effective route: `/v1/ai/executions/:executionId/cancel`
- Public URL: `https://api.modula.digital/v1/ai/executions/:executionId/cancel`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:155`
- Handler: inline
- Controller/service calls: `providerRuntime.cancelExecution`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{executionId: string}).executionId, auth.accountId), request.id))`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: `scripts/verify-phase7e-ai-product-streaming.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-ai-streaming.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/ai/executions/:executionId/stream</code> — reachable</summary>

- Domain: Intelligence
- Method: GET
- Effective route: `/v1/ai/executions/:executionId/stream`
- Public URL: `https://api.modula.digital/v1/ai/executions/:executionId/stream`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:130`
- Handler: inline
- Controller/service calls: `providerRuntime.streamEvents`, `raw.end`, `raw.write`, `raw.writeHead`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{executionId: string}).executionId, auth.accountId, cursor)`
- Request query: none observed
- Request body: none observed
- Pagination: cursor
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: `scripts/verify-phase7e-ai-product-streaming.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-ai-streaming.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/ai/models</code> — reachable</summary>

- Domain: Intelligence
- Method: GET
- Effective route: `/v1/ai/models`
- Public URL: `https://api.modula.digital/v1/ai/models`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:55`
- Handler: inline
- Controller/service calls: `repository.listModels`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated global catalogue read; no user-owned resource identifier
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_ai_models`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: `scripts/verify-phase7e-ai-provider-runtime.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/ai/providers</code> — reachable</summary>

- Domain: Intelligence
- Method: GET
- Effective route: `/v1/ai/providers`
- Public URL: `https://api.modula.digital/v1/ai/providers`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:48`
- Handler: inline
- Controller/service calls: `repository.listProviders`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated global catalogue read; no user-owned resource identifier
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_ai_providers`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: `scripts/verify-phase7e-ai-provider-runtime.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/ai/requests</code> — reachable</summary>

- Domain: Intelligence
- Method: POST
- Effective route: `/v1/ai/requests`
- Public URL: `https://api.modula.digital/v1/ai/requests`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:166`
- Handler: inline
- Controller/service calls: `gateway.createRequest`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}) as Partial<GreenfieldAIRequestContract>`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `actors`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/ai/streams/:streamId/cancel</code> — reachable</summary>

- Domain: Intelligence
- Method: POST
- Effective route: `/v1/ai/streams/:streamId/cancel`
- Public URL: `https://api.modula.digital/v1/ai/streams/:streamId/cancel`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:186`
- Handler: inline
- Controller/service calls: `streaming.cancel`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: MISSING: authenticated session is required but stream ownership is not checked
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{streamId: string}).streamId)`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/ai/streams/:streamId/reconnect</code> — reachable</summary>

- Domain: Intelligence
- Method: POST
- Effective route: `/v1/ai/streams/:streamId/reconnect`
- Public URL: `https://api.modula.digital/v1/ai/streams/:streamId/reconnect`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:198`
- Handler: inline
- Controller/service calls: `streaming.reconnect`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: MISSING: authenticated session is required but stream ownership is not checked
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{streamId: string}).streamId), request.id))`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/ai/tools/:toolId/validate</code> — reachable</summary>

- Domain: Intelligence
- Method: POST
- Effective route: `/v1/ai/tools/:toolId/validate`
- Public URL: `https://api.modula.digital/v1/ai/tools/:toolId/validate`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:209`
- Handler: inline
- Controller/service calls: `grantedPermissions.filter`, `tools.validateAndRecord`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{toolId: string}).toolId,`
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/atproto/connections</code> — registered-feature-disabled</summary>

- Domain: AT Protocol
- Method: GET
- Effective route: `/v1/atproto/connections`
- Public URL: `https://api.modula.digital/v1/atproto/connections`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2111`
- Handler: inline
- Controller/service calls: `atproto.listConnections`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `atproto:connect`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `atproto_connections`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`
- Known clients: `src/api/local/routes/atprotoRoutes.ts`, `src/data/repositories/api/ApiAtprotoRepository.ts`
- Tests: `services/greenfield-api/tests/phase6.security.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/atproto/connections/:connectionId/disconnect</code> — registered-feature-disabled</summary>

- Domain: AT Protocol
- Method: POST
- Effective route: `/v1/atproto/connections/:connectionId/disconnect`
- Public URL: `https://api.modula.digital/v1/atproto/connections/:connectionId/disconnect`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2176`
- Handler: inline
- Controller/service calls: `atproto.disconnect`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `atproto:connect`
- Rate limit: 30 per 1 minute
- Request params: `{connectionId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `atproto_connections`
- Database writes: `atproto_connections`, `atproto_oauth_sessions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`
- Known clients: `src/api/local/routes/atprotoRoutes.ts`, `src/data/repositories/api/ApiAtprotoRepository.ts`
- Tests: `services/greenfield-api/tests/phase6.security.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/atproto/connections/:connectionId/refresh</code> — registered-feature-disabled</summary>

- Domain: AT Protocol
- Method: POST
- Effective route: `/v1/atproto/connections/:connectionId/refresh`
- Public URL: `https://api.modula.digital/v1/atproto/connections/:connectionId/refresh`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2188`
- Handler: inline
- Controller/service calls: `atproto.getConnection`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `atproto:connect`
- Rate limit: 30 per 1 minute
- Request params: `{connectionId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `atproto_connections`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`
- Known clients: `src/api/local/routes/atprotoRoutes.ts`, `src/data/repositories/api/ApiAtprotoRepository.ts`
- Tests: `services/greenfield-api/tests/phase6.security.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/atproto/connections/:connectionId/status</code> — registered-feature-disabled</summary>

- Domain: AT Protocol
- Method: GET
- Effective route: `/v1/atproto/connections/:connectionId/status`
- Public URL: `https://api.modula.digital/v1/atproto/connections/:connectionId/status`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2200`
- Handler: inline
- Controller/service calls: `atproto.getConnection`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `atproto:connect`
- Rate limit: 120 per 1 minute
- Request params: `{connectionId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `atproto_connections`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`
- Known clients: `src/api/local/routes/atprotoRoutes.ts`, `src/data/repositories/api/ApiAtprotoRepository.ts`
- Tests: `services/greenfield-api/tests/phase6.security.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/atproto/feed</code> — registered-feature-disabled</summary>

- Domain: AT Protocol
- Method: GET
- Effective route: `/v1/atproto/feed`
- Public URL: `https://api.modula.digital/v1/atproto/feed`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2223`
- Handler: inline
- Controller/service calls: `atproto.atmosphereFeed`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: none observed
- Request query: `Record<string, unknown>`
- Request body: none observed
- Pagination: cursor; default 20, max 50, next cursor yes
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `atproto_records`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`
- Known clients: `src/api/local/routes/atprotoRoutes.ts`, `src/data/repositories/api/ApiAtprotoRepository.ts`
- Tests: `scripts/verify-phase6-backend.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/atproto/oauth/callback</code> — registered-feature-disabled</summary>

- Domain: AT Protocol
- Method: GET
- Effective route: `/v1/atproto/oauth/callback`
- Public URL: `https://api.modula.digital/v1/atproto/oauth/callback`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2143`
- Handler: inline
- Controller/service calls: `actorId.replace`, `atproto.completePreviewOAuth`, `atproto.consumeOAuthState`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `atproto:connect`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: `Record<string, string>`
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `atproto_connections`, `atproto_oauth_sessions`, `atproto_oauth_states`
- Database writes: `atproto_connections`, `atproto_oauth_sessions`, `atproto_oauth_states`, `atproto_publication_preferences`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`, `Connector/OAuth provider`
- Known clients: `src/api/local/routes/atprotoRoutes.ts`, `src/data/repositories/api/ApiAtprotoRepository.ts`
- Tests: `services/greenfield-api/tests/phase6.security.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/atproto/oauth/start</code> — registered-feature-disabled</summary>

- Domain: AT Protocol
- Method: POST
- Effective route: `/v1/atproto/oauth/start`
- Public URL: `https://api.modula.digital/v1/atproto/oauth/start`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2118`
- Handler: inline
- Controller/service calls: `atproto.startOAuth`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `atproto:connect`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `{`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `atproto_oauth_states`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`, `Connector/OAuth provider`
- Known clients: `src/api/local/routes/atprotoRoutes.ts`, `src/data/repositories/api/ApiAtprotoRepository.ts`
- Tests: `scripts/verify-phase6-backend.mjs`, `services/greenfield-api/tests/phase6.security.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/atproto/preferences</code> — registered-feature-disabled</summary>

- Domain: AT Protocol
- Method: GET
- Effective route: `/v1/atproto/preferences`
- Public URL: `https://api.modula.digital/v1/atproto/preferences`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2209`
- Handler: inline
- Controller/service calls: `atproto.getPreferences`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `atproto:publish`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `atproto_publication_preferences`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`
- Known clients: `src/api/local/routes/atprotoRoutes.ts`, `src/data/repositories/api/ApiAtprotoRepository.ts`
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/atproto/preferences</code> — registered-feature-disabled</summary>

- Domain: AT Protocol
- Method: PATCH
- Effective route: `/v1/atproto/preferences`
- Public URL: `https://api.modula.digital/v1/atproto/preferences`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2216`
- Handler: inline
- Controller/service calls: `atproto.updatePreferences`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `atproto:publish`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any)`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `atproto_publication_preferences`
- Database writes: `atproto_publication_preferences`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`
- Known clients: `src/api/local/routes/atprotoRoutes.ts`, `src/data/repositories/api/ApiAtprotoRepository.ts`
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/attachments/:attachmentId</code> — reachable</summary>

- Domain: Media
- Method: DELETE
- Effective route: `/v1/attachments/:attachmentId`
- Public URL: `https://api.modula.digital/v1/attachments/:attachmentId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-attachment-routes.ts:76`
- Handler: inline
- Controller/service calls: `attachments.removeOrphan`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `attachment:upload`
- Rate limit: 30 per 1 minute
- Request params: `{attachmentId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `attachments`
- Database writes: `attachments`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/attachments/:attachmentId</code> — reachable</summary>

- Domain: Media
- Method: GET
- Effective route: `/v1/attachments/:attachmentId`
- Public URL: `https://api.modula.digital/v1/attachments/:attachmentId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-attachment-routes.ts:65`
- Handler: inline
- Controller/service calls: `attachments.status`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `attachment:upload`
- Rate limit: 60 per 1 minute
- Request params: `{attachmentId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `attachments`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/attachments/:attachmentId/content</code> — reachable</summary>

- Domain: Media
- Method: GET
- Effective route: `/v1/attachments/:attachmentId/content`
- Public URL: `https://api.modula.digital/v1/attachments/:attachmentId/content`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-attachment-routes.ts:89`
- Handler: inline
- Controller/service calls: `attachments.openStored`, `db.selectFrom`, `posts.getById`, `profiles.getById`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: `{attachmentId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `attachments`, `blocks`, `follows`, `greenfield_quote_posts`, `greenfield_reactions`, `post_content`, `post_media`, `post_reposts`, `post_saves`, `posts`, `profile_links`, `profile_media`, `profiles`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/attachments/uploads</code> — reachable</summary>

- Domain: Media
- Method: POST
- Effective route: `/v1/attachments/uploads`
- Public URL: `https://api.modula.digital/v1/attachments/uploads`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-attachment-routes.ts:34`
- Handler: inline
- Controller/service calls: `attachments.createUpload`, `log.info`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `attachment:upload`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `attachment_upload_sessions`, `attachments`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PUT /v1/attachments/uploads/:uploadId/content</code> — reachable</summary>

- Domain: Media
- Method: PUT
- Effective route: `/v1/attachments/uploads/:uploadId/content`
- Public URL: `https://api.modula.digital/v1/attachments/uploads/:uploadId/content`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-attachment-routes.ts:47`
- Handler: inline
- Controller/service calls: `attachments.upload`, `log.info`, `log.warn`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `attachment:upload`
- Rate limit: 30 per 1 minute
- Request params: `{uploadId: string}`
- Request query: none observed
- Request body: `any)`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `attachment_upload_sessions`, `attachments`
- Database writes: `attachment_upload_sessions`, `attachments`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/auth/apple/link</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/auth/apple/link`
- Public URL: `https://api.modula.digital/v1/auth/apple/link`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:707`
- Handler: inline
- Controller/service calls: `appleAuthentication.completeLink`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_authentication_methods`, `greenfield_external_identities`
- Database writes: `greenfield_authentication_methods`, `greenfield_external_identities`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-auth.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/auth/apple/link/options</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/auth/apple/link/options`
- Public URL: `https://api.modula.digital/v1/auth/apple/link/options`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:697`
- Handler: inline
- Controller/service calls: `appleAuthentication.beginLink`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-auth.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/auth/apple/status</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/auth/apple/status`
- Public URL: `https://api.modula.digital/v1/auth/apple/status`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:694`
- Handler: inline
- Controller/service calls: `appleAuthentication.status`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-auth.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/auth/passkeys</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/auth/passkeys`
- Public URL: `https://api.modula.digital/v1/auth/passkeys`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:688`
- Handler: inline
- Controller/service calls: `passkeys.list`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_passkeys`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/auth/passkeys/:passkeyId</code> — reachable</summary>

- Domain: Authentication
- Method: DELETE
- Effective route: `/v1/auth/passkeys/:passkeyId`
- Public URL: `https://api.modula.digital/v1/auth/passkeys/:passkeyId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:773`
- Handler: inline
- Controller/service calls: `mail.queuePasskeyRemoved`, `passkeys.revoke`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{passkeyId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_passkeys`
- Database writes: `greenfield_authentication_methods`, `greenfield_passkeys`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/auth/passkeys/registration/options</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/auth/passkeys/registration/options`
- Public URL: `https://api.modula.digital/v1/auth/passkeys/registration/options`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:730`
- Handler: inline
- Controller/service calls: `passkeys.beginRegistration`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_passkeys`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/auth/passkeys/registration/verify</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/auth/passkeys/registration/verify`
- Public URL: `https://api.modula.digital/v1/auth/passkeys/registration/verify`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:745`
- Handler: inline
- Controller/service calls: `mail.queuePasskeyAdded`, `passkeys.verifyRegistration`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}) as {challengeId?: string`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_auth_challenges`, `greenfield_passkeys`
- Database writes: `greenfield_auth_identities`, `greenfield_passkeys`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/auth/preview/session</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/auth/preview/session`
- Public URL: `https://api.modula.digital/v1/auth/preview/session`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:313`
- Handler: inline
- Controller/service calls: `adminHandles.includes`, `handle.toLowerCase`, `profiles.getByHandle`, `sessions.createSession`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `{handle?: string}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `blocks`, `follows`, `posts`, `profile_links`, `profiles`
- Database writes: `session_capabilities`, `sessions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/phase6.security.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/auth/recovery-codes</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/auth/recovery-codes`
- Public URL: `https://api.modula.digital/v1/auth/recovery-codes`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:794`
- Handler: inline
- Controller/service calls: `recoveryCodes.remaining`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_recovery_code_sets`, `greenfield_recovery_codes`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/auth/recovery-codes/regenerate</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/auth/recovery-codes/regenerate`
- Public URL: `https://api.modula.digital/v1/auth/recovery-codes/regenerate`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:799`
- Handler: inline
- Controller/service calls: `recoveryCodes.regenerate`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `greenfield_recovery_code_sets`, `greenfield_recovery_codes`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/auth/step-up/password</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/auth/step-up/password`
- Public URL: `https://api.modula.digital/v1/auth/step-up/password`
- API version: v1
- Source file: `services/greenfield-api/src/settings-v2/routes.ts:47`
- Handler: inline
- Controller/service calls: `service.passwordStepUp`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_authentication_methods`, `greenfield_password_credentials`
- Database writes: `greenfield_authentication_methods`, `greenfield_sessions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/settings-v2.integration.test.ts`
- Runtime registration: yes
- Live probe: PASS (401)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/auth/step-up/totp</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/auth/step-up/totp`
- Public URL: `https://api.modula.digital/v1/auth/step-up/totp`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:668`
- Handler: inline
- Controller/service calls: `greenfieldSessions.markRecentlyAuthenticated`, `totp.verifyActiveTotp`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_totp_credentials`
- Database writes: `greenfield_session_events`, `greenfield_sessions`, `greenfield_totp_credentials`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/auth/totp/disable</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/auth/totp/disable`
- Public URL: `https://api.modula.digital/v1/auth/totp/disable`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:643`
- Handler: inline
- Controller/service calls: `mail.queueAuthenticatorDisabled`, `totp.disable`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_totp_credentials`
- Database writes: `greenfield_authentication_methods`, `greenfield_totp_credentials`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/auth/totp/enroll</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/auth/totp/enroll`
- Public URL: `https://api.modula.digital/v1/auth/totp/enroll`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:602`
- Handler: inline
- Controller/service calls: `totp.beginEnrollment`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`
- Database writes: `greenfield_authentication_methods`, `greenfield_totp_credentials`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/auth/totp/verify</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/auth/totp/verify`
- Public URL: `https://api.modula.digital/v1/auth/totp/verify`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:617`
- Handler: inline
- Controller/service calls: `mail.queueAuthenticatorEnabled`, `totp.verifyEnrollment`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_auth_challenges`, `greenfield_totp_credentials`
- Database writes: `greenfield_auth_challenges`, `greenfield_authentication_methods`, `greenfield_totp_credentials`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/backend/products/:productId/accounts/:accountId</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: GET
- Effective route: `/v1/backend/products/:productId/accounts/:accountId`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/accounts/:accountId`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:81`
- Handler: inline
- Controller/service calls: `created_at.toISOString`, `updated_at.toISOString`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 240 per 1 minute
- Request params: `{accountId?: string}).accountId ?? '')`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: `greenfield_accounts`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/backend/products/:productId/accounts/:accountId/entitlements</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: GET
- Effective route: `/v1/backend/products/:productId/accounts/:accountId/entitlements`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/accounts/:accountId/entitlements`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:320`
- Handler: inline
- Controller/service calls: `entitlements.listAccount`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: `entitlements.read`
- Rate limit: 240 per 1 minute
- Request params: `{accountId?: string}).accountId ?? '')`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: `greenfield_entitlement_capabilities`, `greenfield_entitlements`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/capabilities/check</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/capabilities/check`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/capabilities/check`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:115`
- Handler: inline
- Controller/service calls: none observed
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 240 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/data-request-domains/:domainId/complete</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/data-request-domains/:domainId/complete`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/data-request-domains/:domainId/complete`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:380`
- Handler: inline
- Controller/service calls: `accountData.completeServiceDomain`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{domainId?: unknown}).domainId, 'domainId'),`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_account_data_artifacts`, `greenfield_account_data_request_domains`, `greenfield_account_data_requests`
- Database writes: `greenfield_account_data_artifacts`, `greenfield_account_data_request_domains`, `greenfield_account_data_requests`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/data-requests/claim</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/data-requests/claim`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/data-requests/claim`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:369`
- Handler: inline
- Controller/service calls: `accountData.claimServiceDomains`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_account_data_request_domains`, `greenfield_account_data_requests`
- Database writes: `greenfield_account_data_request_domains`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/entitlements/check</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/entitlements/check`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/entitlements/check`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:330`
- Handler: inline
- Controller/service calls: `entitlements.check`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: `entitlements.read`
- Rate limit: 240 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_entitlement_capabilities`, `greenfield_entitlements`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/events</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/events`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/events`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:237`
- Handler: inline
- Controller/service calls: `eventJobs.publishEvent`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: `events.publish`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/backend/products/:productId/identity/context</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: GET
- Effective route: `/v1/backend/products/:productId/identity/context`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/identity/context`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:65`
- Handler: inline
- Controller/service calls: none observed
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 240 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/backend/products/:productId/installations/:installationId</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: GET
- Effective route: `/v1/backend/products/:productId/installations/:installationId`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/installations/:installationId`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:101`
- Handler: inline
- Controller/service calls: none observed
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 240 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/backend/products/:productId/installations/:installationId/capabilities</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: GET
- Effective route: `/v1/backend/products/:productId/installations/:installationId/capabilities`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/installations/:installationId/capabilities`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:108`
- Handler: inline
- Controller/service calls: none observed
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 240 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/backend/products/:productId/installations/:installationId/resources</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: GET
- Effective route: `/v1/backend/products/:productId/installations/:installationId/resources`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/installations/:installationId/resources`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:186`
- Handler: inline
- Controller/service calls: `ledger.list`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 240 per 1 minute
- Request params: none observed
- Request query: `{cursor?: string`
- Request body: none observed
- Pagination: cursor
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: `greenfield_data_backup_policies`, `greenfield_data_resource_owners`, `greenfield_data_resources`, `greenfield_data_retention_policies`, `greenfield_data_schema_versions`, `greenfield_data_storage_bindings`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/jobs</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/jobs`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/jobs`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:248`
- Handler: inline
- Controller/service calls: `eventJobs.enqueueJob`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: `jobs.enqueue`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `background_jobs`, `greenfield_module_job_registrations`
- Database writes: `background_jobs`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/jobs/:jobId/cancel</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/jobs/:jobId/cancel`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/jobs/:jobId/cancel`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:311`
- Handler: inline
- Controller/service calls: `eventJobs.cancelJob`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: `jobs.cancel`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `background_jobs`
- Database writes: `background_jobs`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/jobs/:jobId/fail</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/jobs/:jobId/fail`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/jobs/:jobId/fail`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:287`
- Handler: inline
- Controller/service calls: `eventJobs.failJob`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: `jobs.execute`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `background_jobs`
- Database writes: `background_jobs`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/backend/products/:productId/jobs/:jobId/result</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: GET
- Effective route: `/v1/backend/products/:productId/jobs/:jobId/result`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/jobs/:jobId/result`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:303`
- Handler: inline
- Controller/service calls: `eventJobs.jobResult`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: `jobs.result`
- Rate limit: 240 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: `background_jobs`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/jobs/:jobId/start</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/jobs/:jobId/start`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/jobs/:jobId/start`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:268`
- Handler: inline
- Controller/service calls: `eventJobs.startJob`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: `jobs.execute`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `background_jobs`
- Database writes: `background_jobs`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/jobs/:jobId/succeed</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/jobs/:jobId/succeed`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/jobs/:jobId/succeed`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:277`
- Handler: inline
- Controller/service calls: `eventJobs.succeedJob`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: `jobs.execute`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `background_jobs`
- Database writes: `background_jobs`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/jobs/claim</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/jobs/claim`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/jobs/claim`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:259`
- Handler: inline
- Controller/service calls: `eventJobs.claimJobs`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: `jobs.claim`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `background_jobs`, `greenfield_module_job_registrations`
- Database writes: `background_jobs`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/backend/products/:productId/records/:collection</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: GET
- Effective route: `/v1/backend/products/:productId/records/:collection`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/records/:collection`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:126`
- Handler: inline
- Controller/service calls: `records.list`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 240 per 1 minute
- Request params: none observed
- Request query: `{cursor?: string`
- Request body: none observed
- Pagination: cursor
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: `greenfield_module_records`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/records/:collection</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/records/:collection`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/records/:collection`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:150`
- Handler: inline
- Controller/service calls: `records.create`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_records`
- Database writes: `greenfield_module_record_events`, `greenfield_module_records`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/backend/products/:productId/records/:collection/:recordId</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: DELETE
- Effective route: `/v1/backend/products/:productId/records/:collection/:recordId`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/records/:collection/:recordId`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:174`
- Handler: inline
- Controller/service calls: `records.delete`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_record_events`, `greenfield_module_record_versions`, `greenfield_module_records`
- Database writes: `greenfield_module_record_events`, `greenfield_module_record_versions`, `greenfield_module_records`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/backend/products/:productId/records/:collection/:recordId</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: GET
- Effective route: `/v1/backend/products/:productId/records/:collection/:recordId`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/records/:collection/:recordId`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:141`
- Handler: inline
- Controller/service calls: `records.get`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 240 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: `greenfield_module_records`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PUT /v1/backend/products/:productId/records/:collection/:recordId</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: PUT
- Effective route: `/v1/backend/products/:productId/records/:collection/:recordId`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/records/:collection/:recordId`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:162`
- Handler: inline
- Controller/service calls: `records.patch`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_record_events`, `greenfield_module_record_versions`, `greenfield_module_records`
- Database writes: `greenfield_module_record_events`, `greenfield_module_record_versions`, `greenfield_module_records`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/resources</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/resources`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/resources`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:208`
- Handler: inline
- Controller/service calls: `ledger.register`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_data_backup_policies`, `greenfield_data_resource_owners`, `greenfield_data_resources`, `greenfield_data_retention_policies`, `greenfield_data_schema_versions`, `greenfield_data_storage_bindings`
- Database writes: `greenfield_data_resources`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/backend/products/:productId/resources/:resourceId</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: GET
- Effective route: `/v1/backend/products/:productId/resources/:resourceId`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/resources/:resourceId`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:200`
- Handler: inline
- Controller/service calls: `ledger.get`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 240 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `403`, `404`, `429`, `500`
- Database reads: `greenfield_data_backup_policies`, `greenfield_data_resource_owners`, `greenfield_data_resources`, `greenfield_data_retention_policies`, `greenfield_data_schema_versions`, `greenfield_data_storage_bindings`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/resources/:resourceId/migrations</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/resources/:resourceId/migrations`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/resources/:resourceId/migrations`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:228`
- Handler: inline
- Controller/service calls: `ledger.recordMigration`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_data_backup_policies`, `greenfield_data_migration_history`, `greenfield_data_resource_owners`, `greenfield_data_resources`, `greenfield_data_retention_policies`, `greenfield_data_schema_versions`, `greenfield_data_storage_bindings`
- Database writes: `greenfield_data_migration_history`, `greenfield_data_resources`, `greenfield_data_schema_versions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/resources/:resourceId/schemas</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/resources/:resourceId/schemas`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/resources/:resourceId/schemas`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:219`
- Handler: inline
- Controller/service calls: `ledger.declareSchemaVersion`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_data_backup_policies`, `greenfield_data_resource_owners`, `greenfield_data_resources`, `greenfield_data_retention_policies`, `greenfield_data_schema_versions`, `greenfield_data_storage_bindings`
- Database writes: `greenfield_data_schema_versions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/secrets/lease</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/secrets/lease`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/secrets/lease`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:352`
- Handler: inline
- Controller/service calls: `credentialBroker.lease`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: `secrets.use`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/backend/products/:productId/usage</code> — registered-feature-disabled</summary>

- Domain: Module Runtime
- Method: POST
- Effective route: `/v1/backend/products/:productId/usage`
- Public URL: `https://api.modula.digital/v1/backend/products/:productId/usage`
- API version: v1
- Source file: `services/greenfield-api/src/backend-fabric/routes.ts:341`
- Handler: inline
- Controller/service calls: `entitlements.recordUsage`
- Authentication: signed service assertion
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: `entitlements.usage`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_entitlements`, `greenfield_quota_policies`, `greenfield_usage_events`
- Database writes: `greenfield_quota_counters`, `greenfield_usage_events`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-event-job-fabric.mjs`, `scripts/verify-greenfield-backend-v1-secret-fabric.mjs`, `scripts/verify-greenfield-backend-v1-service-fabric.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.service-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: registered-feature-disabled
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/board/layout</code> — reachable</summary>

- Domain: Account
- Method: GET
- Effective route: `/v1/board/layout`
- Public URL: `https://api.modula.digital/v1/board/layout`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1045`
- Handler: inline
- Controller/service calls: `boardLayouts.get`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_board_layouts`
- Database writes: `greenfield_board_layouts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/boardRoutes.ts`, `src/data/repositories/api/ApiProductPreferencesRepository.ts`
- Tests: `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-board.mjs`, `scripts/verify-phase7c-founder-alpha.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/board/layout</code> — reachable</summary>

- Domain: Account
- Method: PATCH
- Effective route: `/v1/board/layout`
- Public URL: `https://api.modula.digital/v1/board/layout`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1055`
- Handler: inline
- Controller/service calls: `boardLayouts.patch`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_board_layouts`
- Database writes: `failed`, `greenfield_board_layouts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/boardRoutes.ts`, `src/data/repositories/api/ApiProductPreferencesRepository.ts`
- Tests: `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-board.mjs`, `scripts/verify-phase7c-founder-alpha.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/comments/:commentId</code> — reachable</summary>

- Domain: Comments
- Method: DELETE
- Effective route: `/v1/comments/:commentId`
- Public URL: `https://api.modula.digital/v1/comments/:commentId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:172`
- Handler: inline
- Controller/service calls: `comments.deleteComment`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{commentId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_comments`
- Database writes: `greenfield_comments`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/features/social/data/useCommentsQuery.ts`
- Tests: `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/comments/:commentId</code> — reachable</summary>

- Domain: Comments
- Method: PATCH
- Effective route: `/v1/comments/:commentId`
- Public URL: `https://api.modula.digital/v1/comments/:commentId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:154`
- Handler: inline
- Controller/service calls: `comments.updateComment`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{commentId: string}`
- Request query: none observed
- Request body: `{text?: string`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_comments`
- Database writes: `comment`, `greenfield_comments`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/features/social/data/useCommentsQuery.ts`
- Tests: `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/comments/:commentId/reaction</code> — reachable</summary>

- Domain: Comments
- Method: DELETE
- Effective route: `/v1/comments/:commentId/reaction`
- Public URL: `https://api.modula.digital/v1/comments/:commentId/reaction`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:197`
- Handler: inline
- Controller/service calls: `comments.setCommentReaction`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{commentId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_comment_reactions`, `greenfield_comments`
- Database writes: `greenfield_comment_reactions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/features/social/data/useCommentsQuery.ts`
- Tests: `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PUT /v1/comments/:commentId/reaction</code> — reachable</summary>

- Domain: Comments
- Method: PUT
- Effective route: `/v1/comments/:commentId/reaction`
- Public URL: `https://api.modula.digital/v1/comments/:commentId/reaction`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:184`
- Handler: inline
- Controller/service calls: `comments.setCommentReaction`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{commentId: string}`
- Request query: none observed
- Request body: `{type?: string} | null)?.type ?? null`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_comment_reactions`, `greenfield_comments`
- Database writes: `greenfield_comment_reactions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/features/social/data/useCommentsQuery.ts`
- Tests: `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/comments/:commentId/replies</code> — reachable</summary>

- Domain: Comments
- Method: GET
- Effective route: `/v1/comments/:commentId/replies`
- Public URL: `https://api.modula.digital/v1/comments/:commentId/replies`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:131`
- Handler: inline
- Controller/service calls: `comments.listReplies`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: `{commentId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `blocks`, `greenfield_comments`, `mutes`, `profiles`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/features/social/data/useCommentsQuery.ts`
- Tests: `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/comments/:commentId/replies</code> — reachable</summary>

- Domain: Comments
- Method: POST
- Effective route: `/v1/comments/:commentId/replies`
- Public URL: `https://api.modula.digital/v1/comments/:commentId/replies`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:140`
- Handler: inline
- Controller/service calls: `comments.createReply`, `mentions.storeMentions`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{commentId: string}`
- Request query: none observed
- Request body: `any)?.text ?? '')`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `greenfield_comments`, `greenfield_handles`, `greenfield_mentions`, `posts`, `profiles`
- Database writes: `greenfield_comments`, `greenfield_mentions`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/features/social/data/useCommentsQuery.ts`
- Tests: `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/commerce/billing-adapters</code> — reachable</summary>

- Domain: Commerce
- Method: GET
- Effective route: `/v1/commerce/billing-adapters`
- Public URL: `https://api.modula.digital/v1/commerce/billing-adapters`
- API version: v1
- Source file: `services/greenfield-api/src/entitlements/routes.ts:32`
- Handler: inline
- Controller/service calls: `service.adapterStatus`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_billing_adapter_registrations`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/commerce/entitlements</code> — reachable</summary>

- Domain: Commerce
- Method: GET
- Effective route: `/v1/commerce/entitlements`
- Public URL: `https://api.modula.digital/v1/commerce/entitlements`
- API version: v1
- Source file: `services/greenfield-api/src/entitlements/routes.ts:30`
- Handler: inline
- Controller/service calls: `service.listAccount`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_entitlement_capabilities`, `greenfield_entitlements`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/commerce/entitlements/check</code> — reachable</summary>

- Domain: Commerce
- Method: POST
- Effective route: `/v1/commerce/entitlements/check`
- Public URL: `https://api.modula.digital/v1/commerce/entitlements/check`
- API version: v1
- Source file: `services/greenfield-api/src/entitlements/routes.ts:31`
- Handler: inline
- Controller/service calls: `service.check`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_entitlement_capabilities`, `greenfield_entitlements`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/commerce/invoices</code> — reachable</summary>

- Domain: Commerce
- Method: GET
- Effective route: `/v1/commerce/invoices`
- Public URL: `https://api.modula.digital/v1/commerce/invoices`
- API version: v1
- Source file: `services/greenfield-api/src/settings-v2/routes.ts:46`
- Handler: inline
- Controller/service calls: `service.invoices`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_commerce_invoices`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/settings-v2.integration.test.ts`
- Runtime registration: yes
- Live probe: PASS (401)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/connections</code> — reachable</summary>

- Domain: Connectors
- Method: GET
- Effective route: `/v1/connections`
- Public URL: `https://api.modula.digital/v1/connections`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1309`
- Handler: inline
- Controller/service calls: `connectorConnections.list`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `Connector/OAuth provider`
- Known clients: none observed
- Tests: `scripts/verify-phase7d-connection-lifecycle.mjs`, `scripts/verify-phase7d-connector-security.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/connections/:connectionId</code> — reachable</summary>

- Domain: Connectors
- Method: DELETE
- Effective route: `/v1/connections/:connectionId`
- Public URL: `https://api.modula.digital/v1/connections/:connectionId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1393`
- Handler: inline
- Controller/service calls: `connectorConnections.disconnect`, `policies.assertAllowed`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).connectionId,`, `any).connectionId, ownerAccountId: auth.accountId},`, `any).connectionId), request.id))`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `blocks`, `follows`, `greenfield_comments`, `greenfield_connections`, `greenfield_extension_capabilities`, `greenfield_extension_installations`, `greenfield_extension_versions`, `greenfield_extensions`, `greenfield_records`, `greenfield_repositories`, `posts`, `profiles`
- Database writes: `greenfield_policy_decision_audit`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `Connector/OAuth provider`
- Known clients: none observed
- Tests: `scripts/verify-phase7d-connection-lifecycle.mjs`, `scripts/verify-phase7d-connector-security.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/connections/:connectionId</code> — reachable</summary>

- Domain: Connectors
- Method: GET
- Effective route: `/v1/connections/:connectionId`
- Public URL: `https://api.modula.digital/v1/connections/:connectionId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1318`
- Handler: inline
- Controller/service calls: `connectorConnections.get`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `any).connectionId), request.id))`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `Connector/OAuth provider`
- Known clients: none observed
- Tests: `scripts/verify-phase7d-connection-lifecycle.mjs`, `scripts/verify-phase7d-connector-security.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/connections/:connectionId/disable</code> — reachable</summary>

- Domain: Connectors
- Method: POST
- Effective route: `/v1/connections/:connectionId/disable`
- Public URL: `https://api.modula.digital/v1/connections/:connectionId/disable`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1336`
- Handler: inline
- Controller/service calls: `connectorConnections.disable`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).connectionId), request.id))`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `Connector/OAuth provider`
- Known clients: none observed
- Tests: `scripts/verify-phase7d-connection-lifecycle.mjs`, `scripts/verify-phase7d-connector-security.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/connections/:connectionId/enable</code> — reachable</summary>

- Domain: Connectors
- Method: POST
- Effective route: `/v1/connections/:connectionId/enable`
- Public URL: `https://api.modula.digital/v1/connections/:connectionId/enable`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1327`
- Handler: inline
- Controller/service calls: `connectorConnections.enable`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).connectionId), request.id))`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `Connector/OAuth provider`
- Known clients: none observed
- Tests: `scripts/verify-phase7d-connection-lifecycle.mjs`, `scripts/verify-phase7d-connector-security.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/connections/:connectionId/refresh</code> — reachable</summary>

- Domain: Connectors
- Method: POST
- Effective route: `/v1/connections/:connectionId/refresh`
- Public URL: `https://api.modula.digital/v1/connections/:connectionId/refresh`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1345`
- Handler: inline
- Controller/service calls: `adapter.refreshCredentials`, `connectorAdapters.require`, `connectorConnections.beginRefresh`, `connectorConnections.completeRefresh`, `connectorConnections.fail`, `connectorConnections.get`, `connectorCredentials.decryptForTrustedBackend`, `connectorCredentials.storeEncrypted`, `policies.assertAllowed`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).connectionId)`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `blocks`, `follows`, `greenfield_comments`, `greenfield_connections`, `greenfield_extension_capabilities`, `greenfield_extension_installations`, `greenfield_extension_versions`, `greenfield_extensions`, `greenfield_records`, `greenfield_repositories`, `posts`, `profiles`
- Database writes: `greenfield_policy_decision_audit`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `Connector/OAuth provider`
- Known clients: none observed
- Tests: `scripts/verify-phase7d-connection-lifecycle.mjs`, `scripts/verify-phase7d-connector-security.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/connectors</code> — reachable</summary>

- Domain: Connectors
- Method: GET
- Effective route: `/v1/connectors`
- Public URL: `https://api.modula.digital/v1/connectors`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1262`
- Handler: inline
- Controller/service calls: `connectorProviders.list`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `Connector/OAuth provider`
- Known clients: `src/api/local/routes/authRoutes.ts`
- Tests: `packages/greenfield-connector-contracts/tests/connector-contracts.test.ts`, `scripts/verify-phase7d-connector-security.mjs`, `services/greenfield-api/tests/phase7d.connector-security.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/connectors/:providerId</code> — reachable</summary>

- Domain: Connectors
- Method: GET
- Effective route: `/v1/connectors/:providerId`
- Public URL: `https://api.modula.digital/v1/connectors/:providerId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1265`
- Handler: inline
- Controller/service calls: `connectorProviders.get`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `any).providerId)`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `Connector/OAuth provider`
- Known clients: `src/api/local/routes/authRoutes.ts`
- Tests: `packages/greenfield-connector-contracts/tests/connector-contracts.test.ts`, `scripts/verify-phase7d-connector-security.mjs`, `services/greenfield-api/tests/phase7d.connector-security.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/connectors/:providerId/authorise</code> — reachable</summary>

- Domain: Connectors
- Method: POST
- Effective route: `/v1/connectors/:providerId/authorise`
- Public URL: `https://api.modula.digital/v1/connectors/:providerId/authorise`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1270`
- Handler: inline
- Controller/service calls: `adapter.getAuthorisationUrl`, `connectorAdapters.require`, `connectorOAuthStates.initiate`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).providerId`
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `202`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_connector_oauth_states`
- Database writes: `greenfield_connector_oauth_states`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `Connector/OAuth provider`
- Known clients: `src/api/local/routes/authRoutes.ts`
- Tests: `packages/greenfield-connector-contracts/tests/connector-contracts.test.ts`, `scripts/verify-phase7d-connector-security.mjs`, `services/greenfield-api/tests/phase7d.connector-security.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/creator/insights</code> — reachable</summary>

- Domain: Platform
- Method: GET
- Effective route: `/v1/creator/insights`
- Public URL: `https://api.modula.digital/v1/creator/insights`
- API version: v1
- Source file: `services/greenfield-api/src/settings-v2/routes.ts:44`
- Handler: inline
- Controller/service calls: `service.insights`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `actors`, `follows`, `greenfield_comments`, `greenfield_post_shares`, `greenfield_reactions`, `greenfield_story_groups`, `greenfield_story_items`, `greenfield_story_views`, `post_likes`, `post_saves`, `posts`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/settings-v2.integration.test.ts`
- Runtime registration: yes
- Live probe: PASS (401)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/creator/payouts</code> — reachable</summary>

- Domain: Platform
- Method: GET
- Effective route: `/v1/creator/payouts`
- Public URL: `https://api.modula.digital/v1/creator/payouts`
- API version: v1
- Source file: `services/greenfield-api/src/settings-v2/routes.ts:45`
- Handler: inline
- Controller/service calls: `service.payouts`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_creator_ledger_entries`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/settings-v2.integration.test.ts`
- Runtime registration: yes
- Live probe: PASS (401)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/developer/agreements/:agreementId/:version/accept</code> — reachable</summary>

- Domain: Developer
- Method: POST
- Effective route: `/v1/developer/agreements/:agreementId/:version/accept`
- Public URL: `https://api.modula.digital/v1/developer/agreements/:agreementId/:version/accept`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:43`
- Handler: inline
- Controller/service calls: `developers.acceptAgreement`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_developer_agreement_acceptances`, `greenfield_developer_agreements`
- Database writes: `greenfield_developer_agreement_acceptances`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/developer/board</code> — reachable</summary>

- Domain: Developer
- Method: GET
- Effective route: `/v1/developer/board`
- Public URL: `https://api.modula.digital/v1/developer/board`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:36`
- Handler: inline
- Controller/service calls: `developers.board`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_developer_builds`, `greenfield_developer_organisation_memberships`, `greenfield_developer_organisations`, `greenfield_developer_products`, `greenfield_developer_profiles`, `greenfield_developer_programme_memberships`, `greenfield_developer_releases`, `greenfield_developer_review_submissions`, `greenfield_developer_test_group_members`, `greenfield_developer_test_groups`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-developer.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/developer/organisations</code> — reachable</summary>

- Domain: Developer
- Method: POST
- Effective route: `/v1/developer/organisations`
- Public URL: `https://api.modula.digital/v1/developer/organisations`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:38`
- Handler: inline
- Controller/service calls: `developers.createOrganisation`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `greenfield_developer_organisation_memberships`, `greenfield_developer_organisations`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/developer/organisations/:organisationId/invitations/accept</code> — reachable</summary>

- Domain: Developer
- Method: POST
- Effective route: `/v1/developer/organisations/:organisationId/invitations/accept`
- Public URL: `https://api.modula.digital/v1/developer/organisations/:organisationId/invitations/accept`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:40`
- Handler: inline
- Controller/service calls: `developers.acceptOrganisationInvitation`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `greenfield_developer_organisation_memberships`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/developer/organisations/:organisationId/members</code> — reachable</summary>

- Domain: Developer
- Method: POST
- Effective route: `/v1/developer/organisations/:organisationId/members`
- Public URL: `https://api.modula.digital/v1/developer/organisations/:organisationId/members`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:39`
- Handler: inline
- Controller/service calls: `developers.inviteOrganisationMember`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_developer_organisation_memberships`
- Database writes: `greenfield_developer_organisation_memberships`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/developer/products</code> — reachable</summary>

- Domain: Developer
- Method: GET
- Effective route: `/v1/developer/products`
- Public URL: `https://api.modula.digital/v1/developer/products`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:48`
- Handler: inline
- Controller/service calls: `developers.listProducts`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_developer_organisation_memberships`, `greenfield_developer_products`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-developer.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/developer/products</code> — reachable</summary>

- Domain: Developer
- Method: POST
- Effective route: `/v1/developer/products`
- Public URL: `https://api.modula.digital/v1/developer/products`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:49`
- Handler: inline
- Controller/service calls: `developers.createProduct`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_developer_organisation_memberships`, `greenfield_developer_programme_memberships`, `greenfield_publisher_namespaces`, `greenfield_publisher_owners`, `greenfield_publishers`
- Database writes: `greenfield_developer_products`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-developer.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/developer/products/:productId</code> — reachable</summary>

- Domain: Developer
- Method: GET
- Effective route: `/v1/developer/products/:productId`
- Public URL: `https://api.modula.digital/v1/developer/products/:productId`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:50`
- Handler: inline
- Controller/service calls: `developers.productDetail`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_developer_builds`, `greenfield_developer_organisation_memberships`, `greenfield_developer_products`, `greenfield_developer_releases`, `greenfield_developer_review_submissions`, `greenfield_developer_source_connections`, `greenfield_developer_test_groups`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-developer.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/developer/products/:productId/builds</code> — reachable</summary>

- Domain: Developer
- Method: POST
- Effective route: `/v1/developer/products/:productId/builds`
- Public URL: `https://api.modula.digital/v1/developer/products/:productId/builds`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:52`
- Handler: inline
- Controller/service calls: `developers.requestBuild`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_developer_builds`, `greenfield_developer_organisation_memberships`, `greenfield_developer_products`, `greenfield_developer_source_connections`
- Database writes: `greenfield_developer_builds`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-developer.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/developer/products/:productId/releases</code> — reachable</summary>

- Domain: Developer
- Method: POST
- Effective route: `/v1/developer/products/:productId/releases`
- Public URL: `https://api.modula.digital/v1/developer/products/:productId/releases`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:53`
- Handler: inline
- Controller/service calls: `developers.createRelease`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_build_provenance`, `greenfield_developer_builds`, `greenfield_developer_organisation_memberships`, `greenfield_developer_products`
- Database writes: `greenfield_developer_releases`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-developer.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PUT /v1/developer/products/:productId/releases/:releaseId/test-groups/:testGroupId</code> — reachable</summary>

- Domain: Developer
- Method: PUT
- Effective route: `/v1/developer/products/:productId/releases/:releaseId/test-groups/:testGroupId`
- Public URL: `https://api.modula.digital/v1/developer/products/:productId/releases/:releaseId/test-groups/:testGroupId`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:55`
- Handler: inline
- Controller/service calls: `developers.assignReleaseTestGroup`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_developer_organisation_memberships`, `greenfield_developer_products`, `greenfield_developer_releases`, `greenfield_developer_test_groups`
- Database writes: `greenfield_developer_release_test_groups`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-developer.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/developer/products/:productId/reviews</code> — reachable</summary>

- Domain: Developer
- Method: POST
- Effective route: `/v1/developer/products/:productId/reviews`
- Public URL: `https://api.modula.digital/v1/developer/products/:productId/reviews`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:56`
- Handler: inline
- Controller/service calls: `developers.submitReview`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_developer_organisation_memberships`, `greenfield_developer_products`, `greenfield_developer_programme_memberships`, `greenfield_developer_releases`, `greenfield_publishers`
- Database writes: `greenfield_developer_review_submissions`, `greenfield_release_review_checks`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-developer.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/developer/products/:productId/sources</code> — reachable</summary>

- Domain: Developer
- Method: POST
- Effective route: `/v1/developer/products/:productId/sources`
- Public URL: `https://api.modula.digital/v1/developer/products/:productId/sources`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:51`
- Handler: inline
- Controller/service calls: `developers.connectSource`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_developer_organisation_memberships`, `greenfield_developer_products`
- Database writes: `greenfield_developer_source_connections`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-developer.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/developer/products/:productId/test-groups</code> — reachable</summary>

- Domain: Developer
- Method: POST
- Effective route: `/v1/developer/products/:productId/test-groups`
- Public URL: `https://api.modula.digital/v1/developer/products/:productId/test-groups`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:54`
- Handler: inline
- Controller/service calls: `developers.createTestGroup`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_developer_organisation_memberships`, `greenfield_developer_products`
- Database writes: `greenfield_developer_test_groups`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-developer.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PUT /v1/developer/profile</code> — reachable</summary>

- Domain: Developer
- Method: PUT
- Effective route: `/v1/developer/profile`
- Public URL: `https://api.modula.digital/v1/developer/profile`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:37`
- Handler: inline
- Controller/service calls: `developers.upsertProfile`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `greenfield_developer_profiles`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/developer/programme/enrol</code> — reachable</summary>

- Domain: Developer
- Method: POST
- Effective route: `/v1/developer/programme/enrol`
- Public URL: `https://api.modula.digital/v1/developer/programme/enrol`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:44`
- Handler: inline
- Controller/service calls: `developers.enrol`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `greenfield_developer_programme_memberships`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-developer.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/developer/publishers</code> — reachable</summary>

- Domain: Developer
- Method: POST
- Effective route: `/v1/developer/publishers`
- Public URL: `https://api.modula.digital/v1/developer/publishers`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:41`
- Handler: inline
- Controller/service calls: `developers.createPublisher`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_developer_organisation_memberships`, `greenfield_publishers`
- Database writes: `greenfield_publisher_owners`, `greenfield_publishers`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/developer/publishers/:publisherId/namespaces</code> — reachable</summary>

- Domain: Developer
- Method: POST
- Effective route: `/v1/developer/publishers/:publisherId/namespaces`
- Public URL: `https://api.modula.digital/v1/developer/publishers/:publisherId/namespaces`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:42`
- Handler: inline
- Controller/service calls: `developers.claimNamespace`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_developer_organisation_memberships`, `greenfield_publisher_namespaces`, `greenfield_publisher_owners`
- Database writes: `greenfield_publisher_namespaces`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/discover</code> — reachable</summary>

- Domain: Discover
- Method: GET
- Effective route: `/v1/discover`
- Public URL: `https://api.modula.digital/v1/discover`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2096`
- Handler: inline
- Controller/service calls: `discovery.getDiscover`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `attachments`, `featured_modules`, `mutes`, `post_media`, `posts`, `trending_topics`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/discoverRoutes.ts`, `src/data/repositories/api/ApiDiscoverRepository.ts`
- Tests: `scripts/verify-phase5-backend.mjs`, `services/greenfield-api/tests/api.integration.test.ts`, `tests/phase7l-b-public-routes.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/extensions</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/extensions`
- Public URL: `https://api.modula.digital/v1/extensions`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1175`
- Handler: inline
- Controller/service calls: `extensions.listPublished`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_extension_versions`, `greenfield_extensions`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/extensions/:extensionId</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/extensions/:extensionId`
- Public URL: `https://api.modula.digital/v1/extensions/:extensionId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1183`
- Handler: inline
- Controller/service calls: `extensions.listPublished`, `items.find`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{extensionId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_extension_versions`, `greenfield_extensions`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/extensions/:extensionId/configuration</code> — reachable</summary>

- Domain: Modules
- Method: PATCH
- Effective route: `/v1/extensions/:extensionId/configuration`
- Public URL: `https://api.modula.digital/v1/extensions/:extensionId/configuration`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:294`
- Handler: inline
- Controller/service calls: `lifecycle.configure`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{extensionId: string}`
- Request query: none observed
- Request body: `any)?.configuration ?? {}),`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_catalogue`
- Database writes: `greenfield_extension_lifecycle_events`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/extensions/:extensionId/disable</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/extensions/:extensionId/disable`
- Public URL: `https://api.modula.digital/v1/extensions/:extensionId/disable`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:284`
- Handler: inline
- Controller/service calls: `lifecycle.disable`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{extensionId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_catalogue`, `greenfield_extension_installations`, `greenfield_extension_versions`, `greenfield_extensions`
- Database writes: `greenfield_extension_installations`, `greenfield_extension_lifecycle_events`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/extensions/:extensionId/enable</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/extensions/:extensionId/enable`
- Public URL: `https://api.modula.digital/v1/extensions/:extensionId/enable`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:274`
- Handler: inline
- Controller/service calls: `lifecycle.enable`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{extensionId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_catalogue`, `greenfield_extension_installations`, `greenfield_extension_versions`, `greenfield_extensions`
- Database writes: `greenfield_extension_installations`, `greenfield_extension_lifecycle_events`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/extensions/:extensionId/install</code> — reachable</summary>

- Domain: Modules
- Method: DELETE
- Effective route: `/v1/extensions/:extensionId/install`
- Public URL: `https://api.modula.digital/v1/extensions/:extensionId/install`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1207`
- Handler: inline
- Controller/service calls: `installations.uninstall`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{extensionId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_extension_versions`, `greenfield_extensions`
- Database writes: `greenfield_extension_installations`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/extensions/:extensionId/install</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/extensions/:extensionId/install`
- Public URL: `https://api.modula.digital/v1/extensions/:extensionId/install`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1195`
- Handler: inline
- Controller/service calls: `installations.install`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{extensionId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_versions`, `greenfield_extensions`
- Database writes: `greenfield_extension_capabilities`, `greenfield_extension_installations`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/extensions/:extensionId/preferences</code> — reachable</summary>

- Domain: Modules
- Method: PATCH
- Effective route: `/v1/extensions/:extensionId/preferences`
- Public URL: `https://api.modula.digital/v1/extensions/:extensionId/preferences`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1217`
- Handler: inline
- Controller/service calls: `installations.updatePreferences`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{extensionId: string}`
- Request query: none observed
- Request body: `any) ?? {}), request.id),`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_extension_versions`, `greenfield_extensions`
- Database writes: `failed`, `greenfield_extension_installations`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/extensions/:extensionProductId/capabilities</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/extensions/:extensionProductId/capabilities`
- Public URL: `https://api.modula.digital/v1/extensions/:extensionProductId/capabilities`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:318`
- Handler: inline
- Controller/service calls: `extensionFabric.declaredCapabilities`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `any).extensionProductId)), request.id))`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_extension_capability_grants`, `greenfield_extension_runtime_projection`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/extensions/:extensionProductId/capabilities/review</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/extensions/:extensionProductId/capabilities/review`
- Public URL: `https://api.modula.digital/v1/extensions/:extensionProductId/capabilities/review`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:328`
- Handler: inline
- Controller/service calls: `approvedCapabilities.filter`, `extensionFabric.reviewCapabilities`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).extensionProductId), approved), request.id))`
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_capability_grants`, `greenfield_extension_event_subscriptions`, `greenfield_extension_runtime_projection`
- Database writes: `greenfield_event_subscriptions`, `greenfield_extension_capability_grants`, `greenfield_extension_event_subscriptions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/extensions/:extensionProductId/contributions/:contributionId/fail</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/extensions/:extensionProductId/contributions/:contributionId/fail`
- Public URL: `https://api.modula.digital/v1/extensions/:extensionProductId/contributions/:contributionId/fail`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:394`
- Handler: inline
- Controller/service calls: `extensionFabric.failContribution`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).extensionProductId),`, `any).contributionId),`
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_contribution_registrations`
- Database writes: `greenfield_extension_contribution_registrations`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/extensions/:extensionProductId/contributions/:contributionId/invoke</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/extensions/:extensionProductId/contributions/:contributionId/invoke`
- Public URL: `https://api.modula.digital/v1/extensions/:extensionProductId/contributions/:contributionId/invoke`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:340`
- Handler: inline
- Controller/service calls: `backendGateway.canHandle`, `backendGateway.executeAction`, `extensionAi.canHandle`, `extensionAi.execute`, `extensionFabric.assertInvocation`, `requiredCapabilities.filter`, `runtimeAccess.resolve`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).extensionProductId),`, `any).contributionId),`, `any).extensionProductId)`
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_capability_grants`, `greenfield_extension_contribution_registrations`, `greenfield_extension_installations`, `greenfield_extension_runtime_projection`, `greenfield_module_permission_reviews`, `greenfield_module_records`, `greenfield_module_releases`, `greenfield_module_versions`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/extensions/:extensionProductId/inspector</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/extensions/:extensionProductId/inspector`
- Public URL: `https://api.modula.digital/v1/extensions/:extensionProductId/inspector`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:431`
- Handler: inline
- Controller/service calls: `extensionFabric.developerInspector`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `any).extensionProductId)), request.id))`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_extension_capability_grants`, `greenfield_extension_contribution_registrations`, `greenfield_extension_installation_edges`, `greenfield_extension_job_executions`, `greenfield_extension_runtime_projection`, `greenfield_module_service_registrations`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/extensions/:extensionProductId/jobs</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/extensions/:extensionProductId/jobs`
- Public URL: `https://api.modula.digital/v1/extensions/:extensionProductId/jobs`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:411`
- Handler: inline
- Controller/service calls: `extensionFabric.enqueueJob`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).extensionProductId),`
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `202`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_capability_grants`, `greenfield_extension_contribution_registrations`, `greenfield_extension_job_executions`, `greenfield_extension_runtime_projection`, `greenfield_module_records`
- Database writes: `greenfield_extension_job_executions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`, `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/extensions/catalogue</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/extensions/catalogue`
- Public URL: `https://api.modula.digital/v1/extensions/catalogue`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1178`
- Handler: inline
- Controller/service calls: `lifecycle.listCatalogue`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_extension_catalogue`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiExtensionRepository.ts`
- Tests: `scripts/verify-phase6s-social-frontend.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/extensions/installed</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/extensions/installed`
- Public URL: `https://api.modula.digital/v1/extensions/installed`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1190`
- Handler: inline
- Controller/service calls: `installations.listInstalled`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_extension_versions`, `greenfield_extensions`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiExtensionRepository.ts`
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/feed/home</code> — reachable</summary>

- Domain: Feed
- Method: GET
- Effective route: `/v1/feed/home`
- Public URL: `https://api.modula.digital/v1/feed/home`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1441`
- Handler: inline
- Controller/service calls: `moderation.blockedSet`, `moderation.mutedSet`, `posts.listHome`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: none observed
- Request query: `Record<string, unknown>`
- Request body: none observed
- Pagination: cursor; default 20, max 50, next cursor yes
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `attachments`, `blocks`, `follows`, `greenfield_quote_posts`, `greenfield_reactions`, `mutes`, `post_content`, `post_media`, `post_reposts`, `post_saves`, `posts`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/feedRoutes.ts`, `src/data/repositories/api/ApiFeedRepository.ts`
- Tests: `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `tests/phase7l-b-public-routes.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/feed/profile/:profileId</code> — reachable</summary>

- Domain: Feed
- Method: GET
- Effective route: `/v1/feed/profile/:profileId`
- Public URL: `https://api.modula.digital/v1/feed/profile/:profileId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1472`
- Handler: inline
- Controller/service calls: `posts.listForHandle`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: `{profileId: string}`
- Request query: `Record<string, unknown>`
- Request body: none observed
- Pagination: cursor; default 20, max 50, next cursor yes
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `attachments`, `greenfield_quote_posts`, `greenfield_reactions`, `post_content`, `post_media`, `post_reposts`, `post_saves`, `posts`, `profiles`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/feedRoutes.ts`, `src/data/repositories/api/ApiFeedRepository.ts`
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/function-jobs/:jobId</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/function-jobs/:jobId`
- Public URL: `https://api.modula.digital/v1/function-jobs/:jobId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:311`
- Handler: inline
- Controller/service calls: `functionJobs.getJob`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{jobId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_function_jobs`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/function-jobs/:jobId/cancel</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/function-jobs/:jobId/cancel`
- Public URL: `https://api.modula.digital/v1/function-jobs/:jobId/cancel`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:321`
- Handler: inline
- Controller/service calls: `functionJobs.cancel`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{jobId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_function_jobs`
- Database writes: `greenfield_function_jobs`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/functions</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/functions`
- Public URL: `https://api.modula.digital/v1/functions`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1243`
- Handler: inline
- Controller/service calls: `db.selectFrom`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_functions`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/functions/:functionId/invoke</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/functions/:functionId/invoke`
- Public URL: `https://api.modula.digital/v1/functions/:functionId/invoke`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1247`
- Handler: inline
- Controller/service calls: `functions.invoke`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: MISSING: client-supplied installationId is capability-checked without authenticated account ownership
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{functionId: string}`
- Request query: none observed
- Request body: `any`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_functions`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/functions/:functionId/jobs</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/functions/:functionId/jobs`
- Public URL: `https://api.modula.digital/v1/functions/:functionId/jobs`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:333`
- Handler: inline
- Controller/service calls: `functionJobs.invoke`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{functionId: string}`
- Request query: none observed
- Request body: `any)?.input ?? {}) as Record<string, unknown>`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `202`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_functions`
- Database writes: `greenfield_function_jobs`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/health/live</code> — reachable</summary>

- Domain: Operations
- Method: GET
- Effective route: `/v1/health/live`
- Public URL: `https://api.modula.digital/v1/health/live`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:236`
- Handler: inline
- Controller/service calls: none observed
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7h-live-contracts.mjs`, `scripts/verify-phase7i-mail-production.mjs`, `scripts/verify-phase7j-b.mjs`, `scripts/verify-phase7j-mac.mjs`, `services/greenfield-api/tests/api.integration.test.ts`
- Runtime registration: yes
- Live probe: PASS (200)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/health/ready</code> — reachable</summary>

- Domain: Operations
- Method: GET
- Effective route: `/v1/health/ready`
- Public URL: `https://api.modula.digital/v1/health/ready`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:240`
- Handler: inline
- Controller/service calls: none observed
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1.mjs`, `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7h-live-contracts.mjs`, `scripts/verify-phase7i-mail-production.mjs`, `scripts/verify-phase7j-b.mjs`, `scripts/verify-phase7j-mac.mjs`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/greenfield-backend-v1.engine-fabric.test.ts`
- Runtime registration: yes
- Live probe: PASS (200)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/intelligence/missions</code> — reachable</summary>

- Domain: Intelligence
- Method: GET
- Effective route: `/v1/intelligence/missions`
- Public URL: `https://api.modula.digital/v1/intelligence/missions`
- API version: v1
- Source file: `services/greenfield-api/src/intelligence/routes.ts:22`
- Handler: inline
- Controller/service calls: `intelligence.listMissions`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/gai01.contract.test.ts`, `services/greenfield-api/tests/gai01.integration.test.ts`
- Runtime registration: yes
- Live probe: PASS (401)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/intelligence/missions</code> — reachable</summary>

- Domain: Intelligence
- Method: POST
- Effective route: `/v1/intelligence/missions`
- Public URL: `https://api.modula.digital/v1/intelligence/missions`
- API version: v1
- Source file: `services/greenfield-api/src/intelligence/routes.ts:13`
- Handler: inline
- Controller/service calls: `intelligence.createMission`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: workspace identifier observed; downstream enforcement requires service evidence
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_developer_organisation_memberships`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/gai01.contract.test.ts`, `services/greenfield-api/tests/gai01.integration.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/intelligence/missions/:missionId</code> — reachable</summary>

- Domain: Intelligence
- Method: GET
- Effective route: `/v1/intelligence/missions/:missionId`
- Public URL: `https://api.modula.digital/v1/intelligence/missions/:missionId`
- API version: v1
- Source file: `services/greenfield-api/src/intelligence/routes.ts:28`
- Handler: inline
- Controller/service calls: `intelligence.detail`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/gai01.contract.test.ts`, `services/greenfield-api/tests/gai01.integration.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/intelligence/missions/:missionId/approvals</code> — reachable</summary>

- Domain: Intelligence
- Method: GET
- Effective route: `/v1/intelligence/missions/:missionId/approvals`
- Public URL: `https://api.modula.digital/v1/intelligence/missions/:missionId/approvals`
- API version: v1
- Source file: `services/greenfield-api/src/intelligence/routes.ts:56`
- Handler: inline
- Controller/service calls: `intelligence.approvals`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/gai01.contract.test.ts`, `services/greenfield-api/tests/gai01.integration.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/intelligence/missions/:missionId/approvals/:approvalId/approve</code> — reachable</summary>

- Domain: Intelligence
- Method: POST
- Effective route: `/v1/intelligence/missions/:missionId/approvals/:approvalId/approve`
- Public URL: `https://api.modula.digital/v1/intelligence/missions/:missionId/approvals/:approvalId/approve`
- API version: v1
- Source file: `services/greenfield-api/src/intelligence/routes.ts:70`
- Handler: inline
- Controller/service calls: `intelligence.approve`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/gai01.contract.test.ts`, `services/greenfield-api/tests/gai01.integration.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/intelligence/missions/:missionId/approvals/:approvalId/reject</code> — reachable</summary>

- Domain: Intelligence
- Method: POST
- Effective route: `/v1/intelligence/missions/:missionId/approvals/:approvalId/reject`
- Public URL: `https://api.modula.digital/v1/intelligence/missions/:missionId/approvals/:approvalId/reject`
- API version: v1
- Source file: `services/greenfield-api/src/intelligence/routes.ts:77`
- Handler: inline
- Controller/service calls: `intelligence.reject`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/gai01.contract.test.ts`, `services/greenfield-api/tests/gai01.integration.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/intelligence/missions/:missionId/decisions</code> — reachable</summary>

- Domain: Intelligence
- Method: GET
- Effective route: `/v1/intelligence/missions/:missionId/decisions`
- Public URL: `https://api.modula.digital/v1/intelligence/missions/:missionId/decisions`
- API version: v1
- Source file: `services/greenfield-api/src/intelligence/routes.ts:49`
- Handler: inline
- Controller/service calls: `intelligence.decisions`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/gai01.contract.test.ts`, `services/greenfield-api/tests/gai01.integration.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/intelligence/missions/:missionId/evidence</code> — reachable</summary>

- Domain: Intelligence
- Method: GET
- Effective route: `/v1/intelligence/missions/:missionId/evidence`
- Public URL: `https://api.modula.digital/v1/intelligence/missions/:missionId/evidence`
- API version: v1
- Source file: `services/greenfield-api/src/intelligence/routes.ts:63`
- Handler: inline
- Controller/service calls: `intelligence.evidence`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/gai01.contract.test.ts`, `services/greenfield-api/tests/gai01.integration.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/intelligence/missions/:missionId/ledger</code> — reachable</summary>

- Domain: Intelligence
- Method: GET
- Effective route: `/v1/intelligence/missions/:missionId/ledger`
- Public URL: `https://api.modula.digital/v1/intelligence/missions/:missionId/ledger`
- API version: v1
- Source file: `services/greenfield-api/src/intelligence/routes.ts:42`
- Handler: inline
- Controller/service calls: `intelligence.ledger`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/gai01.contract.test.ts`, `services/greenfield-api/tests/gai01.integration.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/intelligence/missions/:missionId/proposals/:proposalId/execute</code> — reachable</summary>

- Domain: Intelligence
- Method: POST
- Effective route: `/v1/intelligence/missions/:missionId/proposals/:proposalId/execute`
- Public URL: `https://api.modula.digital/v1/intelligence/missions/:missionId/proposals/:proposalId/execute`
- API version: v1
- Source file: `services/greenfield-api/src/intelligence/routes.ts:84`
- Handler: inline
- Controller/service calls: `intelligence.execute`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/gai01.contract.test.ts`, `services/greenfield-api/tests/gai01.integration.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/intelligence/missions/:missionId/start</code> — reachable</summary>

- Domain: Intelligence
- Method: POST
- Effective route: `/v1/intelligence/missions/:missionId/start`
- Public URL: `https://api.modula.digital/v1/intelligence/missions/:missionId/start`
- API version: v1
- Source file: `services/greenfield-api/src/intelligence/routes.ts:35`
- Handler: inline
- Controller/service calls: `intelligence.start`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/gai01.contract.test.ts`, `services/greenfield-api/tests/gai01.integration.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/internal/build-service/builds/:buildId/result</code> — reachable</summary>

- Domain: Internal
- Method: POST
- Effective route: `/v1/internal/build-service/builds/:buildId/result`
- Public URL: `https://api.modula.digital/v1/internal/build-service/builds/:buildId/result`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:72`
- Handler: inline
- Controller/service calls: `builds.recordResult`
- Authentication: build-service id plus request signature
- Authorization: INTERNAL (nginx-reachable; handler/service guard applies)
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_build_service_registrations`, `greenfield_developer_builds`, `greenfield_developer_source_connections`
- Database writes: `greenfield_build_provenance`, `greenfield_build_result_receipts`, `greenfield_developer_builds`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/internal/build-service/claims</code> — reachable</summary>

- Domain: Internal
- Method: POST
- Effective route: `/v1/internal/build-service/claims`
- Public URL: `https://api.modula.digital/v1/internal/build-service/claims`
- API version: v1
- Source file: `services/greenfield-api/src/developers/routes.ts:71`
- Handler: inline
- Controller/service calls: `builds.claim`
- Authentication: build-service id plus request signature
- Authorization: INTERNAL (nginx-reachable; handler/service guard applies)
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_build_claim_requests`, `greenfield_developer_builds`, `greenfield_developer_source_connections`
- Database writes: `greenfield_build_claim_requests`, `greenfield_developer_builds`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/internal/ssrf-check</code> — registered-but-production-hidden</summary>

- Domain: Internal
- Method: GET
- Effective route: `/v1/internal/ssrf-check`
- Public URL: `https://api.modula.digital/v1/internal/ssrf-check`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2577`
- Handler: inline
- Controller/service calls: none observed
- Authentication: none
- Authorization: INTERNAL (nginx-reachable; handler/service guard applies)
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: none registered
- Request params: none observed
- Request query: `{url?: string`
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: registered-but-production-hidden
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/media/:mediaFile</code> — reachable</summary>

- Domain: Media
- Method: GET
- Effective route: `/v1/media/:mediaFile`
- Public URL: `https://api.modula.digital/v1/media/:mediaFile`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2069`
- Handler: inline
- Controller/service calls: `i.exec`, `postMediaStorage.readPostMedia`, `posts.getById`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: `{mediaFile?: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `attachments`, `greenfield_quote_posts`, `greenfield_reactions`, `post_content`, `post_media`, `post_reposts`, `post_saves`, `posts`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7c-release-candidate.mjs`, `services/greenfield-api/tests/phase7l.media-headers.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/media/stories/:mediaFile</code> — reachable</summary>

- Domain: Media
- Method: GET
- Effective route: `/v1/media/stories/:mediaFile`
- Public URL: `https://api.modula.digital/v1/media/stories/:mediaFile`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase7f-stories-routes.ts:133`
- Handler: inline
- Controller/service calls: `i.exec`, `mediaFile.split`, `stories.canViewGroup`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: `{mediaFile?: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `blocks`, `follows`, `greenfield_story_groups`, `greenfield_story_items`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/meta</code> — reachable</summary>

- Domain: Operations
- Method: GET
- Effective route: `/v1/meta`
- Public URL: `https://api.modula.digital/v1/meta`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:252`
- Handler: inline
- Controller/service calls: `appleAuthentication.status`, `engines.publicTopology`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_engine_capability_registrations`, `greenfield_engine_event_consumer_registrations`, `greenfield_engine_job_registrations`, `greenfield_engine_registrations`, `greenfield_engine_service_registrations`, `greenfield_engine_usage_metric_registrations`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AT Protocol/PDS (feature disabled in production)`, `SMTP/Modula Mail`, `GitHub release source (automation disabled in production)`, `Connector/OAuth provider`
- Known clients: `src/api/local/routes/atprotoRoutes.ts`, `src/api/local/routes/metaRoutes.ts`, `src/data/repositories/api/ApiMetadataRepository.ts`
- Tests: `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7e-web-production-cutover.mjs`, `scripts/verify-phase7h-live-contracts.mjs`, `scripts/verify-phase7h-registration.mjs`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/greenfield-backend-v1.apple-auth.test.ts`, `services/greenfield-api/tests/greenfield-backend-v1.engine-fabric.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `tests/phase7l-b-public-routes.test.ts`
- Runtime registration: yes
- Live probe: PASS (200)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/module-host/:targetProductId/composition</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/module-host/:targetProductId/composition`
- Public URL: `https://api.modula.digital/v1/module-host/:targetProductId/composition`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:303`
- Handler: inline
- Controller/service calls: `extensionFabric.composeHost`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `any).targetProductId), {`
- Request query: `any) ?? {}`
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_extension_contribution_registrations`, `greenfield_extension_installations`, `greenfield_extension_points`, `greenfield_extension_runtime_projection`, `greenfield_module_releases`, `greenfield_module_versions`, `greenfield_release_frontends`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules`
- Public URL: `https://api.modula.digital/v1/modules`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1412`
- Handler: inline
- Controller/service calls: `modules.filter`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_extension_versions`, `greenfield_extensions`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/actions/:actionId</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/actions/:actionId`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/actions/:actionId`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:854`
- Handler: inline
- Controller/service calls: `actions.execute`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any`
- Request query: none observed
- Request body: `any)?.input ?? request.body ?? {},`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_action_events`, `greenfield_module_actions`
- Database writes: `greenfield_module_action_events`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/ai/actions/:actionId/executions</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/ai/actions/:actionId/executions`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/ai/actions/:actionId/executions`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:62`
- Handler: inline
- Controller/service calls: `productActions.execute`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{moduleId: string`
- Request query: none observed
- Request body: `any) ?? {}) as Record<string, unknown>`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `ai_product_action_executions`, `ai_product_action_results`
- Database writes: `ai_product_action_executions`, `ai_product_action_results`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/ai/executions/:executionId/apply</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/ai/executions/:executionId/apply`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/ai/executions/:executionId/apply`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:78`
- Handler: inline
- Controller/service calls: `productActions.apply`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{moduleId: string`
- Request query: none observed
- Request body: `any) ?? {}) as Record<string, unknown>`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `ai_product_action_applications`, `ai_product_action_executions`, `ai_product_action_results`
- Database writes: `ai_product_action_applications`, `ai_product_action_executions`, `ai_product_action_results`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/ai/requests</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/ai/requests`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/ai/requests`
- API version: v1
- Source file: `services/greenfield-api/src/ai/routes.ts:94`
- Handler: inline
- Controller/service calls: `providerRuntime.executeModuleRequest`, `runtimeAccess.resolve`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{moduleId: string}).moduleId`
- Request query: none observed
- Request body: `any) ?? {}) as Partial<GreenfieldAIRequestContract>`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `greenfield_extension_installations`, `greenfield_module_permission_reviews`, `greenfield_module_releases`, `greenfield_module_versions`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `AI provider fabric`
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/backend</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/backend`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/backend`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:896`
- Handler: inline
- Controller/service calls: `backendHealth.diagnostics`, `runtimeAccess.resolve`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_module_permission_reviews`, `greenfield_module_releases`, `greenfield_module_versions`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/backend/disable</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/backend/disable`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/backend/disable`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:929`
- Handler: inline
- Controller/service calls: `backendLifecycle.disable`, `runtimeAccess.resolve`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_module_permission_reviews`, `greenfield_module_releases`, `greenfield_module_versions`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/backend/discover</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/backend/discover`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/backend/discover`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:907`
- Handler: inline
- Controller/service calls: `backendDiscovery.discover`, `runtimeAccess.resolve`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any)?.origin)}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_module_permission_reviews`, `greenfield_module_releases`, `greenfield_module_versions`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`, `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/backend/events</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/backend/events`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/backend/events`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:940`
- Handler: inline
- Controller/service calls: `backendEvents.ingest`
- Authentication: module backend bearer token plus HMAC signature
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/backend/health</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/backend/health`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/backend/health`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:918`
- Handler: inline
- Controller/service calls: `backendHealth.check`, `runtimeAccess.resolve`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_module_permission_reviews`, `greenfield_module_releases`, `greenfield_module_versions`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/backend/webhooks/modula</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/backend/webhooks/modula`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/backend/webhooks/modula`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:949`
- Handler: inline
- Controller/service calls: `backendWebhooks.receive`
- Authentication: module backend bearer token plus HMAC signature
- Authorization: SERVICE/WORKER
- Ownership rule: service identity, product/release assertion, and declared operation are resolved server-side
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/data-resources</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/data-resources`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/data-resources`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:452`
- Handler: inline
- Controller/service calls: `dataLedger.list`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: `{installationId?: string`
- Request body: none observed
- Pagination: cursor
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_data_backup_policies`, `greenfield_data_resource_owners`, `greenfield_data_resources`, `greenfield_data_retention_policies`, `greenfield_data_schema_versions`, `greenfield_data_storage_bindings`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/data-resources</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/data-resources`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/data-resources`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:467`
- Handler: inline
- Controller/service calls: `dataLedger.register`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `Record<string, unknown>) ?? {}) as any`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_data_backup_policies`, `greenfield_data_resource_owners`, `greenfield_data_resources`, `greenfield_data_retention_policies`, `greenfield_data_schema_versions`, `greenfield_data_storage_bindings`
- Database writes: `greenfield_data_resources`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/data-resources/:resourceId</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/data-resources/:resourceId`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/data-resources/:resourceId`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:482`
- Handler: inline
- Controller/service calls: `dataLedger.get`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{resourceId?: string}).resourceId ?? ''),`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_data_backup_policies`, `greenfield_data_resource_owners`, `greenfield_data_resources`, `greenfield_data_retention_policies`, `greenfield_data_schema_versions`, `greenfield_data_storage_bindings`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/data-resources/:resourceId/migrations</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/data-resources/:resourceId/migrations`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/data-resources/:resourceId/migrations`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:496`
- Handler: inline
- Controller/service calls: `dataLedger.recordMigration`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{resourceId?: string}).resourceId ?? ''),`
- Request query: none observed
- Request body: `Record<string, unknown>) ?? {}) as any`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_data_backup_policies`, `greenfield_data_migration_history`, `greenfield_data_resource_owners`, `greenfield_data_resources`, `greenfield_data_retention_policies`, `greenfield_data_schema_versions`, `greenfield_data_storage_bindings`
- Database writes: `greenfield_data_migration_history`, `greenfield_data_resources`, `greenfield_data_schema_versions`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/data-resources/:resourceId/schemas</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/data-resources/:resourceId/schemas`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/data-resources/:resourceId/schemas`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:512`
- Handler: inline
- Controller/service calls: `dataLedger.declareSchemaVersion`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{resourceId?: string}).resourceId ?? ''),`
- Request query: none observed
- Request body: `Record<string, unknown>) ?? {}) as any`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_data_backup_policies`, `greenfield_data_resource_owners`, `greenfield_data_resources`, `greenfield_data_retention_policies`, `greenfield_data_schema_versions`, `greenfield_data_storage_bindings`
- Database writes: `greenfield_data_schema_versions`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/disable</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/disable`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/disable`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:603`
- Handler: inline
- Controller/service calls: `installations.disable`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `202`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_extension_runtime_projection`, `greenfield_module_permission_reviews`, `greenfield_module_releases`
- Database writes: `greenfield_extension_installations`, `greenfield_extension_lifecycle_events`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/enable</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/enable`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/enable`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:593`
- Handler: inline
- Controller/service calls: `installations.enable`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `202`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_extension_runtime_projection`, `greenfield_module_permission_reviews`, `greenfield_module_releases`
- Database writes: `greenfield_extension_installations`, `greenfield_extension_lifecycle_events`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/export</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/export`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/export`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:875`
- Handler: inline
- Controller/service calls: `exports.create`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any`
- Request query: none observed
- Request body: `any) ?? {}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_records`
- Database writes: `greenfield_module_export_jobs`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/frontend</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/frontend`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/frontend`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:756`
- Handler: inline
- Controller/service calls: `productFrontends.resolve`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_mps_ingestions`, `greenfield_release_frontends`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/health</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/health`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/health`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:886`
- Handler: inline
- Controller/service calls: `health.get`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_module_action_events`, `greenfield_module_export_jobs`, `greenfield_module_record_versions`, `greenfield_module_records`, `search_documents`, `search_projection_state`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/modules/:moduleId/install</code> — reachable</summary>

- Domain: Modules
- Method: DELETE
- Effective route: `/v1/modules/:moduleId/install`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/install`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:688`
- Handler: inline
- Controller/service calls: `uninstall.uninstall`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `202`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_contributions`, `greenfield_module_installation_settings`, `greenfield_module_records`, `greenfield_module_releases`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/install</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/install`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/install`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:560`
- Handler: inline
- Controller/service calls: `installations.install`, `version.trim`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `202`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_extension_runtime_projection`, `greenfield_module_install_plans`, `greenfield_module_permission_reviews`, `greenfield_module_releases`, `greenfield_publishers`
- Database writes: `greenfield_extension_installations`, `greenfield_extension_lifecycle_events`, `greenfield_module_install_plans`, `greenfield_module_permission_reviews`, `to`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/install-descriptor</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/install-descriptor`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/install-descriptor`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:582`
- Handler: inline
- Controller/service calls: `installations.getInstallDescriptor`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_extension_runtime_projection`, `greenfield_module_install_plans`, `greenfield_module_permission_reviews`, `greenfield_module_releases`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/install-preview</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/install-preview`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/install-preview`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:549`
- Handler: inline
- Controller/service calls: `installations.installPreview`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_publishers`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/permissions/review</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/permissions/review`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/permissions/review`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:664`
- Handler: inline
- Controller/service calls: `approvedPermissions.filter`, `installations.reviewPermissions`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_extension_runtime_projection`, `greenfield_module_permission_reviews`, `greenfield_module_releases`
- Database writes: `greenfield_extension_lifecycle_events`, `greenfield_module_permission_reviews`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/records/:collection</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/records/:collection`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/records/:collection`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:777`
- Handler: inline
- Controller/service calls: `records.list`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `any`
- Request query: `Record<string, unknown>)), request.id))`
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_module_records`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/records/:collection</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/records/:collection`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/records/:collection`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:788`
- Handler: inline
- Controller/service calls: `records.create`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any`
- Request query: none observed
- Request body: `any) ?? {}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_records`
- Database writes: `greenfield_module_record_events`, `greenfield_module_records`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/modules/:moduleId/records/:collection/:recordId</code> — reachable</summary>

- Domain: Modules
- Method: DELETE
- Effective route: `/v1/modules/:moduleId/records/:collection/:recordId`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/records/:collection/:recordId`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:821`
- Handler: inline
- Controller/service calls: `records.delete`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any`
- Request query: none observed
- Request body: `any) ?? {}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_record_events`, `greenfield_module_record_versions`, `greenfield_module_records`
- Database writes: `greenfield_module_record_events`, `greenfield_module_record_versions`, `greenfield_module_records`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/records/:collection/:recordId</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/records/:collection/:recordId`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/records/:collection/:recordId`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:799`
- Handler: inline
- Controller/service calls: `records.get`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `any`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_module_records`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/modules/:moduleId/records/:collection/:recordId</code> — reachable</summary>

- Domain: Modules
- Method: PATCH
- Effective route: `/v1/modules/:moduleId/records/:collection/:recordId`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/records/:collection/:recordId`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:810`
- Handler: inline
- Controller/service calls: `records.patch`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any`
- Request query: none observed
- Request body: `any) ?? {}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_record_events`, `greenfield_module_record_versions`, `greenfield_module_records`
- Database writes: `failed`, `greenfield_module_record_events`, `greenfield_module_record_versions`, `greenfield_module_records`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/modules/:moduleId/records/:collection/:recordId/permanent</code> — reachable</summary>

- Domain: Modules
- Method: DELETE
- Effective route: `/v1/modules/:moduleId/records/:collection/:recordId/permanent`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/records/:collection/:recordId/permanent`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:843`
- Handler: inline
- Controller/service calls: `records.purge`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any`
- Request query: none observed
- Request body: `any) ?? {}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_record_events`, `greenfield_module_record_versions`, `greenfield_module_records`
- Database writes: `greenfield_module_record_events`, `greenfield_module_record_versions`, `greenfield_module_records`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/records/:collection/:recordId/restore</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/records/:collection/:recordId/restore`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/records/:collection/:recordId/restore`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:832`
- Handler: inline
- Controller/service calls: `records.restore`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any`
- Request query: none observed
- Request body: `any) ?? {}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_record_events`, `greenfield_module_record_versions`, `greenfield_module_records`
- Database writes: `greenfield_module_record_events`, `greenfield_module_record_versions`, `greenfield_module_records`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/runtime</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/runtime`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/runtime`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:442`
- Handler: inline
- Controller/service calls: `runtime2.runtimeSummary`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_module_api_registrations`, `greenfield_module_capability_registry`, `greenfield_module_hook_registrations`, `greenfield_module_job_registrations`, `greenfield_module_permission_states`, `greenfield_module_releases`, `greenfield_module_resolved_dependencies`, `greenfield_module_service_registrations`, `greenfield_module_storage_allocations`, `greenfield_module_ui_contribution_registrations`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/services/:serviceId/invoke</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/services/:serviceId/invoke`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/services/:serviceId/invoke`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:528`
- Handler: inline
- Controller/service calls: `runtime2.invokeService`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `any).serviceId,`
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_module_permission_states`, `greenfield_module_records`, `greenfield_module_releases`, `greenfield_module_service_invocations`, `greenfield_module_service_registrations`, `greenfield_module_storage_allocations`
- Database writes: `greenfield_module_service_invocations`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/settings</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/settings`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/settings`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:720`
- Handler: inline
- Controller/service calls: `settings.get`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_module_installation_settings`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/modules/:moduleId/settings</code> — reachable</summary>

- Domain: Modules
- Method: PATCH
- Effective route: `/v1/modules/:moduleId/settings`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/settings`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:730`
- Handler: inline
- Controller/service calls: `settings.patch`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any)?.values ?? request.body ?? {}) as any), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_installation_settings`
- Database writes: `failed`, `greenfield_module_installation_settings`, `greenfield_module_settings_versions`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/settings-schema</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/settings-schema`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/settings-schema`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:710`
- Handler: inline
- Controller/service calls: `settings.schema`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/uninstall-preview</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/uninstall-preview`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/uninstall-preview`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:678`
- Handler: inline
- Controller/service calls: `uninstall.preview`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_contributions`, `greenfield_module_installation_settings`, `greenfield_module_records`, `greenfield_module_releases`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/update</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/update`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/update`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:641`
- Handler: inline
- Controller/service calls: `approvedPermissions.filter`, `updates.update`, `version.trim`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `202`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_install_plans`
- Database writes: `failed`, `greenfield_module_install_plans`, `greenfield_module_permission_reviews`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/modules/:moduleId/version-preview</code> — reachable</summary>

- Domain: Modules
- Method: POST
- Effective route: `/v1/modules/:moduleId/version-preview`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/version-preview`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:627`
- Handler: inline
- Controller/service calls: `updates.preview`, `version.trim`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/versions</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/versions`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/versions`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:615`
- Handler: inline
- Controller/service calls: `updates.versions`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/views</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/views`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/views`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:746`
- Handler: inline
- Controller/service calls: `views.listViews`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_module_actions`, `greenfield_module_views`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/:moduleId/views/:viewId</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/:moduleId/views/:viewId`
- Public URL: `https://api.modula.digital/v1/modules/:moduleId/views/:viewId`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:766`
- Handler: inline
- Controller/service calls: `views.getView`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `any`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_module_actions`, `greenfield_module_views`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-data-ledger.mjs`, `scripts/verify-greenfield-mps-v1.mjs`, `scripts/verify-phase7b-module-runtime.mjs`, `scripts/verify-phase7e-ai-product-actions.mjs`, `scripts/verify-phase7e-ai-provider-runtime.mjs`, `scripts/verify-phase7e-ai-security.mjs`, `scripts/verify-phase7e-module-backend-auth.mjs`, `scripts/verify-phase7e-module-backend-discovery.mjs`, `scripts/verify-phase7e-module-backend-health.mjs`, `scripts/verify-phase7e-vault-notes-ai-integration.mjs`, `scripts/verify-phase7e-vault-notes-host.mjs`, `scripts/verify-phase7e-vault-notes-lifecycle.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/module-version-switch.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.install-descriptor.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/contributions</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/contributions`
- Public URL: `https://api.modula.digital/v1/modules/contributions`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:740`
- Handler: inline
- Controller/service calls: `contributions.list`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: `any), request.id))`
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_module_contributions`, `greenfield_module_releases`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/installed</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/installed`
- Public URL: `https://api.modula.digital/v1/modules/installed`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:289`
- Handler: inline
- Controller/service calls: `installations.listInstalled`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_extension_runtime_projection`, `greenfield_module_permission_reviews`, `greenfield_module_releases`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: PASS (401)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/modules/installed/:moduleId</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/modules/installed/:moduleId`
- Public URL: `https://api.modula.digital/v1/modules/installed/:moduleId`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:295`
- Handler: inline
- Controller/service calls: `installations.getInstalled`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_extension_installations`, `greenfield_extension_runtime_projection`, `greenfield_module_permission_reviews`, `greenfield_module_releases`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/registry-trust.installed-state.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/notifications</code> — reachable</summary>

- Domain: Activity
- Method: GET
- Effective route: `/v1/notifications`
- Public URL: `https://api.modula.digital/v1/notifications`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1922`
- Handler: inline
- Controller/service calls: `notifications.listForActor`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `social:read`
- Rate limit: 60 per 1 minute
- Request params: none observed
- Request query: `Record<string, unknown>`
- Request body: none observed
- Pagination: cursor; default 20, max 50, next cursor yes
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `blocks`, `mutes`, `notifications`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiActivityRepository.ts`
- Tests: `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/notifications/:notificationId/read</code> — reachable</summary>

- Domain: Activity
- Method: POST
- Effective route: `/v1/notifications/:notificationId/read`
- Public URL: `https://api.modula.digital/v1/notifications/:notificationId/read`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1937`
- Handler: inline
- Controller/service calls: `notifications.markRead`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `social:read`
- Rate limit: 30 per 1 minute
- Request params: `{notificationId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `notifications`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiActivityRepository.ts`
- Tests: `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/notifications/read-all</code> — reachable</summary>

- Domain: Activity
- Method: POST
- Effective route: `/v1/notifications/read-all`
- Public URL: `https://api.modula.digital/v1/notifications/read-all`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1946`
- Handler: inline
- Controller/service calls: `notifications.markAllRead`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `social:read`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `notifications`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiActivityRepository.ts`
- Tests: `scripts/verify-phase7c-api-parity.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/plugins</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/plugins`
- Public URL: `https://api.modula.digital/v1/plugins`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1259`
- Handler: inline
- Controller/service calls: `db.selectFrom`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_plugins`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/posts</code> — reachable</summary>

- Domain: Posts
- Method: POST
- Effective route: `/v1/posts`
- Public URL: `https://api.modula.digital/v1/posts`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1501`
- Handler: inline
- Controller/service calls: `postWrites.create`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:create`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `CreatePostInput`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `attachments`, `posts`
- Database writes: `attachments`, `post_content`, `post_media`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/posts/:postId</code> — reachable</summary>

- Domain: Posts
- Method: DELETE
- Effective route: `/v1/posts/:postId`
- Public URL: `https://api.modula.digital/v1/posts/:postId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1537`
- Handler: inline
- Controller/service calls: `postWrites.delete`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:delete`
- Rate limit: 30 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `posts`
- Database writes: `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/posts/:postId</code> — reachable</summary>

- Domain: Posts
- Method: GET
- Effective route: `/v1/posts/:postId`
- Public URL: `https://api.modula.digital/v1/posts/:postId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1494`
- Handler: inline
- Controller/service calls: `posts.getById`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `attachments`, `greenfield_quote_posts`, `greenfield_reactions`, `post_content`, `post_media`, `post_reposts`, `post_saves`, `posts`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/posts/:postId</code> — reachable</summary>

- Domain: Posts
- Method: PATCH
- Effective route: `/v1/posts/:postId`
- Public URL: `https://api.modula.digital/v1/posts/:postId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1520`
- Handler: inline
- Controller/service calls: `postWrites.update`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:update`
- Rate limit: 30 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: `UpdatePostInput`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `posts`
- Database writes: `post`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/posts/:postId/comments</code> — reachable</summary>

- Domain: Comments
- Method: GET
- Effective route: `/v1/posts/:postId/comments`
- Public URL: `https://api.modula.digital/v1/posts/:postId/comments`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:108`
- Handler: inline
- Controller/service calls: `comments.listComments`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `blocks`, `greenfield_comments`, `mutes`, `profiles`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/posts/:postId/comments</code> — reachable</summary>

- Domain: Comments
- Method: POST
- Effective route: `/v1/posts/:postId/comments`
- Public URL: `https://api.modula.digital/v1/posts/:postId/comments`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:117`
- Handler: inline
- Controller/service calls: `comments.createComment`, `mentions.storeMentions`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: `any)?.text ?? '')`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `greenfield_comments`, `greenfield_handles`, `greenfield_mentions`, `posts`, `profiles`
- Database writes: `greenfield_comments`, `greenfield_mentions`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/posts/:postId/like</code> — reachable</summary>

- Domain: Reactions
- Method: DELETE
- Effective route: `/v1/posts/:postId/like`
- Public URL: `https://api.modula.digital/v1/posts/:postId/like`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1561`
- Handler: inline
- Controller/service calls: `postWrites.setEngagement`, `posts.getById`, `reactions.listReactions`, `reactions.setReaction`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `attachments`, `greenfield_quote_posts`, `greenfield_reactions`, `post_content`, `post_media`, `post_reposts`, `post_saves`, `posts`
- Database writes: `greenfield_reactions`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/posts/:postId/like</code> — reachable</summary>

- Domain: Reactions
- Method: POST
- Effective route: `/v1/posts/:postId/like`
- Public URL: `https://api.modula.digital/v1/posts/:postId/like`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1561`
- Handler: inline
- Controller/service calls: `postWrites.setEngagement`, `posts.getById`, `reactions.listReactions`, `reactions.setReaction`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `attachments`, `greenfield_quote_posts`, `greenfield_reactions`, `post_content`, `post_media`, `post_reposts`, `post_saves`, `posts`
- Database writes: `greenfield_reactions`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/posts/:postId/quote</code> — reachable</summary>

- Domain: Sharing
- Method: POST
- Effective route: `/v1/posts/:postId/quote`
- Public URL: `https://api.modula.digital/v1/posts/:postId/quote`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:211`
- Handler: inline
- Controller/service calls: `mentions.storeMentions`, `quotes.createQuote`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:create`
- Rate limit: 30 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: `any)?.commentary ?? '')`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `greenfield_handles`, `greenfield_mentions`, `posts`
- Database writes: `greenfield_mentions`, `greenfield_quote_posts`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/posts/:postId/reaction</code> — reachable</summary>

- Domain: Reactions
- Method: DELETE
- Effective route: `/v1/posts/:postId/reaction`
- Public URL: `https://api.modula.digital/v1/posts/:postId/reaction`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:85`
- Handler: inline
- Controller/service calls: `reactions.setReaction`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_reactions`, `posts`
- Database writes: `greenfield_reactions`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PUT /v1/posts/:postId/reaction</code> — reachable</summary>

- Domain: Reactions
- Method: PUT
- Effective route: `/v1/posts/:postId/reaction`
- Public URL: `https://api.modula.digital/v1/posts/:postId/reaction`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:72`
- Handler: inline
- Controller/service calls: `reactions.setReaction`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: `{type?: string} | null)?.type ?? null`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_reactions`, `posts`
- Database writes: `greenfield_reactions`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/posts/:postId/reactions</code> — reachable</summary>

- Domain: Reactions
- Method: GET
- Effective route: `/v1/posts/:postId/reactions`
- Public URL: `https://api.modula.digital/v1/posts/:postId/reactions`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:96`
- Handler: inline
- Controller/service calls: `reactions.listReactions`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_reactions`, `posts`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/posts/:postId/repost</code> — reachable</summary>

- Domain: Sharing
- Method: DELETE
- Effective route: `/v1/posts/:postId/repost`
- Public URL: `https://api.modula.digital/v1/posts/:postId/repost`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1561`
- Handler: inline
- Controller/service calls: `postWrites.setEngagement`, `posts.getById`, `reactions.listReactions`, `reactions.setReaction`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `attachments`, `greenfield_quote_posts`, `greenfield_reactions`, `post_content`, `post_media`, `post_reposts`, `post_saves`, `posts`
- Database writes: `greenfield_reactions`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/posts/:postId/repost</code> — reachable</summary>

- Domain: Sharing
- Method: POST
- Effective route: `/v1/posts/:postId/repost`
- Public URL: `https://api.modula.digital/v1/posts/:postId/repost`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1561`
- Handler: inline
- Controller/service calls: `postWrites.setEngagement`, `posts.getById`, `reactions.listReactions`, `reactions.setReaction`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `attachments`, `greenfield_quote_posts`, `greenfield_reactions`, `post_content`, `post_media`, `post_reposts`, `post_saves`, `posts`
- Database writes: `greenfield_reactions`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/posts/:postId/save</code> — reachable</summary>

- Domain: Posts
- Method: DELETE
- Effective route: `/v1/posts/:postId/save`
- Public URL: `https://api.modula.digital/v1/posts/:postId/save`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1561`
- Handler: inline
- Controller/service calls: `postWrites.setEngagement`, `posts.getById`, `reactions.listReactions`, `reactions.setReaction`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `attachments`, `greenfield_quote_posts`, `greenfield_reactions`, `post_content`, `post_media`, `post_reposts`, `post_saves`, `posts`
- Database writes: `greenfield_reactions`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/posts/:postId/save</code> — reachable</summary>

- Domain: Posts
- Method: POST
- Effective route: `/v1/posts/:postId/save`
- Public URL: `https://api.modula.digital/v1/posts/:postId/save`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1561`
- Handler: inline
- Controller/service calls: `postWrites.setEngagement`, `posts.getById`, `reactions.listReactions`, `reactions.setReaction`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `attachments`, `greenfield_quote_posts`, `greenfield_reactions`, `post_content`, `post_media`, `post_reposts`, `post_saves`, `posts`
- Database writes: `greenfield_reactions`, `posts`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/posts/:postId/share</code> — reachable</summary>

- Domain: Sharing
- Method: POST
- Effective route: `/v1/posts/:postId/share`
- Public URL: `https://api.modula.digital/v1/posts/:postId/share`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1598`
- Handler: inline
- Controller/service calls: `postShares.record`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{postId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_post_shares`, `posts`
- Database writes: `greenfield_post_shares`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/commentRoutes.ts`, `src/api/local/routes/postRoutes.ts`, `src/data/repositories/api/ApiPostRepository.ts`, `src/features/composer/screens/ComposerScreen.tsx`, `src/features/social/data/useCommentsQuery.ts`, `src/features/social/data/useReactionMutation.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7m-b7.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/product-standard/products/:productId</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/product-standard/products/:productId`
- Public URL: `https://api.modula.digital/v1/product-standard/products/:productId`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:141`
- Handler: inline
- Controller/service calls: `mpsIngest.getLatest`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{productId?: string}).productId ?? '')`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_mps_ingestions`, `greenfield_product_family_members`, `greenfield_product_identity_aliases`, `greenfield_product_privacy_declarations`, `greenfield_release_frontends`, `greenfield_release_presentation_assets`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-mps-v1.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/product-standard/products/:productId/versions/:version</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/product-standard/products/:productId/versions/:version`
- Public URL: `https://api.modula.digital/v1/product-standard/products/:productId/versions/:version`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:153`
- Handler: inline
- Controller/service calls: `mpsIngest.get`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{productId?: string`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_mps_ingestions`, `greenfield_product_family_members`, `greenfield_product_privacy_declarations`, `greenfield_release_frontends`, `greenfield_release_presentation_assets`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-mps-v1.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/profiles/:handle</code> — reachable</summary>

- Domain: Profile
- Method: GET
- Effective route: `/v1/profiles/:handle`
- Public URL: `https://api.modula.digital/v1/profiles/:handle`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1617`
- Handler: inline
- Controller/service calls: `profiles.getByHandle`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{handle: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `blocks`, `follows`, `posts`, `profile_links`, `profiles`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/profileRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`, `src/data/repositories/api/ApiModerationRepository.ts`, `src/data/repositories/api/ApiProfileRepository.ts`, `src/data/repositories/api/ApiSocialGraphRepository.ts`
- Tests: `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-profile.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`, `tests/phase7l-b-public-routes.test.ts`
- Runtime registration: yes
- Live probe: PASS (404)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/profiles/:handle/followers</code> — reachable</summary>

- Domain: Social
- Method: GET
- Effective route: `/v1/profiles/:handle/followers`
- Public URL: `https://api.modula.digital/v1/profiles/:handle/followers`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1641`
- Handler: inline
- Controller/service calls: `profiles.listFollowers`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{handle: string}`
- Request query: `Record<string, unknown>`
- Request body: none observed
- Pagination: cursor; default 20, max 50, next cursor yes
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `blocks`, `follows`, `posts`, `profile_links`, `profiles`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/profileRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`, `src/data/repositories/api/ApiModerationRepository.ts`, `src/data/repositories/api/ApiProfileRepository.ts`, `src/data/repositories/api/ApiSocialGraphRepository.ts`
- Tests: `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-profile.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`, `tests/phase7l-b-public-routes.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/profiles/:handle/following</code> — reachable</summary>

- Domain: Social
- Method: GET
- Effective route: `/v1/profiles/:handle/following`
- Public URL: `https://api.modula.digital/v1/profiles/:handle/following`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1657`
- Handler: inline
- Controller/service calls: `profiles.listFollowing`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{handle: string}`
- Request query: `Record<string, unknown>`
- Request body: none observed
- Pagination: cursor; default 20, max 50, next cursor yes
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `blocks`, `follows`, `posts`, `profile_links`, `profiles`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/profileRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`, `src/data/repositories/api/ApiModerationRepository.ts`, `src/data/repositories/api/ApiProfileRepository.ts`, `src/data/repositories/api/ApiSocialGraphRepository.ts`
- Tests: `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-profile.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`, `tests/phase7l-b-public-routes.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/profiles/:handle/posts</code> — reachable</summary>

- Domain: Profile
- Method: GET
- Effective route: `/v1/profiles/:handle/posts`
- Public URL: `https://api.modula.digital/v1/profiles/:handle/posts`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1625`
- Handler: inline
- Controller/service calls: `posts.listForHandle`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: `{handle: string}`
- Request query: `Record<string, unknown>`
- Request body: none observed
- Pagination: cursor; default 20, max 50, next cursor yes
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `attachments`, `greenfield_quote_posts`, `greenfield_reactions`, `post_content`, `post_media`, `post_reposts`, `post_saves`, `posts`, `profiles`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/profileRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`, `src/data/repositories/api/ApiModerationRepository.ts`, `src/data/repositories/api/ApiProfileRepository.ts`, `src/data/repositories/api/ApiSocialGraphRepository.ts`
- Tests: `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-profile.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`, `tests/phase7l-b-public-routes.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/profiles/:profileId/block</code> — reachable</summary>

- Domain: Social
- Method: DELETE
- Effective route: `/v1/profiles/:profileId/block`
- Public URL: `https://api.modula.digital/v1/profiles/:profileId/block`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1788`
- Handler: inline
- Controller/service calls: `moderation.unblock`, `profileWrites.actorIdForProfileId`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `social:block`
- Rate limit: 30 per 1 minute
- Request params: `{profileId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `profiles`
- Database writes: `blocks`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/profileRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`, `src/data/repositories/api/ApiModerationRepository.ts`, `src/data/repositories/api/ApiProfileRepository.ts`, `src/data/repositories/api/ApiSocialGraphRepository.ts`
- Tests: `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-profile.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`, `tests/phase7l-b-public-routes.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/profiles/:profileId/block</code> — reachable</summary>

- Domain: Social
- Method: POST
- Effective route: `/v1/profiles/:profileId/block`
- Public URL: `https://api.modula.digital/v1/profiles/:profileId/block`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1773`
- Handler: inline
- Controller/service calls: `moderation.block`, `profileWrites.actorIdForProfileId`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `social:block`
- Rate limit: 30 per 1 minute
- Request params: `{profileId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `blocks`, `profiles`
- Database writes: `blocks`, `follows`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/profileRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`, `src/data/repositories/api/ApiModerationRepository.ts`, `src/data/repositories/api/ApiProfileRepository.ts`, `src/data/repositories/api/ApiSocialGraphRepository.ts`
- Tests: `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-profile.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`, `tests/phase7l-b-public-routes.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/profiles/:profileId/follow</code> — reachable</summary>

- Domain: Social
- Method: DELETE
- Effective route: `/v1/profiles/:profileId/follow`
- Public URL: `https://api.modula.digital/v1/profiles/:profileId/follow`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1693`
- Handler: inline
- Controller/service calls: `profileWrites.unfollow`, `profiles.getById`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `social:follow`
- Rate limit: 30 per 1 minute
- Request params: `{profileId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `blocks`, `follows`, `posts`, `profile_links`, `profiles`
- Database writes: `follows`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/profileRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`, `src/data/repositories/api/ApiModerationRepository.ts`, `src/data/repositories/api/ApiProfileRepository.ts`, `src/data/repositories/api/ApiSocialGraphRepository.ts`
- Tests: `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-profile.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`, `tests/phase7l-b-public-routes.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/profiles/:profileId/follow</code> — reachable</summary>

- Domain: Social
- Method: POST
- Effective route: `/v1/profiles/:profileId/follow`
- Public URL: `https://api.modula.digital/v1/profiles/:profileId/follow`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1673`
- Handler: inline
- Controller/service calls: `profileWrites.follow`, `profiles.getById`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `social:follow`
- Rate limit: 30 per 1 minute
- Request params: `{profileId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `blocks`, `follows`, `posts`, `profile_links`, `profiles`
- Database writes: `follows`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/profileRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`, `src/data/repositories/api/ApiModerationRepository.ts`, `src/data/repositories/api/ApiProfileRepository.ts`, `src/data/repositories/api/ApiSocialGraphRepository.ts`
- Tests: `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-profile.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`, `tests/phase7l-b-public-routes.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/profiles/:profileId/mute</code> — reachable</summary>

- Domain: Social
- Method: DELETE
- Effective route: `/v1/profiles/:profileId/mute`
- Public URL: `https://api.modula.digital/v1/profiles/:profileId/mute`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1818`
- Handler: inline
- Controller/service calls: `moderation.unmute`, `profileWrites.actorIdForProfileId`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `social:mute`
- Rate limit: 30 per 1 minute
- Request params: `{profileId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `profiles`
- Database writes: `mutes`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/profileRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`, `src/data/repositories/api/ApiModerationRepository.ts`, `src/data/repositories/api/ApiProfileRepository.ts`, `src/data/repositories/api/ApiSocialGraphRepository.ts`
- Tests: `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-profile.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`, `tests/phase7l-b-public-routes.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/profiles/:profileId/mute</code> — reachable</summary>

- Domain: Social
- Method: POST
- Effective route: `/v1/profiles/:profileId/mute`
- Public URL: `https://api.modula.digital/v1/profiles/:profileId/mute`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1803`
- Handler: inline
- Controller/service calls: `moderation.mute`, `profileWrites.actorIdForProfileId`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `social:mute`
- Rate limit: 30 per 1 minute
- Request params: `{profileId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `mutes`, `profiles`
- Database writes: `mutes`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/profileRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`, `src/data/repositories/api/ApiModerationRepository.ts`, `src/data/repositories/api/ApiProfileRepository.ts`, `src/data/repositories/api/ApiSocialGraphRepository.ts`
- Tests: `scripts/verify-phase5-backend.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-profile.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`, `tests/phase7l-b-public-routes.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/profiles/me</code> — reachable</summary>

- Domain: Profile
- Method: PATCH
- Effective route: `/v1/profiles/me`
- Public URL: `https://api.modula.digital/v1/profiles/me`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1713`
- Handler: inline
- Controller/service calls: `accounts.changeHandle`, `handle.toLowerCase`, `handle.trim`, `profileWrites.updateMe`, `profiles.getByActorId`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `profile:update`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `{displayName?: string`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `actors`, `blocks`, `follows`, `greenfield_accounts`, `posts`, `profile_links`, `profiles`
- Database writes: `failed`, `greenfield_accounts`, `greenfield_handle_history`, `greenfield_handles`, `profiles`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/profileRoutes.ts`, `src/data/repositories/api/ApiProfileRepository.ts`
- Tests: `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-profile.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/profiles/me/avatar</code> — reachable</summary>

- Domain: Profile
- Method: DELETE
- Effective route: `/v1/profiles/me/avatar`
- Public URL: `https://api.modula.digital/v1/profiles/me/avatar`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1758`
- Handler: inline
- Controller/service calls: `profileWrites.updateMedia`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `profile:update`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `attachments`, `profile_media`, `profiles`
- Database writes: `attachments`, `profile_media`, `profiles`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/profiles/me/avatar</code> — reachable</summary>

- Domain: Profile
- Method: POST
- Effective route: `/v1/profiles/me/avatar`
- Public URL: `https://api.modula.digital/v1/profiles/me/avatar`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1741`
- Handler: inline
- Controller/service calls: `profileWrites.updateMedia`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `profile:update`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `{attachmentId?: unknown} | undefined)?.attachmentId`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `attachments`, `profile_media`, `profiles`
- Database writes: `attachments`, `failed`, `profile_media`, `profiles`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/profiles/me/cover</code> — reachable</summary>

- Domain: Profile
- Method: DELETE
- Effective route: `/v1/profiles/me/cover`
- Public URL: `https://api.modula.digital/v1/profiles/me/cover`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1758`
- Handler: inline
- Controller/service calls: `profileWrites.updateMedia`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `profile:update`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `attachments`, `profile_media`, `profiles`
- Database writes: `attachments`, `profile_media`, `profiles`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/profiles/me/cover</code> — reachable</summary>

- Domain: Profile
- Method: POST
- Effective route: `/v1/profiles/me/cover`
- Public URL: `https://api.modula.digital/v1/profiles/me/cover`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1741`
- Handler: inline
- Controller/service calls: `profileWrites.updateMedia`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `profile:update`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `{attachmentId?: unknown} | undefined)?.attachmentId`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `attachments`, `profile_media`, `profiles`
- Database writes: `attachments`, `failed`, `profile_media`, `profiles`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/providers/:capabilityRole</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/providers/:capabilityRole`
- Public URL: `https://api.modula.digital/v1/providers/:capabilityRole`
- API version: v1
- Source file: `services/greenfield-api/src/providers/routes.ts:28`
- Handler: inline
- Controller/service calls: `service.list`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_account_default_providers`, `greenfield_extension_installations`, `greenfield_module_releases`, `greenfield_module_versions`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-reference-products.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.provider-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PUT /v1/providers/:capabilityRole/default</code> — reachable</summary>

- Domain: Modules
- Method: PUT
- Effective route: `/v1/providers/:capabilityRole/default`
- Public URL: `https://api.modula.digital/v1/providers/:capabilityRole/default`
- API version: v1
- Source file: `services/greenfield-api/src/providers/routes.ts:32`
- Handler: inline
- Controller/service calls: `service.setDefault`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_account_default_providers`, `greenfield_extension_installations`, `greenfield_module_releases`, `greenfield_module_versions`
- Database writes: `greenfield_account_default_providers`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-reference-products.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.provider-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/providers/:capabilityRole/resolve</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/providers/:capabilityRole/resolve`
- Public URL: `https://api.modula.digital/v1/providers/:capabilityRole/resolve`
- API version: v1
- Source file: `services/greenfield-api/src/providers/routes.ts:30`
- Handler: inline
- Controller/service calls: `service.resolve`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_account_default_providers`, `greenfield_extension_installations`, `greenfield_module_releases`, `greenfield_module_versions`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-reference-products.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.provider-fabric.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/reels</code> — reachable</summary>

- Domain: Feed
- Method: GET
- Effective route: `/v1/reels`
- Public URL: `https://api.modula.digital/v1/reels`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2106`
- Handler: inline
- Controller/service calls: `discovery.listReels`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `attachments`, `mutes`, `posts`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/discoverRoutes.ts`, `src/data/repositories/api/ApiReelsRepository.ts`
- Tests: `services/greenfield-api/tests/api.integration.test.ts`, `services/greenfield-api/tests/post04.attachments.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/registry/modules</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/registry/modules`
- Public URL: `https://api.modula.digital/v1/registry/modules`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:96`
- Handler: inline
- Controller/service calls: `registry.listModules`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: `any), request.id))`
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_extension_catalogue`, `greenfield_module_releases`, `greenfield_module_versions`, `greenfield_publishers`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `scripts/verify-phase7m-b10.mjs`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/registry-trust.assets.test.ts`, `services/greenfield-api/tests/registry-trust.github-sync.test.ts`, `services/greenfield-api/tests/registry-trust.identity-aliases.test.ts`, `services/greenfield-api/tests/registry-trust.signing.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`
- Runtime registration: yes
- Live probe: PASS (200)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/registry/modules/:moduleId</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/registry/modules/:moduleId`
- Public URL: `https://api.modula.digital/v1/registry/modules/:moduleId`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:114`
- Handler: inline
- Controller/service calls: `registry.getModule`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_extension_catalogue`, `greenfield_module_releases`, `greenfield_module_versions`, `greenfield_mps_ingestions`, `greenfield_release_asset_blobs`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `scripts/verify-phase7m-b10.mjs`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/registry-trust.assets.test.ts`, `services/greenfield-api/tests/registry-trust.github-sync.test.ts`, `services/greenfield-api/tests/registry-trust.identity-aliases.test.ts`, `services/greenfield-api/tests/registry-trust.signing.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`
- Runtime registration: yes
- Live probe: PASS (404)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PUT /v1/registry/modules/:moduleId/rating</code> — reachable</summary>

- Domain: Modules
- Method: PUT
- Effective route: `/v1/registry/modules/:moduleId/rating`
- Public URL: `https://api.modula.digital/v1/registry/modules/:moduleId/rating`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:270`
- Handler: inline
- Controller/service calls: `marketplace.submitRating`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `{rating?: unknown} | undefined)?.rating)`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_module_ratings`, `greenfield_module_releases`
- Database writes: `failed`, `greenfield_module_ratings`
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `scripts/verify-phase7m-b10.mjs`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/registry-trust.assets.test.ts`, `services/greenfield-api/tests/registry-trust.github-sync.test.ts`, `services/greenfield-api/tests/registry-trust.identity-aliases.test.ts`, `services/greenfield-api/tests/registry-trust.signing.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/registry/modules/:moduleId/versions</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/registry/modules/:moduleId/versions`
- Public URL: `https://api.modula.digital/v1/registry/modules/:moduleId/versions`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:200`
- Handler: inline
- Controller/service calls: `registry.listVersions`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_module_releases`, `greenfield_module_versions`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `scripts/verify-phase7m-b10.mjs`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/registry-trust.assets.test.ts`, `services/greenfield-api/tests/registry-trust.github-sync.test.ts`, `services/greenfield-api/tests/registry-trust.identity-aliases.test.ts`, `services/greenfield-api/tests/registry-trust.signing.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`
- Runtime registration: yes
- Live probe: PASS (200)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/registry/modules/:moduleId/versions/:version</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/registry/modules/:moduleId/versions/:version`
- Public URL: `https://api.modula.digital/v1/registry/modules/:moduleId/versions/:version`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:209`
- Handler: inline
- Controller/service calls: `registry.getVersionDetail`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `any`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_module_releases`, `greenfield_module_versions`, `greenfield_mps_ingestions`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `scripts/verify-phase7m-b10.mjs`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/registry-trust.assets.test.ts`, `services/greenfield-api/tests/registry-trust.github-sync.test.ts`, `services/greenfield-api/tests/registry-trust.identity-aliases.test.ts`, `services/greenfield-api/tests/registry-trust.signing.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`
- Runtime registration: yes
- Live probe: PASS (200)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/registry/products</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/registry/products`
- Public URL: `https://api.modula.digital/v1/registry/products`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:105`
- Handler: inline
- Controller/service calls: `registry.listModules`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: `any), productKind: (request.query as any)?.productKind ?? 'all'}), request.id))`
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_extension_catalogue`, `greenfield_module_releases`, `greenfield_module_versions`, `greenfield_publishers`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.assets.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/registry/products/:productId</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/registry/products/:productId`
- Public URL: `https://api.modula.digital/v1/registry/products/:productId`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:123`
- Handler: inline
- Controller/service calls: `registry.getModule`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `any).productId), parseTrustOptions(request.query)), request.id))`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_extension_catalogue`, `greenfield_module_releases`, `greenfield_module_versions`, `greenfield_mps_ingestions`, `greenfield_release_asset_blobs`
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.assets.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/registry/products/:productId/relationships</code> — reachable</summary>

- Domain: Social
- Method: GET
- Effective route: `/v1/registry/products/:productId/relationships`
- Public URL: `https://api.modula.digital/v1/registry/products/:productId/relationships`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:132`
- Handler: inline
- Controller/service calls: `extensionFabric.relationships`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `any).productId)), request.id))`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_extension_targets`, `greenfield_module_releases`, `greenfield_module_versions`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModuleRepository.ts`
- Tests: `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `services/greenfield-api/tests/registry-trust.assets.test.ts`, `services/greenfield-api/tests/registry-trust.trust-block.test.ts`, `tests/konsta-web-presentation.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/registry/publishers/:publisherId</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/registry/publishers/:publisherId`
- Public URL: `https://api.modula.digital/v1/registry/publishers/:publisherId`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:282`
- Handler: inline
- Controller/service calls: `publishers.getPublisher`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `any).publisherId)`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_publishers`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/registry-trust.signing.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/registry/publishers/:publisherId/signing-keys</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/registry/publishers/:publisherId/signing-keys`
- Public URL: `https://api.modula.digital/v1/registry/publishers/:publisherId/signing-keys`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:219`
- Handler: inline
- Controller/service calls: `signingKeys.listForPublisher`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `any).publisherId)), request.id))`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_publisher_signing_key_events`, `greenfield_publisher_signing_keys`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/registry-trust.signing.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/registry/releases/:releaseId/artifact</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/registry/releases/:releaseId/artifact`
- Public URL: `https://api.modula.digital/v1/registry/releases/:releaseId/artifact`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:229`
- Handler: inline
- Controller/service calls: `presentation.readReleaseArtifact`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{releaseId?: string}).releaseId ?? ''))`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_module_releases`, `greenfield_module_sources`, `greenfield_release_asset_blobs`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`, `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/registry-trust.assets.test.ts`, `services/greenfield-api/tests/registry-trust.github-sync.test.ts`
- Runtime registration: yes
- Live probe: PASS (200)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/registry/releases/:releaseId/assets/:assetId</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/registry/releases/:releaseId/assets/:assetId`
- Public URL: `https://api.modula.digital/v1/registry/releases/:releaseId/assets/:assetId`
- API version: v1
- Source file: `services/greenfield-api/src/modules/routes/index.ts:248`
- Handler: inline
- Controller/service calls: `presentation.readAsset`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{releaseId?: string`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `304`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_module_releases`, `greenfield_release_asset_blobs`, `greenfield_release_presentation_assets`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`, `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/registry-trust.assets.test.ts`, `services/greenfield-api/tests/registry-trust.github-sync.test.ts`
- Runtime registration: yes
- Live probe: PASS (404)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/reports</code> — reachable</summary>

- Domain: Moderation
- Method: POST
- Effective route: `/v1/reports`
- Public URL: `https://api.modula.digital/v1/reports`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1833`
- Handler: inline
- Controller/service calls: `moderation.createReport`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `report:create`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `CreateReportInput`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_comments`, `greenfield_story_groups`, `greenfield_story_items`, `posts`, `profiles`, `reports`
- Database writes: `reports`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiModerationRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`, `scripts/verify-phase6-backend.mjs`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/reports/me</code> — reachable</summary>

- Domain: Moderation
- Method: GET
- Effective route: `/v1/reports/me`
- Public URL: `https://api.modula.digital/v1/reports/me`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1846`
- Handler: inline
- Controller/service calls: `moderation.listForReporter`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `report:create`
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: `Record<string, unknown>`
- Request body: none observed
- Pagination: cursor; default 20, max 50, next cursor yes
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `reports`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-social.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/repositories/me</code> — reachable</summary>

- Domain: Account
- Method: GET
- Effective route: `/v1/repositories/me`
- Public URL: `https://api.modula.digital/v1/repositories/me`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1066`
- Handler: inline
- Controller/service calls: `repositories.getMe`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_repositories`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/repositories/me/exports</code> — reachable</summary>

- Domain: Account
- Method: POST
- Effective route: `/v1/repositories/me/exports`
- Public URL: `https://api.modula.digital/v1/repositories/me/exports`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1155`
- Handler: inline
- Controller/service calls: `repositories.createExport`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_records`, `greenfield_repositories`
- Database writes: `greenfield_repository_exports`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/repositories/me/exports/:exportId</code> — reachable</summary>

- Domain: Account
- Method: GET
- Effective route: `/v1/repositories/me/exports/:exportId`
- Public URL: `https://api.modula.digital/v1/repositories/me/exports/:exportId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1164`
- Handler: inline
- Controller/service calls: `repositories.getExport`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{exportId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_repositories`, `greenfield_repository_exports`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/repositories/me/records</code> — reachable</summary>

- Domain: Account
- Method: GET
- Effective route: `/v1/repositories/me/records`
- Public URL: `https://api.modula.digital/v1/repositories/me/records`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1075`
- Handler: inline
- Controller/service calls: `records.listForAccount`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: `any).collection === 'string' ? (request.query as any).collection : undefined`
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_records`, `greenfield_repositories`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/repositories/me/records</code> — reachable</summary>

- Domain: Account
- Method: POST
- Effective route: `/v1/repositories/me/records`
- Public URL: `https://api.modula.digital/v1/repositories/me/records`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1089`
- Handler: inline
- Controller/service calls: `records.mutate`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_records`, `greenfield_repositories`
- Database writes: `greenfield_record_events`, `greenfield_records`, `greenfield_repositories`, `outbox_events`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/repositories/me/records/:recordId</code> — reachable</summary>

- Domain: Account
- Method: DELETE
- Effective route: `/v1/repositories/me/records/:recordId`
- Public URL: `https://api.modula.digital/v1/repositories/me/records/:recordId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1132`
- Handler: inline
- Controller/service calls: `records.getForAccount`, `records.mutate`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{recordId: string}`
- Request query: none observed
- Request body: `any)?.expectedRevision,`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_records`, `greenfield_repositories`
- Database writes: `greenfield_record_events`, `greenfield_records`, `greenfield_repositories`, `outbox_events`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/repositories/me/records/:recordId</code> — reachable</summary>

- Domain: Account
- Method: GET
- Effective route: `/v1/repositories/me/records/:recordId`
- Public URL: `https://api.modula.digital/v1/repositories/me/records/:recordId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1081`
- Handler: inline
- Controller/service calls: `records.getForAccount`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{recordId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_records`, `greenfield_repositories`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/repositories/me/records/:recordId</code> — reachable</summary>

- Domain: Account
- Method: PATCH
- Effective route: `/v1/repositories/me/records/:recordId`
- Public URL: `https://api.modula.digital/v1/repositories/me/records/:recordId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1108`
- Handler: inline
- Controller/service calls: `records.getForAccount`, `records.mutate`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{recordId: string}`
- Request query: none observed
- Request body: `any`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_records`, `greenfield_repositories`
- Database writes: `failed`, `greenfield_record_events`, `greenfield_records`, `greenfield_repositories`, `outbox_events`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/saves</code> — reachable</summary>

- Domain: Posts
- Method: GET
- Effective route: `/v1/saves`
- Public URL: `https://api.modula.digital/v1/saves`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase6s-routes.ts:225`
- Handler: inline
- Controller/service calls: `saves.listSaves`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `saved:manage`
- Rate limit: 60 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `403`, `404`, `429`, `500`
- Database reads: `post_saves`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiPostRepository.ts`
- Tests: `scripts/verify-phase6s-social-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-social-core.mjs`, `services/greenfield-api/tests/phase6s.social.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/search</code> — reachable</summary>

- Domain: Search
- Method: GET
- Effective route: `/v1/search`
- Public URL: `https://api.modula.digital/v1/search`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1979`
- Handler: inline
- Controller/service calls: `search.search`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: none observed
- Request query: `Record<string, unknown>, await resolveSearchActorContext(request))`
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/discoverRoutes.ts`, `src/data/repositories/api/ApiDiscoverRepository.ts`
- Tests: `scripts/verify-phase6-backend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7c-product-complete.mjs`, `scripts/verify-phase7c-release-candidate.mjs`, `scripts/verify-phase7c-social-core.mjs`, `scripts/verify-phase7e-search-platform.mjs`, `services/greenfield-api/tests/phase6.security.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/search/recent</code> — reachable</summary>

- Domain: Search
- Method: DELETE
- Effective route: `/v1/search/recent`
- Public URL: `https://api.modula.digital/v1/search/recent`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2016`
- Handler: inline
- Controller/service calls: `search.deleteRecent`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: `Record<string, unknown>), ...(((request.body as any) ?? {}) as Record<string, unknown>)}`
- Request body: `any) ?? {}) as Record<string, unknown>)}`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiDiscoverRepository.ts`
- Tests: `scripts/verify-phase7e-search-platform.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/search/recent</code> — reachable</summary>

- Domain: Search
- Method: GET
- Effective route: `/v1/search/recent`
- Public URL: `https://api.modula.digital/v1/search/recent`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1996`
- Handler: inline
- Controller/service calls: `search.listRecent`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: `Record<string, unknown>), request.id))`
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiDiscoverRepository.ts`
- Tests: `scripts/verify-phase7e-search-platform.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/search/recent</code> — reachable</summary>

- Domain: Search
- Method: POST
- Effective route: `/v1/search/recent`
- Public URL: `https://api.modula.digital/v1/search/recent`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2006`
- Handler: inline
- Controller/service calls: `search.recordRecent`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiDiscoverRepository.ts`
- Tests: `scripts/verify-phase7e-search-platform.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/search/saved</code> — reachable</summary>

- Domain: Search
- Method: GET
- Effective route: `/v1/search/saved`
- Public URL: `https://api.modula.digital/v1/search/saved`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2027`
- Handler: inline
- Controller/service calls: `search.listSaved`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiDiscoverRepository.ts`
- Tests: `scripts/verify-phase7e-search-platform.mjs`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/search/saved</code> — reachable</summary>

- Domain: Search
- Method: POST
- Effective route: `/v1/search/saved`
- Public URL: `https://api.modula.digital/v1/search/saved`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2037`
- Handler: inline
- Controller/service calls: `search.createSaved`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiDiscoverRepository.ts`
- Tests: `scripts/verify-phase7e-search-platform.mjs`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/search/saved/:savedSearchId</code> — reachable</summary>

- Domain: Search
- Method: DELETE
- Effective route: `/v1/search/saved/:savedSearchId`
- Public URL: `https://api.modula.digital/v1/search/saved/:savedSearchId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2058`
- Handler: inline
- Controller/service calls: `search.deleteSaved`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{savedSearchId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiDiscoverRepository.ts`
- Tests: `scripts/verify-phase7e-search-platform.mjs`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>PATCH /v1/search/saved/:savedSearchId</code> — reachable</summary>

- Domain: Search
- Method: PATCH
- Effective route: `/v1/search/saved/:savedSearchId`
- Public URL: `https://api.modula.digital/v1/search/saved/:savedSearchId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:2047`
- Handler: inline
- Controller/service calls: `search.patchSaved`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{savedSearchId: string}`
- Request query: none observed
- Request body: `any) ?? {}), request.id))`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `failed`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/data/repositories/api/ApiDiscoverRepository.ts`
- Tests: `scripts/verify-phase7e-search-platform.mjs`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/search/suggestions</code> — reachable</summary>

- Domain: Search
- Method: GET
- Effective route: `/v1/search/suggestions`
- Public URL: `https://api.modula.digital/v1/search/suggestions`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1988`
- Handler: inline
- Controller/service calls: `search.suggestions`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: none observed
- Request query: `Record<string, unknown>, await resolveSearchActorContext(request)), request.id))`
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-phase7e-search-platform.mjs`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/sessions</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/sessions`
- Public URL: `https://api.modula.digital/v1/sessions`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:815`
- Handler: inline
- Controller/service calls: `accessExpiresAt.toISOString`, `authentication.login`, `refreshExpiresAt.toISOString`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_password_credentials`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: `src/api/local/LocalApiServer.ts`, `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-auth.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6-greenfield-frontend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7e-real-auth.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `scripts/verify-phase7l-b-session.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-backend-v1.apple-auth.test.ts`, `services/greenfield-api/tests/greenfield-backend-v1.provider-fabric.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/helpers/registry-fixtures.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/sessions/:sessionId</code> — reachable</summary>

- Domain: Authentication
- Method: DELETE
- Effective route: `/v1/sessions/:sessionId`
- Public URL: `https://api.modula.digital/v1/sessions/:sessionId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1037`
- Handler: inline
- Controller/service calls: `greenfieldSessions.revokeSession`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: `{sessionId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_sessions`
- Database writes: `greenfield_session_events`, `greenfield_session_tokens`, `greenfield_sessions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/LocalApiServer.ts`, `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `scripts/verify-greenfield-backend-v1-auth.mjs`, `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6-greenfield-frontend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7e-real-auth.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `scripts/verify-phase7l-b-session.mjs`, `services/greenfield-api/tests/api-baseline-02.security-acceptance.test.ts`, `services/greenfield-api/tests/greenfield-backend-v1.apple-auth.test.ts`, `services/greenfield-api/tests/greenfield-backend-v1.provider-fabric.test.ts`, `services/greenfield-api/tests/greenfield-product-frontend-v1.runtime.test.ts`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `services/greenfield-api/tests/helpers/registry-fixtures.ts`, `services/greenfield-api/tests/phase6.security.test.ts`, `services/greenfield-api/tests/phase6s.social.test.ts`, `services/greenfield-api/tests/phase7b.module-runtime.test.ts`, `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`, `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `services/greenfield-api/tests/phase7l.profile-update.test.ts`, `services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts`, `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/sessions/apple</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/sessions/apple`
- Public URL: `https://api.modula.digital/v1/sessions/apple`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:976`
- Handler: inline
- Controller/service calls: `accessExpiresAt.toISOString`, `appleAuthentication.completeAuthentication`, `mail.queueNewSignIn`, `refreshExpiresAt.toISOString`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_authentication_methods`, `greenfield_external_identities`
- Database writes: `greenfield_external_identities`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-auth.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.apple-auth.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/sessions/apple/options</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/sessions/apple/options`
- Public URL: `https://api.modula.digital/v1/sessions/apple/options`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:964`
- Handler: inline
- Controller/service calls: `appleAuthentication.beginAuthentication`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1-auth.mjs`, `services/greenfield-api/tests/greenfield-backend-v1.apple-auth.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/sessions/current</code> — reachable</summary>

- Domain: Authentication
- Method: DELETE
- Effective route: `/v1/sessions/current`
- Public URL: `https://api.modula.digital/v1/sessions/current`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1031`
- Handler: inline
- Controller/service calls: `greenfieldSessions.revokeSession`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_sessions`
- Database writes: `greenfield_session_events`, `greenfield_session_tokens`, `greenfield_sessions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-frontend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7e-real-auth.mjs`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/sessions/email-code</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/sessions/email-code`
- Public URL: `https://api.modula.digital/v1/sessions/email-code`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:852`
- Handler: inline
- Controller/service calls: `accessExpiresAt.toISOString`, `authentication.loginWithEmailCode`, `refreshExpiresAt.toISOString`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/sessions/email-code/request</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/sessions/email-code/request`
- Public URL: `https://api.modula.digital/v1/sessions/email-code/request`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:837`
- Handler: inline
- Controller/service calls: `authentication.requestEmailLoginCode`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/sessions/me</code> — reachable</summary>

- Domain: Authentication
- Method: DELETE
- Effective route: `/v1/sessions/me`
- Public URL: `https://api.modula.digital/v1/sessions/me`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1434`
- Handler: inline
- Controller/service calls: `sessions.revokeSession`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: none observed
- Database writes: `sessions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/phase6.security.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/sessions/me</code> — reachable</summary>

- Domain: Authentication
- Method: GET
- Effective route: `/v1/sessions/me`
- Public URL: `https://api.modula.digital/v1/sessions/me`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1428`
- Handler: inline
- Controller/service calls: none observed
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `services/greenfield-api/tests/phase6.security.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/sessions/passkey</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/sessions/passkey`
- Public URL: `https://api.modula.digital/v1/sessions/passkey`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:923`
- Handler: inline
- Controller/service calls: `accessExpiresAt.toISOString`, `greenfieldSessions.issue`, `mail.queueNewSignIn`, `passkeys.verifyAuthentication`, `refreshExpiresAt.toISOString`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any) ?? {}) as {challengeId?: string`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_auth_challenges`, `greenfield_passkeys`
- Database writes: `greenfield_passkeys`, `greenfield_session_events`, `greenfield_session_tokens`, `greenfield_sessions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/sessions/passkey/options</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/sessions/passkey/options`
- Public URL: `https://api.modula.digital/v1/sessions/passkey/options`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:908`
- Handler: inline
- Controller/service calls: `passkeys.beginAuthentication`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_passkeys`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/sessions/recovery-code</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/sessions/recovery-code`
- Public URL: `https://api.modula.digital/v1/sessions/recovery-code`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:880`
- Handler: inline
- Controller/service calls: `accessExpiresAt.toISOString`, `authentication.loginWithRecoveryCode`, `refreshExpiresAt.toISOString`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: `SMTP/Modula Mail`
- Known clients: none observed
- Tests: `scripts/verify-phase7i-f5-auth-foundation.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/sessions/refresh</code> — reachable</summary>

- Domain: Authentication
- Method: POST
- Effective route: `/v1/sessions/refresh`
- Public URL: `https://api.modula.digital/v1/sessions/refresh`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1012`
- Handler: inline
- Controller/service calls: `accessExpiresAt.toISOString`, `greenfieldSessions.refresh`, `refreshExpiresAt.toISOString`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 10 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: `any).refreshToken)`
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_session_tokens`, `greenfield_sessions`
- Database writes: `greenfield_session_events`, `greenfield_session_tokens`, `greenfield_sessions`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiAuthRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6-greenfield-frontend.mjs`, `scripts/verify-phase7c-api-parity.mjs`, `scripts/verify-phase7e-real-auth.mjs`, `scripts/verify-phase7l-b-session.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`, `tests/konsta-web-presentation.test.ts`, `tests/phase7l-b-auth-regression.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/status</code> — reachable</summary>

- Domain: Operations
- Method: GET
- Effective route: `/v1/status`
- Public URL: `https://api.modula.digital/v1/status`
- API version: v1
- Source file: `services/greenfield-api/src/support/routes.ts:20`
- Handler: inline
- Controller/service calls: none observed
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `503`
- Expected errors: `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: PASS (200)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/stories</code> — reachable</summary>

- Domain: Media
- Method: POST
- Effective route: `/v1/stories`
- Public URL: `https://api.modula.digital/v1/stories`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase7f-stories-routes.ts:79`
- Handler: inline
- Controller/service calls: `stories.create`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:create`
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `201`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `blocks`, `follows`, `greenfield_story_groups`, `greenfield_story_items`, `greenfield_story_views`, `profiles`
- Database writes: `greenfield_story_groups`, `greenfield_story_items`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/storyRoutes.ts`, `src/data/repositories/api/ApiStoriesRepository.ts`
- Tests: `scripts/verify-phase7h-api-contract-parity.mjs`, `scripts/verify-phase7h-live-contracts.mjs`, `scripts/verify-phase7i-live-api-parity.mjs`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/stories/:groupId</code> — reachable</summary>

- Domain: Media
- Method: GET
- Effective route: `/v1/stories/:groupId`
- Public URL: `https://api.modula.digital/v1/stories/:groupId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase7f-stories-routes.ts:67`
- Handler: inline
- Controller/service calls: `groupId.startsWith`, `stories.getGroup`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: `{groupId?: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `blocks`, `follows`, `greenfield_story_groups`, `greenfield_story_items`, `greenfield_story_views`, `profiles`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/storyRoutes.ts`, `src/data/repositories/api/ApiStoriesRepository.ts`
- Tests: `scripts/verify-phase7h-api-contract-parity.mjs`, `scripts/verify-phase7h-live-contracts.mjs`, `scripts/verify-phase7i-live-api-parity.mjs`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>DELETE /v1/stories/items/:itemId</code> — reachable</summary>

- Domain: Media
- Method: DELETE
- Effective route: `/v1/stories/items/:itemId`
- Public URL: `https://api.modula.digital/v1/stories/items/:itemId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase7f-stories-routes.ts:121`
- Handler: inline
- Controller/service calls: `stories.deleteItem`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:create`
- Rate limit: 30 per 1 minute
- Request params: `{itemId?: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_story_groups`, `greenfield_story_items`
- Database writes: `greenfield_story_groups`, `greenfield_story_items`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/storyRoutes.ts`, `src/data/repositories/api/ApiStoriesRepository.ts`
- Tests: `services/greenfield-api/tests/phase7i.f5-stories.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/stories/items/:itemId/viewed</code> — reachable</summary>

- Domain: Media
- Method: POST
- Effective route: `/v1/stories/items/:itemId/viewed`
- Public URL: `https://api.modula.digital/v1/stories/items/:itemId/viewed`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase7f-stories-routes.ts:109`
- Handler: inline
- Controller/service calls: `stories.markViewed`
- Authentication: legacy or bridged bearer session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated actor id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: `post:engage`
- Rate limit: 30 per 1 minute
- Request params: `{itemId?: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Database reads: `blocks`, `follows`, `greenfield_story_groups`, `greenfield_story_items`
- Database writes: `greenfield_story_views`
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/storyRoutes.ts`, `src/data/repositories/api/ApiStoriesRepository.ts`
- Tests: `services/greenfield-api/tests/phase7i.f5-stories.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/stories/rail</code> — reachable</summary>

- Domain: Media
- Method: GET
- Effective route: `/v1/stories/rail`
- Public URL: `https://api.modula.digital/v1/stories/rail`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-phase7f-stories-routes.ts:61`
- Handler: inline
- Controller/service calls: `stories.listRail`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 60 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `actors`, `blocks`, `follows`, `greenfield_story_groups`, `greenfield_story_items`, `greenfield_story_views`, `profiles`
- Database writes: none observed
- Storage: `host bind mount: /var/lib/modula/greenfield-media`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/storyRoutes.ts`, `src/data/repositories/api/ApiStoriesRepository.ts`
- Tests: `scripts/verify-phase7h-api-contract-parity.mjs`, `scripts/verify-phase7h-live-contracts.mjs`, `scripts/verify-phase7i-live-api-parity.mjs`, `services/greenfield-api/tests/phase7i.f5-stories.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/support/cases</code> — reachable</summary>

- Domain: Support
- Method: GET
- Effective route: `/v1/support/cases`
- Public URL: `https://api.modula.digital/v1/support/cases`
- API version: v1
- Source file: `services/greenfield-api/src/support/routes.ts:53`
- Handler: inline
- Controller/service calls: `service.list`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `401`, `404`, `429`, `500`
- Database reads: `greenfield_support_cases`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: PASS (401)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>POST /v1/support/cases</code> — reachable</summary>

- Domain: Support
- Method: POST
- Effective route: `/v1/support/cases`
- Public URL: `https://api.modula.digital/v1/support/cases`
- API version: v1
- Source file: `services/greenfield-api/src/support/routes.ts:54`
- Handler: inline
- Controller/service calls: `key.trim`, `service.open`
- Authentication: greenfield bearer access session
- Authorization: AUTHENTICATED
- Ownership rule: authenticated account id is passed into the service/repository scope
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 30 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `400`, `401`, `404`, `409`, `429`, `500`
- Database reads: `greenfield_accounts`, `greenfield_auth_identities`, `greenfield_support_cases`
- Database writes: `greenfield_support_cases`
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/support/contact</code> — reachable</summary>

- Domain: Support
- Method: GET
- Effective route: `/v1/support/contact`
- Public URL: `https://api.modula.digital/v1/support/contact`
- API version: v1
- Source file: `services/greenfield-api/src/support/routes.ts:29`
- Handler: inline
- Controller/service calls: `service.contact`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/tools</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/tools`
- Public URL: `https://api.modula.digital/v1/tools`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1229`
- Handler: inline
- Controller/service calls: `db.selectFrom`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_tools`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/tools/:toolId</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/tools/:toolId`
- Public URL: `https://api.modula.digital/v1/tools/:toolId`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1233`
- Handler: inline
- Controller/service calls: `eb.or`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: `{toolId: string}`
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_tools`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/api/local/routes/authRoutes.ts`, `src/data/repositories/api/ApiToolsRepository.ts`
- Tests: `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, `services/greenfield-api/tests/greenfield.accounts.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/version</code> — reachable</summary>

- Domain: Operations
- Method: GET
- Effective route: `/v1/version`
- Public URL: `https://api.modula.digital/v1/version`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:232`
- Handler: inline
- Controller/service calls: none observed
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: `src/features/settings/screens/ModulaMailSettingsScreen.tsx`
- Tests: `services/greenfield-api/tests/api.integration.test.ts`
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /v1/widgets</code> — reachable</summary>

- Domain: Modules
- Method: GET
- Effective route: `/v1/widgets`
- Public URL: `https://api.modula.digital/v1/widgets`
- API version: v1
- Source file: `services/greenfield-api/src/app/register-routes.ts:1409`
- Handler: inline
- Controller/service calls: `db.selectFrom`
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: `greenfield_widgets`
- Database writes: none observed
- Storage: none observed
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: none observed
- Runtime registration: yes
- Live probe: not executed
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

<details>
<summary><code>GET /version.json</code> — reachable</summary>

- Domain: Operations
- Method: GET
- Effective route: `/version.json`
- Public URL: `https://api.modula.digital/version.json`
- API version: versionless
- Source file: `services/greenfield-api/src/app/register-routes.ts:228`
- Handler: inline
- Controller/service calls: none observed
- Authentication: none
- Authorization: PUBLIC
- Ownership rule: public/optional-viewer policy; downstream visibility checks must enforce privacy
- Workspace rule: none observed
- Capability/permission: none observed
- Rate limit: 120 per 1 minute
- Request params: none observed
- Request query: none observed
- Request body: none observed
- Pagination: none observed
- Response schema: not declared in Fastify
- Success codes: `200`
- Expected errors: `404`, `429`, `500`
- Database reads: none observed
- Database writes: none observed
- Storage: `PostgreSQL artifact/release metadata; artifact delivery route where present`
- Events produced: none observed
- Jobs produced: none observed
- External integrations: none observed
- Known clients: none observed
- Tests: `scripts/verify-greenfield-backend-v1.mjs`, `scripts/verify-phase7e-web-production-cutover.mjs`, `scripts/verify-phase7i-f5-auth-foundation.mjs`, `scripts/verify-phase7j-b.mjs`, `scripts/verify-phase7j-mac.mjs`, `scripts/verify-phase7l-a.mjs`, `services/greenfield-api/tests/api.integration.test.ts`
- Runtime registration: yes
- Live probe: PASS (200)
- Status: reachable
- Notes: No Fastify request/response schema is registered; validation, if present, is handler/service-level.

</details>

