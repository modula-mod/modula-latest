# Phase 7M-B5 — module artwork

The turquoise cube is a **fallback**, not the visual identity of every Modula module.

B4 sketched identities. B5 requires **actual concept art**. Vault Notes must reach final-quality visual identity in this phase.

Artwork remains independent from the Modula core accent `#369CAA`.

---

## Pack contract

| Slot | Required | Role |
| --- | --- | --- |
| `icon` | yes | 1:1 mark for rows, settings, notifications |
| `hero` | Vault Notes yes; others concept | Featured / product page |
| `accentPalette` | yes | 1–3 colours for **that product’s art** |
| `symbol` | yes | Simple mark that still works at 24pt |
| `texture` | optional | Inside the artwork only |

Generic cube appears only when a pack is missing.

---

## Identities

| Product | Module ID | Symbol | Palette | Status |
| --- | --- | --- | --- | --- |
| Vault Notes | `digital.modula.vault-notes` | Folded sheet / vault-leaf, ink on warm paper, one thin stitch | Ivory, iron ink, warm umber. Teal stitch optional and scarce | **Final-quality for B5** |
| Tasks | planned | Quiet check in a list | Graphite, paper | Concept |
| CRM | planned | Two overlapping nameplates | Warm grey, copper | Concept |
| GAIA Atlas | planned | Atlas fragment (not a globe emoji) | Deep green-grey, night | Concept |
| Avatar Studio | planned | Face in a focus halo, not a person clipart | Ink, halo gold | Concept |
| future Gubic | future | Launcher tile language — do not fake a catalogue | Neutral | Concept only |

Gubic remains future. Do not ship a fake store of invented products.

---

## Runtime

`src/features/modules/identity/moduleArtwork.ts` maps module IDs to packs.  
`ModuleArtwork` renders `icon` / `hero`. Product Hub and Module Host use it instead of `AppIcon name="modules"` in a teal square.

Files live in `assets/modules/`. Evidence copies live under `phase-7m/b5/concepts/artwork/`. The evidence repo is not a CDN.
