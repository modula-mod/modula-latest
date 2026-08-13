# Phase 7L-B Defect Execution Register

Date: 2026-08-13
Canonical repo: `/root/modula-latest`
Canonical branch: `main`
Phase 7L-A checkpoint: `6459087863dd087e303d2eb8fe74ac27df558877`
Audit baseline source SHA: `fb4b58c07bf475d99ab6792d367058331257ea97`
Audit baseline production SHA: `2ef3755082b46e49fe62424e93d4a4de9c6f1e17`

Allowed statuses: `OPEN`, `IN_PROGRESS`, `FIXED_SOURCE`, `PASS_LOCAL`, `PASS_LIVE`, `BLOCKED_EXTERNAL`.

Current register counts:

| Severity | Total | OPEN | IN_PROGRESS | FIXED_SOURCE | PASS_LOCAL | PASS_LIVE | BLOCKED_EXTERNAL |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| P0 | 12 | 4 | 0 | 0 | 7 | 1 | 0 |
| P1 | 35 | 10 | 0 | 0 | 24 | 1 | 0 |

Closure rule: source edits alone never close a defect. A defect can move to `PASS_LOCAL` only after its verification command passes in the intended local or disposable acceptance environment. A defect can move to `PASS_LIVE` only after the public/live verification is captured against the deployed fixed SHA.

## P0 Register

### P7LB-P0-001 - Source Baseline

- Severity: P0
- Feature/domain: Source baseline / Release
- Symptom: Phase 7L-B required a clean, committed, pushed Phase 7L-A checkpoint before repair.
- Root cause: Phase 7L-A audit artifacts were uncommitted when remediation began.
- Source files: `package.json`; `scripts/verify-phase7l-a.mjs`; `docs/validation/phase7l-a-*.md`; `docs/validation/evidence/phase7l-a/*`; `docs/roadmap/phase7l-b-beta-remediation.md`; `docs/product/modula-beta-feature-manifest.md`
- Backend dependency: None.
- Fix strategy: Commit and push the audit-only checkpoint, then keep repair work in later commits.
- Verification command: `git status --short`; `git rev-parse HEAD`; `git rev-parse origin/main`; `CI=true pnpm verify:phase7l-a`
- Live verification: `origin/main` contains `6459087863dd087e303d2eb8fe74ac27df558877`.
- Status: PASS_LIVE

### P7LB-P0-002 - Production Identity

- Severity: P0
- Feature/domain: Production identity / Release
- Symptom: Public web/API are behind source main.
- Root cause: Production web/API are intentionally pinned to `2ef3755082b46e49fe62424e93d4a4de9c6f1e17` while source has moved past it.
- Source files: `scripts/write-web-version.mjs`; `scripts/verify-web-build.mjs`; `scripts/verify-phase7e-web-production-cutover.mjs`; `scripts/verify-phase7i-f5-auth-foundation.mjs`
- Backend dependency: API and worker version envelopes.
- Fix strategy: After P0/P1 repairs, build and deploy only the exact fixed `PHASE7L_B_SHA`, then verify web/API/worker version agreement.
- Verification command: `pnpm build:web`; `pnpm verify:web-build`; `curl -fsS https://modula.digital/version.json`; `curl -fsS https://api.modula.digital/version.json`
- Live verification: Public web/API/worker report the exact `PHASE7L_B_SHA`.
- Status: OPEN

### P7LB-P0-003 - Password Login Handoff

- Severity: P0
- Feature/domain: Password login API / Auth
- Symptom: API password login creates a real session, but browser submit-to-Home handoff is not proven.
- Root cause: Phase 7L-A had API proof only; browser crawl was unauthenticated and web session persistence is memory-only.
- Source files: `src/auth/screens/SignInScreen.tsx`; `src/auth/runtime/SessionProvider.tsx`; `src/auth/storage/WebPersistentSessionStorage.ts`; `src/data/repositories/api/ApiAuthRepository.ts`; `services/greenfield-api/src/sessions/service.ts`
- Backend dependency: `POST /v1/sessions`; `GET /v1/accounts/me`; mail security alert queue.
- Fix strategy: Repair canonical web storage, then add browser E2E proving password login, `/v1/accounts/me`, Home transition, reload restore, logout, and re-login.
- Verification command: `CI=true MODULA_TEST_DATABASE_URL=<disposable> MODULA_DATABASE_ADMIN_URL=<disposable-admin> pnpm verify:phase7l-b:auth`
- Live verification: Fresh private browser on `https://modula.digital/sign-in` reaches Home after password submit and remains authenticated after reload.
- Status: PASS_LOCAL

### P7LB-P0-004 - Email OTP Login Handoff

- Severity: P0
- Feature/domain: Email OTP login API / Auth
- Symptom: API OTP login creates a real session, but browser OTP completion and reload restore are not proven.
- Root cause: Phase 7L-A had API challenge proof only; browser crawl lacked controlled OTP entry and persistent web session storage.
- Source files: `src/auth/screens/SignInScreen.tsx`; `src/auth/runtime/SessionProvider.tsx`; `src/auth/storage/WebPersistentSessionStorage.ts`; `src/data/repositories/api/ApiAuthRepository.ts`; `services/greenfield-api/src/auth/challenges/service.ts`; `services/greenfield-api/src/sessions/service.ts`
- Backend dependency: `POST /v1/sessions/email-code/request`; `POST /v1/sessions/email-code`; `GET /v1/accounts/me`.
- Fix strategy: Repair web storage and add controlled OTP browser E2E with correct challenge handoff and reload restore.
- Verification command: `CI=true MODULA_TEST_DATABASE_URL=<disposable> MODULA_DATABASE_ADMIN_URL=<disposable-admin> pnpm verify:phase7l-b:auth`
- Live verification: Fresh private browser completes OTP sign-in, reaches Home, reloads to Home, and leaves no usable session after logout.
- Status: PASS_LOCAL

### P7LB-P0-005 - Wrong Password UI

- Severity: P0
- Feature/domain: Wrong password / Auth
- Symptom: API returns `INVALID_CREDENTIALS`, but browser wrong-password no-session behavior is not proven.
- Root cause: Phase 7L-A validated the backend error domain but did not run authenticated browser failure-state proof; the frontend API decoder also rejected the backend `INVALID_CREDENTIALS` code as unknown.
- Source files: `src/auth/screens/SignInScreen.tsx`; `src/api/contracts/ApiError.ts`; `src/api/decoding/decodeApiEnvelope.ts`; `src/data/repositories/api/ApiAuthRepository.ts`; `services/greenfield-api/src/auth/errors.ts`; `services/greenfield-api/src/authentication/service.ts`; `services/greenfield-api/src/sessions/service.ts`
- Backend dependency: `POST /v1/sessions`.
- Fix strategy: Add browser E2E asserting exact password-domain error and no stored/restored session.
- Verification command: `CI=true MODULA_TEST_DATABASE_URL=<disposable> MODULA_DATABASE_ADMIN_URL=<disposable-admin> pnpm verify:phase7l-b:auth`
- Live verification: Public browser shows the correct wrong-password error and `/v1/accounts/me` remains unauthenticated.
- Status: PASS_LOCAL

