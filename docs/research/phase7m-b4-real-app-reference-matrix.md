# Phase 7M-B4 — real-app reference matrix

**Status:** research for founder visual selection. Not an implementation spec.  
**Capture date:** 2026-08-15  
**Method:** inspect current public interfaces, Apple developer material, and vendor changelogs. Do not treat prior Modula 7M-B screens as a visual baseline.

The previous Phase 7M-B visual direction has been explicitly rejected by the founder. This matrix exists so every later composition can be traced to:

1. Modula’s visual constitution;
2. an established platform convention;
3. an identified reference pattern;
4. an explicitly documented new Modula invention.

No decision in 7M-B4 may be justified as “it looked nicer.”

---

## How to read this matrix

Each row is one inspected screen or pattern, not a licence to clone the product.

| Field | Meaning |
| --- | --- |
| `app` | Shipping product studied |
| `screen` | Surface inspected |
| `source` | URL or artefact actually opened on 2026-08-15 |
| `pattern` | What the interface is doing |
| `why_it_works` | Functional reason, not taste |
| `borrow_principle` | Transferable idea for Modula |
| `do_not_copy` | Brand, geometry, chrome, or copy that must stay theirs |
| `modula_application` | Target Modula component/screen |

Anti-reference (rejected Modula 7M-B2, inspected locally):

- Home: `modula-evidence-screenshots/phase-7m/b2/ios/home/7m-b2-ios-home-light-native-01.png`
- Product Hub: `.../product-hub/7m-b2-ios-product-hub-light-native-01.png`
- Auth: `.../auth/7m-b2-ios-login-light-native-01.png`
- Vault Notes: `.../vault-notes/7m-b2-ios-vault-notes-light-native-01.png`

Those frames prove engineering. They are not a design language.

---

## 1. Social

### Threads — Home

```yaml
app: Threads
screen: Home
source:
  - https://styles.refero.design/style/182f8743-fe22-45d3-98bc-9fd29d058602
  - https://styles.refero.design/style/3b46c64e-b733-4d70-8cd0-531ca1f92937
  - https://embedsocial.com/blog/new-threads-features-2026/
capture_date: 2026-08-15
pattern:
  - continuous vertical document of posts
  - compact author row: ~32–40px avatar, 15px/600 name, 13px timestamp
  - body text ~15px with tight 1.33–1.4 line-height
  - media with small radius, not a nested card
  - action row of unfilled 24px icons, counts as metadata not badges
  - posts separated by hairlines, not shadows
  - bottom tab bar; iOS 26 glass chrome arriving around profile/nav, not around each post
why_it_works:
  - content-to-chrome ratio is extreme; several posts fit one viewport
  - hierarchy is typographic, not containerised
  - colour is scarce; neutrals do the work
borrow_principle:
  - content dominates container
  - author identity is a row, not a header card
  - action rows are low-chrome
  - feed is a continuous flow
do_not_copy:
  - Threads wordmark, Meta indigo, exact icon set
  - exact 18px post-card radius or 1px #d5d5d5 rules
  - Following/For You branding or Threads-specific reply indentation
  - glass-on-profile as a Modula skin
modula_application:
  - Post row (not PostCard-as-box)
  - Home feed
  - action row
```

Threads is a **density reference**, not a design target.

### Instagram — Home / Stories / Nav

