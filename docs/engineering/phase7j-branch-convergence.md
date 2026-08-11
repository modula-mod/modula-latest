# Phase 7J-Mac-A — Branch convergence audit

Date: 2026-08-11  
Host checkout: `/Users/msjoy/Developer/modula-latest` (fresh clone)  
Prior checkout archived: `/Users/msjoy/Developer/modula-latest-pre-7j-20260811-233335`  
Production base (verified newest accepted): `origin/phase7i-trusted-production-alpha` @ `7632e03`  
Convergence branch: `phase7j-product-convergence` @ `6c21940` (pushed)  
Do **not** merge to `main` in this phase.

Authority: semantic bring-forward only. No literal merge of every historical branch.  
Allowed decisions: `MERGE_FULL` | `CHERRY_PICK_VALID` | `ALREADY_INTEGRATED` | `SUPERSEDED` | `SECURITY_ARCHIVE_ONLY` | `ABANDON_INVALID`.

## Verified production base

| Candidate | Tip | Last activity | Verdict |
|---|---|---|---|
| `origin/phase7i-trusted-production-alpha` | `7632e03` | 2026-08-11 17:38 +0100 | **Newest accepted production** (F5 auth domain, mail readiness, release identity) |
| `origin/main` | `dbc4bbf` | 2026-08-08 22:28 +0100 | Behind production by 20 commits — **not** merge base for 7J |
| `origin/phase7j-product-convergence` (pre-Mac-A) | `883af69` | 2026-08-11 08:44 +0100 | Contained Mac-native + 7J product work but **5 commits behind** production tip |

Mac-A action: checked out existing `phase7j-product-convergence`, semantically merged `origin/phase7i-trusted-production-alpha` (`7632e03`), resolved `package.json` / `register-routes.ts` / lockfile, pushed `6c21940`.

## Remote branches (every head after `git fetch --all --prune --tags`)

| Branch | Tip SHA | Merge-base w/ production | Unique commits vs production | Last activity | Architectural generation | Unique product work? | Obsolete code? | Security concerns? | Decision |
|---|---|---|---:|---|---|---|---|---|---|
| `origin/phase7i-trusted-production-alpha` | `7632e03` | `7632e03` | 0 | 2026-08-11 | Phase 7I production-alpha (F5) | Production ops + F5 auth/mail | No | Production SMTP/roles — trust lineage only | **ALREADY_INTEGRATED** (now ancestor of 7J via merge) |
| `origin/phase7j-product-convergence` | `6c21940` | `7632e03` | 24 | 2026-08-11 | Phase 7J product + Mac native | Auth restore, social P0, motion, Product Hub honesty, F5 merge | Rejected obsolete demo auth / duplicate Identity Centre (not present) | None beyond normal review | **MERGE_FULL** (active convergence head) |
| `origin/phase7i-mac-native-ui-acceptance` | `3fe0486` | `0f9708b` | 3 (vs older 7I); 0 unique vs 7J | 2026-08-10 | Phase 7I Mac-B acceptance | UUIDv7 session repair, restore hardening, Home geometry, sticky feed, Stories honesty, SystemSwitch/test IDs | Pre-F5 tip only — not obsolete product | SecureStore/session harden — keep | **ALREADY_INTEGRATED** (all 3 commits ∈ 7J lineage) |
| `origin/main` | `dbc4bbf` | `dbc4bbf` | 0 ahead / 20 behind production | 2026-08-08 | Phase 7H live alpha | Historical mainline through 7H | Older than 7I production | Post-7H hardening already in line | **SUPERSEDED** (by 7I production + 7J; do not merge 7J→main yet) |
| `origin/cursor/setup-cloud-environment-4afb` | `e07254f` | `dbc4bbf` | 1 | 2026-08-11 | Cursor Cloud Agent bootstrap | `.cursor/environment.json`, `.cursor/install.sh` only | N/A product | Low — cloud install scripts | **CHERRY_PICK_VALID** (optional later; not required for product acceptance) |

No remote head left `UNKNOWN`.

## Decision counts (remote heads)

| Decision | Count |
|---|---:|
| MERGE_FULL | 1 |
| CHERRY_PICK_VALID | 1 |
| ALREADY_INTEGRATED | 2 |
| SUPERSEDED | 1 |
| SECURITY_ARCHIVE_ONLY | 0 |
| ABANDON_INVALID | 0 |

## Part 6 — Historical / archive refs (explicit audit)

Historical Phase 1–7A work lives as **archive tags**, not remote branches. `unique_vs_7j=0` means every commit is already an ancestor of `phase7j-product-convergence` (or the tip is behind 7J with no exclusive commits).

