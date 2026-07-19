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
| Connected Accounts | `/settings/connections` | Implemented (Phase 6) |
| AT Protocol connection | `/settings/connections/atproto` | Implemented (Phase 6) |
| AT Protocol OAuth callback | `/oauth/atproto` | Implemented (Phase 6) |
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
| — | `/dev/components` | Implemented (`__DEV__`) |

## Shell

| Bluesky | Modula | Status |
|---|---|---|
| Drawer shell | Not copied — tabs-first | N/A |
| Bottom bar | Expo Router Tabs | Implemented |
| Coming soon targets | `/coming-soon` | Implemented |

## Deferred product (explicit)

Login/Signup/Onboarding, Messages, Post thread, Merge Feeds engine, Gaia, wallet, module runtime.
AT Protocol connected accounts / Atmosphere Preview: Phase 6 frontend (server-mediated OAuth; no Bluesky shell).

## Product Hub (Phase 6S craft)

| Route | Surface |
| --- | --- |
| `/product` | Product Hub catalogue |
| `/product/focus` | Focus Mode studio |
| `/product/merge-feeds` | Merge Feeds studio |
| `/product/automations` | Automations studio |
| `/product/gaia` | Gaia agents console |
| `/product/gaia-atlas` | Gaia Atlas schematic |
| `/product/widgets` | Widgets studio |
| `/product/feature-control` | Feature Control (gates entry points) |
| `/product/customize` | Customize hub — layout studios + optional surfaces |
| `/product/layout-home` | Home layout studio (live) |
| `/product/layout-discover` | Discover layout studio (live) |
| `/product/layout-tabs` | Tab bar studio (live) |
| `/product/layout-activity` | Activity prefs studio (live) |
| `/product/layout-profile` | Profile tabs studio (syncs presentation) |
| `/product/status-composer` | Status composer Preview |
| `/product/saved-hub` | Saved hub Preview |
| `/product/quiet-inbox` | Quiet inbox Preview |
| `/product/inner-circle` | Inner Circle Preview |
| `/product/share-destinations` | Share destinations Preview |
| `/product/scheduled-posts` | Scheduled posts Preview |
| `/product/reactions-prefs` | Reactions prefs Preview |
| `/product/day-agenda` | Day agenda Preview |
| `/product/automations-inbox` | Automations inbox Preview |
| `/product/commands-palette` | Commands palette Preview |
| `/product/motion-prefs` | Motion density (live for SectionEnter) |
| `/product/chrome-density` | Chrome density (live for tab insets) |
| `/product/surface-playground` | Surface Type playground Preview |
| `/product/glass-privacy` | Glass Privacy levels |
| `/product/forge` | Forge Module Builder |
| `/product/integrations` | Integrations hub |
| `/product/search` | Universal search preview |
| `/product/creator` | Creator economy |
| `/product/nft` | NFT / digital ownership foreshadow; DIMON inactive |
| `/product/[slug]` | Capability pre-screen |
| `/discover/inspire` | Inspire destinations Preview |
| `/discover/live` | Live Presence rooms Preview |
| `/onboarding` | First-run onboarding |
| `/profile/os` | Profile-OS pre-screen |