### P7LB-P0-006 - Wrong OTP UI

- Severity: P0
- Feature/domain: Wrong OTP / Auth
- Symptom: API returns `CHALLENGE_INVALID`, but browser wrong-OTP no-session behavior is not proven.
- Root cause: Phase 7L-A validated backend challenge errors but did not run controlled browser OTP failure proof; the frontend API decoder also lacked the backend challenge error codes.
- Source files: `src/auth/screens/SignInScreen.tsx`; `src/auth/screens/VerifyEmailScreen.tsx`; `src/api/contracts/ApiError.ts`; `src/api/decoding/decodeApiEnvelope.ts`; `src/data/repositories/api/ApiAuthRepository.ts`; `services/greenfield-api/src/auth/challenges/service.ts`; `services/greenfield-api/src/auth/errors.ts`
- Backend dependency: `POST /v1/sessions/email-code`; challenge state tables.
- Fix strategy: Add browser E2E asserting exact OTP-domain error and no persisted session.
- Verification command: `CI=true MODULA_TEST_DATABASE_URL=<disposable> MODULA_DATABASE_ADMIN_URL=<disposable-admin> pnpm verify:phase7l-b:auth`
- Live verification: Public browser rejects wrong OTP, does not enter Home, and does not persist credentials.
- Status: PASS_LOCAL

### P7LB-P0-007 - Logout

- Severity: P0
- Feature/domain: Logout / Auth
- Symptom: API logout revokes current session, but browser credentials removal and protected-route denial after logout are not proven.
- Root cause: Browser storage was memory-only, Phase 7L-A did not exercise logged-in logout, API CORS did not allow browser `DELETE`, and the web client sent `Content-Type: application/json` on empty DELETE requests.
- Source files: `src/auth/runtime/SessionProvider.tsx`; `src/auth/runtime/useSessionActions.ts`; `src/auth/storage/WebPersistentSessionStorage.ts`; `src/data/repositories/api/ApiAuthRepository.ts`; `src/api/client/ApiClient.ts`; `src/api/client/requestHeaders.ts`; `services/greenfield-api/src/app/register-plugins.ts`; `services/greenfield-api/src/sessions/service.ts`
- Backend dependency: `DELETE /v1/sessions/current`; `GET /v1/accounts/me`.
- Fix strategy: Make logout clear the canonical web session store and prove protected routes reject after logout/reload.
- Verification command: `CI=true MODULA_TEST_DATABASE_URL=<disposable> MODULA_DATABASE_ADMIN_URL=<disposable-admin> pnpm verify:phase7l-b:auth`
- Live verification: Public browser logout removes credentials, redirects/gates protected routes, and prevents reload restore.
- Status: PASS_LOCAL

### P7LB-P0-008 - Web Reload Restore

- Severity: P0
- Feature/domain: Reload restore on web / Auth/session
- Symptom: Web login cannot survive hard reload.
- Root cause: Audit root cause was `createSessionStorage` choosing `WebMemorySessionStorage`, which stored the token bundle only in process memory.
- Source files: `src/auth/storage/createSessionStorage.ts`; `src/auth/storage/WebPersistentSessionStorage.ts`; `src/auth/storage/SessionStorage.ts`; `src/auth/runtime/SessionProvider.tsx`; `src/auth/runtime/SessionRefreshCoordinator.ts`
- Backend dependency: `POST /v1/sessions/refresh`; `GET /v1/accounts/me`; session revocation state.
- Fix strategy: Implement one documented canonical web session persistence model, restore through `/v1/accounts/me`, clear on expiry/revoke/logout, and avoid duplicate stores.
- Verification command: `CI=true MODULA_TEST_DATABASE_URL=<disposable> MODULA_DATABASE_ADMIN_URL=<disposable-admin> pnpm verify:phase7l-b:auth`
- Live verification: Public browser password login reaches Home, hard reload stays on Home, and `/v1/accounts/me` succeeds.
- Status: PASS_LOCAL

### P7LB-P0-009 - Web Cold Browser Restore

- Severity: P0
- Feature/domain: Cold browser restore on web / Auth/session
- Symptom: Web login cannot survive browser restart while the session is still valid.
- Root cause: Session material has no durable web persistence mechanism.
- Source files: `src/auth/storage/createSessionStorage.ts`; `src/auth/storage/WebPersistentSessionStorage.ts`; `src/auth/runtime/SessionProvider.tsx`; `src/auth/runtime/AccessTokenStore.ts`; `src/data/repositories/api/ApiAuthRepository.ts`
- Backend dependency: Session refresh endpoint and session expiry/revocation checks.
- Fix strategy: Persist the selected web session bundle with explicit security contract, load it during bootstrap, refresh safely, and clear on invalid session.
- Verification command: `CI=true MODULA_TEST_DATABASE_URL=<disposable> MODULA_DATABASE_ADMIN_URL=<disposable-admin> pnpm verify:phase7l-b:auth`
- Live verification: Close/reopen browser context with persisted state, load `https://modula.digital/`, and reach authenticated Home while session remains valid.
- Status: PASS_LOCAL

### P7LB-P0-010 - Password Reset Browser Proof

- Severity: P0
- Feature/domain: Password reset / Auth
- Symptom: API password reset works with a valid recovery token, but browser reset flow is not proven.
- Root cause: Phase 7L-A reset proof used DB-token audit path, not a full browser journey.
- Source files: `src/auth/screens/ForgotPasswordScreen.tsx`; `src/auth/screens/ResetPasswordScreen.tsx`; `src/data/repositories/api/ApiAuthRepository.ts`; `services/greenfield-api/src/accounts/recovery.ts`; `services/greenfield-api/src/mail/service.ts`
- Backend dependency: Recovery token generation, reset endpoint, and mail delivery queue.
- Fix strategy: Add controlled browser reset acceptance, preserving exact error domains and session state.
- Verification command: `CI=true MODULA_E2E_RESET_EMAIL=<controlled> pnpm verify:phase7l-b`
- Live verification: Public reset link flow changes password, rejects old password, accepts new password, and creates a usable session.
- Status: OPEN

### P7LB-P0-011 - Email Verification Browser Proof

