# Phase 7I-F5 Source Baseline

Date: 2026-08-11
Captured at: 2026-08-11T13:17:25Z
Repo: `/root/modula-latest`
Host context: VPS/root shell

## Verdict

`BASELINE_CAPTURED_WITH_VALIDATED_DIRTY_TREE`

This document records the current source state before Phase 7I-F5 authentication schema/domain work. It does not authorize production build, public cutover, registration opening, native acceptance, or mainline convergence.

The checkout had pre-existing dirty work before this F5 baseline was created. That dirty work was validated with the available Checkpoint B gates and should be committed as a preservation slice before any schema migration or authentication-domain restructuring begins.

## Required SHA Values

```text
MAIN_SHA=dbc4bbfa73f1f87b502a9d59fbd76fdb28f0d6c7
PRODUCTION_ALPHA_SHA=0f9708bbaa1896e438dc3a9f5b28ec6d1327c353
MAC_SHA=3fe04860677ad032b92c7282a5dd1ce3336fc45f
VPS_HEAD=0f9708bbaa1896e438dc3a9f5b28ec6d1327c353
```

## VPS Source Commands

Commands run:

```sh
cd /root/modula-latest
git status --short
git branch --show-current
git fetch origin --prune --tags
git rev-parse HEAD
git rev-parse origin/main
git rev-parse origin/phase7i-trusted-production-alpha
git rev-parse origin/phase7i-mac-native-ui-acceptance
git merge-base HEAD origin/main
git rev-list --left-right --count HEAD...origin/main
git rev-list --left-right --count HEAD...origin/phase7i-mac-native-ui-acceptance
git rev-list --left-right --count HEAD...origin/phase7j-product-convergence
```

Recorded values:

| Item | Value |
| --- | --- |
| Local branch | `phase7i-trusted-production-alpha` |
| Local `HEAD` / `VPS_HEAD` | `0f9708bbaa1896e438dc3a9f5b28ec6d1327c353` |
| `origin/main` / `MAIN_SHA` | `dbc4bbfa73f1f87b502a9d59fbd76fdb28f0d6c7` |
| `origin/phase7i-trusted-production-alpha` / `PRODUCTION_ALPHA_SHA` | `0f9708bbaa1896e438dc3a9f5b28ec6d1327c353` |
| `origin/phase7i-mac-native-ui-acceptance` / `MAC_SHA` | `3fe04860677ad032b92c7282a5dd1ce3336fc45f` |
| `origin/phase7j-product-convergence` | `883af699ebb6b10ecd56b4ef631fab53fbad5d3d` |
| Merge base with `origin/main` | `dbc4bbfa73f1f87b502a9d59fbd76fdb28f0d6c7` |
| Ahead/behind vs `origin/main` | `15 0` |
| Ahead/behind vs `origin/phase7i-mac-native-ui-acceptance` | `0 3` |
| Ahead/behind vs `origin/phase7j-product-convergence` | `0 23` |

Interpretation:

- The VPS branch is exactly aligned with `origin/phase7i-trusted-production-alpha`.
- The VPS branch is 15 commits ahead of `origin/main`.
- The Mac-native remote branch is 3 commits ahead of the current VPS branch.
- The Phase 7J convergence remote branch is 23 commits ahead of the current VPS branch.
- Production must not be built from `origin/main` without explicit convergence because `origin/main` is older than the trusted production-alpha source.

## Mac Source Boundary

The requested Mac-local path `~/Developer/modula-latest` is not available from this VPS shell.

Checked paths:

```sh
ls -ld /root/Developer/modula-latest /home/andrei/Developer/modula-latest
```

Result: no matching local Mac checkout path was present.

Only the remote Mac branch SHA was recorded from this host:

```text
origin/phase7i-mac-native-ui-acceptance=3fe04860677ad032b92c7282a5dd1ce3336fc45f
```

Mac-local dirty state, local HEAD, and native build acceptance remain `UNPROVEN_FROM_THIS_HOST` until captured on the Mac.

## Dirty Worktree Classification

Pre-existing dirty paths observed before this F5 baseline document was added:

| Path | Classification |
| --- | --- |
| `packages/api-contracts/src/posts.ts` | social quote-post DTO expansion |
| `services/greenfield-api/src/accounts/recovery.ts` | transactional mail handle metadata for recovery mail |
| `services/greenfield-api/src/accounts/service.ts` | transactional mail handle metadata for verification/recovery mail |
| `services/greenfield-api/src/app/register-routes.ts` | Greenfield account auth bridge for social routes and viewer-aware feed hydration |
| `services/greenfield-api/src/domains/posts/repository.ts` | quote-post hydration and quote count DTO support |
| `services/greenfield-api/src/mail/contract.ts` | transactional security-alert template IDs |
| `services/greenfield-api/src/mail/service.ts` | token-only auth links and queued security-alert helpers |
| `services/greenfield-api/src/mail/templates.ts` | branded transactional email renderer |
| `services/greenfield-api/src/security/auth-context.ts` | Greenfield account token bridge to legacy social auth context |
| `src/auth/runtime/SessionProvider.tsx` | token-only verification route handoff |
| `src/auth/screens/ResetPasswordScreen.tsx` | `?t=` reset-token compatibility |
| `src/auth/screens/VerifyEmailScreen.tsx` | `?t=` verification-token compatibility |
| `docs/validation/phase7i-f-firewall-reconciliation.md` | untracked validation evidence |
| `docs/validation/phase7i-f-mail-external-acceptance.md` | untracked validation evidence |
| `docs/validation/phase7i-f-production-db-rehearsal.md` | untracked validation evidence |
| `docs/validation/phase7i-f3-email.md` | untracked validation evidence |
| `docs/validation/phase7i-f3-founder-account-reconciliation.md` | untracked validation evidence |
| `docs/validation/phase7i-f3-source-reconciliation.md` | untracked validation evidence |
| `services/greenfield-api/src/mail/components.ts` | reusable transactional email component renderer |
| `services/greenfield-api/tests/mail.templates.test.ts` | transactional email template tests |

Classification verdict: `VALIDATED_PRESERVATION_SLICE_PENDING_COMMIT`.

## Checkpoint B Preservation Gates

Commands run from `/root/modula-latest`:

```sh
CI=true pnpm lint
CI=true pnpm typecheck
CI=true pnpm --filter @modula/greenfield-api build
CI=true pnpm --filter @modula/greenfield-api test
git diff --check
CI=true pnpm verify:phase7i-canonical-source
```

Results:

| Command | Result |
| --- | --- |
| `CI=true pnpm lint` | `PASS` |
| `CI=true pnpm typecheck` | `PASS` |
| `CI=true pnpm --filter @modula/greenfield-api build` | `PASS` |
| `CI=true pnpm --filter @modula/greenfield-api test` | `PASS`; Vitest `15` files passed, `8` files skipped; `37` tests passed, `86` skipped |
| `git diff --check` | `PASS` |
| `CI=true pnpm verify:phase7i-canonical-source` | `PASS`; `1638` files scanned |

## Stop Conditions

Do not begin schema migration, passkey/TOTP/recovery-code table work, public cutover, production deployment, or mainline convergence until:

- this validated preservation slice is committed;
- Mac-local state is captured from the actual Mac checkout;
- any future production DB rehearsal uses a fresh isolated restore and records dump SHA-256;
- public/off-host acceptance items remain explicitly `BLOCKED` where no off-host proof exists.
