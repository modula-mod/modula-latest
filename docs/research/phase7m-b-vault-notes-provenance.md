# Phase 7M-B — Vault Notes source provenance & registry reconciliation

Track B, §15 (Vault Notes audit) and §14 (externality). This records the audit
of the real external Vault Notes module repository and how its release is
reconciled into the Modula registry for Phase 7M-B install/host acceptance.

## Source repository

| Field | Value |
| --- | --- |
| Provider | GitHub |
| Repository | `modula-mod/modula-vault-notes` (public) |
| Default branch | `main` |
| Audited base commit | `4f2c3c9` (`merge: consolidate Vault Notes 1.1 into main`) |
| Existing release tags | `vault-notes-v1.0.0`, `vault-notes-v1.1.0` |
| Release assets | `modula-vault-notes-1.0.0.tgz`, `modula-vault-notes-1.1.0.tgz` |
| `vault-notes-v1.1.0` asset sha256 | `46f918b07dc7d9c2734be4e6bb7729c137d316ceaa3f9d272da1bd7f78ad253a` |
| Licence | first-party (`LicenseRef-Modula-First-Party`) — `LICENSE`, `SECURITY.md` |

The repository is a genuine external module: it carries its own
`package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `module.manifest.json`
(Greenfield release contract), `modula.module.json` (Standard 1.2 manifest),
declarative `src/views/*.json`, JSON Schemas under `schemas/`, and its own
`verify`/`release:package` tooling. It builds and tests independently
(`pnpm build && pnpm test` → 7 tests pass). Nothing about Vault Notes is
hardcoded into the host app; installation is driven from the manifest.

## Identity discrepancy found

The canonical Modula registry, Product Hub, host deep links and installed
account records are keyed on **`digital.modula.vault-notes`** (the production
registry record is `digital.modula.vault-notes`, collections `note` + `folder`,
routes under `/module/digital.modula.vault-notes`).

The external repository at the audited base commit declared its identity as
the unqualified **`modula.vault-notes`** across the Standard manifest, release
manifest, views, records, actions, functions, settings, routes and search
declarations. Left unchanged, an install from this source would register a
module whose id does not match the canonical Modula namespace, and host deep
links / account records would diverge from production.

## Resolution — release 1.2.0 (identity alignment)

A new release was prepared **in the external repository** (not by forking into
the host app and not by hardcoding) that renames the namespaced identity to
`digital.modula.vault-notes`:

- `modula.vault-notes.*` → `digital.modula.vault-notes.*` for records, views,
  actions, functions, settings, routes and search declarations.
- Record **collections keep their unqualified names** (`note`, `folder`,
  `tag`, `note-link`, `note-version`, `saved-source`) so account data written
  under a `digital.modula.vault-notes` installation is preserved and continuous
  with the production collection contract.
- `package.json`, `module.manifest.json` and `modula.module.json` bumped to
  `1.2.0`; `source.releaseTag`/`releaseAssetName` updated to the 1.2.0 asset
  names; `VAULT_NOTES_MODULE_VERSION` constant bumped.
- `module.manifest.json.integrity.manifestSha256` recomputed with the canonical
  `@modula/greenfield-module-manifest` checksum →
  `5006e15ff472ef591166da6b0288c52e8ba2757bc579a1dcb6fbd8d14cbe33b7`.
- `LICENSE-POLICY.md` added (required first-party licence evidence for registry
  import) and listed in `package.json` `files` and manifest `license.evidenceIds`.

The repo's own release gate passes on 1.2.0: `pnpm verify`
(`tsc` build + `vitest` 7/7 + `scripts/verify-release.mjs`) →
`Vault Notes release verifier passed`.

Commit prepared in the external repo:
`09067cc feat: release 1.2.0 — align canonical identity to digital.modula.vault-notes`.

> **Push blocked:** the cloud agent's GitHub identity (`cursor[bot]`) has read
> access to `modula-mod/modula-vault-notes` but not write/push
> (`403 Permission ... denied`). The 1.2.0 commit and tag therefore live in the
> local clone at `/modula-mod/modula-vault-notes` and have been imported into
> the local registry for acceptance. Pushing `main` + tagging
> `vault-notes-v1.2.0` and publishing the release asset requires a maintainer
> with write access (or an appropriately scoped token).

## Registry reconciliation (local acceptance)

Imported through the canonical importer (no `git clone`-as-install; the module
is read from its manifest and released into the registry database):

```
pnpm registry:import-module --path /modula-mod/modula-vault-notes --commit 09067cc…
  → module: digital.modula.vault-notes  version: 1.2.0
    manifest: valid  integrity: valid  licence: firstParty  trust: firstParty
    collections: 6  views: 12  release: pendingReview

pnpm registry:publish-release --module digital.modula.vault-notes --version 1.2.0
  → release status: published  catalogue status: available
    installation mode: declarative
```

Catalogue row (`greenfield_extension_catalogue`):
`digital.modula.vault-notes | 1.2.0 | active | executable=false | firstParty`.

Executable functions remain disabled until server-side handlers exist; the
module installs and renders declaratively via the generic Module Host, which is
the Phase 7M-B acceptance surface.

## Verification evidence

- `pnpm verify:phase7e-vault-notes` platform test (generic host install /
  enable / edit / export / disable / re-enable) → 2/2 pass against the external
  checkout.
- External repo `pnpm verify` → build + 7/7 tests + release verifier pass.