- Severity: P0
- Feature/domain: Email verification / Auth
- Symptom: API email verification works, but browser verify-email journey and session handoff are not proven.
- Root cause: Phase 7L-A validated API challenge semantics only.
- Source files: `src/auth/screens/CreateAccountScreen.tsx`; `src/auth/screens/VerifyEmailScreen.tsx`; `src/data/repositories/api/ApiAuthRepository.ts`; `services/greenfield-api/src/accounts/service.ts`; `services/greenfield-api/src/auth/challenges/service.ts`; `services/greenfield-api/src/mail/service.ts`
- Backend dependency: Register, resend verification, verify email, and challenge replay protection.
- Fix strategy: Add controlled browser registration/verification proof with replay and wrong-code checks.
- Verification command: `CI=true MODULA_E2E_REGISTER_EMAIL=<controlled> pnpm verify:phase7l-b`
- Live verification: Public browser verifies email, creates/uses the session only after valid verification, and rejects wrong/replayed codes.
- Status: OPEN

### P7LB-P0-012 - Native iOS Build

- Severity: P0
- Feature/domain: Native iOS build / Native
- Symptom: Native is classified incomplete because Linux audit host cannot run `xcodebuild` or simulator.
- Root cause: Required Mac build/simulator evidence is absent.
- Source files: `ios/Modula.xcworkspace`; `ios/Podfile`; `app.config.ts`; `package.json`; `scripts/verify-phase7j-mac.mjs`
- Backend dependency: Public Greenfield API for simulator golden path.
- Fix strategy: Sync Mac source to fixed main, install dependencies/pods, run xcodebuild, launch simulator, and capture golden path evidence.
- Verification command: `xcodebuild -workspace Modula.xcworkspace -scheme Modula -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build`
- Live verification: Mac evidence shows `BUILD SUCCEEDED` and simulator screenshots for login, Home, Stories, post/reaction/comment, drawer, profile, settings, Product Hub, Vault Notes, logout, and re-login.
- Status: OPEN

## P1 Register

### P7LB-P1-001 - Auth UI Public Routes

- Severity: P1
- Feature/domain: Auth UI public routes / Auth UI
- Symptom: Login/register/forgot/verify routes rendered but emitted React hydration/runtime `#418` during the Phase 7L-A crawl.
- Root cause: Header overflow controls rendered nested web pressables (`button` inside `button`) through `ChromeOverflowMenu` -> `ModulaMenu` -> `ModulaIconButton`; tab routes also rendered desktop rail markup on the first client render while static HTML used the unknown-width mobile bar.
- Source files: `src/platform/ui/menus/chrome-overflow-menu.tsx`; `src/platform/ui/navigation/platform-tabs.web.tsx`; `src/components/primitives/AppIcon.tsx`; `src/platform/ui/motion/section-enter.tsx`; `src/platform/ui/refresh/pull-action-tray.tsx`; `tests/phase7l-b-public-routes.test.ts`
- Backend dependency: None for render; auth endpoints for golden path proof.
- Fix strategy: Use a visual-only overflow icon inside the menu pressable, keep web tab rail/bar first render server-compatible until hydration, and add a localhost-only API fixture boundary so route rendering can be verified without local-origin CORS noise.
- Verification command: `pnpm build:web`; `CI=true pnpm verify:phase7l-b:hydration`
- Live verification: Fresh browser loads `/sign-in`, `/register`, `/forgot-password`, and `/verify-email` with hydration warnings/errors/pageerrors equal to zero.
- Status: PASS_LOCAL

### P7LB-P1-002 - Public Icon Font

- Severity: P1
- Feature/domain: Public icon font / Rendering
- Symptom: Public unauthenticated routes needed icon font/tofu verification.
- Root cause: Audit risk was font-backed Ionicons, but live public crawl found `Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf` served with no tofu matches.
- Source files: `src/components/primitives/AppIcon.tsx`; `src/platform/ui/refresh/pull-action-tray.tsx`
- Backend dependency: Static web asset serving.
- Fix strategy: Keep font load covered in Phase 7L-B static asset/hydration verifier and migrate direct icon usage only if authenticated/native proof reveals defects.
- Verification command: `CI=true pnpm verify:phase7l-b`
- Live verification: Public route crawl records font HTTP 200, correct MIME, and square/tofu count zero.
- Status: PASS_LIVE

### P7LB-P1-003 - Authenticated Icon Rendering

- Severity: P1
- Feature/domain: Authenticated icon rendering / Rendering
- Symptom: Authenticated Home/Activity/Profile/Product Hub icon rendering is not proven.
- Root cause: Phase 7L-A public crawl redirected protected routes to sign-in, so authenticated icon surfaces were not exercised.
- Source files: `src/components/primitives/AppIcon.tsx`; `src/components/primitives/IconButton.tsx`; `src/features/activity/screens/ActivityScreen.tsx`; `src/features/modules/screens/ProductHubMarketplaceScreen.tsx`; `src/features/profile/screens/UnifiedProfileScreen.tsx`
- Backend dependency: Auth session for protected route access.
- Fix strategy: After session persistence, run authenticated browser and native route crawl checking missing glyphs/tofu/font failures.
- Verification command: `CI=true MODULA_E2E_EMAIL=<controlled> MODULA_E2E_PASSWORD=<redacted> pnpm verify:phase7l-b`
- Live verification: Authenticated public browser has zero missing glyphs or font failures on Home, Activity, Profile, Settings, Product Hub, and Vault Notes.
- Status: OPEN

### P7LB-P1-004 - Media Rendering

- Severity: P1
- Feature/domain: Media rendering / Media/API
- Symptom: API-hosted image returns HTTP 200 but Chrome blocks it as `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`.
- Root cause: Media endpoint responded from `api.modula.digital` with `Cross-Origin-Resource-Policy: same-origin` while web origin is `modula.digital`.
- Source files: `services/greenfield-api/src/app/media-response.ts`; `services/greenfield-api/src/app/register-routes.ts`; `services/greenfield-api/src/app/register-phase7f-stories-routes.ts`; `services/greenfield-api/tests/phase7l.media-headers.test.ts`; `services/greenfield-api/tests/phase6s.social.test.ts`; `services/greenfield-api/tests/phase7i.f5-stories.test.ts`
- Backend dependency: Media file serving, authorization, CORS/CORP/CSP headers.
- Fix strategy: Successful post and Story media responses now emit `Cross-Origin-Resource-Policy: same-site` and `Cache-Control: private, no-store`, preserving route authorization and existing narrow CORS origins.
- Verification command: `pnpm --filter @modula/greenfield-api exec vitest run tests/phase7l.media-headers.test.ts tests/phase7c.media-storage.test.ts`
- Live verification: Public browser renders API media from `https://api.modula.digital/v1/media/...` with CORS/CORP/CSP/mixed-content failures equal to zero.
- Status: PASS_LOCAL

### P7LB-P1-005 - Browser Runtime Hydration

