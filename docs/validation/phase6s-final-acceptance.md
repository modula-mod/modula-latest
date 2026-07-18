# Phase 6S - Final acceptance report

**Date:** 2026-07-18
**Branch:** `phase6s-social-product-completion`
**Product API:** `https://api.modula.digital`
**Base branch constraint:** do not merge Phase 6R
**Main constraint:** do not merge to `main` before PART 5 gates pass

## Environment

| Item | Value |
| --- | --- |
| VPS repository | `/home/andrei/modula-latest` |
| Greenfield API | Docker preview service, public HTTPS through nginx |
| Greenfield Worker | Docker preview worker service |
| Database | Production Greenfield PostgreSQL, migrated in place |
| Physical iPhone | Not tested in PART 4 |
| TestFlight | Not started in PART 4 |

## PART 4 Summary

| Gate | Result | Evidence |
| --- | --- | --- |
| Branch sync | PASS | `git fetch origin --prune`, `git switch phase6s-social-product-completion`, `git pull --ff-only` completed; worktree was clean before migrate/deploy |
| Install | PASS | `pnpm install --frozen-lockfile` |
| Migration status before migrate | PASS | pending `006_phase6s_social_product` before first migrate |
| Migrate | PASS | applied `006_phase6s_social_product`, `007_phase6s_backfill_counts_and_defaults`, and `008_phase6s_comment_reply_counter_consistency` |
| Migration status after migrate | PASS | applied `001` through `008`, pending `[]` |
| Controlled seed | PASS | Phase 6S preview fixtures seeded without secrets |
| Public API health | PASS | `curl -fsS https://api.modula.digital/v1/meta` returns Greenfield preview metadata |
| Live API acceptance | PASS | account, social, appearance, extension, function, privacy, and counter checks passed |
| Isolated backup restore | PASS | see `docs/validation/phase6s-backup-restore.md` |
| Extension failure isolation | PASS | plugin throw, plugin timeout, invalid function payload, and function timeout were isolated |
| Connector/tool failure isolation | NOT APPLICABLE | this branch exposes connector/tool listing routes, but no live connector/tool execution route to force a failure |
| Integrated validation | PASS | all required PART 4 verifier/build/export commands passed |

## Runtime Repair

`https://api.modula.digital/v1/meta` previously returned 502. The VPS API container was healthy on `127.0.0.1:4020`, but HTTPS traffic for `api.modula.digital` was falling through to the wrong nginx TLS vhost.

Applied a minimal host nginx repair outside the repository:

- Added `/etc/nginx/conf.d/api.modula.digital.greenfield.conf`.
- Configured TLS for `api.modula.digital` using the existing host certificate paths.
- Proxied HTTPS traffic to `http://127.0.0.1:4020`.
- Verified with `nginx -t`, `systemctl reload nginx`, and public `/v1/meta`.

Also fixed Docker runtime file ownership in the Greenfield API and Worker Dockerfiles so the non-root runtime user can load built workspace packages.

## Production API Health

| Check | Result |
| --- | --- |
| `/v1/meta` reachable over HTTPS | PASS |
| `backend` | `greenfield` |
| `environment` | `preview` |
| AT Protocol required | PASS - not required |
| AT Protocol bridge optional | PASS - `true` |
| DIMON active balances/wallets | PASS - inactive |
| Greenfield accounts/sessions/repos/extensions | PASS |

## Migration And Seed Evidence

| Check | Result |
| --- | --- |
| Existing accounts preserved | PASS |
| Existing posts preserved | PASS |
| Reaction/comment/repost/quote/save tables present | PASS |
| Appearance tables/defaults present | PASS |
| Extension catalogue seeded | PASS |
| Counts initialized correctly | PASS - 0 counter mismatches after migration and seed |
| Duplicate social rows | PASS - 0 duplicate reactions and saves in checked projections |
| Seed post fixtures | PASS - text, media, link, quote, repost, deleted |
| Seed interaction fixtures | PASS - reactions, comments, nested replies, deleted comment tombstone, notifications, saved posts |
| Seed extension/function fixtures | PASS - extension states, plugin failure example, function job examples |

Final seed verification counts included: accounts 6, auth identities 5, posts 12, Phase 6S posts 3, deleted posts 1, media posts 2, link posts 2, quote rows 1, repost rows 2, reactions 5, comments 6, nested replies 3, deleted comment tombstones 1, notifications 3, private saves 3, extension installations 3, extension failures 1, function jobs 4, and 0 counter mismatches.

