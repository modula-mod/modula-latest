# Phase 7C Product Inspiration Study

Status: pre-implementation design study
Date: 2026-07-26

This study maps current public product patterns into Modula surfaces. It is not permission to copy visual assets, component trees, gestures, design systems, brand style, or proprietary interaction details.

Sources checked include public app-store/help/changelog/product pages and Apple design documentation. Where public sources are incomplete, observations are intentionally conservative and tied to broad product patterns.

## Instagram

- Pattern observed: media-first home, strong profile identity, Explore discovery, quick create entry, visible relationship actions, saved collections, story/presence rail.
- Modula surface: Home, Discover, Composer, Profile, Saved.
- Adapt: immediate social context, compact author identity, media-aware post layout, profile tabs, saved collections.
- Do not copy: Reels-first growth bias, commerce clutter, opaque recommendation pressure, branded visual language.
- Accessibility implications: media overlays need contrast tokens, captions, labels for icon-only actions, and reduced-motion media treatment.
- Performance implications: media cards must virtualize, defer heavy previews, and avoid blocking text feed loading.

## Threads

- Pattern observed: lightweight text posting, reply-first social loop, simple follow graph, activity-centered return path, account import/suggestions.
- Modula surface: Feed, Composer, Activity, onboarding suggested people.
- Adapt: low-friction text composer, clear replies and reposts, suggested follows with visible reasons.
- Do not copy: dependency on Instagram identity or any unclear relationship import.
- Accessibility implications: reply actions and composer affordances need text labels and large-tap support.
- Performance implications: text-first feed can load before media/tool contributions.

## X

- Pattern observed: For You/Following split, central post composer, drafts, timeline empty states, post-send progress, broad action menu.
- Modula surface: Home feed modes, Composer, post menu, offline drafts.
- Adapt: distinct feed modes, explicit post action ownership, post result feedback, draft retention.
- Do not copy: engagement-maximizing noise, unbounded menu complexity, unstable terminology.
- Accessibility implications: action menus must remain understandable without icon-only context.
- Performance implications: timeline should preserve scroll state and avoid stale replacement after search/feed refresh.

## Bluesky

- Pattern observed: protocol-independent social primitives, customizable feeds, account-level notification controls, profile tabs, starter/suggested onboarding.
- Modula surface: Discover, Home feed modes, Activity, Profile, Settings.
- Adapt: custom feed language only where useful, profile actions, notification granularity, account/profile separation.
- Do not copy: AT Protocol types, Bluesky provider tree, ALF styling, protocol-first copy.
- Accessibility implications: custom feed chips and notification filters need selected state and screen-reader labels.
- Performance implications: feed switching should not remount the whole root shell.

## Reddit

- Pattern observed: comments are the product center, nested replies need readable bounds, community/topic discovery, saved items, report/moderation flows.
- Modula surface: comments/replies, Discover topics, Saved, Report/Block/Mute.
- Adapt: bounded nested replies, collapse/expand, topic explanations, moderation action availability.
- Do not copy: deep indentation that becomes unreadable, intrusive gesture changes, dense ad-like insertions.
- Accessibility implications: comment depth must be announced without making navigation exhausting.
- Performance implications: comment trees need pagination and collapsed depth after the supported visual level.

## LinkedIn

- Pattern observed: profile completeness, professional identity, follow/connect intent, notification categories, content actions tied to author/viewer relationship.
- Modula surface: profile editor, suggested people, activity, notification settings.
- Adapt: profile completion as optional quality, clear relationship state, category notification controls.
- Do not copy: corporate tone, monetization prompts, excessive profile nags.
- Accessibility implications: profile editor fields need validation messages that are not color-only.
- Performance implications: profile updates should be optimistic only where rollback can preserve drafts.

## Apple App Store

- Pattern observed: editorial discovery, product pages with clear install/update states, permissions and privacy labels, update history.
- Modula surface: Product Hub, module detail, module lifecycle, Vault Notes install onboarding.
- Adapt: product detail hierarchy, install/enable/update state clarity, permission review before activation, trusted publisher metadata.
- Do not copy: paid-store mechanics, ranking theatre, App Store branding.
- Accessibility implications: install state must be readable through text, not only progress rings.
- Performance implications: catalogue should paginate and cache module metadata.

## Apple Settings

- Pattern observed: grouped lists, plain language, destructive actions separated, system controls, detail disclosure, search.
- Modula surface: Settings, Appearance, Privacy, Security, Notifications, Developer/Diagnostics.
- Adapt: grouped information architecture, native controls, confirmation dialogs, hidden developer diagnostics.
- Do not copy: generic system wording where Modula needs product context.
- Accessibility implications: switches, pickers, sliders, and destructive confirmations inherit native semantics where possible.
- Performance implications: settings screens should load schema/local cache first and patch changed keys only.

## Apple Journal