- Severity: P1
- Feature/domain: Browser runtime / Web runtime
- Symptom: Production public routes logged React hydration/runtime error `#418`.
- Root cause: Two deterministic web mismatches were isolated locally: nested button markup in header overflow menus, and tab-route width-dependent markup (`rail` vs `bar`) before hydration.
- Source files: `src/platform/ui/menus/chrome-overflow-menu.tsx`; `src/platform/ui/navigation/platform-tabs.web.tsx`; `tests/phase7l-b-public-routes.test.ts`; `playwright.config.ts`; `scripts/serve-web-dist.mjs`
- Backend dependency: None for public render; auth/session for authenticated hydration route.
- Fix strategy: Remove invalid nested pressable HTML, delay desktop rail selection until after hydration, and keep a browser console/pageerror gate over public routes.
- Verification command: `pnpm build:web`; `CI=true pnpm verify:phase7l-b:hydration`
- Live verification: Fresh browser loads `/`, `/sign-in`, `/register`, `/profile`, `/settings`, `/marketplace`, and Vault Notes with `pageerror=0`, hydration warnings `0`, and React `#418=0`.
- Status: PASS_LOCAL

### P7LB-P1-006 - Home Feed

- Severity: P1
- Feature/domain: Home / Home/feed
- Symptom: Home renders with defects; media fails and authenticated reload proof is missing.
- Root cause: API media is blocked by CORP and the session persistence defect prevents protected/authenticated Home proof.
- Source files: `src/features/feed/screens/HomeFeedScreen.tsx`; `src/features/feed/FeedPostRow.tsx`; `src/features/social/components/social-post.tsx`; `src/data/repositories/api/ApiPostRepository.ts`; `services/greenfield-api/src/domains/posts/repository.ts`
- Backend dependency: Feed/posts/media endpoints.
- Fix strategy: Repair auth persistence and media headers, then prove Home load, reload, feed scroll, and zero critical console errors.
- Verification command: `CI=true MODULA_E2E_EMAIL=<controlled> MODULA_E2E_PASSWORD=<redacted> pnpm verify:phase7l-b`
- Live verification: Authenticated public Home renders posts/media and survives reload with console critical errors equal to zero.
- Status: OPEN

### P7LB-P1-007 - Stories

- Severity: P1
- Feature/domain: Stories rail/create/view/delete / Stories
- Symptom: Stories API lifecycle exists but browser/native media viewer proof is incomplete.
- Root cause: Protected/authenticated story surfaces were not exercised in Phase 7L-A and story media uses the same cross-origin media path class.
- Source files: `src/features/presence/data/useStoriesRailQuery.ts`; `src/features/presence/components/PresenceStoriesRail.tsx`; `src/features/presence/screens/StoryCreateScreen.tsx`; `src/features/presence/screens/StoryViewerScreen.tsx`; `services/greenfield-api/src/domains/stories/service.ts`; `services/greenfield-api/src/app/register-phase7f-stories-routes.ts`
- Backend dependency: Story create/view/seen/delete/privacy/report endpoints and story media serving.
- Fix strategy: Add controlled two-account story browser proof after media headers and session restore are fixed.
- Verification command: `pnpm --filter @modula/greenfield-api test -- phase7i.f5-stories`; `CI=true pnpm verify:phase7l-b`
- Live verification: Public browser creates a story, sees thumbnail/full media, reloads viewer, advances next/previous, records seen state, and deletes/reports according to policy.
- Status: PASS_LOCAL

### P7LB-P1-008 - Text Posts

- Severity: P1
- Feature/domain: Text post create/edit/delete / Posts
- Symptom: Backend text post lifecycle exists but browser UI proof is incomplete.
- Root cause: Phase 7L-A did not run logged-in composer/feed/post detail flows with two accounts.
- Source files: `src/features/feed/screens/HomeFeedScreen.tsx`; `src/features/feed/data/useCreatePostMutation.ts`; `src/features/feed/data/useUpdatePostMutation.ts`; `src/features/feed/screens/PostDetailScreen.tsx`; `services/greenfield-api/src/domains/posts/writes.ts`; `services/greenfield-api/src/domains/posts/repository.ts`
- Backend dependency: Posts create/read/edit/delete authorization.
- Fix strategy: Add two-account browser/API proof for create, read, edit own, delete own, denial for other account, and reload persistence.
- Verification command: `pnpm --filter @modula/greenfield-api test -- phase6s.social`; `CI=true pnpm verify:phase7l-b`
- Live verification: Two public accounts complete text post CRUD with correct authorization and persistence.
- Status: PASS_LOCAL

### P7LB-P1-009 - Image Posts

- Severity: P1
- Feature/domain: Image post create/render / Posts/media
- Symptom: Image posts can publish but web render is broken.
- Root cause: API media URL is canonical HTTPS but blocked by cross-origin response policy.
- Source files: `src/features/feed/data/useCreatePostMutation.ts`; `src/features/social/components/post-body.tsx`; `src/features/social/components/media-post-card.tsx`; `services/greenfield-api/src/domains/media/post-media-storage.ts`; `services/greenfield-api/src/domains/posts/writes.ts`
- Backend dependency: Media upload/storage and `/v1/media/:fileName`.
- Fix strategy: Fix media headers and prove upload -> storage -> API reference -> browser render -> refresh -> other authorized account render.
- Verification command: `pnpm --filter @modula/greenfield-api test -- phase7c.media-storage`; `CI=true pnpm verify:phase7l-b`
- Live verification: Controlled public image post renders for author and authorized second account after reload.
- Status: PASS_LOCAL

### P7LB-P1-010 - Reactions

- Severity: P1
- Feature/domain: Reactions Like/Love/Laugh/Fire / Social
- Symptom: API transitions work but browser reaction UI proof is incomplete.
- Root cause: Phase 7L-A did not exercise logged-in reaction controls and exact count transitions in browser.
- Source files: `src/features/social/components/reaction-control.tsx`; `src/features/social/components/post-actions.tsx`; `src/features/feed/data/useLikePostMutation.ts`; `services/greenfield-api/src/domains/reactions/service.ts`; `packages/greenfield-contracts/src/reaction.ts`
- Backend dependency: Reactions table/service and notification side effects.
- Fix strategy: Prove one active reaction per `(actor,target)` across Like -> Love -> Laugh -> Fire -> none with exact counts.
- Verification command: `pnpm --filter @modula/greenfield-api test -- phase6s.social`; `CI=true pnpm verify:phase7l-b`
- Live verification: Public two-account reaction flow has exact counts and no fake-success UI.
- Status: PASS_LOCAL

### P7LB-P1-011 - Comments And Replies

- Severity: P1
- Feature/domain: Comments/replies / Social
- Symptom: API comments/replies work with defects, but browser UI proof is incomplete.
- Root cause: Phase 7L-A did not exercise logged-in comment create/edit/delete/reply/pagination/reaction/report flows.
- Source files: `src/features/social/data/useCommentsQuery.ts`; `src/features/social/components/comment-preview.tsx`; `src/features/feed/screens/PostDetailScreen.tsx`; `services/greenfield-api/src/domains/comments/service.ts`; `packages/greenfield-contracts/src/comment.ts`
- Backend dependency: Comments service, replies, reactions, reports, notifications.
- Fix strategy: Add two-account API/browser tests for comment/reply lifecycle and authorization.
- Verification command: `pnpm --filter @modula/greenfield-api test -- phase6s.social`; `CI=true pnpm verify:phase7l-b`
- Live verification: Public browser proves create, edit own, delete own, reply, paginate, react, report, deny other edit, and reload.
- Status: PASS_LOCAL

