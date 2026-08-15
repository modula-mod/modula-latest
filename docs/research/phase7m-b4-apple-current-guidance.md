# Phase 7M-B4 — Apple current guidance (inspected)

Capture date: 2026-08-15. These notes are from current Apple material, not from memory of “Apple-like UI.”

**Prohibited interpretation:** white background + rounded rectangle + SF Symbol.

---

## 1. Two layers (WWDC26 — Communicate your brand identity on iOS)

Source: https://developer.apple.com/videos/play/wwdc2026/251/

Apple now asks designers to split an app into:

| Layer | What it is | Where brand lives |
| --- | --- | --- |
| UI layer | Tab bars, top toolbars, global actions | Familiar, platform components. Floating above content. |
| Content layer | The scroll view: imagery, video, words, data | The place to be recognisably Modula |

Implications for Modula:

- Do not paint the tab bar teal to “be on brand.”
- Do not put the logo in a large empty hero on every screen (NYT Cooking keeps the mark only on Home and fades it).
- Custom components are for high-impact content (feed, Product Hub artwork, Vault Notes identity), not for reinventing settings rows.

Gentler Streak is cited as: distinctive content, native navigation. Slack is cited as: tint reserved for unread, create, selected tab.

That is the colour-correction mandate in platform language: **accent is scarce.**

---

## 2. Liquid Glass is chrome, not wallpaper

Sources:

- https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/
- https://developer.apple.com/videos/play/wwdc2025/323/
- https://www.macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27/

iOS 26 introduced Liquid Glass as a functional layer over content. Tab bars can shrink on scroll and expand on scroll-up.

iOS 27 (WWDC 2026) responds to readability failures: stronger diffusion of busy backgrounds, darkened edge, brighter specular highlight, and a transparency slider under Settings → Appearance.

Modula implications:

- 7M-B2 already **rejected** BlurView sampling that mirrored feed text. That rejection stands.
- If a direction uses floating chrome, it must remain **legible**. Opaque/raised is an allowed material. Sampling glass is not automatically allowed.
- Reduce Transparency / Increase Contrast remain hard requirements (`modula-visual-constitution.md`).

Linear’s write-up is useful here: they liked the *idea* of a floating UI layer, then **owned the material** because UIKit’s tab bar could not pin/expand. That is a documented invention path for NAV B/C, not a reason to sprinkle `glassEffect` on posts.

---

## 3. Search (WWDC26 — Design intuitive search experiences)

Source: https://developer.apple.com/videos/play/wwdc2026/292/

| Placement | When | Animation |
| --- | --- | --- |
| Bottom toolbar field/button | Primary search in apps with toolbars (Mail) | Field moves up over keyboard |
| Top toolbar | Bottom occupied (Stocks + sheet) | Pulls up over keyboard |
| Search tab (landing) | Exploratory catalogue (Apple TV) | Tab → suggestions, then type |
| Search tab (prominent/instant) | Known-item lookup (Phone) | Keyboard immediately |
| Inline under title | Scoped to this list (Music library) | Stays at top; placeholder names the scope |
| In scrolling content | Content-styled, not glass | Does not steal toolbar material |

Core field anatomy to preserve even with Modula icons: magnifying glass, placeholder, clear, Cancel on iOS when focused.

**Product Hub diagnosis:** the rejected screen uses search-in-content *and* a segmented control *and* category chips *and* statistics pills. Apple’s guidance is to pick a placement that communicates scope, then reveal filters when they are doing work.

Recommended 7M-B4 experiments (not auto-picked):

- Direction A: title + one search field, categories after the featured story (Music-library-like scope: “Search Product Hub”).
- Direction B: search as a control over the featured artwork (toolbar/floating), categories as a shelf header.
- Direction C: minimized search control; dense list is the default.

---

## 4. App Store discovery (WWDC26 — Enhance your presence on the App Store)

Source: https://developer.apple.com/videos/play/wwdc2026/205/

Apple is adding **Creative Assets**: imagery/video that is *not* a screenshot, used as:

- product page header (first thing a visitor sees)
- search result row identity
- in-app events / ads

The stated reason: screenshots show UI; headers show product identity.

Modula Product Hub must follow this *conceptually*: Vault Notes, CRM, GAIA, Tasks need artwork systems. A shared turquoise cube is the opposite of this guidance.

Do not copy Today-tab editorial frames.

---

## 5. Native apps — composition types, not a single card

Inspected via iOS 26/27 coverage (MacRumors Liquid Glass guide, iOS 26 features PDF):

| App | Composition type |
| --- | --- |
| Photos | Media canvas; chrome recedes |
| Messages | Conversation list + thread field |
| Notes | Document canvas + morphing tools |
| Reminders | Rows / lists |
| Settings | Grouped inset lists |
| Maps | Content map + contextual search/filters |
| Wallet | Passes as objects |
| Health | Data summaries; glass on tab chrome |
| Music / TV | Artwork shelves + search tab |

Modula Home is a **social document**. Product Hub is a **store**. Vault Notes is a **product identity then a document**. Auth is an **account ceremony**. None of these is Settings.

---

## 6. Motion that ships on device

| Gesture / trigger | System behaviour | Duration/physics (observed/documented) | Modula adaptation | Reduced motion |
| --- | --- | --- | --- | --- |
| Scroll down in tabbed app | Tab bar minimises (`tabBarMinimizeBehavior(.onScrollDown)`) | Continuous with scroll; expands on scroll-up or tap | Optional in NAV A/C; never hide without a remaining hit target ≥ 44pt | Keep bar visible |
| Search activate from bottom toolbar | Field morphs upward above keyboard | System morph | Use system search if NAV A | Instant present |
| Context menu from toolbar | Morph from the tapped control (WWDC26) | System | Prefer system menus over custom icon sheets | Fade |
| Shared-element (Airbnb / NYT Cooking zoom) | Source rectangle → destination | Spatial spring | Product Hub artwork → module page; Vault Notes art → install | Cross-fade |
| Instagram/Apple Music shrink-on-scroll | Users report mistaps | Not a free win | Prototype only; founder gate | Disable shrink |

Do not animate because Reanimated exists. Motion must explain state (install progress, tab change, search activation, artwork → product).