```yaml
app: Instagram
screen: Home feed, Stories tray, bottom navigation
source:
  - https://storrito.com/resources/what-instagrams-navigation-redesign-actually-changed/
  - https://piunikaweb.com/2026/02/13/instagram-liquid-glass-navbar-update-whatsapp-delay/
  - https://www.gbnews.com/tech/instagram-ios-liquid-glass-update
capture_date: 2026-08-15
pattern:
  - Stories as a horizontal identity rail above the feed, not widgets
  - media-first posts; text is caption, not the object
  - 2026 nav tests: Home / Reels / DMs / Search / Profile; Create moved to top-left in some cohorts
  - Liquid Glass floating pill tab bar rolling out on iOS 26; shrinks while scrolling
  - composer is a distinct create flow, not a dashboard card in the feed
why_it_works:
  - Stories are a separate temporal layer from the feed
  - navigation encodes product priority (Reels vs feed) rather than decoration
  - floating chrome tries to return pixels to content
borrow_principle:
  - Stories belong above the stream as a rail
  - composer is an affordance, not a Focus/Merge dashboard
  - tab semantics should match product jobs, not a decorative FAB plus four icons
do_not_copy:
  - Instagram gradient rings, Reels-first IA, heart/DM-centric tab order
  - Liquid Glass sampling that bleeds feed text (already a Modula P0)
  - shrinking tab bar that causes mistaps as a default without founder choice
modula_application:
  - Stories rail
  - Home composer entry
  - NAV B study (floating chrome)
```

### X — Home

```yaml
app: X
screen: Home timeline
source:
  - prior Modula study docs/design/x-twitter-inspiration.md (re-checked against current public web Home, 2026-08-15)
  - Threads web redesign commentary noting X-like single-feed + rail: https://thenextweb.com/news/threads-website-redesign-direct-messages-desktop
capture_date: 2026-08-15
pattern:
  - text-first posts with optional media
  - following / for-you as top tabs, not boxed filters
  - compose as a dedicated control, historically a FAB or compose row
  - very high information density; metadata is timestamp + views, not status pills
why_it_works:
  - the timeline is the product; chrome recedes
  - tabs switch ranking, they do not restyle the page into a dashboard
borrow_principle:
  - Following / For You as text hierarchy, not a segmented pill stuffed with Modules
  - composer as a persistent but thin affordance
do_not_copy:
  - X branding, premium checkmarks, view-count culture, right-rail trends
  - rage-engagement density as a personality
modula_application:
  - Home tabs
  - composer affordance
```

### Bluesky — Home / Feeds / Search

```yaml
app: Bluesky
screen: Home feeds, Explore/Search
source:
  - https://styles.refero.design/style/aa9234ca-0cc8-470b-bd38-398712de3e95
  - https://blakecrosley.com/guides/design/bluesky
  - https://github.com/bluesky-social/social-app/pull/5732
capture_date: 2026-08-15
pattern:
  - feed choice is a first-class tab strip, not a setting
  - active tab often by type weight, not a filled pill
  - posts stack densely; some clients use 12px gaps rather than giant cards
  - Search tab soft-reset focuses the field (iOS convention)
  - feed marketplace uses preview-before-pin, like a store of algorithms
why_it_works:
  - algorithmic choice is visible without becoming admin UI
  - search behaves like iOS: retap tab to focus
borrow_principle:
  - Modules / Following / For You can be feed identities, not chrome widgets
  - selected state can be typographic
  - Product Hub “preview before commit” for modules
do_not_copy:
  - Bluesky sky-blue, butterfly, ALF, or any copied component
  - custom-feed marketplace visual language
modula_application:
  - Home feed switcher
  - Search tab behaviour
  - Product Hub preview-before-install
```

Modula architecture still forbids copying Bluesky implementation. Density and feed-as-tab are the only borrowings.

### Reddit — Feed / comments

```yaml
app: Reddit
screen: Home feed, post detail
source:
  - public iOS/web Home inspected via current Reddit product marketing and in-app IA (feed + comments), 2026-08-15
  - cross-check: Indigo client study of Reddit threading, https://benricemccarthy.ghost.io/indigo/
capture_date: 2026-08-15
pattern:
  - community identity is a compact row (icon + name), then title, then body/media
  - voting is a dedicated vertical/horizontal control, not a generic like
  - comments are a destination, not an inline badge soup
why_it_works:
  - hierarchy starts with provenance (which community), then claim (title)
  - dense lists still feel scannable because title weight is the beacon
borrow_principle:
  - author/provenance row then content; do not wrap both in a product card
  - comments deserve a destination, not five competing pills
do_not_copy:
  - orange branding, karma, awards, subreddit chips as Modula’s accent system
modula_application:
  - post hierarchy
  - comment entry
```

