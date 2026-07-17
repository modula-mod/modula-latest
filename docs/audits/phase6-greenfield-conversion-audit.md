# Phase 6 → Greenfield conversion audit

**Date:** 2026-07-18  
**Base tip:** `1e419b8` (`phase6-atproto-backend`)  
**Corrective branch:** `phase6-greenfield-sovereign-core`  
**Scope:** Inventory Phase 6 work and classify for Greenfield sovereign-core conversion (Phase 6R).

## Classification legend

| Class | Meaning |
| --- | --- |
| **KEEP** | Remains core Greenfield / Modula capability |
| **RENAME** | Keep behaviour; rename to Greenfield terminology |
| **GENERALISE** | Keep mechanism; strip AT-specific naming / widen to bridges |
| **MOVE TO OPTIONAL BRIDGE** | Leave available only under Greenfield Bridges / AT Protocol |
| **REMOVE FROM CORE UI** | Must not gate accounts, onboarding, or primary product IA |
| **DEFER** | Out of Phase 6R Mac foundation / later work |

## ADR numbering note

`docs/architecture/adr/ADR-007-progressive-at-oauth-async-publication.md` already exists for the optional AT bridge. Phase 6R adds:

- `ADR-007-greenfield-sovereign-account-model.md` — authoritative account ownership (supersedes any implication that AT owns Modula identity)
- `ADR-008-greenfield-extension-kernel.md`
- `ADR-009-dimon-on-greenfield.md`

The progressive AT OAuth ADR remains valid **only** as bridge behaviour under the sovereign account model.

---

## Inventory and classification

### Sessions, auth runtime, capabilities

| Item | Location (indicative) | Class | Notes |
| --- | --- | --- | --- |
| Session tokens / refresh / storage | `src/auth/**`, `services/api` sessions | **KEEP** | Authoritative sessions become Greenfield-owned in PART 2 |
| Auth capabilities gates | `src/auth/capabilities/**` | **KEEP** | |
| Authenticated API writes | `services/api` social writers, RLS migrations | **KEEP** | |
| Local prototype account UI | `src/auth/screens/**` | **RENAME** | User-facing → Modula Account; no AT prerequisite |

### Social graph and content

| Item | Location (indicative) | Class | Notes |
| --- | --- | --- | --- |
| Profiles / profile mutations | API domains + app profile | **KEEP** | Link to `greenfield_accounts` in PART 2 |
| Posts, likes, saves, reposts | API + composer + feeds | **KEEP** | |
| Follows | API + social UI | **KEEP** | |
| Notifications | API + settings | **KEEP** | |
| Search | API + worker search | **KEEP** | |
| Blocks / mutes / reports | moderation domains | **KEEP** | |

### Worker, jobs, outbox, ops

| Item | Location (indicative) | Class | Notes |
| --- | --- | --- | --- |
| Worker service | `services/worker` | **KEEP** / **RENAME** | PART 2 → `greenfield-worker` |
| PostgreSQL job lease / retry / DLQ | worker jobs | **KEEP** | |
| Outbox drain | `services/worker/src/outbox` | **KEEP** | |
| Audit events | API audit domain | **KEEP** | |
| API validation / envelopes | api-contracts + transport | **KEEP** | |
| SSRF protection | API security | **KEEP** | Especially for bridge HTTP |
| Deployment / backups / preview compose | `ops/**`, Docker | **KEEP** | PART 2/4 rename paths |

### AT Protocol publication and indexing (generalise)

| Item | Location (indicative) | Class | Target generalisation |
| --- | --- | --- | --- |
| AT publication jobs | `services/worker/src/atproto/*`, job types `atproto.publish*` | **GENERALISE** | External bridge jobs |
| AT connection status | `atproto_connections`, UI connection status | **GENERALISE** | Bridge connection status |
| AT record indexing / ingest | `atproto/ingest.ts`, `atproto_records` | **GENERALISE** | External record indexing |
| AT publication preferences | preferences API + composer prefs | **GENERALISE** | Bridge publication preferences |
| AT publication status banners | frontend publication status | **GENERALISE** | External publication status |

### Optional bridge (move)