## Live API Acceptance

Live acceptance suffix: `mrq8zmoi`.

| Area | Result | Evidence |
| --- | --- | --- |
| Registration | PASS | account created through live API |
| Verification | PASS | invite/admin verification path used without recording tokens |
| Sign-in | PASS | session created |
| Session refresh | PASS | session refresh succeeded |
| Password recovery/reset | PASS | reset completed without recording recovery token |
| Session revocation after reset | PASS | old access and refresh tokens returned 401; new sign-in succeeded |
| Create post | PASS | live post created |
| React | PASS | reaction inserted and counted |
| Change reaction | PASS | reaction type changed |
| Remove reaction | PASS | reaction total returned to 0 |
| Comment | PASS | top-level comment created |
| Reply | PASS | nested reply created |
| Edit comment | PASS | comment body updated |
| Delete comment | PASS | parent comment tombstoned with reply retained |
| Repost | PASS | repost created |
| Quote | PASS | quote post created |
| Save | PASS | viewer save visible only to saving user |
| Follow | PASS | follow relationship created |
| Notifications | PASS | recipient notifications present; self-notifications 0 |
| Search | PASS | expected post returned |
| Profile edit | PASS | profile update succeeded |
| Appearance `GET/PATCH /v1/accounts/me/appearance` | PASS | version advanced to 2 |
| Extension install | PASS | installation created |
| Extension enable | PASS |
| Extension disable | PASS |
| Extension uninstall | PASS |
| Function invoke | PASS | sync and queued jobs completed |
| Function cancel | PASS | queued function cancellation path recorded |
| Quoted private/unavailable content | PASS | private quoted fixture returned 404 and did not leak |
| Counter validation in PostgreSQL | PASS | reaction, like, repost, reply, and quote counters matched source rows |
| Duplicate live social rows | PASS | no duplicate reactions, saves, or reposts for the acceptance post |

## Extension Failure Isolation

Isolation suffix: `mrq88801`.

| Failure case | Result | Evidence |
| --- | --- | --- |
| Plugin throws during enable | PASS | background job completed with recorded `PLUGIN_FAILED`; installation moved to `failed` |
| Plugin times out | PASS | background job completed with recorded `PLUGIN_TIMEOUT`; installation moved to `disabled` |
| Function returns invalid payload | PASS | function job failed with `Function returned invalid payload` |
| Function exceeds timeout | PASS | function job failed with `Function timed out` |
| API readiness after failures | PASS | public `/v1/meta` remained healthy |
| Worker continuity after failures | PASS | worker processed all failure jobs and remained running |
| Safe user-facing failure state | PASS | extension/function states recorded as failed or disabled without crashing API |
| Controlled retry posture | PASS | failures recorded as terminal for the forced fixture jobs |

