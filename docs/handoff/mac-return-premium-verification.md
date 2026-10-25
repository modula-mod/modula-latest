# Mac return handoff — Premium, Verification, and Native consolidation

Mission: `VPS-CONSOLIDATION-01`  
Prepared: 2026-10-25  
Production deployment: **NONE**  
Real Premium payments: **DISABLED**

## Source identity

- Latest pushed Native main: `be679c8672a9cb0a857087e3e90ab7df644b1899`.
- Native reference checkout: `/root/modula-worktrees/modula-native-vps-reference`.
- GreenField starting main: `17aa21c3058b73a2e5b8f355e9798d8e150f6ee4`.
- GreenField candidate branch: `phase/greenfield-premium-verification-01`.
- GreenField implementation commit before handoff documents: `58bde349fa40c1907a74e2f5d66ca38f3134e2fb`.
- Accepted backend PR/merge: recorded in the mission final report after remote CI and merge; no production deployment is implied.
- Migration: `076_greenfield_premium_entitlements`.
- Known collision: GreenField draft PR #137 currently also uses migration 076 for optional packages. Rebase and renumber #137 after this migration lands; do not combine the migrations.

## Backend schema

Premium is account-scoped and versioned:

- `greenfield_premium_catalogue_versions`
- `greenfield_premium_tiers`
- `greenfield_premium_capabilities`
- `greenfield_premium_memberships`
- `greenfield_premium_preferences`
- append-only `greenfield_premium_membership_events`

Membership fields are `account_id`, `catalogue_version`, `tier_id`, `subscription_status`, `entitlement_source`, `effective_at`, `expires_at`, `membership_since`, `revision`, optional hashed provider reference, and audit metadata. Future Apple processing has an idempotent event boundary, but there is no client purchase-success endpoint and no live billing integration.

Verification is a separate account authority:

- `greenfield_verification_applications`
- `greenfield_verification_statuses`
- `greenfield_verification_appeals`
- append-only `greenfield_verification_events`

No identity-document or biometric column exists. This phase stores synthetic QA statements/decisions only.

## Premium contract

Catalogue version 1 exposes Core, Plus, Horizon, Horizon Plus (`horizon_plus`), and Studio. Prices are `null`, pricing is provisional, purchase is disabled, and placeholder limits are not enforced.

Endpoints:

- `GET /v1/premium/tiers`
- `GET /v1/me/membership`
- `GET /v1/me/entitlements`
- `GET /v1/me/entitlements/:capabilityId`
- `PATCH /v1/me/membership/badge-visibility`
- QA only: `PUT /v1/admin/qa/premium/:handle`, requiring `admin:ops` and an idempotency key

Capability definitions are server-controlled and centralized. Installed modules, storage, and In-Mail are marked `existing_free` and stay available to Core. Profile analytics, scheduled posting, Premium appearance/profile plate/QR styles, eligible new Moliboo content, creator/business, and team functions are QA-only declarations. Cloud AI is `future_disabled`. Existing Moliboo ownership survives downgrade; only eligible future content after roster 115 is represented by the provisional capability metadata.

Membership assignments accept active, expired, revoked, and downgraded QA fixtures only when the QA flag is enabled outside production. A client cannot choose a paid tier. `premium_purchase` and StoreKit transaction endpoints are absent.

## Verification contract

States: `unverified`, `pending`, `under_review`, `verified`, `paused`, `denied`, `revoked`.

Types: `person`, `notable_person`, `organization`, `public_body`, `official_module_developer`.

Endpoints:

- `GET /v1/me/verification`
- `POST /v1/me/verification/applications`
- `POST /v1/me/verification/applications/:applicationId/appeals`
- QA review only: `GET /v1/admin/qa/verification/applications`
- QA review only: `POST /v1/admin/qa/verification/applications/:applicationId/transitions`
- QA review only: `POST /v1/admin/qa/verification/appeals/:appealId/transitions`

Review requires `admin:moderation`. Allowed application actions are explicit server-side transitions such as start review, approve, deny, pause, resume, and revoke. Appeal review is separately authorized and audited. Only the exact `verified` state is publicly effective; paused/revoked/denied/claimed accounts do not display a verification mark. Membership tier never participates in a verification decision.

