# Bluesky → Modula Screen Map

Study: `/tmp/bluesky-social-app`, UI-only from `/home/andrei/modula`.  
**Reimplement** on Modula primitives. Do not copy shell, providers, ALF, or AT Proto into UI.

Legend: **Implemented** (usable layout + mock/stub) · **Stub** (navigable IA, Coming soon) · **Defer** (not in nav yet)

## Tabs

| Bluesky | Modula route | Status |
|---|---|---|
| Home feed | `/(tabs)/feed` | Implemented |
| Search / Explore | `/(tabs)/explore` | Implemented |
| Notifications | `/(tabs)/notifications` | Implemented (mock list) |
| Profile | `/(tabs)/profile` | Implemented (structure) |
| Messages | — | Defer |
| — | `/(tabs)/board` | Implemented (Modula-first) |

## Composer & content

| Bluesky | Modula route | Status |
|---|---|---|
| Composer | `/compose` | Implemented stub (+ tools Alert) |
| Post thread | — | Defer |
| Hashtag / Topic | Explore chips → stubAction | Stub |
| Lists | `/settings/lists` | Stub |
| Bookmarks / Saved feeds | — | Defer |
| Video feed | — | Defer |

## Settings tree (Bluesky parity)

| Bluesky screen | Modula route | Status |
|---|---|---|
| Settings root | `/settings` | Implemented |
| AccountSettings | `/settings/account` | Implemented |
| Email (account) | `/settings/account/email` | Stub |
| Password | `/settings/account/password` | Stub |
| Export data | `/settings/account/export` | Stub |
| Delete account | `/settings/account/delete` | Stub |
| PrivacyAndSecurity | `/settings/privacy` | Implemented (toggle stub) |
| ActivityPrivacy | `/settings/privacy/activity` | Stub |
| AppPasswords | `/settings/privacy/app-passwords` | Stub |
| AppearanceSettings | `/settings/appearance` | Implemented (mode live) |
| AccessibilitySettings | `/settings/accessibility` | Implemented (local toggles) |
| ContentAndMedia / ExternalMedia | `/settings/content-media` | Stub |
| NotificationSettings | `/settings/notifications` | Stub |
| LanguageSettings | `/settings/language` | Stub |
| FollowingFeedPreferences / ThreadPreferences | `/settings/feeds` | Stub |
| InterestsSettings | `/settings/interests` | Stub |
| Moderation hub | `/settings/moderation` | Implemented |
| Muted accounts | `/settings/moderation/muted` | Stub |
| Blocked accounts | `/settings/moderation/blocked` | Stub |
| Moderation lists | `/settings/moderation/lists` | Stub |
| AboutSettings | `/settings/about` | Implemented |
| AppIcon / Beta / Automation labels | — | Defer |
| — | `/settings/modules` | Implemented (empty) |
| — | `/settings/marketplace` | Stub |
| — | `/settings/developer` | Implemented |
| — | `/settings/developer/expo-ui` | Implemented (Expo UI Lab catalog) |
| — | `/settings/developer/expo-ui/playground` | Implemented (full playground) |
| — | `/settings/developer/expo-ui/[section]` | Implemented (per-section demos) |
| — | `/dev/components` | Implemented (`__DEV__` → Expo UI Lab) |

## Shell

| Bluesky | Modula | Status |
|---|---|---|
| Drawer shell | Not copied — tabs-first | N/A |
| Bottom bar | Expo Router Tabs | Implemented |
| Coming soon targets | `/coming-soon` | Implemented |

## Deferred product (explicit)

Login/Signup/Onboarding, Messages, Post thread, Merge Feeds engine, real auth, AT Proto adapter, Gaia, wallet, module runtime.