## Integrated Validation

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --filter @modula/greenfield-api typecheck` | PASS |
| `pnpm --filter @modula/greenfield-api test` | PASS - 5 tests passed, 31 env-gated skips |
| `pnpm --filter @modula/greenfield-api build` | PASS |
| `pnpm --filter @modula/greenfield-worker typecheck` | PASS |
| `pnpm --filter @modula/greenfield-worker test` | PASS - 4 tests passed, 2 env-gated skips |
| `pnpm --filter @modula/greenfield-worker build` | PASS |
| `pnpm verify:phase6-greenfield-backend` | PASS |
| `pnpm verify:phase6-greenfield-frontend` | PASS |
| `pnpm verify:phase6s-social-backend` | PASS |
| `pnpm verify:phase6s-social-frontend` | PASS |
| `pnpm exec expo export --platform web` | PASS - exported 100 static routes to `dist`; command exited 0 |
| `git diff --check` | PASS |

## Files Changed For PART 4

| File | Purpose |
| --- | --- |
| `docs/validation/phase6s-backup-restore.md` | Records isolated backup restore evidence |
| `docs/validation/phase6s-final-acceptance.md` | Records PART 4 VPS acceptance evidence |
| `services/greenfield-api/migrations/007_phase6s_backfill_counts_and_defaults.sql` | Backfills Phase 6S counts, social rows, appearance defaults, and extension grants |
| `services/greenfield-api/migrations/007_phase6s_backfill_counts_and_defaults.down.sql` | Reversible metadata/count fallback for migration 007 |
| `services/greenfield-api/migrations/008_phase6s_comment_reply_counter_consistency.sql` | Recomputes post/comment reply counters from active source rows |
| `services/greenfield-api/migrations/008_phase6s_comment_reply_counter_consistency.down.sql` | Recomputes projections and returns schema marker to 007 |
| `services/greenfield-api/seeds/preview-seed.ts` | Converts preview seed to non-destructive Phase 6S fixture upserts |
| `services/greenfield-api/src/domains/comments/service.ts` | Keeps reply counters consistent when tombstoning comments |
| `services/greenfield-api/src/domains/mentions/service.ts` | Avoids empty mention lookup SQL for posts/comments without mentions |
| `services/greenfield-worker/src/extensions/plugin-lifecycle.ts` | Records plugin failures and isolates throw/timeout cases |
| `services/greenfield-worker/src/functions/invoke.ts` | Adds deterministic invalid-payload and timeout function failure handling |
| `services/greenfield-worker/src/jobs/runner.ts` | Passes background job IDs into plugin lifecycle handlers |
| `ops/docker/greenfield-api.Dockerfile` | Fixes runtime ownership for non-root API container |
| `ops/docker/greenfield-worker.Dockerfile` | Fixes runtime ownership for non-root Worker container |

## PART 5 — Mac acceptance (post PART 4 handoff)

**Mac tip pulled:** `4ba1d3bc4d1abcffc261dc0d716c67f5f2a9fdfe`  
**Mac model / OS / Xcode:** Mac14,10 · macOS 27.0 (26A5378n) · Xcode 26.3 (17C529)

### Mac live API corroboration

| Check | Result |
| --- | --- |
| `GET /v1/meta` | PASS — `backend:greenfield`, `environment:preview`, `atproto:false`, `inviteOnly:true`, Greenfield accounts/sessions/repos/extensions true |
| `GET /v1/feed/home` | PASS — 200 |
| `GET /v1/extensions` | PASS — 200 |
| `GET /v1/tools` | PASS — 200 |
| Bad sign-in | PASS — 401 |

### Mac static gates

| Check | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | |
| `pnpm typecheck` | PASS | |
| `pnpm verify:theme` | PASS | |
| `pnpm verify:phase4` | PASS | |
| `pnpm verify:phase5` | PASS | |
| `pnpm verify:phase6-greenfield-backend` | PASS | |
| `pnpm verify:phase6-greenfield-frontend` | PASS | |
| `pnpm verify:phase6s-social-backend` | PASS | |
| `pnpm verify:phase6s-social-frontend` | PASS | |
| `pnpm exec expo export --platform web` | PASS | 100 routes |
| `git diff --check` | PASS | at PART 4 tip |
| `pnpm exec expo install --check` | FAIL (pre-existing) | Expo patch drift (`57.0.6` vs `~57.0.7`) — not introduced by PART 5 |
| `pnpm lint` | FAIL (pre-existing) | SkeletonBlock refs + prior liquid-glass/immutability debt |
| `pnpm verify:phase1` | FAIL (pre-existing) | Route layout / reanimated policy drift |
| `pnpm verify:phase2` | FAIL (pre-existing) | Reanimated / BlurView policy drift |
| `pnpm verify:phase3` | FAIL (pre-existing) | Route thinness / reanimated drift |

### Simulator

| Check | Result |
| --- | --- |
| Native Simulator build + install + launch | PASS |
| Home feed shows live PART 4 acceptance fixtures | PASS |
| Extension Centre / Appearance / Activity surfaces | PASS (deep-link screenshots) |
| Full interactive social checklist | NOT EXECUTED |
| Evidence | `docs/validation/phase6s-simulator-acceptance.md` + `docs/validation/phase6s-screenshots/` |

### Physical iPhone / TestFlight

| Check | Result | Evidence |
| --- | --- | --- |
| Device paired / available | FAIL / BLOCKED | `xcrun devicectl list devices` — simulated only; no physical iPhone |
| `pnpm exec expo run:ios --device` (physical) | BLOCKED | no physical destination |
| Appearance screenshot matrix (physical) | BLOCKED | |
| Release / TestFlight | BLOCKED | requires physical PASS |

## Remaining Gates

| Gate | Status |
| --- | --- |
| Physical iPhone validation | BLOCKED — no paired physical iPhone on this Mac |
| TestFlight | BLOCKED — starts only after physical iPhone PASS |
| Merge to `main` | BLOCKED — physical/TestFlight still required by Phase 6S definition of done |
| Phase 6R merge | BLOCKED by instruction — do not merge Phase 6R |
| Phase 6S PR into `phase6-greenfield-sovereign-core` | OPEN — code + PART 4 complete; physical gate still open |
