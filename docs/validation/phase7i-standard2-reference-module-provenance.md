# Phase 7I Standard 2 Reference Module Provenance

Status: `REFERENCE_MODULE_PROVENANCE = PASS`

Date: 2026-08-09
Execution host: `core.modula.digital`
Canonical source root: `/root`
Current trust state: `IN_PLACE_REMEDIATED - NOT YET PRODUCTION ACCEPTED`

## Starting Gate

Commands run from `/root/modula-latest`:

| Check | Result |
| --- | --- |
| `git status --short` before fetch | Dirty: `package.json`, `src/api/local/routes/metaRoutes.ts` |
| `git branch --show-current` | `phase7i-trusted-production-alpha` |
| `git rev-parse HEAD` | `1ce28c422458dc024c67a45a5fb42454629679b4` |
| `git remote -v` | `origin https://github.com/modula-mod/modula-latest.git` |
| `git fetch origin --prune --tags` | Passed |
| `git status --short` after fetch | Dirty: `package.json`, `src/api/local/routes/metaRoutes.ts` |
| `systemctl --failed` | `0 loaded units listed` |
| `crontab -l || true` | `no crontab for root` |
| Active `/etc` and `/var/spool/cron` `.dbus-daemon` scan | No matches |
| `/var/tmp/.dbus-daemon` existence | Absent |
| Active `.dbus-daemon` process scan | No matches after excluding the scan commands themselves |
| Root shell/startup `.dbus-daemon` scan | No matches in `/root/.bashrc`, `/root/.profile`, `/root/.bash_profile`, `/root/.zshrc`, `/root/.ssh`, `/root/.config/systemd`, `/root/.local/share/systemd` |

The literal broad grep across `/etc /root /var/spool/cron` was started and then stopped after it produced thousands of matches from preserved incident evidence such as `/root/root-crontab-phase7h-before-20260808T202339Z.cron` and pnpm store snapshots. Those files are evidence archives, not active startup, cron, or service configuration. The targeted active-persistence checks above returned clean.

Pre-existing dirty source classification:

| Path | Classification |
| --- | --- |
| `package.json` | Pre-existing Phase 7H/7I verifier script registration: adds `verify:phase7h-registration`. Not edited by this provenance change. |
| `src/api/local/routes/metaRoutes.ts` | Pre-existing local `/meta` contract/capability adjustment. Not edited by this provenance change. |

## Why The Main Repository Expected It

Canonical `/root/modula-latest` search found the reference module in:

- `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`
- `scripts/phase7e-module-runtime-2-verifier-utils.mjs`
- `scripts/verify-phase7e-web-production-cutover.mjs`
- Block 14 documentation and screenshot evidence

The hard dependency was not declared in:

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

The original runtime test resolved:

`../modula-mod/modula-standard2-reference-module`

relative to `/root/modula-latest`, which would require `/root/modula-mod/modula-standard2-reference-module`. That repository did not exist in canonical `/root` source.

Classification: `B. integration-test fixture`.

It is not a production dependency, not a package-manager dependency, and not a production Marketplace module. It is a Standard 2 runtime acceptance fixture used to exercise dependency planning, capability projection, service/API registration, hooks, jobs, storage, UI contribution projection, service invocation, disable/re-enable, uninstall cleanup, and secret redaction.

## Old Copy Evidence

The non-canonical copy was inspected without executing package scripts:

`/home/andrei/modula-mod/modula-standard2-reference-module`

Observed metadata:

- Git repository: yes
- Worktree: clean
- Remote: none
- HEAD: `9ae68e4bf0307a693b61d98c6a5fdcebd07dc6c2`
- HEAD tree: `42420faee30254bcf57034967be3544fc28a148a`
- `git fsck --full`: no output, exit 0
- Last commits:
  - `9ae68e4 fix: align host manifest validation`
  - `acb7aa4 chore: track reference module repo hygiene`
  - `2d37b19 feat: add Standard 2 reference module`
- Package name: `@modula/standard2-reference-module`
- Package scripts: `verify`
- Dependencies: none

Source hash inventory excluding `.git`, `node_modules`, `dist`, `build`, `coverage`, `.env`, and `*.env`:

| SHA-256 | Path |
| --- | --- |
| `295aa1f18923880afebb2e08aa70a8c4f285cc52baea238b8d2864d10e45d825` | `.gitignore` |
| `4a0b5ab1c7d37ec0949179a4c5c6485b86816cffe786e3bfb860812a57eac082` | `README.md` |
| `f734c613f465d20de5a565d32186f547b97317b29af7b690326f4fa2ec604b27` | `docs/runtime-contract.md` |
| `bfd9dd863c9f8bd9d1fb1c44ae3b3145b8aaccd0d926aaa33e7cb6200833b545` | `manifest.json` |
| `793e6efc3cb1c2f35d6a57e8d771cbebafbe4cd91ba2baccbbf74b00b7406f40` | `package.json` |
| `17c814b167307942d3609c7b9d916ceddb85839573ab39baa114e30edb132a1a` | `pnpm-lock.yaml` |
| `60792eb4f712b51bbc1688e54f29c23d254b4a65de9a20d1692f891c3f5aa9e4` | `scripts/verify-reference-module.mjs` |
| `a6ebc4bc793128957fda174f078bfc66a0416bb83518d1fa53428a4cb7b7fe1d` | `src/analyze-text.mjs` |

