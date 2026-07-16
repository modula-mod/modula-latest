# Phase 4.5 — Social Expansion Inspiration

Implementable patterns for Modula product surfaces. Not a link dump.  
Format per product: **Pattern / Why it works / Where Modula may use it / What must not be copied / A11y / Platform**.

Modula UI skill: product screens use `src/platform/ui/*`, primitives, and `src/components/system/*` — never `@expo/ui/swift-ui` from features. Create is **not** a tab. No floating developer gear. Preview labels when not production-backed.

---

## Cross-cutting adopt / avoid

| Adopt | Avoid |
|---|---|
| Dense hierarchical settings (Bluesky/X) | One dump settings screen with Alert stubs |
| Account panel as personal OS rail (X/LinkedIn/Discord) | Dummy destinations / `#` / “coming soon” Alerts |
| Marketplace as browsable catalog with detail pages (App Store / Discord) | Marketplace as a FeaturePreview dead end |
| Filter menus on Activity/Discover (Instagram/Reddit) | Pill-only filters with no overflow menu |
| Honest Preview CTAs for install/mute/report | Claiming production install, mute persistence, or report send |
| Sheets for switcher / appearance / report / share | Third-party drawer packages / Reanimated |

---

## Bluesky

- **Pattern:** Settings as nested lists; account switcher; muted words / blocked accounts as real pages; custom feeds as first-class.
- **Why:** Users trust dense, named destinations over modal stubs.
- **Where:** Settings hierarchy; Lists/custom feeds; Mute words; Blocked accounts; Account switcher sheet.
- **What must not be copied:** ALF, AT Proto UI types, Bluesky shell gestures, copied components.
- **A11y:** Row min 44pt; section headers announced; Preview suffixes in labels.
- **Platform:** Stack destinations + ModulaSheet switcher on iPhone.

## X

- **Pattern:** Left rail / account switcher; Lists; Bookmarks; Monetization / Creator Studio entry; overflow menus for filters.
- **Why:** Personal navigation stays out of the tab bar.
- **Where:** Adaptive account panel; Lists; Saved/Bookmarks; Creator studio preview; Activity filter menu.
- **What must not be copied:** Brand bird chrome, Premium paywall UX, centre create tab.
- **A11y:** Switcher announces selected account; destructive Sign out separated.
- **Platform:** Native sheet on phone; wider rail content on web/iPad.

## Instagram

- **Pattern:** Saved collections; Close Friends; share profile / QR; sticker/reaction picker (restrained); media-forward Discover.
- **Why:** Collections and inner circle are familiar social affordances.
- **Where:** Saved collections; Inner circle preview; QR/share profile sheet; Discover media → real destinations.
- **What must not be copied:** Heart-only engagement; permanent Reels tab; floating story stickers on product chrome.
- **A11y:** Contrast on media overlays; collection names not colour-only.
- **Platform:** Sheets for share/QR; Stack for collections.

## Facebook

- **Pattern:** Marketplace as peer surface; multi-step report flow; notification preference categories.
- **Why:** Marketplace and report feel “product complete” when they have real destinations.
- **Where:** Marketplace browse/detail; Report multi-step sheet; Notifications settings pages.
- **What must not be copied:** Dense blue chrome, News Feed clutter, ad-heavy IA.
- **A11y:** Report steps with clear progress; cancel always available.
- **Platform:** ModulaSheet for report; Marketplace Stack routes.

## Reddit

- **Pattern:** Communities / topics as discovery units; feed filters via menu; side panel personal tools.
- **Why:** Topic pages make Discover actionable.
- **Where:** Discover communities → topic pages; Board pinned spaces; Activity filters.
- **What must not be copied:** Karma chrome, alien branding, endless nested comment chrome.
- **A11y:** Topic titles as headings; clear empty states.
- **Platform:** `/communities/[topicId]` Stack screens.

## TikTok

- **Pattern:** Creator insights / analytics entry from content; For You / New / Featured marketplace sections.
- **Why:** Creator studio and module “For you” feel premium without algorithm claims.
- **Where:** Post analytics preview; Creator studio; Marketplace For you section.
- **What must not be copied:** Full FYP chrome as a fifth tab; black-on-saturated overlays.
- **A11y:** mediaOverlay tokens; Reduce Motion on immersive previews.
- **Platform:** Analytics as Stack from View engagement; Reels remain non-tab.