### TikTok — For You

```yaml
app: TikTok
screen: For You
source:
  - current iOS For You structure as documented in public product UI (full-bleed video, right action rail, bottom caption), 2026-08-15
capture_date: 2026-08-15
pattern:
  - one piece of media owns the viewport
  - chrome is overlay, not a card around the video
  - actions are a vertical rail; captions sit in the content layer
why_it_works:
  - when media is the object, containers are waste
  - identity and CTA live in the content layer (WWDC26 brand-layer rule)
borrow_principle:
  - media should glow to the edges; do not put video inside a Product Hub-style tile
  - overlay chrome is for playback, not for every text post
do_not_copy:
  - vertical action rail as Modula’s default post chrome
  - For You as the only home
  - TikTok typography, sounds, or shopping
modula_application:
  - media treatment inside the feed
  - Stories / short-form later, not 7M-B4 flagship
```

### LinkedIn — Feed / profile

```yaml
app: LinkedIn
screen: Home feed, profile
source:
  - current LinkedIn iOS Home (post composer, feed cards, profile hero), 2026-08-15
capture_date: 2026-08-15
pattern:
  - professional identity is a compact actor row plus a heavier profile hero
  - feed still uses cards more than Threads; this is a caution, not a model
  - composer entry is explicit (“Start a post”)
  - notifications are a tab, not a teal badge farm on Home
why_it_works:
  - profile hierarchy (photo, name, headline, network) is a dedicated surface
  - composer is labelled as work, which fits the product
borrow_principle:
  - Profile is a destination with its own hierarchy
  - notifications belong in Activity, not as Home decoration
do_not_copy:
  - LinkedIn blue, “Start a post” corporate card, reaction explosion, banner+avatar hero as Home
  - feed-as-dashboard of prompts
modula_application:
  - Profile
  - composer labelling (Modula voice, not LinkedIn voice)
```

---

## 2. Premium / productivity

### Linear Mobile — Navigation / lists

```yaml
app: Linear Mobile
screen: Bottom toolbar, issue lists, create
source:
  - https://linear.app/changelog/2025-10-16-mobile-app-redesign
  - https://linear.app/changelog/2026-01-22-customize-your-navigation-in-linear-mobile
  - https://linear.app/now/linear-liquid-glass
  - https://nelson.co/work/linear-26
capture_date: 2026-08-15
pattern:
  - Oct 2025: rebuilt bottom toolbar + Create at the top of every screen; custom frosted material
  - they studied iOS 26 Liquid Glass, then built their own material because stock tab bars cannot expand/pin
  - Jan 2026: rearrange tabs; pin projects/initiatives/documents
  - fourth slot can expand to more destinations
  - compact lists; navigation is a workflow object, not a decorative pill
why_it_works:
  - mobile is treated as a dense workflow, not a shrunk desktop
  - navigation is customisable because roles differ
  - material is owned, so shape can change without fighting UIKit
borrow_principle:
  - bottom navigation is a product decision, not a leftover glass effect
  - create can live at the top if the bottom bar is for moving, not posting
  - NAV C may be expandable/minimal rather than a fixed four-icon + teal FAB
do_not_copy:
  - Linear issue rows, status dots, “Create Issue”, their custom glass recipe
  - pinning as a 7M-B4 ship requirement (document as later invention if chosen)
modula_application:
  - NAV C — spatial/minimal
  - Home vs Product Hub information density
  - motion of expanding chrome
```

### Notion — Mobile Home

