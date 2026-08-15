# Phase 7M-B5 — twelve flagship compositions (Direction M)

All twelve sit inside **Direction M**. They are not three global themes. They are layout alternatives the founder can mix.

Visual mockups: evidence repo `phase-7m/b5/concepts/`.

**Flagged for implementation:** AUTH-2, HOME-1, HUB-1, NOTES-1, NAV-C.

---

## Authentication

### AUTH-1 Editorial
Large quiet wordmark, one sentence, then a single identity field. Continue is the only button. Display type (Craft/Notes). No panel card.

### AUTH-2 Minimal Identity — **CANDIDATE**
Small Modula mark. “Sign in.” Email. Continue. Then password **or** email code as the best available method. Alternatives and recovery are trailing text links. Native keyboard / autofill. Passkey/Apple shown only when the capability exists (do not fake a button).

Flow: identity → best available method → alternative method → recovery.

### AUTH-3 Spatial Native
Identity field on a still spatial stage (chrome, not wallpaper). Same progressive flow. Glass optional on the Continue control only, with opaque fallback.

---

## Home / Social Feed

### HOME-1 Continuous Social — **CANDIDATE**
Focus Halo stories. For You / Following / Modules. Compact post rows, hairlines, media in column. Low-chrome actions. Composer is a one-line prompt or tab accessory, not a card. No Focus/Merge dashboard banners in the first viewport.

### HOME-2 Media-forward
Same modes. First viewport privileges one strong media object (Instagram/TikTok rhythm) then returns to the document. Not Reels-as-the-OS.

### HOME-3 Modular Feed
Modules mode first when Focus/work is on. Module context sits above the post (Reddit-like context, not subreddit chrome). Still a document.

---

## Product Hub

### HUB-1 Editorial Store — **CANDIDATE**
No Installed/Available/Updates pills. Top answers: What is interesting? What can I add? What is new? What does this do?

Shelves: Featured, New for Modula, Made by Modula, Productivity, Social, Creator, Your modules.

Rows: artwork + name + one-line job + Install/Open. Technical data on the details screen, collapsed.

### HUB-2 Immersive Product
Full-bleed featured artwork for one product (Vault Notes), then shelves. Photo-as-object (Airbnb/App Store).

### HUB-3 Dense Discovery
Linear/Spotify-library density. Search-first. Still artwork rows, still no registry kinds dump.

---

## Vault Notes

### NOTES-1 Editorial Notes — **CANDIDATE**
Hero identity (paper/vault-leaf, not the cube). Title, one sentence, publisher, **Available**, Install. Stages: Checking compatibility → Verifying release → Installing → Enabling → Ready. Then Open. Never “Not available” / “Permission required” when installable.

### NOTES-2 Native Workspace
After install (and as a composition): Notes-like list, native search in toolbar, no card per note.

### NOTES-3 Minimal Spatial
Identity on a quiet spatial stage; same install flow; glass only on the Install control if proven.

---

## Navigation options (choose independently)

| ID | Name | Implementation intent |
| --- | --- | --- |
| NAV-A | Native | Platform tab bar, destinations only. Create in toolbar/accessory. |
| NAV-B | Modula Floating | Custom **opaque** raised pill. No sampling blur. |
| NAV-C | Hybrid — **CANDIDATE** | Native tab foundation + Modula compose/accessory surface. Spatial in chrome only. |

Test: scroll, safe areas, keyboard, Stories, media, OLED, Reduce Motion, Dynamic Type.