### P7LB-P1-012 - Follows

- Severity: P1
- Feature/domain: Follows / Social
- Symptom: API follow/unfollow exists but browser proof is incomplete.
- Root cause: Phase 7L-A did not exercise authenticated profile follow controls and resulting feed/notification effects.
- Source files: `src/features/profile/data-query/useFollowProfileMutation.ts`; `src/features/profile/components/ProfileActions.tsx`; `src/features/profile/screens/ProfileConnectionsScreen.tsx`; `services/greenfield-api/src/domains/profiles/writes.ts`; `services/greenfield-api/src/domains/profiles/repository.ts`
- Backend dependency: Follow relationship persistence and notifications.
- Fix strategy: Prove follow, unfollow, counts, notification, feed effect, and self-follow denial.
- Verification command: `pnpm --filter @modula/greenfield-api test -- phase6s.social`; `CI=true pnpm verify:phase7l-b`
- Live verification: Two public accounts complete follow/unfollow with exact counts and no self-notification.
- Status: PASS_LOCAL

### P7LB-P1-013 - Notifications Activity

- Severity: P1
- Feature/domain: Notifications/activity / Activity
- Symptom: Activity route redirected during unauthenticated crawl; logged-in notification surface is not proven.
- Root cause: Auth/session persistence defect blocked authenticated browser proof.
- Source files: `src/features/activity/data/useActivityQuery.ts`; `src/features/activity/screens/ActivityScreen.tsx`; `services/greenfield-api/src/domains/notifications/repository.ts`; `services/greenfield-worker/src/notifications/create.ts`; `services/greenfield-worker/src/notifications/social.ts`
- Backend dependency: Notification repository, worker social notifications, security/module notification events.
- Fix strategy: Prove follow, reaction, comment, reply, repost, security, and module notifications with no self-notification and correct targets.
- Verification command: `pnpm --filter @modula/greenfield-worker test -- phase7e.notifications`; `CI=true pnpm verify:phase7l-b`
- Live verification: Public browser Activity shows expected notifications and navigates to correct targets.
- Status: PASS_LOCAL

### P7LB-P1-014 - Bookmarks Saved

- Severity: P1
- Feature/domain: Bookmarks/saved / Social
- Symptom: API saved/bookmark behavior exists but browser persistence proof is incomplete.
- Root cause: Phase 7L-A did not exercise authenticated save/unsave and saved surface after reload/logout/login.
- Source files: `src/features/feed/data/useSavePostMutation.ts`; `src/features/saved/data/useSavedPostsQuery.ts`; `src/features/saved/screens/SavedPostsScreen.tsx`; `services/greenfield-api/src/domains/saves/service.ts`
- Backend dependency: Saves/bookmarks persistence and post visibility checks.
- Fix strategy: Prove bookmark, reload, logout/login, Saved visibility, and unbookmark.
- Verification command: `pnpm --filter @modula/greenfield-api test -- phase6s.social`; `CI=true pnpm verify:phase7l-b`
- Live verification: Public browser saved post persists across reload and re-login, then disappears after unbookmark.
- Status: PASS_LOCAL

### P7LB-P1-015 - Repost

- Severity: P1
- Feature/domain: Repost / Social
- Symptom: API repost behavior exists but browser proof is incomplete.
- Root cause: Phase 7L-A did not exercise logged-in repost/share controls.
- Source files: `src/features/feed/data/useRepostMutation.ts`; `src/features/feed/postActions/runPostAction.ts`; `src/features/feed/postActions/catalog.ts`; `services/greenfield-api/src/domains/quotes/service.ts`; `packages/greenfield-contracts/src/repost.ts`
- Backend dependency: Repost/quote persistence and notification side effects.
- Fix strategy: Prove repost, unrepost if supported, share action behavior, counts, notification, and authorization.
- Verification command: `pnpm --filter @modula/greenfield-api test -- phase6s.social`; `CI=true pnpm verify:phase7l-b`
- Live verification: Public two-account flow shows repost/share results and notification without fake success.
- Status: PASS_LOCAL

### P7LB-P1-016 - Block Mute Report

- Severity: P1
- Feature/domain: Block/mute/report / Moderation
- Symptom: API enforcement works with defects, but browser/profile/feed/story/comment/search enforcement proof is incomplete.
- Root cause: Phase 7L-A did not run full two-account moderation browser acceptance.
- Source files: `src/features/feed/postActions/runPostAction.ts`; `src/features/feed/postActions/catalog.ts`; `src/features/profile/components/ProfileActions.tsx`; `services/greenfield-api/src/domains/moderation/repository.ts`; `services/greenfield-api/src/domains/policy/engine.ts`
- Backend dependency: Moderation repository, policy engine, search/feed/story filters.
- Fix strategy: Prove server-side block enforcement, separate mute behavior, and persistent reports for profile/post/comment/story.
- Verification command: `pnpm --filter @modula/greenfield-api test -- phase6.security`; `CI=true pnpm verify:phase7l-b`
- Live verification: Public two-account flow verifies block, unblock, mute, report, direct-ID denial/filtering, and no fake toast-only success.
- Status: PASS_LOCAL

### P7LB-P1-017 - Discover

- Severity: P1
- Feature/domain: Discover people/posts/modules / Discover/search
- Symptom: Discover renders but has dense/runtime defects and partial block-policy proof.
- Root cause: Phase 7L-A public crawl did not prove authenticated result correctness, pagination, failures, or block filtering.
- Source files: `src/features/discover/screens/DiscoverScreen.tsx`; `src/features/discover/data/useDiscoverQuery.ts`; `src/data/repositories/api/ApiDiscoverRepository.ts`; `services/greenfield-api/src/domains/discovery/repository.ts`; `services/greenfield-api/src/domains/search/service.ts`
- Backend dependency: Discovery/search repository and visibility policy.
- Fix strategy: Prove real people/posts/modules search, loading, empty, pagination, failure, and block policy; remove fake surfaces from beta if needed.
- Verification command: `pnpm --filter @modula/greenfield-api test -- phase7e.search-platform`; `CI=true pnpm verify:phase7l-b`
- Live verification: Public browser Discover shows only real content or honest Coming Soon states and respects block policy.
- Status: PASS_LOCAL

### P7LB-P1-018 - Search Recent Saved