```yaml
app: Notion
screen: Mobile Home / swipeable hub (May 2026)
source:
  - https://blog.notionfacile.fr/notion-mobile/
capture_date: 2026-08-15
pattern:
  - Home, AI chats, meetings, inbox grouped into one swipeable hub
  - capture via widgets rather than stuffing every control into the first viewport
why_it_works:
  - related destinations share a space; they are not four equal cards
borrow_principle:
  - do not put Focus, Merge Feeds, Modules, and Composer on Home as equal cards
  - secondary hubs can be swipeable, not permanently stacked
do_not_copy:
  - Notion AI chrome, sidebar metaphors, purple, block editor as Home
modula_application:
  - Home information architecture
  - drawer vs hub
```

### Things — Lists

```yaml
app: Things
screen: Today / lists (Things 3.22 for iOS 26)
source:
  - https://apps.apple.com/us/app/things-3/id904237743
capture_date: 2026-08-15
pattern:
  - iOS 26 refresh: rounder windows, glassy buttons, still a list of to-dos
  - Magic Plus: create inserts into the list rather than a dashboard tile
  - Quick Find rather than a permanent search rectangle plus chips plus stats
why_it_works:
  - the list is the product; chrome is a way to add or find
  - system materials on controls, not on every row
borrow_principle:
  - rows do not need cards
  - search can be invoked, not always visible
  - create belongs in the content’s coordinate system
do_not_copy:
  - Things checkboxes, Cultured Code rounding, their icon
modula_application:
  - Vault Notes list later
  - Product Hub installed list
  - Home post rows
```

### Craft — Documents

```yaml
app: Craft
screen: Document / library
source:
  - https://www.atlasworkspace.ai/blog/notion-vs-craft
capture_date: 2026-08-15
pattern:
  - typographic documents; SF / New York-like reading
  - cards exist as documents, not as every paragraph
why_it_works:
  - identity is in type and paper, not in chrome
borrow_principle:
  - Vault Notes should feel like a knowledge product, not a permission dialog
  - Direction A can be editorial without becoming Craft
do_not_copy:
  - Craft card-nesting of pages, award-era visuals, exact type pairing
modula_application:
  - Vault Notes product identity
  - typography roles (display vs body)
```

### Apple Notes / Reminders

```yaml
app: Apple Notes, Apple Reminders
screen: List, note editor, reminder list
source:
  - https://www.macrumors.com/guide/ios-26-liquid-glass/
  - https://www.apple.com/nz/os/pdf/All_New_Features_iOS_26_Sept_2025_NZ_Final.pdf
capture_date: 2026-08-15
pattern:
  - Notes: paper content layer, glass tools that morph while editing
  - Reminders: lists and rows; suggested tasks, not marketplace cards
  - search in Notes is a system search field, not a custom rectangle plus category chips plus stats
why_it_works:
  - content is a document or a list; tools come when needed
borrow_principle:
  - Vault Notes after install should feel closer to Notes than to Module Host legalese
  - permission/error is an exceptional state
do_not_copy:
  - yellow Notes icon, lined paper, Reminders circles as Modula’s module art
modula_application:
  - Vault Notes hosted experience (later, still generic Module Host underneath)
  - empty/error vs identity
```

### Raycast / Arc

```yaml
app: Raycast, Arc
screen: launcher / browser chrome
source:
  - https://propicked.com/business/compare/raycast-vs-craft-docs
capture_date: 2026-08-15
pattern:
  - Raycast: one field, ranked results, almost no persistent chrome
  - Arc: spaces and lightweight chrome; identity in spaces not in every button
why_it_works:
  - speed comes from reducing destinations, not adding pills
borrow_principle:
  - Product Hub search should be a search, not a control stack
  - Direction C can be command-dense without a launcher clone
do_not_copy:
  - Raycast command palette as Modula Home
  - Arc spaces UI
modula_application:
  - Product Hub search
  - NAV C compactness
```

---

## 3. Discovery / marketplace

### Apple App Store — Today / product page / search

