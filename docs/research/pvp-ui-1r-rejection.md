# PVP-UI-1 current problems — recorded before reconstruction

**Status:** FOUNDER REJECTED — VISUAL DIRECTION NOT APPROVED  
**Recorded:** 2026-08-22  
**From:** PR #35 HEAD `8bf192a1cf7f18df728d187efe5aaa00cc44d07f`  
**Source:** founder brief + current Product Hub composition in `ProductHubMarketplaceScreen`

These failures were recorded before TSX reconstruction. They are not solved by larger corner radii, bigger type, or stretching Vault Notes artwork.

## CURRENT PROBLEMS

| # | Failure | Where it lives in PVP-UI-1 |
| --- | --- | --- |
| 01 | Search is a large grey field. It is not integrated with navigation or discovery. | `ProductHubHeader` idle block renders `ProductHubSearchChrome` as a full-width raised pill under a subtitle. |
| 02 | Discover / Installed / Updates is a second utility block immediately under search. | `ProductHubSegmentedControl` is the first child of the landing `ScrollView`. |
| 03 | Featured Vault Notes is acceptable but not editorial. Artwork and product information are separate components. | `ModuleEditorialHero`: `ProductCover`, then copy below, then a hairline identity row. |
| 04 | Almost no variation in section composition. | Featured card → row list → muted row list → shelf of identical tiles → more row lists. |
| 05 | Coming Soon looks disabled rather than intentionally upcoming. | `ComingSoonRow` → `ModuleRow muted` at 0.72 opacity; `ModuleAction` Soon at 0.45 opacity. |
| 06 | Made by Modula begins as generic rounded tiles. | `ModuleShelf` → `ModuleFeatureCard` with a 128pt rounded scene box. |
| 07 | Light interface contains too much empty white canvas without hierarchy. | Large title + description + search + segmented consume the first viewport before any story. |
| 08 | Dark mode is an inversion of the light composition, not a designed dark marketplace. | Same geometry; dark canvas in palettes is `#171717` grey slabs rather than OLED-black marketplace art direction. |
| 09 | Desktop is a phone column inside a browser. | `ResponsiveContent` maxWidth 1120 with a single stacked column. |
| 10 | Product discovery lacks richness: no editorial stories, weak collections, weak visual categories, no compelling shelves, no meaningful previews. | Collections reuse `ModuleRow`. Browse tiles are small grey/wash squares. Search idle is a thin list. |
| 11 | Insufficient native Expo / SwiftUI / Compose interaction. | Native search, bottom SearchBarSlot, and library navigation were evaluated then left as a custom utility stack. |
| 12 | The screen looks like a Product Hub prototype, not a destination people would browse. | Combined effect of 01–11. |

## What must not be the “fix”

- Bigger image in the same `[image] / copy / row` sandwich
- Larger grey search pill
- Keeping segmented control because the previous phase built it
- Fake ratings, downloads, or invented modules
- Liquid Glass on featured/content cards
- Averaging three directions into a fourth bland design
