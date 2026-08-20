# Phase 7M-B7 full-route audit

Candidate source at audit start:

- CURRENT_VPS_HEAD: `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a`
- ORIGIN_MAIN: `fcca100137526ff44892ba1b2870238d11b78834`
- LATEST_UI_BRANCH: `origin/cursor/full-route-screenshots-99cd`
- LATEST_UI_SHA: `d81d2c9e544fc0ece22b8299441d9172cc6d159f`
- TARGET_REF: `origin/cursor/full-route-screenshots-99cd`
- TARGET_SHA: `d81d2c9e544fc0ece22b8299441d9172cc6d159f`

The 173 PNGs and 163 manifest routes are historical local iOS-simulator evidence. They were captured from `EXPO_PUBLIC_DATA_SOURCE=local`, not the production web release. The manifest records capture success, not visual or functional acceptance. The current normal review path remains stale until the post-change exact SHA is deployed and production-web capture is complete.

## Audit conclusions

- The route inventory contains an invalid `/index` alias and omits explicit 404, loading, empty, and error-state evidence.
- Welcome/onboarding and auth forms render, but the composition remains sparse and implementation-led.
- Home and dedicated Post use the shared `PostShell`, but detail also mounts a second legacy comments thread and composer. The local media fixture has no matching local comments route, producing the captured broken fallback.
- 33 images have extremely low visual entropy and are blank, splash, unavailable, or otherwise non-reviewable.
- Product Hub, module detail/install, Vault Notes, and dynamic module-host acceptance cannot be inferred from the current images.
- Several developer/settings captures contain test diagnostics or error toasts.
- Every retained route must be recaptured from the deployed production-web exact SHA. `KEEP` therefore does not appear in this pre-hardening audit.

## Missing required states

| Required evidence | Current state | Priority | Action |
| --- | --- | --- | --- |
| 404 / unavailable | Invalid `/index` capture only | P1 | Add an intentional unknown-route capture with the real not-found screen |
| Loading | Accidental splash frames only | P1 | Add controlled loading fixtures; do not use half-settled navigation |
| Empty | Scattered empty previews without manifest state labels | P1 | Capture intentional empty states |
| Error | Broken comments and developer toasts, not controlled error acceptance | P1 | Repair normal flows and capture legitimate retry UI |
| Post variants | Text/image only; carousel/video/music interaction states absent | P1 | Add Post V2 evidence pack |
| Desktop web | Absent | P1 | Capture canonical desktop viewport from production |
| Production web | Absent | P1 | Capture only after exact-SHA deployment |

## Route-by-route inventory