## Canonical public badge DTO

All added fields are optional/additive in `packages/api-contracts/src/profiles.ts` so old clients can continue decoding the pre-existing response.

```json
{
  "publicIdentity": {
    "schemaVersion": 1,
    "verification": {
      "status": "verified",
      "type": "person",
      "mark": "blue_identity_seal"
    },
    "membership": {
      "tier": "horizon",
      "status": "active",
      "badgeVisible": true,
      "mark": "modula_unit"
    }
  },
  "premiumTier": "horizon",
  "premiumSince": "2026-10-25T00:00:00.000Z",
  "premiumBadgeVisible": true,
  "verificationStatus": "verified",
  "verifiedType": "person",
  "isVerified": true
}
```

Verification mark mappings:

- person/notable person: `blue_identity_seal`
- organization: `ink_squircle`
- government/public body: `slate_hexagon`
- official module developer: `developer_seal`

Premium mark: `modula_unit`, only for an effective non-Core membership when badge visibility is enabled.

The projection is used by profiles, posts/reels, comments, conversation participants, message senders, Discover, and unified search. Profile share previews and QR profile data have no separate GreenField endpoint; they inherit the profile response. A single batch projection service resolves actors/accounts and uses a 15-second bounded cache with invalidation after membership/preference/verification changes.

Important Native decoder correction: the current pushed Discover model treats any non-empty `identityClaims` array as verified. GreenField now strips claims from Discover and emits authoritative fields, but Native must be changed to prefer `publicIdentity.verification`/`isVerified` and never infer a check from the presence of a claim.

## Feature flags

All flags default false:

- `MODULA_PREMIUM_ENTITLEMENTS_ENABLED`
- `MODULA_PREMIUM_QA_ASSIGNMENTS_ENABLED`
- `MODULA_VERIFICATION_ENABLED`
- `MODULA_VERIFICATION_QA_REVIEW_ENABLED`

Both QA mutation flags are refused when `MODULA_ENVIRONMENT=production`. No public or production flag was enabled by this mission.

## QA deployment and fixtures

Isolated PostgreSQL database: `modula_vps_consolidation_01_qa` in container `modula-premium-qa-pg`, PostgreSQL 16.9.  
QA API: `modula-premium-verification-qa-api`, loopback only at `127.0.0.1:4024`.  
QA worker: `modula-premium-verification-qa-worker`; external ingest and mail disabled.  
QA media volume: `modula-premium-verification-qa-media`.  
QA migration: 076, no pending/unknown migrations.  
API image ID: `sha256:af5cfd073788713adefab448f8a6e093b584be09bfa816e081d062d753bc925a`.  
Worker image ID: `sha256:b1490b583bbd36cbd0c2d899b5ad37b561d4b784f7d3c63c7eeae71e3db100d2`.  
Both images are labeled with revision `58bde349fa40c1907a74e2f5d66ca38f3134e2fb` and expected migration 076.

Non-secret fixture identities:

| Handle | Account ID | Actor ID | Purpose |
|---|---|---|---|
| `vpsc01admin` | `01a1749c-0739-7e6d-a504-d9c7da71dae9` | `actor-01a1749c-0739-7e6d-a504-d9c7da71dae9` | QA operator; Core/unverified |
| `vpsc01horizon` | `01a1749c-0805-701a-b717-fdbfdc1a7d5e` | `actor-01a1749c-0805-701a-b717-fdbfdc1a7d5e` | Horizon + verified person; Premium badge hidden |
| `vpsc01claim` | `01a1749c-bee9-7c1e-8cb2-4b500a80584a` | `actor-01a1749c-bee9-7c1e-8cb2-4b500a80584a` | Core + synthetic claimed identity; remains unverified |

No password, bearer token, signing key, database password, or recovery token is recorded here.

Live QA evidence:

