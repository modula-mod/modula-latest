# PVP Platform Phase 2 Vault Notes reference

Recorded: 2026-08-24

Repository: `modula-mod/modula-vault-notes`

Module ID: `digital.modula.vault-notes`

Release: `vault-notes-v1.2.0`

Release commit: `c62f47a468c6d33fc5412db2d30f2b5d1c0bb2ce`

Artifact SHA-256: `98489d3c145fc4768c1bb86e8f470a1e58e509d0acee62fe3324410430cff935`

## Result

Vault Notes is a standalone Module Standard 2.1 module and the first reference
extension host. Its core manifest imports no optional add-on or plugin. It owns
notes, folders/collections, tags, attachments, search, archive/restore,
settings, versioned events, typed capabilities, and 12 extension points.

The release build now removes `dist` before compiling. The release verifier
explicitly rejects stale AI output, and the packaged artifact contains no
`dist/ai` implementation.

## Source acceptance

| Gate | Result |
| --- | --- |
| Repository main equals origin/main | PASS |
| Immutable tag resolves to a 40-character commit | PASS |
| Manifest/Standard validation | PASS |
| Build and unit tests | PASS |
| Release provenance/checksum verification | PASS |
| Notes create/update/revision conflict | PASS |
| Folders, tags, search, archive/unarchive | PASS |
| Soft delete, restore, permanent delete | PASS |
| Settings and export | PASS |
| Optional AI/Voice/Formatting implementation in core | 0 |
| Declared extension points | 12 |

Command:

```text
CI=true pnpm verify
```

## Greenfield reference journey

`services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`
imports the real manifest and immutable release provenance, publishes the
release into the disposable registry, and proves:

1. install and enable Vault Notes with zero extensions;
2. open a generic Module Host composition;
3. install and enable independent Formatting, AI, and Voice releases;
4. resolve their contributions without a Vault product special case;
5. disable Formatting and observe its commands disappear while the host stays
   enabled;
6. re-enable Formatting and observe its commands return;
7. reject parent uninstall while enabled dependants remain;
8. retain an AI-owned record across uninstall/reinstall;
9. delete a Voice-owned record without deleting the core Project Atlas note;
10. return `404` when Account B requests Account A's host.

The real API/worker integration result is `4 passed`; the lower-level extension
fabric suite is `8 passed`.

## Honest boundary

The automated VPS proof exercises the actual Fastify API, PostgreSQL migration,
worker handlers, immutable manifests, and repository tests. It is not a manual
iPhone recording session or production deployment. Production registry,
database, images, and public web were not mutated.
