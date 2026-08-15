# Phase 7M-B4 — three visual directions

The previous Phase 7M-B visual direction has been explicitly rejected. These directions are **compositions for founder selection**, not production screens.

Do not implement a direction until founder review. Do not average the three into a fourth “safe” look.

Engineering remains: Vault Notes `digital.modula.vault-notes`, generic Module Host, Surface Runtime, Appearance Runtime, icon abstraction, Expo UI adapters, a11y, motion infrastructure, auth, Product Hub data, evidence repo.

---

## Shared constitution (all three)

From `modula-visual-constitution.md` plus 7M-B4 research:

- Content first, surfaces second.
- Accent `#369CAA` is scarce.
- Posts are not automatically cards.
- Product Hub is a marketplace, not a registry.
- Vault Notes identity is artwork + install, not “Permission required.”
- Auth is progressive (email → continue → password or OTP or Apple).
- Home is a continuous social document.
- Typography roles are shared (see `phase7m-b4-typography-roles.md`).
- ModuleArtwork exists (see `phase7m-b4-module-artwork.md`).
- No whole-app rollout before founder visual approval.

Navigation is **prototyped, not chosen**: A uses NAV A, B uses NAV B, C uses NAV C.

---

## Direction A — Native Editorial

**One sentence:** A typographic Social OS that uses iOS navigation as a familiar UI layer and puts Modula identity entirely in content.

| Axis | Choice | Trace |
| --- | --- | --- |
| Density | High, Threads-like, several posts per viewport | reference: Threads Home |
| Containers | Almost none; hairlines; photos carry radius | constitution + Threads + Notes |
| Navigation | NAV A — restrained native tab bar | platform: WWDC26 UI layer; Gentler Streak |
| Materials | System chrome; paper canvas; no decorative glass on content | platform |
| Colour | Neutrals; teal only on the single primary product verb (Install / Get) | Airbnb accent scarcity + Slack/WWDC26 |
| Type | SF-like roles; display used sparingly on Product Hub/Vault Notes | Craft/Notes + WWDC26 type |
| Product Hub | Editorial featured story + App Store-like list rows | App Store Creative Assets concept |
| Auth | Quiet type, one field, Continue, official Sign in with Apple | AutoFill / Sign in with Apple |
| Risk | Could feel too Apple if artwork is weak | invention: Modula writing + module art must carry identity |

**Not:** white + rounded rect + SF Symbol.

---

## Direction B — Spatial Modula

**One sentence:** A two-layer shell with owned floating chrome and staged product identity, still content-first underneath.

| Axis | Choice | Trace |
| --- | --- | --- |
| Density | Medium-high; more air around media and featured art | Instagram media + App Store hero |
| Containers | Content still not card-soup; **chrome** is a distinct raised layer | WWDC26 two layers; Linear owned material |
| Navigation | NAV B — floating Modula pill, opaque/raised (no feed sampling) | Instagram 2026 pill + 7M-B2 engineering constraint |
| Materials | Subtle depth on chrome and featured stages only | Linear custom frost (principle, not recipe) |
| Colour | Teal as a rare light in the content layer (story ring, Get); chrome stays neutral | WWDC26: colour in the scroll view |
| Type | Same roles; slightly more display on auth and hub | invention: Modula wordmark as a quiet spatial object |
| Product Hub | Immersive featured artwork as first viewport, then shelves | App Store header + Airbnb photo-as-object |
| Auth | Identity as a small staged mark; still progressive, not a marketing splash | constitution: no giant empty hero without purpose |
| Risk | Floating chrome can become the product. Must stay thinner than 7M-B2. | anti-pattern: glass because glass exists |

The 7M-B2 pill fixed text bleed. Direction B asks whether a **redesigned** floating shell is the identity, not whether the bugfix should be preserved as look-and-feel.

---

## Direction C — Dense Social OS

**One sentence:** Maximum information, minimum decoration; modules appear inside social surfaces; navigation is a compact workflow control.

| Axis | Choice | Trace |
| --- | --- | --- |
| Density | Highest; compact author rows, tight leading, more posts | Threads + X + Linear lists |
| Containers | None for posts; Product Hub is a dense catalogue list | Steam/App Store search rows |
| Navigation | NAV C — spatial/minimal compact bar, expandable overflow (Linear-like) | Linear 2026 pinning/expand |
| Materials | Flat; separators; almost no elevation | Bluesky weight-based tabs |
| Colour | Near-zero accent in the feed; teal only on Get/Install and unread | Slack restraint |
| Type | Body and metadata do most work; display almost unused on Home | Things / Linear |
| Product Hub | Compact featured banner (not a giant hero) + dense rows | Raycast reduction + store rows |
| Auth | Utility: small wordmark, email, Continue — an OS gate | Raycast / iOS account |
| Modules on Home | A single inline module row in the stream (Vault Notes capture), not a Focus card | invention: modules woven into social surfaces |
| Risk | Can feel austere or “admin.” Voice and module art must still be human. | anti-pattern: debug metadata |

---

## Screen-by-screen intent

### Auth

| | A Native Editorial | B Spatial Modula | C Dense Social OS |
| --- | --- | --- | --- |
| First read | Wordmark + one line of voice | Quiet spatial mark + voice | Small wordmark, immediate field |
| Fields | Email only | Email only | Email only |
| Primary | Continue (neutral ink) | Continue on a raised control | Continue (compact) |
| Native | Sign in with Apple official | Same | Same |
| Secondary | Create an account | Create an account | Create an account |
| Not shown | Password, OTP, debug, teal links | Same | Same |

Password and OTP are later states in all three. Compositions show the **entry** state.

### Home

| | A | B | C |
| --- | --- | --- | --- |
| Status | System status bar only | System + thin Modula chrome | System only |
| Stories | Small rail | Slightly larger rail, still not widgets | Thin rail |
| Tabs | Text: Following / For You / Modules | Text on a thin floating strip | Compact text, weight-selected |
| Composer | Text affordance in the stream | Thin field under tabs | Inline “Write” row |
| Posts | Hairline document | Hairline + media may full-bleed | Tightest stacking |
| Extra cards | None | None | Optional **one** inline module row, not Focus/Merge |
| Nav | Native tab bar | Floating pill + compose | Compact expandable bar |

### Product Hub

| | A | B | C |
| --- | --- | --- | --- |
| First viewport | Title, one search, Featured Vault Notes story | Artwork stage with search over it | Compact banner + list immediately |
| Catalogue | List rows with distinct art | Shelves of art | Dense list |
| Controls visible | Search only | Search over hero | Minimized search |
| Categories | After scroll, as text | Shelf headers | Single text line |
| Stats / segments | Absent | Absent | Absent or overflow |

### Vault Notes

| | A | B | C |
| --- | --- | --- | --- |
| Identity | Editorial artwork + type | Environmental artwork stage | Compact product header |
| CTA | Install (one teal use) | Install as floating chrome on art | Install immediately |
| Host | Still generic Module Host underneath | Same | Same |
| Forbidden | “Permission required” as the page | Same | Same |

---

## Founder gate

Stop after twelve compositions + contact sheet + this document.

Selection is a founder action. After selection, build **only** Auth, Home, Product Hub, Vault Notes as functional prototypes on the real backend. No 7M-C. No production deploy.
