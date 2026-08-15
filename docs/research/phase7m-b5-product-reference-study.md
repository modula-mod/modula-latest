# Phase 7M-B5 — product-quality non-social study

**Purpose:** composition discipline.  
**Not the goal:** make Modula look like a productivity SaaS app.

Capture date: 2026-08-15.

---

## Apple App Store

```yaml
app: Apple App Store
patterns:
  - editorial featured story, then shelves (Today / Games / Apps)
  - product identity imagery ≠ screenshots (WWDC26 Creative Assets)
  - list rows: artwork + name + subtitle + Get
  - search is a destination, not a filter chip row above a registry
  - categories are editorial, not “kind=plugin”
use_for_modula:
  - HUB-1 Editorial Store
  - featured story answers “what is interesting?”
  - Get/Install as the scarce accent verb
do_not_copy:
  - Today cards as a Modula skin
  - App Store chrome, Today date lockup, “Get” copy as a trademark
```

---

## Apple Music

```yaml
app: Apple Music
patterns:
  - artwork is the object; titles are captions
  - tab bar is Library / Home / Browse / Search / Radio — destinations
  - now-playing is a floating accessory, not a fifth tab of content
  - dense lists with strong album art, almost no card frames
use_for_modula:
  - module artwork as the object
  - NAV: tabs = destinations; play/create = accessory
do_not_copy:
  - Music red, mini-player as a Modula clone
```

---

## Apple Photos

```yaml
app: Apple Photos
patterns:
  - content is a mosaic; chrome is thin
  - years/months/days is a density control, not a filter pill soup
  - selection and share live in the toolbar
use_for_modula:
  - media viewer should own the screen
  - density control without chips
do_not_copy:
  - Memories marketing, iCloud chrome
```

---

## Apple Notes

```yaml
app: Apple Notes
patterns:
  - list of notes is typographic; no card per note
  - folders are navigation, not badges
  - empty state is a short line, not a marketing hero
  - editor is the product; chrome recedes
use_for_modula:
  - NOTES-2 Native Workspace
  - Vault Notes list after install: rows, not tiles
do_not_copy:
  - yellow Note icon as Vault Notes identity
```

---

## Apple Reminders

```yaml
app: Apple Reminders
patterns:
  - smart lists as coloured identity, each list owns a colour
  - native controls (check, date, priority) rather than custom toggles
use_for_modula:
  - module identity colour ≠ OS accent
  - native check/switch/date where the job is a control
do_not_copy:
  - Reminders list colours as Modula’s theme
```

---

## Linear

```yaml
app: Linear
patterns:
  - 2025–26 mobile rebuild: owned material, pin/expand navigation
  - lists are information, not cards
  - custom chrome when the system tab bar cannot do the job
  - density is a feature
use_for_modula:
  - NAV-C compact/hybrid option
  - own the material if stock tab bar fails (principle, not Linear frost recipe)
  - Product Hub as a dense catalogue in HUB-3
do_not_copy:
  - Linear wordmark, issue IDs, purple, command menu as the OS
```

Do not make Modula look like a productivity SaaS app. Linear is studied for **density and chrome ownership**, not for issue-tracker aesthetics.

---

## Airbnb

```yaml
app: Airbnb
patterns:
  - photo-as-object; one accent (Rausch) used scarcely
  - search/filter is the job of Explore, not a chip dump
  - platform-native tab icons
  - listing identity is photography, never a pastel icon tile
use_for_modula:
  - scarce accent law
  - Product Hub featured artwork as photography/illustration object
do_not_copy:
  - Rausch, category icon grid, “Where to?” copy
```

---

## Spotify

```yaml
app: Spotify
patterns:
  - shelves of artwork; titles are secondary
  - Your Library is a dense list with filters that earn their keep
  - now playing is accessory chrome
use_for_modula:
  - HUB shelves (Featured, New, Made by Modula)
  - Your modules as a library, not Installed=0 pills
do_not_copy:
  - Spotify green, wrapped campaign chrome
```

---

## Notion

```yaml
app: Notion
patterns:
  - typographic workspace; pages are documents
  - empty states are invitations to write, not illustrations of empty databases
use_for_modula:
  - NOTES-1 editorial notes as a document
do_not_copy:
  - Notion mark, slash-command as the OS, grey-on-grey SaaS
```

---

## Craft

```yaml
app: Craft
patterns:
  - editorial type, generous but not empty
  - documents feel printed, not “app-y”
use_for_modula:
  - Auth and Vault Notes display type
do_not_copy:
  - Craft brand, card-stack documents
```

---

## Things

```yaml
app: Things
patterns:
  - calm density; headings do hierarchy
  - native iOS patterns with a distinct list personality
use_for_modula:
  - NOTES-2 / Tasks future: calm list, not kanban theatre
do_not_copy:
  - Things headings, magic plus button geometry
```

---

## Composition lessons (binding for Direction M)

| Lesson | From | Modula rule |
| --- | --- | --- |
| Identity imagery ≠ screenshot | App Store WWDC26 205 | ModuleArtwork.hero is mandatory for Vault Notes |
| Artwork is the object | Music, Spotify, Airbnb | Hub rows are art + name + verb |
| Lists beat tiles for tools | Notes, Linear, Things | After install, Vault Notes is a list |
| Accent is scarce | Airbnb, Slack/WWDC26 | `#369CAA` is Install/Get/unread — not every chip |
| Tabs are destinations | Apple HIG, Music | Create is an action, not mixed indiscriminately |
| Empty states are short | Notes, Things | No “No registry results” |
| Own chrome only if needed | Linear | NAV-B/C must justify themselves vs native tabs |
