# Phase 7M-B — validation evidence & status

Aggregate status for Phase 7M-B (Semantic UI System, Flagship Reconstruction &
Real Module Installation). This records the automated gate results captured on
this branch and the manual gates that remain (they require a human-in-the-loop
simulator/browser and visual sign-off).

Branch: `cursor/phase7m-b-ui-system-module-runtime-103e`
Commit at capture: `a5a451e` (web version marker matches HEAD).

## Automated gates (captured)

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck (app + packages) | `pnpm typecheck` | PASS |
| Lint (max-warnings=0) | `pnpm lint` | PASS |
| Aggregate 7M-B verifier | `pnpm verify:phase7m-b` | PASS (source + dynamic-route + 19 platform tests) |
| Module platform suite | vitest × 4 files | 19/19 PASS |
| Web build | `pnpm build:web` | PASS (203 files, marker `a5a451e`) |
| Web build verifier | `pnpm verify:web-build` | PASS |
| Dynamic route resolver self-test | `node scripts/resolve-web-dist-file.mjs` | PASS |
| Prior-phase regression (7L-B) | `pnpm verify:phase7l-b` | PASS except auth-browser (env port conflict, see below) |

### Aggregate verifier coverage (`verify:phase7m-b`)

- **Track A structure:** canonical `ModulaIcon` registry + SVG/native adapters +
  barrel wiring; consolidated field/menu controls (`ModulaFieldShell`,
  `ModulaOTPField`, `ModulaSearchField`, `ModulaSecureField`, `ModulaPopover`);
  semantic typography aliases; expanded motion tokens (incl. reduced-motion).
- **Track B invariants:** generic Module Host has no `vault-notes` branching;
  route resolver has no vault-notes branching; client repository does not
  hardcode `'digital.modula.vault-notes'` (Phase 7E guard).
- **Dynamic route regression gate:** against the real `dist/`, direct HTTP load
  of `/module/digital.modula.vault-notes` → `module/[moduleId].html` and
  `/module/digital.modula.vault-notes/note/abc` →
  `module/[moduleId]/[...path].html`; `/` → `index.html`; `/product` resolves.
- **Module platform DB suite:** `phase7e.vault-notes-platform`,
  `phase7b.module-runtime`, `phase7e.module-runtime-2`,
  `phase7l.product-hub-policy` (19 tests) — real install → enable → edit →
  export → disable → re-enable via generic host APIs, records CRUD, settings,
  reinstall-with-keepData, account isolation, and Product Hub canonicalisation.

## Track B — Vault Notes provenance summary

Full audit: `docs/research/phase7m-b-vault-notes-provenance.md`.

- The genuinely external `modula-mod/modula-vault-notes` repo (public) declares
  `modula.vault-notes@1.1.0`; it builds, tests and self-verifies independently.
- The canonical production Product Hub product is `digital.modula.vault-notes@0.2.0`,
  whose declared source repo (`modula-mod/modula-module-vault-notes`) is **not
  currently accessible** — recorded as a maintainer follow-up.
- Identity alignment is handled at the registry/policy layer, not by editing the
  external repo. An earlier rename attempt was reverted (unlandable + broke the
  Phase 7E invariant + invented a version).

## Known environmental / pre-existing findings (not code regressions)

1. **Auth browser regression port conflict** — `verify:phase7l-b:auth` runs a
   Playwright harness that binds `127.0.0.1:4020`, but the preserved dev
   greenfield-api already listens there (mission requires preserving port 4020).
   Auth itself is healthy: `/v1/health/live` returns ok, and register /
   verify-email / sessions returned 200/201 during the platform run; the
   `phase7l.profile-update` API test passes. Re-run this gate on a host where
   4020 is free (or with `reuseExistingServer`).
2. **expo-doctor** — 18/20 checks pass. The two failures are pre-existing and
   out of scope: (a) app-config fields not synced in a non-CNG project, and
   (b) patch-level Expo package mismatches. The mission prohibits SDK/dependency
   upgrades, and this branch does not change any dependency versions.

## Defect register

See `phase7m-b-defect-register.md`. Open P0: 0. Open P1: 0.

## Manual gates still required (human-in-the-loop)

These cannot be completed by an autonomous agent without a simulator/browser and
product owner sign-off; the phase completion criterion is explicit visual
approval of the four flagship surfaces.

- **iOS build + simulator exercise** of the canonical controls, icons, Module
  Host, and Vault Notes install → CRUD flow.
- **Flagship visual approval** of Login, Home, Product Hub, and Vault Notes.
- **Flagship presentation redesign** (Authentication, Home, Product Hub) and the
  UI Lab state-matrix extension remain to be built/reviewed; they were scoped in
  this phase but require the visual review loop above.