- unauthenticated Premium reads: 401
- nonexistent purchase endpoint: 404
- normal-user Premium promotion: 403
- normal-user verification approval: 403
- default membership: Core
- operator-assigned membership: Horizon/active
- verified-person public mark: `blue_identity_seal`
- hidden Premium badge: membership mark `null`, Verification mark retained
- claimed identity with even a legacy `verified: true` claim: authoritative `isVerified: false`
- profile attempts to submit `isVerified`, `verifiedType`, or `premiumTier`: ignored; authority remains Core/unverified
- Discover strips `identityClaims` and stays unverified
- post/comment author, conversation participant, and message sender projections tested
- worker heartbeat records the exact candidate SHA

## Validation completed on the VPS

- real-PostgreSQL Premium/Verification integration: 9/9
- affected targeted API tests after bounded reruns: 86/86
- worker tests with real PostgreSQL: 45/45, no skips
- migration upgrade/ledger validation: 6/6, including fresh database and 065-to-076 path
- API and worker typechecks: PASS
- immutable image build graph: PASS
- Atlas: 95/95, 471 application routes, 196 explicit exclusions, 0 source-only routes, 0 runtime-only routes, 319 tables
- Native detached source checks at Premium tip `5c020488…`: boundary verifier PASS; generated design contracts PASS

## Native branches and merge order

1. Preserve Mac dirty state and local-only branches first.
2. Reconcile #206 with #210, then land #210 after messaging tests.
3. Land #213 after #210 if dependent; land #212 after comment UX tests.
4. Land #211 after Moliboo persistence/layout tests.
5. Rebase `premium/hub-and-tiers` (`5c020488…`) and adopt the canonical optional DTO. Keep purchases disabled.
6. Recover and push Mac-only Verification badge and Modula Unit artwork/source; do not replace them from Linux.
7. Resolve Product UI #77 separately; it is currently DIRTY.
8. Package stack: Product Standard #9 -> Module Generator #5 -> Game Lab #2 -> GreenField #137 (renumber migration) -> Native GameHost #99 -> Native PackageManager #168.
9. Reconcile shell fixes and update AppLock timing assertions.
10. Xcode tests -> simulator acceptance -> physical-iPhone acceptance.

Nodus stays local-only, must not depend on Premium or server availability, and requires model/provider/device acceptance on Mac. Do not download model files to the VPS. Moliboo stays 2D; validate asset-pack signatures, wardrobe ownership, saved outfits, and downgrade persistence. PackageManager must consume the universal signed-package contracts rather than Premium-specific infrastructure.

## AppLock discrepancy

Pushed source delays are 0 seconds through attempt 4, then 30, 60, 300, 900, and 3600 seconds for attempts 5, 6, 7, 8, and 9+. The stale test expects 5 seconds at attempt 6 and 60 seconds at attempt 12. Update the test to 60 and 3600 seconds and add boundaries; do not weaken the source policy.

## Required Mac acceptance

Simulator:

- decode old responses without the new optional fields and new responses with all four badge combinations
- Premium Hub, comparison, welcome/checklist, management/cancel surfaces with purchases disabled
- Verification person/organization/public-body marks, pause/revoke propagation, and claimed-identity regression
- profile, feed, reel, comments, Discover, search, chat thread/participant/message, share preview, and QR card rendering
- #210 first-contact picker, #213 share-to-new-chat, duplicate retries, blocked/restricted users, and In-Mail routing
- #211 family tabs, wardrobe, saved outfit, existing ownership after downgrade
- AppLock boundary timing and background/foreground lock behavior

Physical iPhone:

- complete Premium/Verification visual hierarchy across appearance/surface modes
- biometric/AppLock and security-delay behavior
- first-message and share-sheet flows, push/deep-link behavior, keyboard/accessibility/touch targets
- Moliboo asset memory/performance and persistence
- signed package download/install/update/revocation and GameHost runtime
- QR scan/share and Modula Unit asset fidelity

## Known unavailable work

No pushed dedicated Verification badge branch, Modula Unit icon/QR asset branch, or Nodus R8 branch was found. Any reported uncommitted implementations remain Mac-only and must be preserved/recovered there. The VPS did not reconstruct, overwrite, or delete them. See `docs/consolidation/native-main-recovery.md` and `docs/consolidation/branch-cleanup-candidates.md` for the evidence inventory and future cleanup proposal.