| Route | Screenshot | Source SHA | Functional state | Visual state | Media state | Navigation state | Priority | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/create-account` | `create-account.png` | `d81d2c9` | route renders; end-to-end auth state not proved by screenshot | sparse engineering-form composition | none | reachable | P1 | REDESIGN |
| `/forgot-password` | `forgot-password.png` | `d81d2c9` | route renders; end-to-end auth state not proved by screenshot | sparse engineering-form composition | none | reachable | P1 | REDESIGN |
| `/onboarding` | `onboarding.png` | `d81d2c9` | renders locally | weak identity and excessive whitespace | none | reachable | P1 | REDESIGN |
| `/recover` | `recover.png` | `d81d2c9` | route renders; end-to-end auth state not proved by screenshot | sparse engineering-form composition | none | reachable | P1 | REDESIGN |
| `/register` | `register.png` | `d81d2c9` | route renders; end-to-end auth state not proved by screenshot | sparse engineering-form composition | none | reachable | P1 | REDESIGN |
| `/reset-password` | `reset-password.png` | `d81d2c9` | route renders; end-to-end auth state not proved by screenshot | sparse engineering-form composition | none | reachable | P1 | REDESIGN |
| `/sign-in` | `sign-in.png` | `d81d2c9` | route renders; end-to-end auth state not proved by screenshot | sparse engineering-form composition | none | reachable | P1 | REDESIGN |
| `/verify-email` | `verify-email.png` | `d81d2c9` | OTP route renders; expiry, resend and success states unproved | sparse engineering-form composition | none | reachable | P1 | REPAIR |
| `/welcome` | `welcome.png` | `d81d2c9` | renders locally | weak identity and excessive whitespace | none | reachable | P1 | REDESIGN |
| `/activity` | `activity.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/create` | `create.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/discover` | `discover.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/index` | `index.png` | `d81d2c9` | route alias is invalid; screenshot is not-found | broken | none | wrong alias | P1 | REMOVE_OBSOLETE |
| `/profile` | `profile.png` | `d81d2c9` | profile route renders locally | needs current-state recapture and bottom-chrome proof | cover/avatar render where present | direct public load unproved | P2 | RECAPTURE |
| `/account/switcher` | `account__switcher.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/board` | `board.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/collections/collection-saved` | `collections__collection-saved.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/collections` | `collections.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/communities/topic-profile-os` | `communities__topic-profile-os.png` | `d81d2c9` | controlled dynamic fixture resolves inconsistently | unavailable/empty shell in evidence | none | reachable but state is not useful | P1 | REPAIR |
| `/communities` | `communities.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/compose` | `compose.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/creator` | `creator.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/creator/insights` | `creator__insights.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/creator/monetization` | `creator__monetization.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/discover/feeds` | `discover__feeds.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/discover/inspire` | `discover__inspire.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/discover/interests` | `discover__interests.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/discover/live` | `discover__live.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/discover/media` | `discover__media.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/drafts` | `drafts.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/help/getting-started` | `help__getting-started.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/help` | `help.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/help/shortcuts` | `help__shortcuts.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/lists/list-following` | `lists__list-following.png` | `d81d2c9` | controlled dynamic fixture resolves inconsistently | unavailable/empty shell in evidence | none | reachable but state is not useful | P1 | REPAIR |
| `/lists` | `lists.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/marketplace/digital.modula.vault-notes` | `marketplace__digital.modula.vault-notes.png` | `d81d2c9` | route captured from local preview; install/open flow not proved | B6 quality cannot be accepted from this frame | module artwork not consistently evidenced | direct-load/public state unproved | P1 | REPAIR |
| `/marketplace` | `marketplace.png` | `d81d2c9` | route captured from local preview; install/open flow not proved | B6 quality cannot be accepted from this frame | module artwork not consistently evidenced | direct-load/public state unproved | P1 | REPAIR |
| `/marketplace/seller/seller-modula` | `marketplace__seller__seller-modula.png` | `d81d2c9` | route captured from local preview; install/open flow not proved | B6 quality cannot be accepted from this frame | module artwork not consistently evidenced | direct-load/public state unproved | P1 | REPAIR |
| `/messages/thread-demo` | `messages__thread-demo.png` | `d81d2c9` | controlled dynamic fixture resolves inconsistently | unavailable/empty shell in evidence | none | reachable but state is not useful | P1 | REPAIR |
| `/messages` | `messages.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/module/digital.modula.vault-notes/notes` | `module__digital.modula.vault-notes__notes.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/module/digital.modula.vault-notes` | `module__digital.modula.vault-notes.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/modules` | `modules.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/oauth/atproto` | `oauth__atproto.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/post/post-showcase-bali/analytics` | `post__post-showcase-bali__analytics.png` | `d81d2c9` | post renders; comments fixture/API boundary fails on media detail | legacy chrome and incomplete Post V2 | image renders | reachable | P1 | REDESIGN |
| `/post/post-showcase-bali` | `post__post-showcase-bali.png` | `d81d2c9` | post renders; comments fixture/API boundary fails on media detail | legacy chrome and incomplete Post V2 | image renders | reachable | P1 | REDESIGN |
| `/product/focus` | `product__focus.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/agents` | `product__agents.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/aki` | `product__aki.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/atlas` | `product__atlas.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/automations-inbox` | `product__automations-inbox.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/automations` | `product__automations.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/chat-assist` | `product__chat-assist.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/chrome-density` | `product__chrome-density.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/circuit-memory` | `product__circuit-memory.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/claims-graph` | `product__claims-graph.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/commands-palette` | `product__commands-palette.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/commands` | `product__commands.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/communities` | `product__communities.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/creator` | `product__creator.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/customize` | `product__customize.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/product/day-agenda` | `product__day-agenda.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/product/design-lab` | `product__design-lab.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/product/developer` | `product__developer.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/feature-control` | `product__feature-control.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/forge` | `product__forge.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/foundry` | `product__foundry.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/gaia-atlas` | `product__gaia-atlas.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/gaia` | `product__gaia.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/glass-privacy` | `product__glass-privacy.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/governor` | `product__governor.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product` | `product.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/product/inner-circle` | `product__inner-circle.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/integrations` | `product__integrations.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/intelligence/focus` | `product__intelligence__focus.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/intelligence` | `product__intelligence.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/kaizen` | `product__kaizen.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/layout-activity` | `product__layout-activity.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/layout-discover` | `product__layout-discover.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/layout-home` | `product__layout-home.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/layout-profile` | `product__layout-profile.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/product/layout-tabs` | `product__layout-tabs.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/product/ledger` | `product__ledger.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/product/merge-feeds` | `product__merge-feeds.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/module-standards` | `product__module-standards.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/motion-prefs` | `product__motion-prefs.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/nft` | `product__nft.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/ownership` | `product__ownership.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/permissions` | `product__permissions.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/presence` | `product__presence.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/quiet-inbox` | `product__quiet-inbox.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/quiet-send` | `product__quiet-send.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/reactions-prefs` | `product__reactions-prefs.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/sandbox` | `product__sandbox.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/saved-hub` | `product__saved-hub.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/scheduled-posts` | `product__scheduled-posts.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/search` | `product__search.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/share-destinations` | `product__share-destinations.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/start` | `product__start.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/status-composer` | `product__status-composer.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/product/surface-playground` | `product__surface-playground.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/product/themes` | `product__themes.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/product/widgets` | `product__widgets.png` | `d81d2c9` | preview route renders locally | dense internal product-preview copy | none | back navigation visible | P2 | REDESIGN |
| `/profile/andrei.modula/followers` | `profile__andrei.modula__followers.png` | `d81d2c9` | profile route renders locally | needs current-state recapture and bottom-chrome proof | cover/avatar render where present | direct public load unproved | P2 | RECAPTURE |
| `/profile/andrei.modula/following` | `profile__andrei.modula__following.png` | `d81d2c9` | profile route renders locally | needs current-state recapture and bottom-chrome proof | cover/avatar render where present | direct public load unproved | P2 | RECAPTURE |
| `/profile/andrei.modula` | `profile__andrei.modula.png` | `d81d2c9` | profile route renders locally | needs current-state recapture and bottom-chrome proof | cover/avatar render where present | direct public load unproved | P2 | RECAPTURE |
| `/profile/customize` | `profile__customize.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/profile/edit` | `profile__edit.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/profile/os` | `profile__os.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/profile/preview` | `profile__preview.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/reactions` | `reactions.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/reels/algorithm` | `reels__algorithm.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/reels` | `reels.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/report` | `report.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/saved` | `saved.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/settings/about` | `settings__about.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/accessibility` | `settings__accessibility.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/account/email` | `settings__account__email.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/account/export` | `settings__account__export.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/account/handle` | `settings__account__handle.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/account/mail` | `settings__account__mail.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/settings/account/password` | `settings__account__password.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/settings/account/sessions` | `settings__account__sessions.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/settings/account` | `settings__account.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/appearance-lab` | `settings__appearance-lab.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/appearance` | `settings__appearance.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/blocked` | `settings__blocked.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/connections/atproto` | `settings__connections__atproto.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/settings/connections` | `settings__connections.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/content` | `settings__content.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/data` | `settings__data.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/developer/data-runtime` | `settings__developer__data-runtime.png` | `d81d2c9` | preview route renders | developer diagnostics and error toast visible | none | reachable | P1 | REPAIR |
| `/settings/developer/expo-ui/buttons` | `settings__developer__expo-ui__buttons.png` | `d81d2c9` | preview route renders | developer diagnostics and error toast visible | none | reachable | P1 | REPAIR |
| `/settings/developer/expo-ui` | `settings__developer__expo-ui.png` | `d81d2c9` | preview route renders | developer diagnostics and error toast visible | none | reachable | P1 | REPAIR |
| `/settings/developer/expo-ui/playground` | `settings__developer__expo-ui__playground.png` | `d81d2c9` | preview route renders | developer diagnostics and error toast visible | none | reachable | P1 | REPAIR |
| `/settings/developer` | `settings__developer.png` | `d81d2c9` | preview route renders | developer diagnostics and error toast visible | none | reachable | P1 | REPAIR |
| `/settings/developer/modula-ui-lab` | `settings__developer__modula-ui-lab.png` | `d81d2c9` | preview route renders | developer diagnostics and error toast visible | none | reachable | P1 | REPAIR |
| `/settings/developer/session` | `settings__developer__session.png` | `d81d2c9` | preview route renders | developer diagnostics and error toast visible | none | reachable | P1 | REPAIR |
| `/settings/dimon` | `settings__dimon.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/extensions/ext-composer-media` | `settings__extensions__ext-composer-media.png` | `d81d2c9` | preview route renders | developer diagnostics and error toast visible | none | reachable | P1 | REPAIR |
| `/settings/extensions` | `settings__extensions.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/settings/help` | `settings__help.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings` | `settings.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/inner-circle` | `settings__inner-circle.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/settings/language` | `settings__language.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/marketplace` | `settings__marketplace.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/modules/digital.modula.vault-notes` | `settings__modules__digital.modula.vault-notes.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/modules` | `settings__modules.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/mute-words` | `settings__mute-words.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/notifications` | `settings__notifications.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/privacy` | `settings__privacy.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/settings/security` | `settings__security.png` | `d81d2c9` | settings route renders locally | usable but current evidence is stale | none | back/action reachability unproved | P2 | RECAPTURE |
| `/share-profile` | `share-profile.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/share` | `share.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/stories/add:profile-andrei` | `stories__add-profile-andrei.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/stories/create` | `stories__create.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/teams` | `teams.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/whats-new` | `whats-new.png` | `d81d2c9` | route renders in local simulator capture | review required against deployed web | no broken media visible in thumbnail audit | public direct load unproved | P2 | RECAPTURE |
| `/` | `home.png` | `d81d2c9` | feed renders local controlled data | Post V2 rail dominates media | hero image renders | bottom chrome overlaps review area | P1 | REDESIGN |
| `/profile/jenny.modula` | `profile-jenny.png` | `d81d2c9` | profile route renders locally | needs current-state recapture and bottom-chrome proof | cover/avatar render where present | direct public load unproved | P2 | RECAPTURE |
| `/post/post-local-1` | `post-text.png` | `d81d2c9` | post renders; comments fixture/API boundary fails on media detail | legacy chrome and incomplete Post V2 | not evidenced | reachable | P1 | REDESIGN |
| `/marketplace/module-vault-notes` | `marketplace-vault.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |
| `/product/intelligence/gaia` | `intelligence-gaia.png` | `d81d2c9` | capture did not settle to a reviewable route state | blank, splash, or unavailable capture | not evidenced | unknown | P1 | REPAIR |

