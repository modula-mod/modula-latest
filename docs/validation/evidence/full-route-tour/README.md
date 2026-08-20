# Full Route Tour — Phase 7M-B7 production web

Captured from **https://modula.digital** after exact-SHA deployment of `f0da1c1d707f262687ee35284d2721c98f32e2e5`.

- Environment: production web
- Captured at: 2026-08-20T23:17:23.320Z
- Mobile route captures: 159
- Desktop key-route captures: 14
- Automated capture results: 173 PASS / 0 REVIEW
- Automated public browser acceptance: 26 PASS / 0 FAIL / 1 controlled local-only mutation SKIP
- Unexpected page, console, request, or HTTP errors: 0
- Historical rejected screenshots: [previous-rejected](previous-rejected/)
- Post V2 states and motion: [current/03-posts](current/03-posts/)

## Review sheets

- [Auth](current/review/AUTH.png)
- [Social](current/review/SOCIAL.png)
- [Product Hub](current/review/PRODUCT-HUB.png)
- [Modules](current/review/MODULES.png)
- [Settings](current/review/SETTINGS.png)
- [Full product](current/review/FULL-PRODUCT.png)
- [Post Experience V2](current/review/POST-EXPERIENCE-V2.png)
- [Post before / after](current/review/POST-BEFORE-AFTER.png)

## Known contract limits

- Music persistence is not exposed by the canonical backend media contract; no fake music post was captured.
- No controlled public video post exists in production; video/full-player evidence remains open.
- Installed/authenticated-only states require a controlled production evidence account; no private credentials were used.
- Public guest reaction selection opens correctly but cannot persist an engagement mutation.
- The controlled comments-error capture intentionally intercepts the comments request with HTTP 503; it is marked `expectedErrorState` in the manifest and is excluded from unexpected-error totals.

## Route index

