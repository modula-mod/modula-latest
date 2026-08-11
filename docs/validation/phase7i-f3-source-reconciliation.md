# Phase 7I-F3 Source Reconciliation

Date: 2026-08-11

Scope: VPS checkout at `/root/modula-latest`. The Mac checkout `~/Developer/modula-latest` is not available on this host; Mac-native source state must be captured on the Mac before native acceptance or mainline convergence is claimed.

## VPS Git State

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
git rev-parse origin/phase7j-product-convergence
git merge-base HEAD origin/main
git rev-list --left-right --count HEAD...origin/main
```

Recorded values:

| Item | Value |
| --- | --- |
| Local branch | `phase7i-trusted-production-alpha` |
| Local HEAD | `0f9708bbaa1896e438dc3a9f5b28ec6d1327c353` |
| `origin/main` | `dbc4bbfa73f1f87b502a9d59fbd76fdb28f0d6c7` |
| `origin/phase7i-trusted-production-alpha` | `0f9708bbaa1896e438dc3a9f5b28ec6d1327c353` |
| `origin/phase7i-mac-native-ui-acceptance` | `3fe04860677ad032b92c7282a5dd1ce3336fc45f` |
| `origin/phase7j-product-convergence` | `883af699ebb6b10ecd56b4ef631fab53fbad5d3d` |
| Merge base with `origin/main` | `dbc4bbfa73f1f87b502a9d59fbd76fdb28f0d6c7` |
| Ahead/behind vs `origin/main` | `15 0` |

Interpretation: the VPS branch is exactly aligned with `origin/phase7i-trusted-production-alpha` and is 15 commits ahead of `origin/main`. The local branch is not behind `origin/main`.

## Running Runtime Source Identity

Commands run:

```sh
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker image inspect modula-greenfield-api:e29b789-quotehydrate --format 'id={{.Id}} created={{.Created}} labels={{json .Config.Labels}}'
curl -fsS http://127.0.0.1:4020/v1/health/live
curl -fsS http://127.0.0.1:4020/v1/health/ready
curl -fsS http://127.0.0.1:4020/v1/meta
curl -k -fsS --max-time 10 https://api.modula.digital/v1/meta
```

Recorded values:

| Item | Value |
| --- | --- |
| Loopback API health | `/v1/health/live = 200`, `/v1/health/ready = 200` |
| Loopback API environment | `production` |
| Loopback registration mode | `open` |
| Loopback `emailVerificationRequired` | `true` |
| API image | `modula-greenfield-api:e29b789-quotehydrate` |
| API image ID | `sha256:c3997e38a422992e42c85d5d3e9d8de3bb5d9174d4b7db2fb8a8982af261f00e` |
| API image label revision | `e29b789-quotehydrate` |
| API image source label | `/root/modula-latest` |
| Public `https://api.modula.digital/v1/meta` | `503` |

Interpretation: the running loopback API is healthy but is not clearly built from the current Git SHA. Public API cutover is not complete because the public API endpoint still returns `503`.

## Dirty Worktree Classification

Pre-existing dirty files observed before Phase 7I-F3 edits:

| Path | Classification |
| --- | --- |
| `packages/api-contracts/src/posts.ts` | Existing social quote-post DTO work |
| `services/greenfield-api/src/app/register-routes.ts` | Existing Greenfield/social auth bridge + feed viewer work |
| `services/greenfield-api/src/domains/posts/repository.ts` | Existing quote-post hydration work |
| `services/greenfield-api/src/security/auth-context.ts` | Existing Greenfield account token bridge work |
| `docs/validation/phase7i-f-firewall-reconciliation.md` | Existing untracked validation evidence |
| `docs/validation/phase7i-f-mail-external-acceptance.md` | Existing untracked validation evidence |
| `docs/validation/phase7i-f-production-db-rehearsal.md` | Existing untracked validation evidence |

Files changed in this Phase 7I-F3 pass:

| Path | Purpose |
| --- | --- |
| `services/greenfield-api/src/mail/components.ts` | Reusable transactional-mail rendering components |
| `services/greenfield-api/src/mail/templates.ts` | Branded multipart mail renderer |
| `services/greenfield-api/src/mail/contract.ts` | Security-alert template IDs |
| `services/greenfield-api/src/mail/service.ts` | Token-only auth links and security-alert mail helpers |
| `services/greenfield-api/src/accounts/service.ts` | Pass handle metadata into verification mail |
| `services/greenfield-api/src/accounts/recovery.ts` | Pass handle metadata into password reset mail |
| `services/greenfield-api/tests/mail.templates.test.ts` | Template rendering and token-visibility tests |
| `src/auth/screens/VerifyEmailScreen.tsx` | Accept `?t=` verification links |
| `src/auth/screens/ResetPasswordScreen.tsx` | Accept `?t=` reset links |
| `src/auth/runtime/SessionProvider.tsx` | Use `?t=` in local pending-verification route |

## Source Verdict

`BLOCKED` for production source cutover.

Reasons:

- public `api.modula.digital` still returns `503`;
- loopback runtime image revision is not the current Git SHA;
- production registration is currently `open` before the new identity/passkey/security gates are complete;
- Mac checkout state was not accessible from this VPS.
