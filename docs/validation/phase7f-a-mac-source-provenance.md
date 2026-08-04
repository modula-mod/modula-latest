# Phase 7F-A — Mac Source Provenance

**Recorded at:** 2026-08-04 (Pass A start)  
**Workspace:** `/Users/msjoy/Developer/modula-ios-smoke/`  
**Mac branch:** `phase7f-a-mac-ios-smoke`

## Block 14 status at build time

**Completed on `origin/main`.** Remote history includes:

- `97fc3ec` — merge: consolidate Phase 7E platform into main
- `59d9fb7` — merge: complete Phase 7E Block 14 mainline and web cutover
- tip `eb0ca52` — fix: harden production web runtime resolution

No temporary Block 14 integration branch remains on the remote (only `origin/main`). Pass A therefore builds consolidated main directly. Pass B retests the same tip unless `main` advances.

## Selection priority result

| Priority | Candidate | Result |
| --- | --- | --- |
| 1 | `origin/main` with Phase 7E | **SELECTED** — contains Block 13 + Block 14 |
| 2 | Block 14 integration branch | Not present remotely |
| 3 | `origin/phase7e-block13-standard2-runtime` | Archived as tag only |

Known Block 13 checkpoint `7497ca0` is an ancestor of selected `main` (tagged `archive/pre-mainline-20260801/phase7e-block13-standard2-runtime`).

---

## 1. Main application — `modula-latest`

| Field | Value |
| --- | --- |
| Repository URL | `https://github.com/modula-mod/modula-latest.git` |
| Source branch | `origin/main` |
| Mac working branch | `phase7f-a-mac-ios-smoke` (created from `origin/main`) |
| Commit | `eb0ca524a86872e3e9a467bf5e582d06a3ce8119` |
| Commit date | Sun Aug 2 01:30:06 2026 +0100 |
| Subject | fix: harden production web runtime resolution |
| Source class | Consolidated `main` (not a temporary mainline candidate) |
| Working-tree state at selection | Clean clone at tip |

### Relevant release / archive tags (application)

| Tag | Target (at fetch) |
| --- | --- |
| `archive/pre-mainline-20260801/phase7e-block13-standard2-runtime` | `7497ca0dcf935e995e4e2478ab7736b781b89562` |
| `archive/pre-mainline-20260801/phase7e-block11-real-product-completion` | `f693ebd…` |
| `archive/pre-phase7e-main-20260801` | pre–Phase 7E mainline marker |

Tags were not modified.

---

## 2. Module Standard — `modula-module-standard`

| Field | Value |
| --- | --- |
| Repository URL | `https://github.com/modula-mod/modula-module-standard.git` |
| Branch | `main` (`origin/main`, ff-only) |
| Working commit | `2bfc0a826d19db870a445e06d52010cec6e0a54f` |
| Commit date | Sat Aug 1 23:32:10 2026 +0100 |
| Subject | merge: archive superseded modula main history |
| Release tag | `mms-v2.0.0` → `f85450d344b585bf35629abcee9a0559bde85a92` |
| Tag status | Present; **not modified** |

Standard 2 release target matches expected `f85450d344b585bf35629abcee9a0559bde85a92`.

---

## 3. Vault Notes — `modula-vault-notes`

| Field | Value |
| --- | --- |
| Repository URL | `https://github.com/modula-mod/modula-vault-notes.git` |
| Branch | `main` (`origin/main`, ff-only) |
| Working commit | `4f2c3c9ef18a862ca4f896c3f59bf2e821b38c11` |
| Commit date | Sat Aug 1 23:33:20 2026 +0100 |
| Subject | merge: consolidate Vault Notes 1.1 into main |
| Release tag | `vault-notes-v1.1.0` → `f443972d53f94b6f192a37bcce8742bdf18a99b5` |
| Tag status | Present; **not modified** |

---

## 4. Filesystem layout for relative `file:` packages

```text
/Users/msjoy/Developer/modula-ios-smoke/
├── modula-latest/          ← this app (smoke branch)
└── modula-mod/
    ├── modula-module-standard/
    └── modula-vault-notes/
```

Path probe at selection time:

| Candidate | Absolute | Exists |
| --- | --- | --- |
| `../modula-mod/modula-module-standard` | `/Users/msjoy/Developer/modula-ios-smoke/modula-mod/modula-module-standard` | yes |
| `../modula-mod/modula-vault-notes` | `/Users/msjoy/Developer/modula-ios-smoke/modula-mod/modula-vault-notes` | yes |

---

## 5. Isolation note

This workspace is separate from:

- `/Users/msjoy/Developer/modula-latest` (day-to-day checkout)
- `/Users/msjoy/Developer/modula-phase7f/` (earlier Phase 7F attempt on older commits)

No production deployment, Nginx/Hestia, release-tag, or remote-branch cleanup actions were performed from this Mac phase.