| Item | Location (indicative) | Class | Notes |
| --- | --- | --- | --- |
| AT OAuth (API + Expo client) | `services/api` atproto OAuth, `src/features/atproto/oauth/**` | **MOVE TO OPTIONAL BRIDGE** | Settings → Connections → External Networks → AT Protocol |
| AT account connection settings | `AtprotoConnectionScreen`, routes under `/settings/connections/atproto` | **MOVE TO OPTIONAL BRIDGE** | |
| AT record creation / put / delete on PDS | worker publish/update/delete | **MOVE TO OPTIONAL BRIDGE** | |
| AT ingestion | worker ingest | **MOVE TO OPTIONAL BRIDGE** | |
| Tap (if present) | AT-specific surfaces | **MOVE TO OPTIONAL BRIDGE** / **DEFER** | No first-class Tap product in core |
| PDS configuration / `pdsPilot` | meta capabilities, Connections PDS row | **MOVE TO OPTIONAL BRIDGE** / **DEFER** | Pilot remains deferred |
| AT-specific schemas / lexicons package | `packages/atproto-lexicons` | **MOVE TO OPTIONAL BRIDGE** | Not Greenfield schemas |
| AT-specific Composer destination | `ComposerScreen` `modula+atproto` | **MOVE TO OPTIONAL BRIDGE** | Must not be default / required |

### Remove from core UI

| Item | Location (indicative) | Class | Action in PART 1 / later |
| --- | --- | --- | --- |
| “Connect AT account” as account prerequisite | onboarding / account copy | **REMOVE FROM CORE UI** | Ensure registration/sign-in never require AT |
| AT identity as primary identity | settings / profile framing | **REMOVE FROM CORE UI** | Modula Account / Greenfield account ID + handle |
| AT publishing as default Composer option | composer defaults | **REMOVE FROM CORE UI** | Default remains Modula-only (`DEFAULT_PUBLISHING_DESTINATION`) |
| AT-specific account onboarding | auth flows | **REMOVE FROM CORE UI** | |
| Atmosphere Preview as primary product section | `DiscoverScreen` For You | **REMOVE FROM CORE UI** | Demote from Discover; may live under External Networks later |

### Packages and contracts

| Item | Class | Notes |
| --- | --- | --- |
| `@modula/api-contracts` (incl. `atproto.ts`) | **KEEP** + **GENERALISE** over time | Bridge DTOs stay until PART 2 bridge package |
| `@modula/protocol-contracts` | **KEEP** | Adapter boundary; Greenfield protocol is separate |
| `@modula/atproto-lexicons` | **MOVE TO OPTIONAL BRIDGE** | |
| `@modula/greenfield-contracts` (new) | **KEEP** | PART 1 |
| `@modula/greenfield-protocol` (new) | **KEEP** | PART 1 |
| `@modula/dimon-contracts` (new) | **DEFER** implementation / **KEEP** IDs | Prepare only |

### Backend rename (not PART 1)

| Item | Class | Notes |
| --- | --- | --- |
| `services/api` → `services/greenfield-api` | **RENAME** | **PART 2 — VPS** |
| `services/worker` → `services/greenfield-worker` | **RENAME** | **PART 2 — VPS** |
| Native Greenfield account DB migrations | **DEFER** to PART 2 | |
| Full extension runtime | **DEFER** to PART 2+ | Contracts only in PART 1 |

### Documentation

| Item | Class | Notes |
| --- | --- | --- |
| Phase 6 handoffs / validation (`docs/handoffs/phase6-*`, `docs/validation/phase6-*`) | Historical documentation | Keep; do not rewrite as product copy |
| ADR-005 AT adapter | Safe developer terminology | Still true: AT is optional |
| ADR-006 no blockchain primary DB | **KEEP** | Reinforced by Greenfield + DIMON ADRs |
| ADR-007 progressive AT OAuth | Optional bridge | Subordinate to sovereign account ADR |

---

## Grep audit summary (PART 1)

Audit command covered `src`, `ios`, `android`, `packages`, `services`, `docs` for  
`AT Protocol|atproto|Atmosphere|PDS|DID|Lexicon`.

| Bucket | Treatment |
| --- | --- |
| Core account dependency | Rewrite user-facing account/settings language to Modula Account / Greenfield / Connections / External Networks |
| Optional bridge | Leave AT Protocol implementation under Settings → Connections → External Networks → AT Protocol |
| Historical documentation | Leave Phase 6 handoffs/validation as-is |
| Protocol-specific implementation | Keep code paths; do not delete blindly |
| Safe developer terminology | Internal types, job names, packages may retain `atproto` until bridge rename |

---

## PART 1 deliverables checklist

- [x] Corrective branch `phase6-greenfield-sovereign-core` from `1e419b8`
- [x] This audit
- [x] ADR-007 / ADR-008 / ADR-009 (Greenfield / extensions / DIMON)
- [x] `@modula/greenfield-contracts`
- [x] `@modula/greenfield-protocol`
- [x] `@modula/dimon-contracts`
- [x] Core frontend account language cleanup (no AT required for Modula accounts)

**Explicitly out of PART 1:** service rename, DB migrations, full auth implementation, deploy, PR open/merge.
