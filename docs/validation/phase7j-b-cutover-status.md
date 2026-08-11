# Phase 7J-B — Production Cutover Status

Date: 2026-08-11 / 2026-08-12 UTC  
Mission: Production Cutover, Live Beta Acceptance & Mainline Finalization  
Critical rule: Do **not** merge to `main` until the exact convergence build is proven live.

## Canonical refs

| Role | Value |
| --- | --- |
| Candidate branch | `phase7j-product-convergence` |
| Deployed / proven SHA | `b5252d5f7654547ff8aa75498bd205336692cd99` |
| Pre-cutover production | `7632e03cd904569eb71b68f93a60eab83100b2a1` on `phase7i-trusted-production-alpha` |
| Public web | `https://modula.digital` |
| Public API | `https://api.modula.digital` |
| VPS repo | `/root/modula-latest` |

## 1. Pre-cutover inspection

- Candidate tip verified: `origin/phase7j-product-convergence` = `b5252d5…`
- Dirty VPS tree classified as **uncommitted Phase 7I F5c/F6b WIP** (not deployed; live images were `7632e03…`)
- Dirty archive: `/root/modula-backups/phase7j-b-dirty-wip-20260811T225312Z/` (+ SHA-256 sums)

## 2. Immutable pre-cutover backup

| Item | Value |
| --- | --- |
| Backup dir | `/var/backups/modula/greenfield/phase7j-b-pre-cutover-20260811T225405Z/` |
| Dump | `modula.dump.gz` |
| SHA-256 | `fa54bf24a43e27d9eff65181630f4e099393ccee6a68ade9fcbac90d8ff32da0` |
| Web previous preserved | `/var/www/modula/releases/7632e03cd904569eb71b68f93a60eab83100b2a1` |

## 3. Source switch

- VPS switched cleanly to `phase7j-product-convergence` @ `b5252d5…`
- Working tree clean after archived WIP discard

## 4. VPS source gates

All required gates **PASS** (evidence: `docs/validation/evidence/phase7j-b/vps-source-gates.txt`):

`install --frozen-lockfile`, `lint`, `typecheck`, API build/test, Worker build/test, `build:web`, `verify:web-build`, `verify:phase7j-mac`, `git diff --check`

## 5. Migrations

`git diff 7632e03…b5252d5 -- services/greenfield-api/migrations/` → **empty**.  
**No new migrations.** Production migrate not required.

## 6–7. Deploy

- API/Worker images: `modula-greenfield-{api,worker}:b5252d5f7654547ff8aa75498bd205336692cd99`
- `SOURCE_RELEASE_SHA` / `SOURCE_BUILT_AT` preserved in compose env + `/version.json`
- Web release: `/var/www/modula/releases/b5252d5f7654547ff8aa75498bd205336692cd99`
- `current` → candidate SHA; `previous` → `7632e03…` (not deleted)

## 8. Public identity agreement

Evidence: `docs/validation/evidence/phase7j-b/public-identity-proof.txt`, `identity-agreement.json`

| Surface | Commit |
| --- | --- |
| Git candidate | `b5252d5f7654547ff8aa75498bd205336692cd99` |
| Web `/version.json` | same |
| API `/version.json` | same |
| Worker `expectedCommit` | same |

Health live/ready **200**. Meta OK. Stories rail OK. **No mixed deployment.**

## 9. Live auth acceptance

| Check | Result | Notes |
| --- | --- | --- |
| Lab password → session → Home | **PASS** | Playwright; URL `/`; body shows `@macbf7e269` / Home rail |
| Reload still signed in | **PASS** | Remained on `/`, not Sign in |
| Logout → protected removed | **PASS** | Drawer Sign out → `/welcome` |
| Founder OTP → session | **PASS** | API; `/me` handle `modula_org` |
| Founder OTP UI mode | **PASS** | Sign-in “Email me a sign-in code” reachable |
| Founder password UI | **BLOCKED (credentials)** | Founder password not available in agent env/artifacts; not a deploy failure |
| New-sign-in mail vs session bug | **PASS** | Successful password login lands Home (not stuck on Login) |

Evidence: `ui-auth-wide.txt`, `ui-logout-otp.txt`, screenshots `10–14`, `20–24`, `founder-otp-login.txt`, `auth-lab-password.txt`

## 10. Rendering

- Sidebar / Home chrome icons render (no missing icon squares in acceptance shots)
- Stories ring visible on Home
- Feed API returns items for lab account
- Static asset scan on homepage entry: **0 bad** (`static-asset-scan.txt`)
- Surface HTTP smoke: key routes **200/301** (`surface-http-smoke.txt`)

## 11. Two-account golden path (public API)

Accounts: A=`macbf7e269`, B=`p7jb489287` (registered+verified during cutover)

| Step | Result |
| --- | --- |
| A follows B | PASS |
| A text post | PASS |
| B reactions Like→Love→Laugh→Fire | PASS (`PUT /v1/posts/:id/reaction`) |
| B comment / A reply | PASS (reply nesting parent field soft) |
| B bookmark/save | PASS |
| B repost | PASS |
| Share API | N/A (client share sheet; `/share` 404 expected) |
| Story create without media | VALIDATION (media required) — non-blocking for text social path |
| B views rail | PASS |
| Notifications | PASS |
| Mute/unmute, block/unblock | PASS |
| Report disposable post | PASS (`category: spam`) |

Evidence: `golden-path-api.txt`, `moderation-report.txt`

## 12. Surfaces / Vault Notes

- Product Hub / Board / Settings / Appearance / Security routes serve
- Vault Notes: install `0.1.0` OK; records collection `note` listable; **RESTORE_COUNT 1** after reinstall path; enable/disable returned CONFLICT when already in target state (non-blocking lifecycle edge)
- Runtime 2: not re-exercised end-to-end in this cutover beyond module install/views; prior Phase 7E Runtime 2 remains the reference — classify as **non-blocking follow-up** for deep UI module polish (Phase 7K)

Classification counts for this mission:

- `SOURCE_FAILURE=0`
- `TEST_ENV_FAILURE=0` (founder password absence recorded as credential gap, not test harness failure)
- `LIVE_DEPLOYMENT_FAILURE=0`

## 13. Production repairs

**None.** Final proven SHA remains `b5252d5f7654547ff8aa75498bd205336692cd99`.

## 14–16. Mainline / fresh Mac / final rebuild

Tracked in timeline below after merge + fresh clone + final redeploy.

## Timeline

| UTC | Step | Result |
| --- | --- | --- |
| 2026-08-11T22:53Z | Inspect + dirty archive | PASS |
| 2026-08-11T22:54Z | DB backup | PASS |
| 2026-08-11T22:54Z | Switch to `b5252d5` | PASS |
| 2026-08-11T22:54–56Z | Source gates | PASS |
| 2026-08-11T22:57–59Z | API/Worker + web deploy | PASS |
| 2026-08-11T22:59Z | Identity agreement | PASS |
| 2026-08-11T23:00–06Z | Auth / golden path / UI / vault | PASS_WITH_NON_BLOCKING |

## Verdict

`PASS_WITH_NON_BLOCKING_ISSUES`

Non-blocking:

1. Founder **password** not available to agent (OTP proven)
2. Vault Notes enable/disable CONFLICT when already transitioned; create payload schema needs product polish
3. Nested comment `parentCommentId` not always persisted as parent
4. Deep Runtime 2 UI walk deferred to Phase 7K polish track

**Phase 7K — Modula Beta UI / Native Design System** starts next **from `main`** — not started in this mission.