- Severity: P1
- Feature/domain: Search recent/saved / Search
- Symptom: Search recent/saved persistence and browser UI proof are incomplete.
- Root cause: Phase 7L-A did not run authenticated search journeys.
- Source files: `src/features/product/screens/UniversalSearchScreen.tsx`; `src/features/feed/components/HomeSearchModal.tsx`; `src/data/repositories/api/ApiDiscoverRepository.ts`; `services/greenfield-api/src/domains/search/repository.ts`; `services/greenfield-api/src/domains/search/service.ts`
- Backend dependency: Search documents, recent/saved search persistence, visibility policy.
- Fix strategy: Prove people/posts/modules search with recent/saved state, loading, empty, pagination, failures, and block policy.
- Verification command: `pnpm --filter @modula/greenfield-api test -- phase7e.search-platform`; `CI=true pnpm verify:phase7l-b`
- Live verification: Public authenticated browser search returns real results, persists recent/saved state, and filters blocked content.
- Status: OPEN

### P7LB-P1-019 - Profile Owner Public

- Severity: P1
- Feature/domain: Profile owner/public / Profile
- Symptom: Owner/public profile proof is incomplete; owner route redirected during unauthenticated crawl.
- Root cause: Auth/session defect blocked protected profile verification.
- Source files: `src/features/profile/screens/UnifiedProfileScreen.tsx`; `src/features/profile/components/ProfileHero.tsx`; `src/features/profile/tabs/PostsProfileTab.tsx`; `src/features/profile/tabs/MediaProfileTab.tsx`; `src/data/repositories/api/ApiProfileRepository.ts`; `services/greenfield-api/src/domains/profiles/repository.ts`
- Backend dependency: Profile, follow counts, post/media/module/link profile data.
- Fix strategy: Prove avatar, name, handle, bio, counts, Posts, Media, About, Modules, Links, Focus Halo, and reload behavior.
- Verification command: `CI=true MODULA_E2E_EMAIL=<controlled> MODULA_E2E_PASSWORD=<redacted> pnpm verify:phase7l-b`
- Live verification: Public browser validates owner and second-account profile views with media/avatar fallbacks.
- Status: OPEN

### P7LB-P1-020 - Edit Profile

- Severity: P1
- Feature/domain: Edit profile / Profile
- Symptom: Edit profile persistence proof is incomplete.
- Root cause: Phase 7L-A did not exercise authenticated profile editing and reload.
- Source files: `src/features/profile/screens/EditProfileScreen.tsx`; `src/features/profile/data-query/useUpdateProfileMutation.ts`; `src/features/profile/storage/validateProfilePresentation.ts`; `services/greenfield-api/src/domains/profiles/writes.ts`
- Backend dependency: Profile update service and validation.
- Fix strategy: Prove edit persistence for avatar/name/handle/bio/links/surface preferences where beta-visible.
- Verification command: `CI=true MODULA_E2E_EMAIL=<controlled> MODULA_E2E_PASSWORD=<redacted> pnpm verify:phase7l-b`
- Live verification: Public browser edits controlled profile, reloads, and second account sees expected permitted changes.
- Status: OPEN

### P7LB-P1-021 - Composer Text Photo

- Severity: P1
- Feature/domain: Composer text/photo / Composer
- Symptom: Composer text/photo UI proof is incomplete and media render is blocked.
- Root cause: Phase 7L-A did not run authenticated composer flow; photo path depends on the CORP media repair.
- Source files: `src/features/feed/screens/HomeFeedScreen.tsx`; `src/features/feed/data/useCreatePostMutation.ts`; `src/platform/ui/camera/mediaCapture.ts`; `src/platform/ui/camera/presentMediaSourceMenu.ts`; `services/greenfield-api/src/domains/posts/writes.ts`; `services/greenfield-api/src/domains/media/post-media-storage.ts`
- Backend dependency: Post create and media upload/storage.
- Fix strategy: Prove text and photo create, failure handling, reload persistence, and other-account render.
- Verification command: `pnpm --filter @modula/greenfield-api test -- phase7c.media-storage`; `CI=true pnpm verify:phase7l-b`
- Live verification: Public browser creates text/photo posts and renders the photo after refresh.
- Status: PASS_LOCAL

### P7LB-P1-022 - Composer Poll GIF Tools

- Severity: P1
- Feature/domain: Composer poll/GIF/tools / Composer
- Symptom: Visible composer tools are misleading if they are not beta-ready.
- Root cause: Phase 7L-A classified partial/planned composer affordances as visible without full backend proof.
- Source files: `src/features/feed/screens/HomeFeedScreen.tsx`; `src/data/repositories/api/ApiToolsRepository.ts`; `src/features/feed/postActions/catalog.ts`; `docs/product/modula-beta-feature-manifest.md`
- Backend dependency: Tool registry only where real; no fake poll/GIF execution.
- Fix strategy: Gate non-beta-ready tools to `COMING_SOON` or hide internal/test-only actions; keep text/photo real.
- Verification command: `CI=true pnpm verify:phase7l-b`
- Live verification: Public composer exposes only working text/photo actions or honest disabled Coming Soon controls with no fake success.
- Status: OPEN

### P7LB-P1-023 - Product Hub Route

- Severity: P1
- Feature/domain: Product Hub route / Product Hub
- Symptom: Product Hub is protected in public crawl and shows duplicate/misleading entries when authenticated/API-inspected.
- Root cause: UI consumed registry rows/release rows without a canonical beta classification or installability projection.
- Source files: `services/greenfield-api/src/modules/beta-catalogue-policy.ts`; `services/greenfield-api/src/modules/registry-service.ts`; `services/greenfield-api/tests/phase7l.product-hub-policy.test.ts`; `packages/greenfield-module-registry-contracts/src/registry.ts`; `src/data/repositories/api/ApiModuleRepository.ts`; `src/data/repositories/contracts/ModuleRepository.ts`; `src/features/modules/components/ModuleCatalogueCard.tsx`; `src/features/modules/components/ModuleStatusPill.tsx`
- Backend dependency: Registry modules/releases/installations/install preview.
- Fix strategy: Add deterministic beta classification and installability projection to registry summaries/details, hide non-beta duplicate/internal/test fixture records from normal Product Hub registry output, and dedupe contradictory UI status pills.
- Verification command: `pnpm --filter @modula/greenfield-api exec vitest run tests/phase7l.product-hub-policy.test.ts`; `pnpm typecheck`; `pnpm lint`
- Live verification: Public authenticated Product Hub shows one coherent card per beta product and no duplicate stale records.
- Status: PASS_LOCAL

### P7LB-P1-024 - Canonical Vault Notes Product

