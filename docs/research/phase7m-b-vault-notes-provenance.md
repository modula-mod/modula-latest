# Phase 7M-B — Vault Notes source provenance & registry reconciliation

Track B, §15 (Vault Notes audit), §14 (externality). This records the audit of
the real external Vault Notes repository and how it reconciles (and where it
diverges) from the canonical Modula registry record.

## What was audited

### A. The external repository the user exposed

| Field | Value |
| --- | --- |
| Provider | GitHub |
| Repository | `modula-mod/modula-vault-notes` (public) |
| Default branch | `main`, HEAD `4f2c3c9` (`merge: consolidate Vault Notes 1.1 into main`) |
| Declared module id | **`modula.vault-notes`** |
| Declared version | **`1.1.0`** (Standard 1.2, `standardVersion 1.2.0`) |
| Release tags / assets | `vault-notes-v1.0.0`, `vault-notes-v1.1.0` (`modula-vault-notes-{ver}.tgz`) |
| `vault-notes-v1.1.0` asset sha256 | `46f918b07dc7d9c2734be4e6bb7729c137d316ceaa3f9d272da1bd7f78ad253a` |
| Licence | first-party (`LicenseRef-Modula-First-Party`) |
| Manifest sha256 | `d674b65a66bc5a671dc43ef2f8883d2faabc02b34c7c52d5c80162df9f661cfb` |

This is a genuinely external, self-contained module: its own `package.json`,
`pnpm-workspace.yaml`, `tsconfig.json`, `module.manifest.json` (Greenfield
release contract), `modula.module.json` (Standard 1.2 manifest), declarative
`src/views/*.json`, JSON Schemas under `schemas/`, and its own release tooling.
It builds, tests and self-verifies independently:

```
pnpm install && pnpm build && pnpm test   → 7/7 pass
node scripts/verify-release.mjs           → Vault Notes release verifier passed
```

Record collections: `note`, `folder`, `tag`, `note-link`, `note-version`,
`saved-source`. Views (12): home, collection, detail, editor, search,
favourites, archived, trash, folders, settings, empty, error.

### B. The canonical registry record (live production)

`GET https://api.modula.digital/v1/registry/modules/digital.modula.vault-notes`:

| Field | Value |
| --- | --- |
| Module id | **`digital.modula.vault-notes`** |
| Version | **`0.2.0`** |
| Status | `published` |
| Source repository | **`modula-mod/modula-module-vault-notes`** (note: `module-`) |
| Source commit | `54ab8edac1ba469f0081c636e11f6059d712becc` |
| Manifest path | `module.manifest.json` |

`GET .../modula.vault-notes` returns empty — the unqualified id is **not** a
production registry product.

## Divergence found (the audit finding)

The external repository that is currently accessible is **not** the same object
as the canonical production Product Hub product:

| Dimension | External repo (accessible) | Canonical registry (production) |
| --- | --- | --- |
| Module id | `modula.vault-notes` | `digital.modula.vault-notes` |
| Version | `1.1.0` | `0.2.0` |
| Source repo | `modula-mod/modula-vault-notes` | `modula-mod/modula-module-vault-notes` |

The canonical product's declared source repo, `modula-mod/modula-module-vault-notes`,
is **not currently accessible** to this agent (`gh repo view` →
"Could not resolve to a Repository"). So the exact source that produced
`digital.modula.vault-notes@0.2.0` cannot be re-derived or byte-verified here.

## How the codebase already reconciles identity (existing behaviour — preserved)

- The **client never hardcodes** the canonical id. Phase 7E guards this:
  `ApiModuleRepository.ts` must not contain `'digital.modula.vault-notes'`,
  `local-vault-note`, or `includes('vault-notes')`. The id the client installs
  and routes to comes from the registry catalogue response, not app code.
- Product Hub canonicalisation lives in
  `services/greenfield-api/src/modules/beta-catalogue-policy.ts`: it maps the
  **legacy** id `modula.module.vaultNotes` → `digital.modula.vault-notes` and
  classifies `digital.modula.vault-notes` (published) as the single
  `CANONICAL_PRODUCT`. Phase 7L (`phase7l.product-hub-policy.test.ts`) locks
  this in and passes.
- The generic Module Host has **no** Vault Notes branching; views/routes/records
  resolve from the manifest (`GET /v1/modules/:id/views`,
  `/records/:collection`). Confirmed during the 7M-B host audit.

## Decision — 7M-B2 unification (supersedes “do not mutate”)

Phase 7M-B2 eliminates the split. There is one Vault Notes:

- Product: Vault Notes
- Module ID: `digital.modula.vault-notes`
- Source: `modula-mod/modula-vault-notes`
- Legacy ID `modula.vault-notes` is an alias only
- Legacy repo `modula-module-vault-notes` is archive/redirect only

See `docs/architecture/vault-notes-canonical-identity.md`.

The earlier 7M-B attempt to invent `1.2.0` remains rejected. 7M-B2 overlays
canonical identity at import and keeps version **1.1.0**.

## Verification evidence


- `pnpm exec vitest run` on
  `phase7e.vault-notes-platform.test.ts`, `phase7b.module-runtime.test.ts`,
  `phase7e.module-runtime-2.test.ts`, `phase7l.product-hub-policy.test.ts`
  → **19 passed** against the genuine external `modula.vault-notes` checkout at
  `../modula-mod/modula-vault-notes`. This covers real install → enable → edit →
  export → disable → re-enable through the generic host APIs, records CRUD,
  settings, reinstall-with-keepData, and Product Hub canonicalisation policy.

## Open item for a maintainer

To byte-verify the canonical `digital.modula.vault-notes@0.2.0` against its
declared source, `modula-mod/modula-module-vault-notes` (commit `54ab8ed`) must
be made accessible, **or** the team should confirm whether
`modula-mod/modula-vault-notes` is the intended go-forward source and, if so,
publish a canonical `digital.modula.vault-notes` release from it through the
registry importer (which requires write access to that external repo to tag the
release). No local registry rows were left mutated: the local dev registry was
recreated clean, and automated acceptance runs against ephemeral test data.