```yaml
app: Apple App Store
screen: Today, product page, search results
source:
  - https://developer.apple.com/videos/play/wwdc2026/205/
  - https://asoworld.com/blog/apple-s-new-app-store-creative-assets-what-it-means-for-your-aso-strategy/
  - https://www.applyra.io/blog/app-store-creative-assets-indie-header-playbook
capture_date: 2026-08-15
pattern:
  - Today: editorial stories, large artwork, one idea per hero
  - product page: icon + name + subtitle + Get, then screenshots
  - WWDC26 Creative Assets: product-page header and search-row imagery independent of screenshots
  - search results: identity at a glance; technical metadata is not the first read
  - Get is a scarce, consistent verb
why_it_works:
  - products have faces
  - featured is not a grid of identical admin cards
  - search rows are list cells with art, not another card grid
borrow_principle:
  - Product Hub first viewport = editorial featured + list, not 2×2 cubes
  - ModuleArtwork must include hero art, not only a generic icon
  - Install/Get is the action; checksums stay off the primary surface
do_not_copy:
  - Today card chrome, “APP OF THE DAY”, Apple editorial photography
  - exact Get button geometry or ranking UI
modula_application:
  - Product Hub
  - ModuleArtwork
  - Vault Notes product identity
```

### Airbnb — Explore / listing

```yaml
app: Airbnb
screen: Explore, listing card, listing detail
source:
  - https://design.google/library/airbnb-invites-you-in
  - https://karrisaarinen.com/dls/
  - https://styles.refero.design/style/c2325884-4391-4688-85cd-e143f5107517
capture_date: 2026-08-15
pattern:
  - photograph is the object; text is a caption under the image
  - listing “cards” often have no border/shadow; radius is on the photo
  - one accent (Rausch) for the primary verb, almost nowhere else
  - categories as a horizontal icon+label strip, not three stacked control rows
  - platform conventions kept for nav, system icons, contextual actions
  - motion: photo shared-element to detail
why_it_works:
  - a dense catalogue still feels visual because media carries identity
  - accent scarcity makes Reserve mean something
  - brand survives while navigation stays native-enough
borrow_principle:
  - Product Hub rows: artwork first, then name + line + Get
  - accent scarcity (#369CAA used like Rausch, not as wallpaper)
  - category exploration without a stats row
do_not_copy:
  - coral #FF385C, Cereal, wish-heart overlay, photo-of-homes
  - pill search split into Where/When/Who
modula_application:
  - Product Hub catalogue
  - ModuleArtwork
  - colour discipline
```

### Spotify / Apple Music

```yaml
app: Spotify, Apple Music
screen: Home / browse, playlist header, library search
source:
  - https://newsroom.spotify.com/2026-07-10/discovery-playlists-release-radar-control-updates/
  - WWDC26 search: Apple Music library search is scoped inline under the title
  - https://www.macrumors.com/guide/ios-26-liquid-glass/
capture_date: 2026-08-15
pattern:
  - editorial shelves of artwork, not identical text cards
  - playlist identity is cover art + title + verb
  - filters appear in context (Release Radar session controls) rather than always-on chrome
  - Apple Music tab bar uses Liquid Glass and can minimise on scroll
  - library search is scoped (“search these albums”), distinct from global Search tab
why_it_works:
  - discovery is visual shelves
  - search scope is communicated by placement
borrow_principle:
  - Product Hub can use shelves (Featured, Made by Modula, Explore)
  - do not show Discover + search + categories + stats at once
  - if Product Hub search is local, say so in the placeholder
do_not_copy:
  - Spotify green, Music red, playlist mosaics, now-playing bar as Modula nav
modula_application:
  - Product Hub shelves
  - search placement
```

### Steam / PlayStation / Shop

