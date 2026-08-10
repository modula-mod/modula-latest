# Phase 7I-MAC-A — UI Defect Inventory

Date: 2026-08-10  
Branch: `phase7i-mac-native-ui-acceptance`  
Before evidence: `docs/validation/evidence/phase7i-mac-a-before/`

Severity: `P0` crash/blocker · `P1` broken interaction/layout · `P2` poor product quality · `P3` polish

| ID | Sev | Screen | Screenshot | Symptom | Probable cause | Recommended component | Implementation boundary |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MAC-A-001 | P0 | Acceptance / API | — | Cannot reach private Greenfield on `127.0.0.1:4020`; public API `503 MAINTENANCE` | Mac SSH pubkey not authorized on `root@87.106.40.136` / `core.modula.digital` | N/A (ops) | Ops: authorize `~/.ssh/id_ed25519.pub`; local tunnel only — do not open 4020 publicly |
| MAC-A-002 | P1 | Stories (standalone) | `05-stories.png` | Was: `PresenceStoriesRail` returned `null` when empty | Empty guard | Honest empty copy | **Mitigated** in Checkpoint B — empty state added; no demo stories |
| MAC-A-003 | P1 | Home Stories (signed-in, unproven this session) | Pending tunnel | Historical “Stories missing” risk if query fails silently or Focus `hideNav` | Session/Focus/layout gates + empty rail | Keep Add Story stub; add loading/error chip | `HomeFeedScreen` + rail — no fixture content |
| MAC-A-004 | P2 | Home | `03-home-top.png` | “Merge Feeds · 2 sources (local Preview)” copy while runtime is remote-dev | Product Preview label for Merge feature, not `DATA_SOURCE` | Clarify copy (“Preview feature” vs data source) | `features/product` / Merge banner only |
| MAC-A-005 | P2 | Home sticky modes | — | Dual inline/sticky segmented controls — mis-measure risk | Stick Y from layout before modes | Keep `CUSTOM_TRACK` sticky; never Host | `HomeStickyFeedModes` + shared picker |
| MAC-A-006 | P2 | Settings | pending clear shot | Risk of debug-looking cards / non-native toggles (from prior 7G/7H audits) | Incomplete native list/switch adoption | `ModulaList` / `ModulaSwitch` adapters | `src/platform/ui` → settings screens |
| MAC-A-007 | P2 | Product Hub / Module detail | pending live data | App Store-like hierarchy vs flat/debug cards when API returns | Presentation density | Keep branded cards; native controls for filters | marketplace/product features via adapters |
| MAC-A-008 | P3 | Drawer | `10-drawer.png` / `nav-probe.png` | “Local prototype account” under Sign in while using remote override | Guest copy | Soften wording for remote-dev guests | drawer content / session copy |
| MAC-A-009 | P3 | Auth deep links | mixed | Dev-client deep links with `--/` path corrupted Metro URL once | Bad URL composition during audit tooling | Prefer `modula://route` | docs only |
| MAC-A-010 | P3 | Home segmented | `03-home-top.png` | Inline control reads custom-track (may be expected light theme) | Shared vs community control path | Confirm `appearance="segmented"` on device | adapter already exists |

## Non-defects observed

- Tab bar reaches screen edge; Create disc present; no black under-bar gap in Home shot.
- Offline/error card with Retry remains interactive.
- Drawer opens via `modula:///?openDrawer=1` without immediate close.
- No native crash during cold launch + guest Home.

## Blocked verification (needs MAC-A-001)

Auth invalid-credentials against real Greenfield, Stories signed-in rail, Module Host/Vault Notes, Appearance live effects across OLED/Surface Type, network reconnect recovery after tunnel stop/start.
