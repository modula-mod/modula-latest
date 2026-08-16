# Phase 7M-B6 — Direction M refined

Direction M remains: **Dense Social OS + Native Editorial + Spatial chrome only where useful**.

B5 was promising and not approved. B6 matures the Product Hub and overlay architecture. It does not start 7M-C and does not deploy production.

## Visual direction

Content hierarchy instead of container hierarchy.

Product Hub is an editorial marketplace, not a registry:

- Featured hero (exceptional)
- Compact product rows (workhorse)
- Horizontal shelves
- Curated collections
- Category tiles only in search browse

Module Detail is a continuous product page:

- Identity + Install
- Preview
- What’s New
- Privacy & Access
- Trust & Technical Details (secondary)

Cards are reserved for media and grouped interactive content.

## Siren.uix social reference (founder)

Founder directed B6 to match [@siren.uix](https://www.instagram.com/siren.uix) — specifically the LinkedIn app redesign carousel [DSjlMDlks24](https://www.instagram.com/p/DSjlMDlks24/?img_index=1) (Home / Notifications / Network).

Adapted into Modula — not a LinkedIn clone:

- Muted page canvas with white grouped cells (Home posts, Activity rows, Start a post)
- 48px circular identity, name + meta stack, trailing overflow
- Outline action counts; accent only on the verb (Follow, Like when selected, unread dot)
- Discover people rows with a single rounded Follow control

Product Hub stays editorial. This does not start 7M-C.

## Overlay invariant

Every actionable Modula sheet:

```
HEADER   stable
BODY     independently scrolls
FOOTER   fixed above safe area
```

The primary CTA never lives at the end of an unbounded ScrollView.

When a sheet is open, shell navigation recedes (`setShellChromeHoldObscure`).

Structured header/footer sheets present through the same `ModulaSheet` primitive as an RN Modal so footer and compact Install buttons receive taps. Expo BottomSheet remains for simple sheets, with `'half' | 'full'` snap points only.

Hub Install opens `/marketplace/[id]?install=1`. The detail screen presents the sheet immediately from declared permissions and hydrates `installPreview` in the background.

## Production

## Search

Option 2, explicit state machine:

```
IDLE_LARGE_HEADER → COMPACT_HEADER → SEARCH_EXPANDING → SEARCH_ACTIVE → SEARCH_RESULTS
                 ↘ CANCEL → SEARCH_COLLAPSING ↗
```

Web prioritises focus, Escape, and keyboard over identical motion.

## Production

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
```

Vault Notes candidate identity remains `digital.modula.vault-notes` / `1.1.0` / `modula-mod/modula-vault-notes`. Production `0.2.0` is unchanged.

## Density pass (B6 follow-up)

Developer Tools remains the density reference (eyebrow / display / body / section lists / icons) — not a licence to copy its gradient card onto product screens.

Canonical chrome:

- `PageIntro` for page-level eyebrow + body when the native title already owns the name
- `SectionHeader` for section lists (Product Hub re-exports it as `HubSectionHeader`)
- `CoverAtmosphere` / `HubAtmosphere` for paper/ink scene art when there is no photograph

Applied to Profile, Board, Settings, Product Hub, Discover, Activity, module detail, and empty states. Accent stays a verb. No 7M-C whole-app rollout.