- Severity: P1
- Feature/domain: Product Hub canonical Vault Notes / Product Hub
- Symptom: Canonical Vault Notes is published/installable but UI lifecycle copy can imply unavailable.
- Root cause: Duplicate stale identity and UI-side status recomputation created contradictory badges/buttons.
- Source files: `services/greenfield-api/src/modules/beta-catalogue-policy.ts`; `services/greenfield-api/src/modules/registry-service.ts`; `src/data/repositories/api/ApiModuleRepository.ts`; `src/features/modules/components/ModuleCatalogueCard.tsx`; `src/features/modules/components/ModuleStatusPill.tsx`
- Backend dependency: Module detail, install preview, installation state, release selection.
- Fix strategy: Registry emits `CANONICAL_PRODUCT` and `installability.status=available` for published `digital.modula.vault-notes`; frontend decodes that projection and displays non-duplicated human status copy.
- Verification command: `pnpm --filter @modula/greenfield-api exec vitest run tests/phase7l.product-hub-policy.test.ts`; `pnpm typecheck`; `pnpm lint`
- Live verification: Public Product Hub shows Vault Notes as Available/Installed/Update/Unavailable exactly once, with coherent details.
- Status: PASS_LOCAL

### P7LB-P1-025 - Stale Vault Notes Duplicate

- Severity: P1
- Feature/domain: Product Hub stale Vault Notes duplicate / Product Hub
- Symptom: Registry exposes both `digital.modula.vault-notes` and stale duplicate `modula.module.vaultNotes`.
- Root cause: Legacy/placeholder module identities were not classified away from beta UI/search/install surfaces.
- Source files: `services/greenfield-api/src/modules/beta-catalogue-policy.ts`; `services/greenfield-api/src/modules/registry-service.ts`; `services/greenfield-api/tests/phase7l.product-hub-policy.test.ts`; `src/data/repositories/api/ApiModuleRepository.ts`
- Backend dependency: Registry records, search projections, install preview.
- Fix strategy: Classify `modula.module.vaultNotes` as `DUPLICATE` with canonical replacement `digital.modula.vault-notes` and hide it from normal beta registry listing/detail/version catalogue.
- Verification command: `pnpm --filter @modula/greenfield-api exec vitest run tests/phase7l.product-hub-policy.test.ts`; `pnpm typecheck`
- Live verification: Public Product Hub, registry search, module detail, search, and install paths expose only canonical Vault Notes.
- Status: PASS_LOCAL

### P7LB-P1-026 - Vault Notes Install Enable

- Severity: P1
- Feature/domain: Vault Notes install/enable / Vault Notes
- Symptom: Install/enable can work but async lifecycle state remains unclear in UI proof.
- Root cause: Phase 7L-A observed async install polling stuck initially and later enabled state only in targeted API proof.
- Source files: `src/features/marketplace/screens/ModuleDetailScreen.tsx`; `src/features/modules/hooks/useModuleQueries.ts`; `services/greenfield-api/src/modules/installation-service.ts`; `services/greenfield-api/src/modules/lifecycle-service.ts`; `services/greenfield-api/src/modules/runtime-access.ts`
- Backend dependency: Module installations, lifecycle jobs, health/views.
- Fix strategy: Prove install -> enable -> open -> health/views using disposable DB first and controlled production account later.
- Verification command: `MODULA_TEST_DATABASE_URL=<disposable> MODULA_DATABASE_MIGRATOR_URL=<disposable-admin> CI=true pnpm verify:phase7e-vault-notes`
- Live verification: Controlled production account installs/enables Vault Notes and opens module host without contradictory status.
- Status: PASS_LOCAL

### P7LB-P1-027 - Vault Notes Note List

- Severity: P1
- Feature/domain: Vault Notes note list / Vault Notes
- Symptom: Record list after enable returns `200`, but module UI note list proof is incomplete.
- Root cause: Phase 7L-A did not run authenticated module-host browser proof after enable.
- Source files: `src/features/modules/runtime/module-host.tsx`; `src/features/modules/runtime/module-view-renderer.tsx`; `src/features/modules/hooks/useModuleQueries.ts`; `services/greenfield-api/src/modules/record-service.ts`; `services/greenfield-api/src/modules/view-service.ts`
- Backend dependency: Module records, views, runtime access.
- Fix strategy: Prove enabled Vault Notes lists existing records, empty state, search/filter/sort, and reload.
- Verification command: `MODULA_TEST_DATABASE_URL=<disposable> MODULA_DATABASE_MIGRATOR_URL=<disposable-admin> CI=true pnpm verify:phase7e-vault-notes`
- Live verification: Public browser opens Vault Notes and lists/searches records for controlled account.
- Status: PASS_LOCAL

### P7LB-P1-028 - Vault Notes Create Note

- Severity: P1
- Feature/domain: Vault Notes create note / Vault Notes
- Symptom: Audit create-note attempt returned `400 VALIDATION_FAILED` because required `body` was missing.
- Root cause: Phase 7L-A payload did not satisfy Vault Notes schema, so final CRUD lifecycle remains unproven.
- Source files: `src/features/modules/runtime/module-view-renderer.tsx`; `src/features/modules/hooks/useModuleQueries.ts`; `services/greenfield-api/src/modules/record-service.ts`; `scripts/verify-phase7e-vault-notes-lifecycle.mjs`; `scripts/phase7e-vault-notes-verifier-utils.mjs`
- Backend dependency: Module record create/update/delete/archive/restore/settings/search.
- Fix strategy: Update lifecycle verifier and browser flow to use schema-correct note payloads including `body`.
- Verification command: `MODULA_TEST_DATABASE_URL=<disposable> MODULA_DATABASE_MIGRATOR_URL=<disposable-admin> CI=true pnpm verify:phase7e-vault-notes`
- Live verification: Controlled production account creates, reads, updates, deletes, archives, restores, searches, disables/enables, uninstall keepData, reinstalls, and recovers records.
- Status: PASS_LOCAL

### P7LB-P1-029 - Search Generated Modules

- Severity: P1
- Feature/domain: Search generated modules / Product Hub
- Symptom: Quarantined generated search modules are visible in registry output.
- Root cause: Test/internal/quarantined generated module records were not excluded from beta Product Hub/search/install catalogue.
- Source files: `services/greenfield-api/src/modules/beta-catalogue-policy.ts`; `services/greenfield-api/src/modules/registry-service.ts`; `services/greenfield-api/tests/phase7l.product-hub-policy.test.ts`; `services/greenfield-api/tests/phase7e.search-platform.test.ts`; `services/greenfield-worker/src/search/module-projector.ts`; `services/greenfield-worker/src/search/module-release-projector.ts`
- Backend dependency: Registry/search projections and quarantine classifications.
- Fix strategy: Classify `digital.modula.search-*` generated records as `TEST_ONLY`, hide them from normal beta registry listing/detail/version catalogue, and tombstone generated fixture module/release search documents instead of indexing active beta search results.
- Verification command: `pnpm --filter @modula/greenfield-api exec vitest run tests/phase7l.product-hub-policy.test.ts`; `pnpm --filter @modula/greenfield-api exec vitest run tests/phase7e.search-platform.test.ts`; `pnpm --filter @modula/greenfield-worker test`; `pnpm typecheck`
- Live verification: Public Product Hub, registry search, global search, install preview, and release catalogue omit generated search fixtures from beta UI.
- Status: PASS_LOCAL