| Archive / historical ref | Tip | Unique vs 7J | Generation | Decision | Notes |
|---|---|---:|---|---|---|
| `archive/2026-07-21/phase1-social-shell` | `0d2de40` | 0 | Phase 1 social shell | **ALREADY_INTEGRATED** | Shell IA preserved; obsolete auth/sidebar patterns superseded later |
| `archive/2026-07-21/phase2-appearance-runtime` | `7b27386` | 0 | Phase 2 appearance | **ALREADY_INTEGRATED** | Appearance + Surface Types live on mainline/7J |
| `archive/2026-07-21/phase3-unified-profile` | `1fa3942` | 0 | Phase 3 profile | **ALREADY_INTEGRATED** | `/profile` canonical; no Identity Centre |
| `archive/2026-07-21/phase4-data-auth-runtime` | `5f19235` | 0 | Phase 4 data/auth | **SUPERSEDED** | Pre-F5 auth; F5 domain on 7I tip supersedes |
| `archive/2026-07-21/phase4-5-native-ui-recovery` | `67ca4a2` | 0 | Phase 4.5 UI | **SUPERSEDED** | Experiments folded / replaced by Mac-native + 7F/7J |
| `archive/2026-07-21/phase5-frontend-remote-acceptance` | `932b35a` | 0 | Phase 5 FE | **ALREADY_INTEGRATED** | Remote acceptance patterns in lineage |
| `archive/2026-07-21/phase5-production-backend` | `8276e5a` | 0 | Phase 5 BE | **SUPERSEDED** | Pre-Greenfield-sovereign / pre-7I runtime |
| `archive/2026-07-21/phase6-atproto-backend` | `3b777f6` | 0 | Phase 6 AT Proto BE | **SUPERSEDED** | AT Proto backend not product path |
| `archive/2026-07-21/phase6-atproto-frontend` | `7f7ece7` | 0 | Phase 6 AT Proto FE | **SUPERSEDED** | Forbidden AT Proto UI coupling — keep out |
| `archive/2026-07-21/phase6-greenfield-sovereign-core` | `955ff43` | 0 | Phase 6 Greenfield | **ALREADY_INTEGRATED** | Sovereign core in lineage |
| `archive/2026-07-21/phase6s-social-product-completion` | `c3cacd9` | 0 | Phase 6S social | **ALREADY_INTEGRATED** | Social contracts in lineage |
| `archive/2026-07-21/phase7a-greenfield-module-platform` | `190e58c` | 0 | Phase 7A modules | **ALREADY_INTEGRATED** | External module packages; no inline Vault Notes |
| `archive/pre-mainline-20260801/*` / `archive/pre-phase7e-main-20260801` | various | 0 | Phase 7B–7E era | **ALREADY_INTEGRATED** / **SUPERSEDED** | Folded into mainline; do not resurrect forks |
| `archive/pre-phase7i-local-main-20260808` | `8b57936` | 0 | Pre-7I local | **SUPERSEDED** | Evidence-only; 7I production replaces |
| `archive/2026-07-21/cursor-video-appearance-advanced-0f9c` | `4d19a1a` | 94 | Video/Appearance Advanced | **CHERRY_PICK_VALID** (patterns) / **SUPERSEDED** (branch tip) | Durable surfaces already on 7J (`ProgressiveBlurBand`, `ShellBottomProgressiveBlur`, floating tab inset, pull-action tray, sticky feed modes, Product Hub). Reject: absolute sticky Host overlays, opaque glass slabs, direct SwiftUI imports, broken bottom inset, duplicate sidebar, stale demo routes |
| `archive/2026-07-21/cursor-developer-expo-ui-lab-bae2` | `a90166a` | 2 | Expo UI Lab | **ALREADY_INTEGRATED** | Lab present under `src/platform/ui/dev/expo-ui-lab` + Settings Developer |

### Video / Appearance bring-forward vs reject

**Brought forward (already present on 7J — do not re-merge tip):**

- `ProgressiveBlurBand` / `ProgressiveBlurEdges`
- `shell-bottom-progressive-blur` / progressive blur header background
- Floating tab bar inset + liquid-glass tab bar adapters
- Home sticky feed modes (Mac-native hardened)
- Pull-action tray gesture stack
- Product Hub depth surfaces
- Stories rail (real data path preferred over dial demos)

**Rejected / do not resurrect:**

- Host chrome inside absolute sticky overlays
- Opaque slab under glass
- Direct SwiftUI imports outside `@expo/ui` adapters
- Broken bottom safe-area inset experiments from mid-iteration commits
- Duplicate sidebar / stale product demo routes from experimental Product Hub forks
- AT Proto frontend/backend branches as product sources

### Mac-native (`phase7i-mac-native-ui-acceptance`) — preserved

Inspected commits `77156e3`, `2791ba0`, `3fe0486` — all ancestors of 7J:

- Session restore hardening + Greenfield UUIDv7 session acceptance
- Drawer `runtimeEnvironment` fix
- Home geometry + sticky feed honesty
- SystemSwitch / native-control settings matrix
- Test IDs + Stories empty-state honesty
- Evidence under `docs/validation/evidence/phase7i-mac-*`

## Architecture guards (Parts 9–11)

| Guard | Status on `6c21940` |
|---|---|
| `/profile` canonical (no Identity Centre) | PASS — `UnifiedProfileScreen` et al.; docs forbid Identity Centre |
| Modules external GitHub-backed packages | PASS — no `src/features/vault-notes/` tree |
| Semantic conflict resolution on F5 merge | PASS — kept 7J Expo patches + MCP scripts; adopted F5 auth verify scripts + `MailIdentityService` imports; regenerated lockfile for otplib/webauthn/qrcode |
| No `--ours/--theirs` broad checkout | PASS |

## Lineage (post Mac-A)

```text
origin/main (dbc4bbf)                          [SUPERSEDED as product base]
  └── origin/phase7i-trusted-production-alpha (7632e03)   [production base]
        └── phase7j-product-convergence (6c21940)         [MERGE_FULL / active]
              ↑ includes phase7i-mac-native-ui-acceptance (3fe0486)
              ↑ includes prior 7J product commits (883af69…)
              ↑ merge commit brings F5 tip into 7J
```

## VPS / API access note (Mac-A clarification)

- Prefer `ssh modula-vps` for VPS access (not `root@87.106.40.136` unless alias fails).
- Optional diagnostics tunnel: `ssh -N -L 4020:127.0.0.1:4020 modula-vps`.
- Product acceptance uses public `https://api.modula.digital` only.

## Next gates

1. Source verify: lint / typecheck / web build / expo-doctor (Part 12)
2. iOS build (Parts 13–14)
3. Real API health + auth/session (Parts 15–17)
4. UI rebuild only after auth/icons/images/base build PASS
5. **Do not** merge to `main`; next ops step after acceptance is VPS deploy from this branch