## Overlay inventory

| Surface | Correct class | Current owner | B7 disposition |
| --- | --- | --- | --- |
| Main navigation | DRAWER | `NavigationDrawer` | Retest gestures, focus and safe areas |
| Comments | BOTTOM SHEET | `CommentsSurface` inside `PostShell` | Repair detents, loading/error/retry, and sticky composer |
| Composer Tools | BOTTOM SHEET | `ComposerToolsDrawer` legacy name | Preserve behavior; document naming debt |
| Module install | BOTTOM SHEET | `InstallPreviewSheet` | Preserve B6 fixed footer and retest |
| Module permissions | BOTTOM SHEET | install flow | Preserve fixed decision action |
| Appearance controls | ROUTE / native controls | settings routes | Retest surface inheritance |
| Reaction picker | POPOVER / MENU | `ReactionPicker` | Add hold-and-horizontal selection and keyboard alternative |
| Post actions | CONTEXT MENU | `PostContextMenu` | Enforce exclusive overlay state and focus return |
| Media full player | FULL-SCREEN MODAL | not implemented by current Post V2 renderers | Implement for exposed video/music types |
| Share profile/post | FULL-SCREEN MODAL | Expo Router modal routes | Retest dismissal and focus |
| Report | FULL-SCREEN MODAL | Expo Router modal route | Retest protected-action flow |

## Stop conditions at audit

- P0: 0.
- P1: open. Deployment and evidence recapture are prohibited until repaired.
- Database migration: none expected and none authorised.
- Production API/DB: preserve.