```yaml
app: Steam, PlayStation Store, Shop
screen: store home / product row
source:
  - https://www.gamingonlinux.com/2026/06/the-new-steam-store-home-page-is-here-with-improved-gamepad-navigation/
  - current Shop (Shopify) and PlayStation storefront IA, 2026-08-15
capture_date: 2026-08-15
pattern:
  - hero art for a featured title, then rows of distinct product art
  - Steam 2026 home: higher-resolution art, personalised calendar, wishlist — still art-led
  - Shop: product photography, price, merchant; chrome is search + cart
why_it_works:
  - catalogues fail when every SKU shares one icon
borrow_principle:
  - CRM, GAIA, Vault Notes, Tasks cannot share a turquoise cube
  - featured vs list is a hierarchy, not a uniform grid
do_not_copy:
  - Steam dark gamer chrome, PlayStation blue orbs, Shop checkout
modula_application:
  - ModuleArtwork system
  - Product Hub featured vs list
```

---

## 4. Native iOS & Apple guidance

### UI layer vs content layer (binding)

```yaml
app: iOS 26/27 system
screen: tab bars, toolbars, search, Apple apps
source:
  - https://developer.apple.com/videos/play/wwdc2026/251/
  - https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/
  - https://developer.apple.com/videos/play/wwdc2025/323/
  - https://www.macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27/
capture_date: 2026-08-15
pattern:
  - two layers: UI (navigation/actions) floats; content underneath carries brand
  - move brand colour into the scroll view, not onto bulky bars
  - accent is for action, status, feedback — Slack cited for restraint
  - logos are understated; NYT Cooking fades the mark on scroll
  - iOS 27: glass more readable, darkened edge, transparency slider; Reduce Transparency still exists
why_it_works:
  - people already know iOS navigation
  - brand in content avoids painting every control teal
borrow_principle:
  - Modula identity lives in feed, Product Hub art, Vault Notes artwork, voice
  - chrome should be familiar (NAV A) or an owned material (NAV B/C), never both plus a FAB
  - glass is optional chrome, never feed wallpaper
do_not_copy:
  - “white + rounded rect + SF Symbol” as the definition of native
  - sampling glass that mirrors feed text (7M-B2 rejected path)
modula_application:
  - all four flagship screens
  - NAV A/B/C
  - colour correction
```

### Search placement (binding for Product Hub)

```yaml
app: iOS Search
screen: Mail, Phone, Apple TV, Apple Music Library, Stocks
source:
  - https://developer.apple.com/videos/play/wwdc2026/292/
  - https://developer.apple.com/documentation/swiftui/view/searchtoolbarbehavior(_:)
capture_date: 2026-08-15
pattern:
  - toolbar search vs search-in-content are different materials and animations
  - tabbed apps should usually have one primary Search entry
  - Search tab can be a landing (Apple TV) or instant keyboard (Phone)
  - scoped search sits under a title (“search these albums”)
  - keep magnifying glass semantics even with custom icons
  - do not stack search with a second row of always-visible filters unless the query is active
why_it_works:
  - placement tells you the scope
  - reachability on iPhone prefers bottom toolbar search
borrow_principle:
  - Product Hub should not show segmented control + search rectangle + category rectangle + stats pills at once
  - Direction A: system-like search, categories after scroll
  - Direction B: search over featured content
  - Direction C: minimized search control
do_not_copy:
  - Mail scope bar as Product Hub’s permanent chrome
modula_application:
  - Product Hub search
  - Explore search (later)
```

### Photos, Messages, Settings, Maps, Wallet, Health, TV

```yaml
app: Photos, Messages, Settings, Maps, Wallet, Health, Apple TV
screen: primary tabs / lists
source:
  - https://www.macrumors.com/guide/ios-26-liquid-glass/
  - https://developer.apple.com/videos/play/wwdc2026/292/
capture_date: 2026-08-15
pattern:
  - Photos: Library vs Collections, dedicated search; chrome recedes over images
  - Messages: conversation list, not cards; composer is the thread field
  - Settings: grouped inset lists; search in sidebar/top; no marketplace hero
  - Maps: search + contextual filters when relevant
  - Wallet / Health: passes and data as content, glass on controls
  - Apple TV Search tab shows genres before typing
why_it_works:
  - each app chooses list, media canvas, or grouped settings — not one card primitive
borrow_principle:
  - pick a composition type per screen: canvas, list, media, settings
  - Settings-style grouping is wrong for Product Hub and Home
do_not_copy:
  - copying any Apple app’s IA wholesale
modula_application:
  - screen composition types (see constitution addendum)
```