### P7LB-P1-030 - Module Host Declarative States

- Severity: P1
- Feature/domain: Module host declarative states / Module runtime
- Symptom: Module host declarative rendering states are not browser-proven.
- Root cause: Authenticated module host was not reached in Phase 7L-A browser crawl.
- Source files: `src/features/modules/runtime/module-host.tsx`; `src/features/modules/runtime/module-view-renderer.tsx`; `src/features/modules/components/SchemaSettingsRenderer.tsx`; `services/greenfield-api/src/modules/view-service.ts`; `services/greenfield-api/src/modules/contribution-service.ts`
- Backend dependency: Module views, records, settings schema, contributions.
- Fix strategy: Prove declarative route/widget/settings/search/event surfaces where beta-supported, with unavailable/quarantined states honest.
- Verification command: `MODULA_TEST_DATABASE_URL=<disposable> MODULA_DATABASE_MIGRATOR_URL=<disposable-admin> CI=true pnpm verify:phase7e-module-runtime-2`
- Live verification: Public authenticated module host opens canonical Vault Notes views and handles unavailable/quarantined states without crash or fake success.
- Status: PASS_LOCAL

### P7LB-P1-031 - Module Runtime Health

- Severity: P1
- Feature/domain: Module runtime health / Module runtime
- Symptom: Runtime 2 verifier is not final because disposable DB URL is missing and production is behind main.
- Root cause: Test environment and live deployment failures were separated correctly but not yet resolved.
- Source files: `scripts/verify-phase7e-module-runtime-2.mjs`; `scripts/phase7e-module-runtime-2-verifier-utils.mjs`; `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`; `services/greenfield-api/src/modules/runtime2-service.ts`
- Backend dependency: Disposable PostgreSQL acceptance DB and later production deployment identity.
- Fix strategy: Provision isolated Postgres, apply migrations pending `[]`, run Runtime 2 with zero DB skips, then repeat live after fixed SHA deploy.
- Verification command: `MODULA_TEST_DATABASE_URL=<disposable> MODULA_DATABASE_MIGRATOR_URL=<disposable-admin> CI=true pnpm verify:phase7e-module-runtime-2`
- Live verification: After deploy, Runtime 2 reports `SOURCE_FAILURE=0`, `TEST_ENV_FAILURE=0`, and `LIVE_DEPLOYMENT_FAILURE=0`.
- Status: PASS_LOCAL

### P7LB-P1-032 - Modula Mail Settings

- Severity: P1
- Feature/domain: Modula Mail settings / Mail
- Symptom: Settings could misrepresent mailbox/provisioner state.
- Root cause: Mail provisioner is disabled while identity state can be queued/adoption-required/active, and UI proof is incomplete.
- Source files: `src/features/settings/screens/SettingsExtraScreens.tsx`; `src/features/settings/screens/AccountScreen.tsx`; `services/greenfield-api/src/mail/identity-service.ts`; `services/greenfield-api/src/mail/service.ts`
- Backend dependency: Mail identity/provisioning/forwarding jobs and transactional mail.
- Fix strategy: Preserve real transactional mail, show true identity/provisioner state, and avoid implying active mailbox when provisioner is disabled.
- Verification command: `CI=true pnpm verify:phase7l-b`
- Live verification: Public Settings displays true Modula Mail identity state and transactional verification/OTP/reset/security alert mail still sends.
- Status: OPEN

### P7LB-P1-033 - Security Center Sessions

- Severity: P1
- Feature/domain: Security Center sessions / Security
- Symptom: Security route renders publicly, but real sessions/recent activity controls are not fully proven.
- Root cause: Phase 7L-A did not exercise authenticated sessions list/revoke and gated controls.
- Source files: `src/features/settings/screens/SettingsExtraScreens.tsx`; `src/features/settings/screens/AccountSessionsScreen.tsx`; `src/app/settings/account/sessions.tsx`; `src/data/repositories/api/ApiAuthRepository.ts`; `services/greenfield-api/src/auth/security-events/service.ts`; `services/greenfield-api/src/sessions/service.ts`
- Backend dependency: Account sessions, revoke endpoints, security events.
- Fix strategy: Prove visible rows are real or hidden/gated; verify sessions list, revoke, recent activity, and route navigation.
- Verification command: `CI=true MODULA_E2E_EMAIL=<controlled> MODULA_E2E_PASSWORD=<redacted> pnpm verify:phase7l-b`
- Live verification: Public authenticated Security Center loads real sessions/recent activity and hides/gates unready controls.
- Status: OPEN

### P7LB-P1-034 - Passkeys

- Severity: P1
- Feature/domain: Passkeys / Security/auth
- Symptom: Passkey product affordance is incomplete and cannot be treated as beta-ready without hardware/native/browser proof.
- Root cause: Backend step-up/passkey readiness exists, but production UI and Apple/web association acceptance are not fully proven.
- Source files: `services/greenfield-api/src/auth/passkeys/service.ts`; `services/greenfield-api/src/auth/passkeys/rp.ts`; `src/features/settings/screens/SettingsExtraScreens.tsx`; `src/auth/screens/SignInScreen.tsx`; `docs/validation/phase7l-a-static-assets.md`
- Backend dependency: Passkey service, relying-party configuration, AASA/webcredentials, security mail.
- Fix strategy: Gate passkeys honestly as Coming Soon unless full registration/login/revoke proof exists.
- Verification command: `CI=true pnpm verify:phase7l-b`
- Live verification: Public UI either hides/gates passkeys as Coming Soon or proves passkey setup/login/revoke on supported hardware with evidence.
- Status: OPEN

### P7LB-P1-035 - TOTP

- Severity: P1
- Feature/domain: TOTP / Security/auth
- Symptom: TOTP setup/verification/recovery-code flow is not beta-proven.
- Root cause: Backend TOTP services exist but browser UI journey is incomplete/gated.
- Source files: `services/greenfield-api/src/auth/mfa/totp.ts`; `services/greenfield-api/src/auth/mfa/recovery-codes.ts`; `services/greenfield-api/src/auth/step-up/policy.ts`; `src/features/settings/screens/SettingsExtraScreens.tsx`
- Backend dependency: TOTP credentials, step-up challenges, recovery codes, security events/mail.
- Fix strategy: Gate TOTP/recovery codes honestly unless browser setup, verify, disable, and recovery-code evidence is captured.
- Verification command: `CI=true pnpm verify:phase7l-b`
- Live verification: Public UI either hides/gates TOTP as Coming Soon or proves setup/verify/disable/recovery-code lifecycle with evidence.
- Status: OPEN