- Pattern observed: private-by-default personal capture, suggestions with explicit privacy controls, entry creation, search, media attachment, scheduled reminders.
- Modula surface: Vault Notes, Board Continue, Composer Save to Vault, notification settings.
- Adapt: private capture framing, source-aware note creation, opt-in suggestion categories later.
- Do not copy: claims about on-device intelligence unless implemented.
- Accessibility implications: private suggestions require clear labels and user control.
- Performance implications: note creation must be fast and account-scoped; search can fall back to cached recent notes.

## Apple Notes

- Pattern observed: folders, recent notes, search, quick create, checklist/media/link attachments, simple editing hierarchy.
- Modula surface: Vault Notes route, Board Vault card, Save to Vault.
- Adapt: folder preference, recent list, empty states with create actions, fast note editor.
- Do not copy: full Notes feature surface, collaboration, or encryption claims.
- Accessibility implications: editor controls need labels and keyboard behavior.
- Performance implications: note lists should use incremental fetch and local recent cache.

## Notion

- Pattern observed: mobile home, inbox, search, page editing, flexible workspace without forcing a canvas on first use.
- Modula surface: Board, Search, Profile modules, Vault Notes.
- Adapt: continue/recent/pinned organization, compact workspace cards, search-first retrieval.
- Do not copy: unbounded block editor, workspace complexity, AI upsell.
- Accessibility implications: cards need clear headings and actions.
- Performance implications: Board cards must isolate failures and load independently.

## Linear

- Pattern observed: mobile companion for focused workflows, customizable bottom toolbar, inbox/Pulse streams, contextual menus for issue actions.
- Modula surface: Board, Activity, root navigation, post/module menus.
- Adapt: user-prioritized shortcuts, compact operational cards, reliable contextual menus.
- Do not copy: issue-tracker terminology, enterprise-first density.
- Accessibility implications: reordering/pinning must work without drag-only interaction.
- Performance implications: personalized navigation should not remount navigators or lose route state.

## Raycast

- Pattern observed: command-first productivity, notes, quicklinks, AI commands, share-sheet actions, extension disclosure.
- Modula surface: Composer tool drawer, Product Hub, Vault Notes, future GAIA tooling.
- Adapt: command palette logic, tool availability, share/save flows, clear extension capability disclosure.
- Do not copy: global AI autonomy or desktop command-center assumptions.
- Accessibility implications: tools need labels, descriptions, disabled reasons, and keyboard selection on web.
- Performance implications: registry-driven tool menus should cache metadata and lazy-load module detail.

## Cross-Source Design Implications

- Feed density: compact identity and actions, content first, media only as large as needed.
- Post hierarchy: author, context, content, attribution, actions, state.
- Composer entry: central action, persistent draft, expandable tool drawer.
- Profile headers: identity, trust, graph, action, tabs.
- Follow controls: explicit relationship state everywhere.
- Notifications: categories, unread state, deep links, no stale badges.
- Search: native header search where possible, debounce, cancellation, recent searches, empty states.
- Drawers and sheets: navigation drawer stays stable; sheets handle focused actions.
- Settings grouping: account/profile/privacy/security/notifications/appearance/accessibility/modules/connections/data/about/developer.
- Module discovery: Product Hub owns install, Discover may recommend.
- Module installation: progress, permissions, privacy label, enable, pin, open.
- Empty states: actionable, honest, and scoped.
- Error recovery: every remote surface gets retry and safe user-facing messages.

## Public Sources Consulted

- Apple HIG search fields: https://developer.apple.com/design/human-interface-guidelines/search-fields
- Apple HIG navigation and search: https://developer.apple.com/design/human-interface-guidelines/navigation-and-search
- Apple HIG lists and tables: https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- Apple App Store product pages: https://developer.apple.com/app-store/product-page/
- Apple App Store overview: https://www.apple.com/app-store/
- Apple Journal settings: https://support.apple.com/guide/iphone/change-journal-settings-iphf965002cf/ios
- Apple Journaling Suggestions privacy: https://www.apple.com/legal/privacy/data/en/journaling-suggestions/
- Instagram App Store page: https://apps.apple.com/ro/app/instagram/id389801252
- Threads App Store page: https://apps.apple.com/us/app/threads/id6446901002
- Meta Threads launch/product description: https://about.fb.com/news/2023/07/introducing-threads-new-app-text-sharing/
- Bluesky notification controls: https://bsky.social/about/blog/07-02-2025-more-notification-control
- X iOS help: https://help.x.com/en/using-x/x-ios-app
- Notion mobile help: https://www.notion.com/help/notion-for-mobile
- Notion mobile home release: https://www.notion.com/releases/2026-05-04
- Linear mobile navigation changelog: https://linear.app/changelog/2026-01-22-customize-your-navigation-in-linear-mobile
- Raycast iOS page: https://www.raycast.com/ios
- Raycast iOS changelog: https://www.raycast.com/changelog/ios
- Raycast iOS launch blog: https://www.raycast.com/blog/raycast-for-ios
- LinkedIn notifications help: https://www.linkedin.com/help/linkedin/answer/a543133
- Reddit mobile bug discussion evidence for comment navigation sensitivity: https://www.reddit.com/r/bugs/comments/1urz85p/ios_swipe_up_for_comments_no_longer_working/
