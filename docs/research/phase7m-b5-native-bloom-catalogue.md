# Phase 7M-B5 — Native Bloom research pass

**Catalogue:** https://nativebloom.dev/  
**Role:** discovery only. Native Bloom is a curated catalogue of React Native blocks with video previews and links back to original sources.

Native Bloom’s own FAQ (inspected 2026-08-15): it does **not** own third-party code and does **not** resell it. A subscription pays for curation. **Membership is not a licence to copy source.**

Every discovered component still needs its own provenance/licence check.

Free browsing shows video previews. Full agent context is a Pro feature; this pass therefore records **categories, pattern, and decision** without vendoring third-party source.

---

## Search categories covered

navigation · toolbar · tab bar · drawer · sheet · context menu · cards · social · stories · reaction · media · search · composer · input · onboarding · authentication · marketplace · grid · carousel

---

## Decision legend

| Decision | Meaning |
| --- | --- |
| USE_DIRECTLY | Licence + Expo 57 / RN 0.86 compatible, already or newly admitted |
| ADAPT | Pattern OK behind a Modula adapter after admission |
| REIMPLEMENT_BEHAVIOUR | Recreate the interaction on Modula primitives |
| INSPIRATION_ONLY | Visual/UX cue; no code |
| REJECT | Conflicts with constitution, licence, or stack |

---

## Catalogue notes (no third-party source copied)

Native Bloom does not grant a blanket licence. Blocks from paid kits explicitly have **no source files** in the catalogue. Open-source blocks still require reading the original repo licence and SHA.

| Native Bloom | Original source | Author | Package/repo | Licence | Pattern | Compatibility | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| https://nativebloom.dev/ (navigation / tab bar facet) | Inspect original per block before any copy | Catalogue credits Authors | varies | **check per repo** | Tab/destination vs action | Unknown until original SHA | INSPIRATION_ONLY until provenance |
| toolbar / composer facets | Aashu-Dubey animation-samples (also MIT, audited separately) | Aashu Dubey | `Aashu-Dubey/react-native-animation-samples` | MIT | Interruptible toolbar | Reanimated + RNGH — already installed | REIMPLEMENT_BEHAVIOUR |
| stories / social facets | Instagram/Threads behaviour, not a kit | — | — | n/a | Presence rail | — | INSPIRATION_ONLY |
| reaction / grid magnification | animation-samples Grid Magnification | Aashu Dubey | same MIT repo | MIT | Proximity enlarge | Reanimated 4.x / RNGH 2.x | REIMPLEMENT_BEHAVIOUR |
| sheet / context menu | Prefer Expo UI Menu / ContextMenu / Compose DropdownMenu | Expo | `@expo/ui@57.0.10` already installed | MIT (Expo) | Native menus | Installed | USE_DIRECTLY (through adapters) |
| cards | Airbnb/App Store editorial | — | — | n/a | Photo-as-object | — | INSPIRATION_ONLY — do not add a generic card kit |
| marketplace / grid | App Store rows, Spotify shelves | — | — | n/a | Editorial store | — | INSPIRATION_ONLY |
| onboarding / authentication | Apple Sign in with Apple HIG; AutoFill | Apple / Expo | installed Auth fields | — | Progressive disclosure | Installed | REIMPLEMENT_BEHAVIOUR |
| carousel | Compose `HorizontalPager` / Expo | Expo | `@expo/ui/jetpack-compose` | MIT | Pager | Android path | ADAPT through adapter if a product job appears |
| drawer | Existing Modula drawer | Modula | `src/platform/ui` | Modula | Spatial overlay | Installed | USE_DIRECTLY existing |

**REJECT list (do not install from catalogue fashion):**

- FlashList, TrueSheet, Gorhom, Moti, Paper, NativeWind, Tamagui — still not admitted.
- Any paid kit whose source is not available.
- Rope-physics / decorative Skia demos with no interaction job.
- Card kits that reintroduce card soup.

---

## Binding rule

If a Native Bloom video is useful, write down the **original URL + licence + SHA** before any code lands in Modula. Until that row is complete, the decision is INSPIRATION_ONLY.