Security keyword review of non-generated old source found only `https://modula.digital` metadata. No `child_process`, `exec`, `spawn`, `eval`, dynamic `require`, network client, filesystem write, `/tmp`, `/var/tmp`, `process.env`, or install lifecycle script usage was found in source files excluding generated and dependency directories.

Important issue: the old `dist/greenfield.manifest.json` used placeholder provenance and integrity values such as commit `0123456789abcdef0123456789abcdef01234567`, manifest SHA `aaaaaaaa...`, and release SHA `bbbbbbbb...`. The Greenfield runtime test rewrote the source commit and manifest checksum at load time. This confirms the old repo was a test fixture, not a publishable production module release.

## Canonical History Trace

`/root/modula-latest` history found the local-path expectation in:

- `eaaf16c feat: complete Phase 7E runtime and web cutover prep`
- `98d3474 docs: record phase 7e block 14 cutover evidence`

`/root/modula-mod/modula-module-standard` history found no `standard2-reference` or `modula-standard2-reference-module` occurrences.

Module Standard tags inspected:

- `mms-v2.0.0`
- `mms-v1.2.0`
- `mms-v1.1.0`
- `mms-v1.0.0`
- earlier archive tags

Module Standard has canonical fixture packages, especially `@modula/module-fixtures`, but no equivalent `digital.modula.standard2-reference` fixture. The existing Standard 2 fixture is Vault Notes oriented and does not exercise the exact Greenfield runtime gateway paths required by `phase7e.module-runtime-2.test.ts`.

## Resolution

Accepted outcome: `Outcome B - reference module should be a committed fixture inside modula-latest`.

Canonical path:

`/root/modula-latest/fixtures/modules/standard2-reference/`

Committed fixture files:

- `fixtures/modules/standard2-reference/greenfield.manifest.json`
- `fixtures/modules/standard2-reference/package.json`
- `fixtures/modules/standard2-reference/README.md`
- `fixtures/modules/standard2-reference/LICENSE-POLICY.md`
- `fixtures/modules/standard2-reference/docs/runtime-contract.md`
- `fixtures/modules/standard2-reference/scripts/verify-reference-module.mjs`
- `fixtures/modules/standard2-reference/src/analyze-text.mjs`

Host consumers updated:

- `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts`
- `scripts/phase7e-module-runtime-2-verifier-utils.mjs`

The fixture is intentionally local to the canonical app source tree. Tests no longer resolve `/home/andrei` or an unknown sibling repository. The fixture verifier runs with `node` from `/root/modula-latest` and does not require `pnpm install` inside the fixture directory.

## Final Classification

| Field | Value |
| --- | --- |
| Source origin | Independently recreated from Standard 2 contracts after reviewing the old copy as evidence only |
| Canonical repository | `modula-mod/modula-latest` |
| Canonical path | `fixtures/modules/standard2-reference/` |
| Immutable SHA | Git commit containing this fixture; record with `git rev-parse HEAD` after commit |
| Licence | `LicenseRef-Modula-First-Party-Test-Fixture` |
| Purpose | Standard 2 Greenfield runtime integration-test fixture |
| Production/test classification | Test-only, not Marketplace authority, not production runtime source |
| Dependency mechanism | Direct repository-relative fixture path inside `/root/modula-latest`; no package manager dependency |
| `/home/andrei` runtime/build/test dependency | None |

## Verification

Commands run from `/root/modula-latest`:

| Command | Result |
| --- | --- |
| `node fixtures/modules/standard2-reference/scripts/verify-reference-module.mjs` | Passed; manifest fixture SHA output `3287d161649329ae5ff01ba69cbc934158a3f8c2e70f6183b80548547105f09f` |
| `rg -n 'modula-standard2-reference-module\|/home/andrei/modula-mod/modula-standard2-reference-module' services scripts packages fixtures ops src --glob '!node_modules'` | No matches |
| `rg -n '../modula-mod/modula-standard2-reference-module\|/home/andrei/modula-mod/modula-standard2-reference-module' . --glob '!node_modules' --glob '!docs/**'` | No matches |
| `git diff --check` | Passed |
| `CI=true pnpm --filter @modula/greenfield-api exec vitest run tests/phase7e.module-runtime-2.test.ts` | Passed: 1 test passed, 4 DB integration tests skipped because `MODULA_TEST_DATABASE_URL` was not set |
| `CI=true pnpm --filter @modula/greenfield-api build` | Passed |
| `CI=true pnpm --filter @modula/greenfield-worker build` | Passed |

Aggregate verifier attempt:

| Command | Result |
| --- | --- |
| `node scripts/verify-phase7e-module-runtime-2.mjs` | Reference fixture and source checks passed, then failed on broader non-provenance gates: pnpm non-TTY module purge guard without `CI=true`, missing DB URL for isolated runtime DB verification, branch/deployment mismatch in web production cutover verifier |

The reference-module provenance gate is closed. Broader Phase 7I source self-containment, DB-backed runtime verification, deployment parity, and production rebuild gates remain pending.