| Route | State | Viewport | Screenshot | Result |
| --- | --- | --- | --- | --- |
| `/create-account` | PUBLIC | mobile | [view](current/01-auth/mobile/001-create-account.png) | PASS |
| `/forgot-password` | PUBLIC | mobile | [view](current/01-auth/mobile/002-forgot-password.png) | PASS |
| `/onboarding` | PUBLIC | mobile | [view](current/00-onboarding/mobile/003-onboarding.png) | PASS |
| `/recover` | PUBLIC | mobile | [view](current/01-auth/mobile/004-recover.png) | PASS |
| `/register` | PUBLIC | mobile | [view](current/01-auth/mobile/005-register.png) | PASS |
| `/reset-password` | PUBLIC | mobile | [view](current/01-auth/mobile/006-reset-password.png) | PASS |
| `/sign-in` | PUBLIC | mobile | [view](current/01-auth/mobile/007-sign-in.png) | PASS |
| `/verify-email` | PUBLIC | mobile | [view](current/01-auth/mobile/008-verify-email.png) | PASS |
| `/welcome` | PUBLIC | mobile | [view](current/00-onboarding/mobile/009-welcome.png) | PASS |
| `/activity` | PUBLIC | mobile | [view](current/05-activity/mobile/010-activity.png) | PASS |
| `/create` | PUBLIC | mobile | [view](current/10-other-states/mobile/011-create.png) | PASS |
| `/discover` | PUBLIC | mobile | [view](current/04-discover/mobile/012-discover.png) | PASS |
| `/profile` | PUBLIC | mobile | [view](current/06-profile/mobile/013-profile.png) | PASS |
| `/account/switcher` | PUBLIC | mobile | [view](current/09-settings/mobile/014-account__switcher.png) | PASS |
| `/board` | PUBLIC | mobile | [view](current/02-home/mobile/015-board.png) | PASS |
| `/collections/collection-saved` | PUBLIC | mobile | [view](current/10-other-states/mobile/016-collections__collection-saved.png) | PASS |
| `/collections` | PUBLIC | mobile | [view](current/10-other-states/mobile/017-collections.png) | PASS |
| `/communities/topic-profile-os` | PUBLIC | mobile | [view](current/10-other-states/mobile/018-communities__topic-profile-os.png) | PASS |
| `/communities` | PUBLIC | mobile | [view](current/10-other-states/mobile/019-communities.png) | PASS |
| `/compose` | PUBLIC | mobile | [view](current/10-other-states/mobile/020-compose.png) | PASS |
| `/creator` | PUBLIC | mobile | [view](current/10-other-states/mobile/021-creator.png) | PASS |
| `/creator/insights` | PUBLIC | mobile | [view](current/10-other-states/mobile/022-creator__insights.png) | PASS |
| `/creator/monetization` | PUBLIC | mobile | [view](current/10-other-states/mobile/023-creator__monetization.png) | PASS |
| `/discover/feeds` | PUBLIC | mobile | [view](current/04-discover/mobile/024-discover__feeds.png) | PASS |
| `/discover/inspire` | PUBLIC | mobile | [view](current/04-discover/mobile/025-discover__inspire.png) | PASS |
| `/discover/interests` | PUBLIC | mobile | [view](current/04-discover/mobile/026-discover__interests.png) | PASS |
| `/discover/live` | PUBLIC | mobile | [view](current/04-discover/mobile/027-discover__live.png) | PASS |
| `/discover/media` | PUBLIC | mobile | [view](current/04-discover/mobile/028-discover__media.png) | PASS |
| `/drafts` | PUBLIC | mobile | [view](current/10-other-states/mobile/029-drafts.png) | PASS |
| `/help/getting-started` | PUBLIC | mobile | [view](current/10-other-states/mobile/030-help__getting-started.png) | PASS |
| `/help` | PUBLIC | mobile | [view](current/10-other-states/mobile/031-help.png) | PASS |
| `/help/shortcuts` | PUBLIC | mobile | [view](current/10-other-states/mobile/032-help__shortcuts.png) | PASS |
| `/lists/list-following` | PUBLIC | mobile | [view](current/10-other-states/mobile/033-lists__list-following.png) | PASS |
| `/lists` | PUBLIC | mobile | [view](current/10-other-states/mobile/034-lists.png) | PASS |
| `/marketplace/digital.modula.vault-notes` | PUBLIC | mobile | [view](current/07-product-hub/mobile/035-marketplace__digital.modula.vault-notes.png) | PASS |
| `/marketplace` | PUBLIC | mobile | [view](current/07-product-hub/mobile/036-marketplace.png) | PASS |
| `/marketplace/seller/seller-modula` | PUBLIC | mobile | [view](current/07-product-hub/mobile/037-marketplace__seller__seller-modula.png) | PASS |
| `/messages/thread-demo` | PUBLIC | mobile | [view](current/05-activity/mobile/038-messages__thread-demo.png) | PASS |
| `/messages` | PUBLIC | mobile | [view](current/05-activity/mobile/039-messages.png) | PASS |
| `/module/digital.modula.vault-notes/notes` | UNINSTALLED | mobile | [view](current/08-modules/mobile/040-module__digital.modula.vault-notes__notes.png) | PASS |
| `/module/digital.modula.vault-notes` | UNINSTALLED | mobile | [view](current/08-modules/mobile/041-module__digital.modula.vault-notes.png) | PASS |
| `/modules` | PUBLIC | mobile | [view](current/08-modules/mobile/042-modules.png) | PASS |
| `/oauth/atproto` | PUBLIC | mobile | [view](current/10-other-states/mobile/043-oauth__atproto.png) | PASS |
| `/post/post-local-owner-media/analytics` | PUBLIC | mobile | [view](current/03-posts/mobile/044-post__post-showcase-bali__analytics.png) | PASS |
| `/post/post-local-owner-media` | PUBLIC | mobile | [view](current/03-posts/mobile/045-post__post-showcase-bali.png) | PASS |
| `/product/focus` | PUBLIC | mobile | [view](current/07-product-hub/mobile/046-product__focus.png) | PASS |
| `/product/agents` | PUBLIC | mobile | [view](current/07-product-hub/mobile/047-product__agents.png) | PASS |
| `/product/aki` | PUBLIC | mobile | [view](current/07-product-hub/mobile/048-product__aki.png) | PASS |
| `/product/atlas` | PUBLIC | mobile | [view](current/07-product-hub/mobile/049-product__atlas.png) | PASS |
| `/product/automations-inbox` | PUBLIC | mobile | [view](current/07-product-hub/mobile/050-product__automations-inbox.png) | PASS |
| `/product/automations` | PUBLIC | mobile | [view](current/07-product-hub/mobile/051-product__automations.png) | PASS |
| `/product/chat-assist` | PUBLIC | mobile | [view](current/07-product-hub/mobile/052-product__chat-assist.png) | PASS |
| `/product/chrome-density` | PUBLIC | mobile | [view](current/07-product-hub/mobile/053-product__chrome-density.png) | PASS |
| `/product/circuit-memory` | PUBLIC | mobile | [view](current/07-product-hub/mobile/054-product__circuit-memory.png) | PASS |
| `/product/claims-graph` | PUBLIC | mobile | [view](current/07-product-hub/mobile/055-product__claims-graph.png) | PASS |
| `/product/commands-palette` | PUBLIC | mobile | [view](current/07-product-hub/mobile/056-product__commands-palette.png) | PASS |
| `/product/commands` | PUBLIC | mobile | [view](current/07-product-hub/mobile/057-product__commands.png) | PASS |
| `/product/communities` | PUBLIC | mobile | [view](current/07-product-hub/mobile/058-product__communities.png) | PASS |
| `/product/creator` | PUBLIC | mobile | [view](current/07-product-hub/mobile/059-product__creator.png) | PASS |
| `/product/customize` | PUBLIC | mobile | [view](current/07-product-hub/mobile/060-product__customize.png) | PASS |
| `/product/day-agenda` | PUBLIC | mobile | [view](current/07-product-hub/mobile/061-product__day-agenda.png) | PASS |
| `/product/design-lab` | PUBLIC | mobile | [view](current/07-product-hub/mobile/062-product__design-lab.png) | PASS |
| `/product/developer` | PUBLIC | mobile | [view](current/07-product-hub/mobile/063-product__developer.png) | PASS |
| `/product/feature-control` | PUBLIC | mobile | [view](current/07-product-hub/mobile/064-product__feature-control.png) | PASS |
| `/product/forge` | PUBLIC | mobile | [view](current/07-product-hub/mobile/065-product__forge.png) | PASS |
| `/product/foundry` | PUBLIC | mobile | [view](current/07-product-hub/mobile/066-product__foundry.png) | PASS |
| `/product/gaia-atlas` | PUBLIC | mobile | [view](current/07-product-hub/mobile/067-product__gaia-atlas.png) | PASS |
| `/product/gaia` | PUBLIC | mobile | [view](current/07-product-hub/mobile/068-product__gaia.png) | PASS |
| `/product/glass-privacy` | PUBLIC | mobile | [view](current/07-product-hub/mobile/069-product__glass-privacy.png) | PASS |
| `/product/governor` | PUBLIC | mobile | [view](current/07-product-hub/mobile/070-product__governor.png) | PASS |
| `/product` | PUBLIC | mobile | [view](current/07-product-hub/mobile/071-product.png) | PASS |
| `/product/inner-circle` | PUBLIC | mobile | [view](current/07-product-hub/mobile/072-product__inner-circle.png) | PASS |
| `/product/integrations` | PUBLIC | mobile | [view](current/07-product-hub/mobile/073-product__integrations.png) | PASS |
| `/product/intelligence/focus` | PUBLIC | mobile | [view](current/07-product-hub/mobile/074-product__intelligence__focus.png) | PASS |
| `/product/intelligence` | PUBLIC | mobile | [view](current/07-product-hub/mobile/075-product__intelligence.png) | PASS |
| `/product/kaizen` | PUBLIC | mobile | [view](current/07-product-hub/mobile/076-product__kaizen.png) | PASS |
| `/product/layout-activity` | PUBLIC | mobile | [view](current/07-product-hub/mobile/077-product__layout-activity.png) | PASS |
| `/product/layout-discover` | PUBLIC | mobile | [view](current/07-product-hub/mobile/078-product__layout-discover.png) | PASS |
| `/product/layout-home` | PUBLIC | mobile | [view](current/07-product-hub/mobile/079-product__layout-home.png) | PASS |
| `/product/layout-profile` | PUBLIC | mobile | [view](current/07-product-hub/mobile/080-product__layout-profile.png) | PASS |
| `/product/layout-tabs` | PUBLIC | mobile | [view](current/07-product-hub/mobile/081-product__layout-tabs.png) | PASS |
| `/product/ledger` | PUBLIC | mobile | [view](current/07-product-hub/mobile/082-product__ledger.png) | PASS |
| `/product/merge-feeds` | PUBLIC | mobile | [view](current/07-product-hub/mobile/083-product__merge-feeds.png) | PASS |
| `/product/module-standards` | PUBLIC | mobile | [view](current/07-product-hub/mobile/084-product__module-standards.png) | PASS |
| `/product/motion-prefs` | PUBLIC | mobile | [view](current/07-product-hub/mobile/085-product__motion-prefs.png) | PASS |
| `/product/nft` | PUBLIC | mobile | [view](current/07-product-hub/mobile/086-product__nft.png) | PASS |
| `/product/ownership` | PUBLIC | mobile | [view](current/07-product-hub/mobile/087-product__ownership.png) | PASS |
| `/product/permissions` | PUBLIC | mobile | [view](current/07-product-hub/mobile/088-product__permissions.png) | PASS |
| `/product/presence` | PUBLIC | mobile | [view](current/07-product-hub/mobile/089-product__presence.png) | PASS |
| `/product/quiet-inbox` | PUBLIC | mobile | [view](current/07-product-hub/mobile/090-product__quiet-inbox.png) | PASS |
| `/product/quiet-send` | PUBLIC | mobile | [view](current/07-product-hub/mobile/091-product__quiet-send.png) | PASS |
| `/product/reactions-prefs` | PUBLIC | mobile | [view](current/07-product-hub/mobile/092-product__reactions-prefs.png) | PASS |
| `/product/sandbox` | PUBLIC | mobile | [view](current/07-product-hub/mobile/093-product__sandbox.png) | PASS |
| `/product/saved-hub` | PUBLIC | mobile | [view](current/07-product-hub/mobile/094-product__saved-hub.png) | PASS |
| `/product/scheduled-posts` | PUBLIC | mobile | [view](current/07-product-hub/mobile/095-product__scheduled-posts.png) | PASS |
| `/product/search` | PUBLIC | mobile | [view](current/04-discover/mobile/096-product__search.png) | PASS |
| `/product/share-destinations` | PUBLIC | mobile | [view](current/07-product-hub/mobile/097-product__share-destinations.png) | PASS |
| `/product/start` | PUBLIC | mobile | [view](current/07-product-hub/mobile/098-product__start.png) | PASS |
| `/product/status-composer` | PUBLIC | mobile | [view](current/07-product-hub/mobile/099-product__status-composer.png) | PASS |
| `/product/surface-playground` | PUBLIC | mobile | [view](current/07-product-hub/mobile/100-product__surface-playground.png) | PASS |
| `/product/themes` | PUBLIC | mobile | [view](current/07-product-hub/mobile/101-product__themes.png) | PASS |
| `/product/widgets` | PUBLIC | mobile | [view](current/07-product-hub/mobile/102-product__widgets.png) | PASS |
| `/profile/andrei.modula/followers` | PUBLIC | mobile | [view](current/06-profile/mobile/103-profile__andrei.modula__followers.png) | PASS |
| `/profile/andrei.modula/following` | PUBLIC | mobile | [view](current/06-profile/mobile/104-profile__andrei.modula__following.png) | PASS |
| `/profile/andrei.modula` | PUBLIC | mobile | [view](current/06-profile/mobile/105-profile__andrei.modula.png) | PASS |
| `/profile/customize` | PUBLIC | mobile | [view](current/06-profile/mobile/106-profile__customize.png) | PASS |
| `/profile/edit` | PUBLIC | mobile | [view](current/06-profile/mobile/107-profile__edit.png) | PASS |
| `/profile/os` | PUBLIC | mobile | [view](current/06-profile/mobile/108-profile__os.png) | PASS |
| `/profile/preview` | PUBLIC | mobile | [view](current/06-profile/mobile/109-profile__preview.png) | PASS |
| `/reactions` | PUBLIC | mobile | [view](current/03-posts/mobile/110-reactions.png) | PASS |
| `/reels/algorithm` | PUBLIC | mobile | [view](current/10-other-states/mobile/111-reels__algorithm.png) | PASS |
| `/reels` | PUBLIC | mobile | [view](current/03-posts/mobile/112-reels.png) | PASS |
| `/report` | PUBLIC | mobile | [view](current/10-other-states/mobile/113-report.png) | PASS |
| `/saved` | PUBLIC | mobile | [view](current/10-other-states/mobile/114-saved.png) | PASS |
| `/settings/about` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/115-settings__about.png) | PASS |
| `/settings/accessibility` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/116-settings__accessibility.png) | PASS |
| `/settings/account/email` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/117-settings__account__email.png) | PASS |
| `/settings/account/export` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/118-settings__account__export.png) | PASS |
| `/settings/account/handle` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/119-settings__account__handle.png) | PASS |
| `/settings/account/mail` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/120-settings__account__mail.png) | PASS |
| `/settings/account/password` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/121-settings__account__password.png) | PASS |
| `/settings/account/sessions` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/122-settings__account__sessions.png) | PASS |
| `/settings/account` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/123-settings__account.png) | PASS |
| `/settings/appearance-lab` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/124-settings__appearance-lab.png) | PASS |
| `/settings/appearance` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/125-settings__appearance.png) | PASS |
| `/settings/blocked` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/126-settings__blocked.png) | PASS |
| `/settings/connections/atproto` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/127-settings__connections__atproto.png) | PASS |
| `/settings/connections` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/128-settings__connections.png) | PASS |
| `/settings/content` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/129-settings__content.png) | PASS |
| `/settings/data` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/130-settings__data.png) | PASS |
| `/settings/developer/data-runtime` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/131-settings__developer__data-runtime.png) | PASS |
| `/settings/developer/expo-ui/buttons` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/132-settings__developer__expo-ui__buttons.png) | PASS |
| `/settings/developer/expo-ui` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/133-settings__developer__expo-ui.png) | PASS |
| `/settings/developer/expo-ui/playground` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/134-settings__developer__expo-ui__playground.png) | PASS |
| `/settings/developer` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/135-settings__developer.png) | PASS |
| `/settings/developer/modula-ui-lab` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/136-settings__developer__modula-ui-lab.png) | PASS |
| `/settings/developer/session` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/137-settings__developer__session.png) | PASS |
| `/settings/dimon` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/138-settings__dimon.png) | PASS |
| `/settings/extensions/modula.core.composerTools` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/139-settings__extensions__ext-composer-media.png) | PASS |
| `/settings/extensions` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/140-settings__extensions.png) | PASS |
| `/settings/help` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/141-settings__help.png) | PASS |
| `/settings` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/142-settings.png) | PASS |
| `/settings/inner-circle` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/143-settings__inner-circle.png) | PASS |
| `/settings/language` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/144-settings__language.png) | PASS |
| `/settings/marketplace` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/145-settings__marketplace.png) | PASS |
| `/settings/modules/digital.modula.vault-notes` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/146-settings__modules__digital.modula.vault-notes.png) | PASS |
| `/settings/modules` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/147-settings__modules.png) | PASS |
| `/settings/mute-words` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/148-settings__mute-words.png) | PASS |
| `/settings/notifications` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/149-settings__notifications.png) | PASS |
| `/settings/privacy` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/150-settings__privacy.png) | PASS |
| `/settings/security` | AUTHENTICATED_REQUIRED | mobile | [view](current/09-settings/mobile/151-settings__security.png) | PASS |
| `/share-profile` | PUBLIC | mobile | [view](current/06-profile/mobile/152-share-profile.png) | PASS |
| `/share` | PUBLIC | mobile | [view](current/10-other-states/mobile/153-share.png) | PASS |
| `/stories/create` | PUBLIC | mobile | [view](current/10-other-states/mobile/154-stories__create.png) | PASS |
| `/teams` | PUBLIC | mobile | [view](current/10-other-states/mobile/155-teams.png) | PASS |
| `/whats-new` | PUBLIC | mobile | [view](current/10-other-states/mobile/156-whats-new.png) | PASS |
| `/` | PUBLIC | mobile | [view](current/02-home/mobile/157-home.png) | PASS |
| `/post/post-local-1` | PUBLIC | mobile | [view](current/03-posts/mobile/158-post-text.png) | PASS |
| `/product/intelligence/gaia` | PUBLIC | mobile | [view](current/07-product-hub/mobile/159-intelligence-gaia.png) | PASS |
| `/sign-in` | PUBLIC | desktop | [view](current/01-auth/desktop/001-sign-in.png) | PASS |
| `/verify-email` | PUBLIC | desktop | [view](current/01-auth/desktop/002-verify-email.png) | PASS |
| `/welcome` | PUBLIC | desktop | [view](current/00-onboarding/desktop/003-welcome.png) | PASS |
| `/activity` | PUBLIC | desktop | [view](current/05-activity/desktop/004-activity.png) | PASS |
| `/discover` | PUBLIC | desktop | [view](current/04-discover/desktop/005-discover.png) | PASS |
| `/marketplace/digital.modula.vault-notes` | PUBLIC | desktop | [view](current/07-product-hub/desktop/006-marketplace__digital.modula.vault-notes.png) | PASS |
| `/marketplace` | PUBLIC | desktop | [view](current/07-product-hub/desktop/007-marketplace.png) | PASS |
| `/module/digital.modula.vault-notes` | UNINSTALLED | desktop | [view](current/08-modules/desktop/008-module__digital.modula.vault-notes.png) | PASS |
| `/post/post-local-owner-media` | PUBLIC | desktop | [view](current/03-posts/desktop/009-post__post-showcase-bali.png) | PASS |
| `/profile/andrei.modula` | PUBLIC | desktop | [view](current/06-profile/desktop/010-profile__andrei.modula.png) | PASS |
| `/settings/appearance` | AUTHENTICATED_REQUIRED | desktop | [view](current/09-settings/desktop/011-settings__appearance.png) | PASS |
| `/settings` | AUTHENTICATED_REQUIRED | desktop | [view](current/09-settings/desktop/012-settings.png) | PASS |
| `/settings/security` | AUTHENTICATED_REQUIRED | desktop | [view](current/09-settings/desktop/013-settings__security.png) | PASS |
| `/` | PUBLIC | desktop | [view](current/02-home/desktop/014-home.png) | PASS |

## Post Experience V2

| State | Screenshot | Result |
| --- | --- | --- |
| text | [view](current/03-posts/mobile/state-text.png) | PASS |
| image-real | [view](current/03-posts/mobile/state-image-real.png) | PASS |
| carousel-resting | [view](current/03-posts/mobile/state-carousel-resting.png) | PASS |
| reaction-picker | [view](current/03-posts/mobile/state-reaction-picker.png) | PASS |
| context-menu | [view](current/03-posts/mobile/state-context-menu.png) | PASS |
| comments-full | [view](current/03-posts/mobile/state-comments-full.png) | PASS |
| comments-partial | [view](current/03-posts/mobile/state-comments-partial.png) | PASS |
| comments-error | [view](current/03-posts/mobile/state-comments-error.png) | PASS |
| post-loading | [view](current/03-posts/mobile/state-post-loading.png) | PASS |
