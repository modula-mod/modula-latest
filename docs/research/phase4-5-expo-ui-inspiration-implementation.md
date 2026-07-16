# Phase 4.5 — Expo UI inspiration → Modula implementation

Maps inspiration screenshots in `docs/validation/phase4-5-inspiration-screens/` to Modula surfaces and Expo UI SwiftUI components.  
**Policy:** Study hierarchy/density → reimplement with Modula tokens (`#369CAA` accent). Never clone brand chrome, ALF, or Bluesky design-system code. Product screens import `src/platform/ui/*` only — never `@expo/ui/swift-ui`.

Expo docs consulted: [BottomSheet](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/bottomsheet/), [ContextMenu](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/contextmenu/), [ControlGroup](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/controlgroup/), [DisclosureGroup](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/disclosuregroup/), [Expo UI overview](https://docs.expo.dev/versions/latest/sdk/ui/).

---

## Screenshot → Modula surface → Expo UI

| Screenshot | Patterns to adopt | Modula surface | Expo UI / platform wrapper | Do not clone |
|---|---|---|---|---|
| IMG_0306 Composer | Cancel · Drafts · Post header; avatar + audience pill; reply permissions; undo/redo; icon toolbar above keyboard; + thread | `ComposerScreen` + Tools / Audience / Reply / CW sheets | `ModulaSheet` (SwiftUI BottomSheet), `ModulaControlGroup` for toolbar clusters, Menu for overflow | X-blue accent, bird brand, LIVE clone |
| IMG_0308 Chat inbox | Search, All filter, pinned, compose FAB | `MessagesInboxScreen` | `ModulaMenu` / sheet filters, `ModulaContextMenu` Pin/Mute/Delete Preview, FAB → new-message sheet | Exact IG/X DM chrome |
| IMG_0307 Account sidebar | Profile header, bold primary nav, secondary Settings/Help | `AdaptiveAccountPanel` | `ModulaSheet`; DisclosureGroup for dense secondary | Drawer package / centre Create tab |
| IMG_0309 Notifications | All/Mentions segmented; mixed activity; gear | `ActivityScreen` | Segmented filter + settings gear; row `ModulaContextMenu` | Push claims without backend |
| IMG_0310 Profile | Tabs, Spaces card, FAB | `ProfileShell` / tabs | ContextMenu More; Share sheet; rich Modules cards + ControlGroup | Bluesky ALF components |
| IMG_0311 Explore | Interests CTA, Hot/New, pin feeds | `DiscoverScreen` | Interests sheet; feed pin sheet; badges | Algorithm “For You” claims |
| IMG_0314 / 0315 / 0316 Settings | Avatar header; drill-down; icons + descriptions + status | `SettingsHomeScreen` + extras | `ModulaDisclosureGroup` for dense subsections; search | Exact X/IG/Bluesky copy |
| IMG_0313 Bluesky profile | Calm hero + tabs | Profile | Density only | ALF / AT Proto UI |
| IMG_0312 Video grid | Media grid feed | Discover media grid route | Grid + optional glass overlays (Reduce Transparency safe) | TikTok FYP as a tab |
| IMG_0320 Post detail | Thread + sticky reply bar | `PostDetailScreen` | Reply bar → Composer reply mode; header ContextMenu | Nested Reddit chrome |
| IMG_0317 Share sheet | Search people, Copy link, Share via… | `ShareToSheet` via `ModulaSheet` | BottomSheet + seeded contacts | Third-party share UI kits |
| IMG_0318 Home feed | Feed selector, compose consistency | `HomeFeedScreen` | Feed `ModulaMenu`; compose toolbar/FAB consistency | Floating developer gear |
| IMG_0319 ControlGroup card | Delete / Edit / Unshare cluster | Marketplace / module cards | `ModulaControlGroup` (Install Preview / Edit / Remove Preview) | Cloning competitor card skins |

---

## Adopt vs do-not-clone (summary)

### Adopt
- SwiftUI **BottomSheet** detents + grabber for all product action sheets (Tools, Share, Audience, Reply, CW, filters, new message, interests, feeds, appearance quick sheet).
- **ContextMenu** long-press on posts, chats, notifications, trending topics.
- **ControlGroup** for related action clusters (module cards, composer tool clusters inside Menu).
- **DisclosureGroup** for dense Settings subsections.
- **Menu** for tap overflow (filters, feed selector) where a host view exists.
- Glass/Blur only through existing Material surfaces + Reduce Transparency respect.
- Haptics on publish, pin, share copy, filter change.
- Honest **Preview** labels for non-backend capabilities.

### Do not clone
- Competitor brand colours (X-blue, IG gradient), logos, ALF, copied components.
- Third-party drawers/sheets/Reanimated Worklets packages.
- Create as a visible tab; floating developer gear.
- Claiming production install, mute persistence, DM delivery, or push without backend.

---

## Wrapper ownership

| Wrapper | Expo source (platform only) | Fallback |
|---|---|---|
| `ModulaSheet` | `@expo/ui` universal → SwiftUI BottomSheet on iOS | Web Modal |
| `ModulaContextMenu` | `@expo/ui/swift-ui` ContextMenu | Long-press → `presentModulaActions` |
| `ModulaMenu` | `@expo/ui/swift-ui` Menu on iOS | Tap → `presentModulaActions` |
| `ModulaControlGroup` | `@expo/ui/swift-ui` ControlGroup | Horizontal action row |
| `ModulaDisclosureGroup` | `@expo/ui/swift-ui` DisclosureGroup | Expandable RN section |

---

## Extra Expo modules used (SDK 57)

Already registered: `expo-blur`, `expo-glass-effect`, `expo-haptics`, `expo-image`, `expo-clipboard`, `@expo/ui`.  
Phase 4.5 mega-pass uses them through Modula materials / haptics / share copy — no new third-party UI packages.
