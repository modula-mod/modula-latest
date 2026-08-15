# Phase 7M-B4 — ModuleArtwork

Status: design concept only. Do not implement a second media stack. Do not use the evidence repository as a CDN.

## Why this exists

The rejected Product Hub rendered CRM, GAIA, Tasks, and Vault Notes as the same turquoise cube. A marketplace cannot share one glyph.

Apple’s 2026 App Store Creative Assets (WWDC26 session 205) separate **product identity imagery** from **screenshots**. Airbnb listings are photographs with captions, not icon tiles. Steam/Spotify shelves fail if every title uses the same cover.

## Contract (concept)

`ModuleArtwork` is a structured identity pack per product, not a random illustration.

| Slot | Required | Role | Fallback |
| --- | --- | --- | --- |
| `icon` | yes | 1:1 mark for rows, settings, notifications | Generic module mark (cube **only** here) |
| `hero` | yes for first-party; recommended for third-party | Featured / product page header | `icon` on a neutral canvas — never teal fill |
| `accentPalette` | yes | 1–3 colours for that product’s art, **not** the app accent | Neutral ink |
| `material` | optional | Gradient/paper/spatial wash **inside the artwork**, not as app chrome | None |
| `publisher` | yes | “by Modula” or third-party publisher | Publisher name as text |
| `screenshots` | optional | After install decision, not instead of hero | Omit |
| `video` | optional | Product page / featured only | Omit |

## Identity sketches (not final art)

These are inventions to stop the cube. Final art is a founder/brand task.

| Product | Module ID | Icon idea | Hero idea | Palette |
| --- | --- | --- | --- | --- |
| Vault Notes | `digital.modula.vault-notes` | Folded sheet / vault-leaf, ink on paper | Warm paper, handwriting implied, private desk light | Ivory, ink, one thin teal stitch |
| Tasks | planned | Check in a quiet list, not a clipboard clipart | Dense list in motion, calm | Graphite, paper, scarce teal |
| CRM | planned | Two overlapping nameplates | People and correspondence, photographic or illustrated | Warm grey, copper, ink |
| GAIA | planned | Atlas fragment, not a globe emoji | Map/knowledge field | Deep green-grey, night, not teal |

Gubic remains future. Do not fake a catalogue of invented products.

## Rules

- Generic cube is a **fallback**, not a brand system.
- Product Hub primary UI never shows module IDs, checksums, or “Greenfield-managed.”
- Artwork files live in product storage / release assets, not `modula-evidence-screenshots`.
- Accent palette of a module must not recolour Modula’s shell. `#369CAA` stays the OS accent, used sparsely.
- Screenshots of the hosted module are not a substitute for hero identity.

## Mapping to screens

| Screen | Slot |
| --- | --- |
| Product Hub featured | `hero` (+ optional `video`) |
| Product Hub list row | `icon` or cropped `hero` |
| Vault Notes pre-install | `hero` full viewport or editorial |
| Notifications / settings | `icon` |
| Home inline module row (Direction C) | `icon` + name, never the cube |

Trace: App Store creative assets; Airbnb photo-as-object; constitution “no raw engineering UI.”
