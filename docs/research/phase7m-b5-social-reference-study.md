# Phase 7M-B5 — social reference study

**Status:** research for Direction M and flagship rebuild. Not a licence to clone any app.  
**Capture date:** 2026-08-15  
**Method:** inspect current public interfaces, vendor changelogs, and established UI studies. Do not use remembered 2023–2024 layouts as if they were current.

B4’s real-app matrix remains valid. B5 goes further: extract **interaction and composition patterns** that a React Native host can actually implement, then apply them inside Direction M.

Anti-reference (rejected Modula 7M-B2 runtime frames):

- Home / Hub / Auth / Vault Notes under `modula-evidence-screenshots/phase-7m/b2/`

Those frames prove engineering. They are not a design language.

---

## How to read this file

```yaml
app: Name
patterns:
  - what the current UI is doing
use_for_modula:
  - transferable principle
do_not_copy:
  - brand, exact chrome, exact iconography
```

What matters is not copying them. What matters is how much social content can sit on screen without wrapping every post in a large card.

---

## X

```yaml
app: X
patterns:
  - compact post hierarchy: avatar + name/handle/time on one row
  - metadata density: views, replies, reposts, likes as a quiet action row
  - action placement: equally weighted icon row under the post, not a card footer
  - tab treatment: Home is a stream; Communities/Notifications/Messages are destinations
  - media sits in the text column, not in a nested panel
  - composer is a dedicated compose surface, not a dashboard widget
  - context menus on the • overflow, not on every glyph
use_for_modula:
  - feed density
  - post information hierarchy
  - action row as metadata, not badges
  - For You / Following as a mode, not a page title
do_not_copy:
  - X-specific branding
  - exact navigation (Grok, Premium, Communities)
  - exact iconography or the bird/X mark
  - engagement farming chrome (view counts as a primary number)
```

---

## Instagram

```yaml
app: Instagram
patterns:
  - Stories as a horizontal presence rail above a media-first feed
  - post hierarchy is photo/video first, caption second
  - double-tap Like, long-press reaction / send
  - bottom navigation is destinations; Create is a centre action
  - floating / pill tab treatment on current iOS (chrome, not content)
  - media viewer is immersive and owns the screen
  - profile is a grid of work, not a bio card stack
use_for_modula:
  - Stories rail as presence, not another feed card
  - media-forward rhythm as HOME-2, not as the only Home
  - Create as a tool launcher, not a fifth content tab
  - opaque floating chrome as a NAV-B option (no feed sampling)
do_not_copy:
  - Instagram wordmark, gradient story ring recipe, Reels-as-the-product
  - exact 5-tab IA
  - heart-only reaction language
```

---

## Threads

```yaml
app: Threads
patterns:
  - continuous vertical document of posts
  - compact author row (~32–40px avatar, name, relative time)
  - body ~15px, tight leading, several posts per viewport
  - hairline separators, almost no card chrome
  - unfilled 24px action icons; counts are metadata
  - Following / For You as a segmented mode in the header
  - comments as a thread continuation, not a nested card
use_for_modula:
  - HOME-1 Continuous Social density
  - posts are rows in a document, not Product Cards
  - scarce colour; neutrals do the work
  - thread hierarchy without wrapping
do_not_copy:
  - Threads wordmark, Meta indigo
  - exact 18px radii or #d5d5d5 rules
  - glass-on-profile as a Modula skin
```

The X and Threads examples are useful precisely because they show how much social content can fit on screen without wrapping every post in a large card.

---

## Reddit

```yaml
app: Reddit
patterns:
  - community identity sits above the post (subreddit as context)
  - voting is a distinct vertical/leading control, not a like heart
  - feed mixes text, link, and media without forcing one card height
  - comments are a ranked tree with collapse
  - search and communities are first-class, not overflow
use_for_modula:
  - Modules mode can borrow “context above the post” (module as community)
  - mixed media/text rhythm
  - comments as structure, not a sticker row
do_not_copy:
  - karma, awards, snoo, subreddit chrome
  - upvote/downvote as Modula’s reaction model
```

---

## Bluesky

```yaml
app: Bluesky
patterns:
  - custom feeds as first-class modes
  - compact post rows with modest media radius
  - selected tab state is weight, not a filled teal pill
  - composer is reachable, not a floating marketing button
  - replies indent as conversation, not as cards-in-cards
use_for_modula:
  - Following / For You / Modules as feed modes
  - selected state without colour fills
  - protocol-independent post row (already Modula law)
do_not_copy:
  - Bluesky butterfly, ALF, AT Proto types in UI
  - copying shell or gesture architecture
```

---

## TikTok

```yaml
app: TikTok
patterns:
  - vertical media owns the viewport
  - actions are a trailing column on the media
  - comments/composer are sheets over the media, not a separate site
  - following vs for-you is a top mode, extremely light chrome
use_for_modula:
  - HOME-2 media-forward: one strong media object, not a grid of thumbnails
  - sheets for comments/composer
  - chrome must recede when media is the job
do_not_copy:
  - For You Algorithm branding, duet/stitch chrome, shop
  - full-bleed vertical video as the only Home
```

---

## LinkedIn

```yaml
app: LinkedIn
patterns:
  - professional identity row (name, headline, time)
  - denser text posts; media is supporting
  - reactions are a small set with a long-press picker
  - composer is “start a post” — one line, then a full sheet
  - notifications and messaging are separate destinations
use_for_modula:
  - reaction long-press → picker (canonical Like/Love/Laugh/Fire)
  - composer entry as a one-line prompt, then a real tool surface
  - identity row without a profile card
do_not_copy:
  - LinkedIn blue, “Start a post” copy, work-anniversary chrome
  - reaction set beyond Modula’s four canonical types in the flagship picker
```

---

## Cross-app pattern table (what B5 actually takes)

| Concern | Take from | Modula application | Reject |
| --- | --- | --- | --- |
| Feed density | Threads, X | HOME-1 continuous document | Card soup from 7M-B2 |
| Media rhythm | Instagram, TikTok | HOME-2 optional composition | Reels clone |
| Module-in-social | Reddit context, Bluesky custom feeds | HOME-3 Modules mode | Fake subreddits |
| Stories | Instagram rail + Modula Focus Halo | Presence rail, not Instagram rings-as-brand | Gradient recipe |
| Reactions | LinkedIn/IG long-press; animation-samples proximity | tap Like; long-press row | 8-type bloom as equal icons |
| Composer | LinkedIn one-line → sheet; X dedicated compose | `+` launches tools | Pill soup of equal CTAs |
| Navigation | Apple HIG tabs as destinations; IG pill as chrome option | NAV A/B/C prototypes | Mixing Create into a content tab without a decision |
| Comments | Threads/X thread; Reddit tree | Post detail as conversation | Nested comment cards |

---

## Screens inspected (checklist)

For each app above, B5 required looking at: Home feed, post hierarchy, Stories (where they exist), composer, comments, reactions, profile, search, notifications, bottom navigation, context menus, media viewer.

Modula does **not** need feature-parity with all of those screens in B5. Flagship rebuild is Authentication, Home, Product Hub, Vault Notes, plus navigation chrome.