### Authentication (platform)

```yaml
app: iOS Account / Sign in with Apple / AutoFill
screen: sign-in
source:
  - https://developer.apple.com/documentation/Security/password-autofill
  - https://support.apple.com/guide/security/password-autofill-security-sec7aefe77c3/web
  - https://www.twilio.com/en-us/blog/developers/best-practices/best-practices-for-otp-input-forms-in-ios
  - Sign in with Apple button guidelines (HIG / App Store 4.8)
capture_date: 2026-08-15
pattern:
  - progressive fields: username/email first; password when that path is chosen
  - Sign in with Apple uses the official button, equal prominence if other social buttons exist
  - AutoFill via textContentType; OTP via oneTimeCode + domain-bound SMS
  - errors attach to fields; no novel of debug text
  - keyboard-aware; return key advances
why_it_works:
  - the system already knows how to sign in
  - extra chrome slows autofill and password managers
borrow_principle:
  - calm entry, progressive disclosure, OTP as its own state
  - official Apple button, not a teal “Continue with Apple”
do_not_copy:
  - generic SaaS split-screen marketing login
  - six fake OTP boxes that break AutoFill
modula_application:
  - Auth compositions A/B/C
```

---

## 5. Navigation prototypes (must not auto-select)

| Prototype | Reference | Principle | Risk |
| --- | --- | --- | --- |
| **NAV A — restrained native** | iOS 26 tab bar, Gentler Streak (WWDC26), Apple Music | Familiar UI layer; brand in content | Can feel like “just another iOS app” if content is weak |
| **NAV B — floating Modula** | Instagram glass pill 2026, Linear custom material, Apple “floating UI layer” | Distinct shell; keep opaque/raised so text cannot bleed | 7M-B2 pill was a bugfix, not a proven design; do not keep it by inertia |
| **NAV C — spatial/minimal** | Linear expandable fourth slot; iOS minimise-on-scroll; Raycast compactness | Fast, customisable, content-first | Discoverability; mistaps if chrome hides too aggressively |

Founder selects. Agents do not.

---

## 6. What the rejected 7M-B2 UI was doing (anti-patterns)

Inspected 2026-08-15 from the private evidence archive.

| Screen | What it is | Why it fails as a design language |
| --- | --- | --- |
| Home | Dashboard of Focus card, Merge Feeds card, pill segmented control, composer field, then posts | Social products lead with the stream. Extra cards steal the first viewport. |
| Product Hub | Duplicate titles, segment + search + chips + stats pills, 2×2 identical cube cards | Reads as an internal module registry. Marketplaces lead with product faces. |
| Auth | Web form: email + password + teal primary + teal links | No progressive disclosure, no native Apple control, accent on every verb. |
| Vault Notes | “Permission required” / “hosted route” empty state | Exception presented as the product. |
| Colour | Teal on FAB, story badge, Focus, selected chips, Install, links | Accent cannot mean anything. |
| Geometry | Almost every control is a rounded rectangle | Rounded rectangles are not IA. |

Engineering to **preserve**: Vault Notes canonical id, Module Host, Surface/Appearance runtimes, icon abstraction, Expo UI adapters, a11y, motion tokens, auth functionality, Product Hub data, evidence repo, verification, routes, API behaviour.

---

## 7. Traceability rule for 7M-B4 compositions

Every composition in `phase-7m/b4/directions/` must cite at least one row above, plus whether the idea is:

- `constitution` — already in `modula-visual-constitution.md`
- `platform` — HIG / WWDC
- `reference` — named app pattern
- `invention` — new Modula, documented in `docs/design/phase7m-b4-visual-directions.md`

If a pixel cannot be traced, it does not ship into a prototype after selection.