## Threads

- **Pattern:** Calm text hierarchy; restrained compose tools; simple activity categories.
- **Why:** Completeness without visual noise.
- **Where:** Messages inbox rows; Drafts; Help articles as quiet reading surfaces.
- **What must not be copied:** Meta reply-nesting wholesale.
- **A11y:** Comfortable body line height; Preview badges not emoji.
- **Platform:** Shared Composer; seeded inbox FlatList.

## LinkedIn

- **Pattern:** Professional identity → profile; Creator / monetization soft entry; Help & Support.
- **Why:** Account panel identity is the strongest personal signal.
- **Where:** Owner identity → profile; Creator / Monetization preview; Help & Support.
- **What must not be copied:** Employment widgets in hero; dense promo cards.
- **A11y:** Identity row 44pt+; name + handle both readable.
- **Platform:** Account panel identity press → `/profile`.

## YouTube

- **Pattern:** Library (Saved/History/Drafts); Creator Studio; What’s New / release notes.
- **Why:** Library cluster makes secondary surfaces feel intentional.
- **Where:** Account panel Library group; Drafts; What’s New; Creator studio.
- **What must not be copied:** YouTube red brand system or Shorts tab pressure.
- **A11y:** Group headings in panel; version string selectable/long-press for Dev.
- **Platform:** Settings About long-press → Developer in `__DEV__`.

## Pinterest

- **Pattern:** Boards/collections as save destinations; visual browse with categories.
- **Why:** Collections + marketplace categories map cleanly to Modula modules.
- **Where:** Saved collections; Marketplace categories; Board pinned spaces.
- **What must not be copied:** Masonry-only obsession or pin branding.
- **A11y:** Text labels under visual tiles.
- **Platform:** Grid with semantic surfaces, not pure image mash.

## Discord

- **Pattern:** Server/topic browsing; user settings depth; marketplace-like app directory.
- **Why:** Settings depth + directory browse feel complete.
- **Where:** Settings nested pages; Marketplace seller/creator cards; Keyboard shortcuts sheet (web/iPad).
- **What must not be copied:** Nitro paywall UX; purple glow defaults.
- **A11y:** Keyboard shortcuts listed with keys + actions; Reduce Transparency notes.
- **Platform:** Web/iPad shortcuts sheet; ModulaMenu for overflow.

---

## This-pass feature backlog (ship)

### Account panel / sidebar
1. Enriched destinations: Board, Saved, Messages, Lists, Collections, Drafts, Marketplace, Appearance, Settings, Creator, Help, Developer (`__DEV__`), Sign out
2. Account switcher → real ModulaSheet
3. Overflow menu for secondary items if needed
4. Appearance quick panel sheet (mode/OLED note)

### Settings hierarchy
5. Account, Privacy & Safety, Notifications, Appearance, Accessibility, Content & Media, Language & Translate, Marketplace preferences, Data & storage, About, Help — each a real route
6. Mute words + Blocked accounts under Privacy
7. About long-press → Developer in `__DEV__`

### Marketplace
8. Seeded catalog with Featured / New / For you / categories
9. Search, module detail, Preview install CTA (honest), seller preview cards

### Social surfaces
10. Messages inbox (seeded)
11. Lists / custom feeds + list detail
12. Saved collections
13. Drafts
14. Inner circle
15. QR / share profile sheet
16. Sticker/reaction picker preview (restrained)
17. Post analytics from View engagement
18. Creator studio / Insights
19. Help center articles + What’s New
20. Keyboard shortcuts sheet (web/iPad)
21. Report multi-step sheet (preview)
22. Community/topic detail pages

### Tab enrichment
23. Discover: trending/people/communities/marketplace/media → real destinations; filter menu
24. Board: pinned spaces → module/marketplace/saved
25. Activity: filter menu; rows → post/profile/module

### Quality
26. Replace Alert-only settings stubs and marketplace FeaturePreview dead ends
27. Composer “Browse tools” → Marketplace
28. Validation doc + focused commits
