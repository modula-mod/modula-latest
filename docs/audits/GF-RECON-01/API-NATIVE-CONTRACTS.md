# GF-RECON-01 Native ↔ Backend API Contracts

> GF-RECON-01 — audit date 2026-11-13 (UTC). Read-only reconciliation.
> Backend `modula-mod/modula-latest` main `a91d490e61ebfff38069378ddf757429eb000449` · Native `modula-mod/modula-native` main `5db0f027dd29c6a877b04aa98e0b457ee2b82e2d` · Vault Notes `modula-mod/modula-vault-notes` main `15bf535785cb544fed40fb440499b7081fa89e93`.
> Live VPS revision, production migration ledger, worker image, feature flags and backup state: **UNKNOWN** (no read-only runtime access in this mission).
> Master plan `MODULA_GREENFIELD_MASTER_PLAN_2026.pdf` was **not available** to the auditor; comparison uses the 2026-11-13 founder audit document and the GreenField Experience Atlas v1.0. GreenField is **not** complete.

## Method

Static scan. Backend: every `app.<method>('…')`, `app[method]('…')` and the `app.route` table in `services/greenfield-api/src` at `a91d490e` → 622 method+path patterns. Native: every Swift string literal containing `/v1/` outside test targets, with `\(…)` interpolations normalised to a parameter. Matching is **path-shape only**; HTTP method, request/response schema and capability flags are **not** compared (UNVERIFIED) — a follow-up should use typed fixtures.

## Summary

| Native ref | Distinct paths | Matched | Prefix-only (path builders) | No backend route |
|---|---|---|---|---|
| main 5db0f027 | 176 | 172 | 2 | 2 |
| #296 72c0a368 | 189 | 185 | 2 | 2 |
| #297 c379ee21 | 198 | 194 | 2 | 2 |
| #298 4ea4841d | 200 | 196 | 2 | 2 |

## Mismatches (native main and all stack PRs)

| Native path | Native location | Backend | Status | Severity | Owner |
|---|---|---|---|---|---|
| GET /v1/intelligence/nodus/releases/latest?platform=ios | ios/Modula/Core/Intelligence/Nodus/NodusRelease.swift:141 | no route | NOT FOUND | P2 | Synapse (GF-AI-02) |
| /v1/reels/:id | ios/Modula/Features/Reels/ReelModels.swift:75 | only GET /v1/reels | NOT FOUND | P3 | Prism / Forge |
| /v1/ (base) and /v1/gubic/sessions/:id (builder prefixes) | GreenfieldClient.swift:547, GubicModels.swift:45 | used only as prefixes of real routes | SOURCE PRESENT | — | — |

## Messaging v3 (#296) — 13 new client paths, all matched

`/v1/messaging/capabilities`, `/v1/messaging/privacy`, `/v1/messages/search`, `/v1/presence`, `/v1/presence/heartbeat`, `/v1/groups`, `/v1/groups/:id`, `/v1/groups/:id/members`, `/v1/groups/:id/members/:id`, `/v1/groups/:id/members/:id/role`, `/v1/groups/:id/leave`, `/v1/conversations/:id/messages/:id/reactions`, `/v1/conversations/:id/messages/:id/receipts` (MessageModels.swift:268-283). Socket `GET /v1/messaging/socket` matches register-messaging-routes.ts:504; capabilities advertise `singleInstance: true` (:320).

## Calls (#297) — 9 new client paths, all matched

`/v1/conversations/:id/calls`, `/v1/calls/:id`, `/v1/calls/:id/:command`, `/v1/calls/:id/signalling-ticket`, `/v1/calls/:id/media-credentials`, `/v1/calls/:id/signalling` (ws), `/v1/me/calls`, `/v1/push/voip-devices`, `/v1/push/voip-devices/:id` (CallRepository.swift:13-27, CallModels.swift:295) ↔ register-calls-routes.ts:144-286. Backend-only: `GET/PATCH /v1/me/call-settings` (no native caller). Calls capability is reported inside `GET /v1/messaging/capabilities` and is OFF unless `MODULA_CALLS_ENABLED=true` and TURN + ticket pepper are configured (env.ts:148, :615); maxParticipants 2 (register-calls-routes.ts:38).

## #298 — 2 new paths, matched

`POST /v1/stories/:itemId/replies`, `DELETE /v1/stories/items/:itemId`.

## Capability-gated native features

Native `CreationCapabilities.swift:9-11` defaults `linkPost`, `linkPreview`, `pollPost` to false (backend has no post link/poll persistence — G012). #298 lists as unsupported (no endpoint): mark unread, separate story reaction type/viewer lists/highlights, realtime comments (polled every 25 s), Home new-post count.

## Full path table (native main)

| Path | Status | First location |
|---|---|---|
| `/v1/` | PREFIX-ONLY | ios/Modula/Core/Networking/GreenfieldClient.swift:547 |
| `/v1/account/data-exports` | MATCHED | ios/Modula/Features/Settings/SettingsServiceModels.swift:444 |
| `/v1/account/data-requests/{x}/advance` | MATCHED | ios/Modula/Features/Settings/SettingsServiceModels.swift:453 |
| `/v1/account/data-requests/{x}/artifacts` | MATCHED | ios/Modula/Features/Settings/SettingsServiceModels.swift:459 |
| `/v1/account/data-requests/{x}/cancel` | MATCHED | ios/Modula/Features/Settings/Real/SettingsAccountPages.swift:430 |
| `/v1/account/deletion-requests` | MATCHED | ios/Modula/Features/Settings/Real/SettingsAccountPages.swift:417 |
| `/v1/account/deletion-requests/current` | MATCHED | ios/Modula/Features/Settings/Real/SettingsAccountPages.swift:404 |
| `/v1/accounts/forgot-password` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:268 |
| `/v1/accounts/handles/{x}/availability` | MATCHED | ios/Modula/Features/Settings/Real/SettingsAccountPages.swift:506 |
| `/v1/accounts/me` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:223 |
| `/v1/accounts/me/app-preferences` | MATCHED | ios/Modula/Features/Settings/Real/SettingsAccountPages.swift:91 |
| `/v1/accounts/me/blocks` | MATCHED | ios/Modula/Features/Settings/Real/SettingsAccountPages.swift:130 |
| `/v1/accounts/me/handle` | MATCHED | ios/Modula/Features/Settings/Real/SettingsAccountPages.swift:515 |
| `/v1/accounts/me/mutes` | MATCHED | ios/Modula/Features/Settings/Real/SettingsAccountPages.swift:130 |
| `/v1/accounts/me/notification-preferences` | MATCHED | ios/Modula/Features/Settings/Real/SettingsNotificationPages.swift:20 |
| `/v1/accounts/me/sessions` | MATCHED | ios/Modula/Core/Networking/GreenfieldAccountClient.swift:79 |
| `/v1/accounts/register` | MATCHED | ios/Modula/Core/Networking/GreenfieldAccountClient.swift:47 |
| `/v1/accounts/resend-verification` | MATCHED | ios/Modula/Core/Networking/GreenfieldAccountClient.swift:66 |
| `/v1/accounts/reset-password` | MATCHED | ios/Modula/Core/Networking/GreenfieldAccountClient.swift:72 |
| `/v1/accounts/verify-email` | MATCHED | ios/Modula/Core/Networking/GreenfieldAccountClient.swift:62 |
| `/v1/attachments/uploads` | MATCHED | ios/Modula/Core/MediaUpload/MediaUploading.swift:90 |
| `/v1/attachments/uploads/{x}/content` | MATCHED | ios/Modula/Core/MediaUpload/MediaUploading.swift:121 |
| `/v1/attachments/{x}` | MATCHED | ios/Modula/Core/MediaUpload/MediaUploading.swift:101 |
| `/v1/auth/apple/link` | MATCHED | ios/Modula/Features/Settings/SettingsAuthFlows.swift:301 |
| `/v1/auth/apple/link/options` | MATCHED | ios/Modula/Features/Settings/SettingsAuthFlows.swift:280 |
| `/v1/auth/apple/status` | MATCHED | ios/Modula/Features/Settings/SettingsSecurityCenter.swift:259 |
| `/v1/auth/passkeys` | MATCHED | ios/Modula/Features/Settings/Real/SettingsDecisionPages.swift:88 |
| `/v1/auth/passkeys/registration/options` | MATCHED | ios/Modula/Features/Settings/SettingsAuthFlows.swift:192 |
| `/v1/auth/passkeys/registration/verify` | MATCHED | ios/Modula/Features/Settings/SettingsAuthFlows.swift:228 |
| `/v1/auth/passkeys/{x}` | MATCHED | ios/Modula/Features/Settings/SettingsSecurityCenter.swift:300 |
| `/v1/auth/recovery-codes` | MATCHED | ios/Modula/Features/Settings/SettingsSecurityCenter.swift:251 |
| `/v1/auth/recovery-codes/regenerate` | MATCHED | ios/Modula/Features/Settings/SettingsSecurityCenter.swift:268 |
| `/v1/auth/step-up/password` | MATCHED | ios/Modula/Features/Settings/Real/SettingsAccountPages.swift:283 |
| `/v1/auth/totp/disable` | MATCHED | ios/Modula/Features/Settings/SettingsSecurityCenter.swift:333 |
| `/v1/auth/totp/enroll` | MATCHED | ios/Modula/Features/Settings/SettingsAuthFlows.swift:121 |
| `/v1/auth/totp/verify` | MATCHED | ios/Modula/Features/Settings/SettingsAuthFlows.swift:134 |
| `/v1/comments/{x}` | MATCHED | ios/Modula/Features/Social/PostBackendCapabilities.swift:42 |
| `/v1/comments/{x}/pin` | MATCHED | ios/Modula/Features/Social/PostRepository.swift:177 |
| `/v1/comments/{x}/poll/vote` | MATCHED | ios/Modula/Features/Community/CommunityModels.swift:205 |
| `/v1/comments/{x}/reaction` | MATCHED | ios/Modula/Features/Social/PostRepository.swift:184 |
| `/v1/comments/{x}/replies` | MATCHED | ios/Modula/Features/Social/PostRepository.swift:63 |
| `/v1/commerce/billing-adapters` | MATCHED | ios/Modula/Features/Premium/PremiumModels.swift:53 |
| `/v1/commerce/invoices` | MATCHED | ios/Modula/Features/Premium/PremiumModels.swift:52 |
| `/v1/connections` | MATCHED | ios/Modula/Features/Settings/Real/SettingsDecisionPages.swift:188 |
| `/v1/connectors` | MATCHED | ios/Modula/Features/Settings/Real/SettingsDecisionPages.swift:182 |
| `/v1/conversations` | MATCHED | ios/Modula/Features/Messages/MessageModels.swift:224 |
| `/v1/conversations/modula-route-probe/typing` | MATCHED | ios/Modula/Features/Messages/MessagingRepository.swift:159 |
| `/v1/conversations/unread` | MATCHED | ios/Modula/Features/Messages/MessageModels.swift:228 |
| `/v1/conversations/{x}/archive` | MATCHED | ios/Modula/Features/Messages/MessagingRepository.swift:223 |
| `/v1/conversations/{x}/messages` | MATCHED | ios/Modula/Core/Notifications/PushNotificationController.swift:210 |
| `/v1/conversations/{x}/messages/{x}` | MATCHED | ios/Modula/Features/Messages/MessagingRepository.swift:175 |
| `/v1/conversations/{x}/messages?limit=40` | MATCHED | ios/Modula/Features/Messages/MessageModels.swift:209 |
| `/v1/conversations/{x}/mute` | MATCHED | ios/Modula/Features/Messages/MessagingRepository.swift:217 |
| `/v1/conversations/{x}/read` | MATCHED | ios/Modula/Features/Messages/MessageModels.swift:221 |
| `/v1/conversations/{x}/typing` | MATCHED | ios/Modula/Features/Messages/MessagingRepository.swift:207 |
| `/v1/conversations?limit=30` | MATCHED | ios/Modula/Features/Messages/MessageModels.swift:201 |
| `/v1/creator/insights` | MATCHED | ios/Modula/Features/Premium/PremiumModels.swift:50 |
| `/v1/creator/insights?days={x}` | MATCHED | ios/Modula/Features/Settings/Real/SettingsCreatorPages.swift:152 |
| `/v1/creator/payouts` | MATCHED | ios/Modula/Features/Premium/PremiumModels.swift:51 |
| `/v1/developer/board` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:35 |
| `/v1/developer/gubic/submissions` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:33 |
| `/v1/discover` | MATCHED | ios/Modula/Features/Discover/DiscoverRepository.swift:34 |
| `/v1/feed/home?mode={x}&limit=30` | MATCHED | ios/Modula/Features/Home/HomeRepository.swift:26 |
| `/v1/follow-requests/{x}/accept` | MATCHED | ios/Modula/Core/Notifications/PushNotificationController.swift:221 |
| `/v1/follow-requests/{x}/reject` | MATCHED | ios/Modula/Features/Activity/ActivityRepository.swift:115 |
| `/v1/gifs/search?q={x}&limit=24&offset={x}` | MATCHED | ios/Modula/Core/Composer/ComposerServices.swift:30 |
| `/v1/gifs/trending?limit=24&offset={x}` | MATCHED | ios/Modula/Core/Composer/ComposerServices.swift:25 |
| `/v1/gubic/capabilities` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:31 |
| `/v1/gubic/categories` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:27 |
| `/v1/gubic/featured?limit=20` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:25 |
| `/v1/gubic/games/{x}` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:38 |
| `/v1/gubic/games?limit=100` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:28 |
| `/v1/gubic/library` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:29 |
| `/v1/gubic/library/{x}` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:42 |
| `/v1/gubic/lobbies/join` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:34 |
| `/v1/gubic/lobbies/{x}` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:43 |
| `/v1/gubic/me/achievements` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:32 |
| `/v1/gubic/my-games` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:30 |
| `/v1/gubic/new-releases?limit=20` | MATCHED | ios/Modula/Features/GUBIC/GubicModels.swift:26 |
| `/v1/gubic/sessions/{x}` | PREFIX-ONLY | ios/Modula/Features/GUBIC/GubicModels.swift:45 |
| `/v1/hashtags/suggest?q={x}` | MATCHED | ios/Modula/Features/Creation/Composer/CreationStudioStore.swift:179 |
| `/v1/in-mail` | MATCHED | ios/Modula/Features/InMail/InMailModels.swift:58 |
| `/v1/in-mail/{x}` | MATCHED | ios/Modula/Features/InMail/InMailModels.swift:57 |
| `/v1/in-mail/{x}/replies` | MATCHED | ios/Modula/Features/InMail/InMailModels.swift:59 |
| `/v1/in-mail?limit=30` | MATCHED | ios/Modula/Features/InMail/InMailModels.swift:51 |
| `/v1/intelligence/nodus/releases/latest` | NO BACKEND ROUTE | ios/Modula/Core/Intelligence/Nodus/NodusRelease.swift:141 |
| `/v1/link-previews?url={x}` | MATCHED | ios/Modula/Core/Composer/ComposerServices.swift:77 |
| `/v1/link-safety?url={x}` | MATCHED | ios/Modula/Features/Browser/ModulaInAppBrowser.swift:852 |
| `/v1/me/entitlements` | MATCHED | ios/Modula/Features/Premium/PremiumModels.swift:47 |
| `/v1/me/entitlements/{x}` | MATCHED | ios/Modula/Features/Premium/PremiumModels.swift:57 |
| `/v1/me/membership` | MATCHED | ios/Modula/Features/Premium/PremiumModels.swift:46 |
| `/v1/me/membership/badge-visibility` | MATCHED | ios/Modula/Features/Premium/PremiumModels.swift:48 |
| `/v1/me/verification` | MATCHED | ios/Modula/Features/Premium/PremiumModels.swift:49 |
| `/v1/message-requests` | MATCHED | ios/Modula/Features/Messages/MessageModels.swift:225 |
| `/v1/message-requests/{x}/accept` | MATCHED | ios/Modula/Features/Messages/MessageModels.swift:226 |
| `/v1/message-requests/{x}/decline` | MATCHED | ios/Modula/Features/Messages/MessageModels.swift:227 |
| `/v1/modules/installed` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:277 |
| `/v1/modules/{x}/enable` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:344 |
| `/v1/modules/{x}/frontend` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:426 |
| `/v1/modules/{x}/install` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:326 |
| `/v1/modules/{x}/installation-descriptor` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:350 |
| `/v1/modules/{x}/installation-descriptor?platform=ios&hostVersion={x}` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:445 |
| `/v1/modules/{x}/package-install-plan` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:337 |
| `/v1/modules/{x}/permissions/review` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:356 |
| `/v1/modules/{x}/records/attachment` | MATCHED | ios/Modula/ModuleRuntime/ProductUIRenderer.swift:125 |
| `/v1/modules/{x}/records/{x}` | MATCHED | ios/Modula/ModuleRuntime/Bridge/ModuleBackendRequest.swift:19 |
| `/v1/modules/{x}/records/{x}?limit=100&recordState={x}&sort=updatedAt&direction=desc` | MATCHED | ios/Modula/ModuleRuntime/ProductUIRenderer.swift:206 |
| `/v1/modules/{x}/update` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:364 |
| `/v1/modules/{x}/version-preview` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:383 |
| `/v1/modules/{x}/versions?platform=ios&hostVersion={x}` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:374 |
| `/v1/moliboo/activities/complete` | MATCHED | ios/Modula/Features/MolibooGame/MolibooGameAPI.swift:14 |
| `/v1/moliboo/catalogue/items` | MATCHED | ios/Modula/Features/MolibooGame/MolibooGameAPI.swift:9 |
| `/v1/moliboo/catalogue/outfits` | MATCHED | ios/Modula/Features/MolibooGame/MolibooGameAPI.swift:10 |
| `/v1/moliboo/characters/{x}/care` | MATCHED | ios/Modula/Features/MolibooGame/MolibooGameAPI.swift:17 |
| `/v1/moliboo/characters/{x}/equip` | MATCHED | ios/Modula/Features/MolibooGame/MolibooGameAPI.swift:16 |
| `/v1/moliboo/characters/{x}/skills/{x}/use` | MATCHED | ios/Modula/Features/MolibooGame/MolibooGameAPI.swift:18 |
| `/v1/moliboo/characters/{x}/state` | MATCHED | ios/Modula/Features/MolibooGame/MolibooGameAPI.swift:15 |
| `/v1/moliboo/inventory` | MATCHED | ios/Modula/Features/MolibooGame/MolibooGameAPI.swift:11 |
| `/v1/moliboo/outfits` | MATCHED | ios/Modula/Features/MolibooGame/MolibooGameAPI.swift:12 |
| `/v1/moliboo/outfits/{x}` | MATCHED | ios/Modula/Features/MolibooGame/MolibooGameAPI.swift:19 |
| `/v1/moliboo/quests` | MATCHED | ios/Modula/Features/MolibooGame/MolibooGameAPI.swift:13 |
| `/v1/moliboo/quests/{x}/claim` | MATCHED | ios/Modula/Features/MolibooGame/MolibooGameAPI.swift:20 |
| `/v1/notifications/read-all` | MATCHED | ios/Modula/Features/Activity/ActivityRepository.swift:77 |
| `/v1/notifications/{x}/read` | MATCHED | ios/Modula/Features/Activity/ActivityRepository.swift:60 |
| `/v1/notifications?limit=30` | MATCHED | ios/Modula/Features/Activity/ActivityRepository.swift:135 |
| `/v1/posts` | MATCHED | ios/Modula/Features/Creation/Publishing/PublishingRepository.swift:20 |
| `/v1/posts/{x}` | MATCHED | ios/Modula/Features/Home/HomeRepository.swift:94 |
| `/v1/posts/{x}/comments` | MATCHED | ios/Modula/Core/Notifications/PushNotificationController.swift:213 |
| `/v1/posts/{x}/comments?limit=30` | MATCHED | ios/Modula/Features/Social/PostBackendCapabilities.swift:34 |
| `/v1/posts/{x}/like` | MATCHED | ios/Modula/Core/Notifications/PushNotificationController.swift:218 |
| `/v1/posts/{x}/reaction` | MATCHED | ios/Modula/Features/Social/PostRepository.swift:57 |
| `/v1/posts/{x}/repost` | MATCHED | ios/Modula/Features/Home/HomeRepository.swift:80 |
| `/v1/posts/{x}/save` | MATCHED | ios/Modula/Features/Home/HomeRepository.swift:64 |
| `/v1/posts/{x}/share` | MATCHED | ios/Modula/Features/Social/PostRepository.swift:103 |
| `/v1/premium/tiers` | MATCHED | ios/Modula/Features/Premium/PremiumModels.swift:45 |
| `/v1/profiles/me` | MATCHED | ios/Modula/Features/Profile/ProfileRepository.swift:201 |
| `/v1/profiles/me/follow-requests?limit=30` | MATCHED | ios/Modula/Features/Activity/ActivityRepository.swift:145 |
| `/v1/profiles/me/{x}` | MATCHED | ios/Modula/Features/Profile/ProfileRepository.swift:228 |
| `/v1/profiles/{x}` | MATCHED | ios/Modula/Features/Profile/ProfileRepository.swift:65 |
| `/v1/profiles/{x}/block` | MATCHED | ios/Modula/Features/Messages/MessagingRepository.swift:229 |
| `/v1/profiles/{x}/follow` | MATCHED | ios/Modula/Features/Activity/ActivityRepository.swift:105 |
| `/v1/profiles/{x}/followers` | MATCHED | ios/Modula/Features/Profile/ProfileRepository.swift:118 |
| `/v1/profiles/{x}/following` | MATCHED | ios/Modula/Features/Profile/ProfileRepository.swift:127 |
| `/v1/profiles/{x}/mute` | MATCHED | ios/Modula/Features/Profile/ProfileRepository.swift:161 |
| `/v1/profiles/{x}/posts?limit=1` | MATCHED | ios/Modula/Features/Activity/ActivityRedesign.swift:394 |
| `/v1/profiles/{x}/posts?limit=20` | MATCHED | ios/Modula/Features/Profile/ProfileRepository.swift:82 |
| `/v1/profiles/{x}/posts?limit=8` | MATCHED | ios/Modula/Features/Discover/DiscoverRepository.swift:139 |
| `/v1/profiles/{x}/{x}` | MATCHED | ios/Modula/Features/Settings/Real/SettingsAccountPages.swift:140 |
| `/v1/push/devices` | MATCHED | ios/Modula/Core/Notifications/PushNotificationController.swift:28 |
| `/v1/push/devices/{x}` | MATCHED | ios/Modula/Core/Notifications/PushNotificationController.swift:29 |
| `/v1/push/preferences` | MATCHED | ios/Modula/Core/Notifications/PushNotificationController.swift:30 |
| `/v1/reels` | MATCHED | ios/Modula/Features/Reels/ReelModels.swift:74 |
| `/v1/reels/{x}` | NO BACKEND ROUTE | ios/Modula/Features/Reels/ReelModels.swift:75 |
| `/v1/registry/artifacts/{x}` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:468 |
| `/v1/registry/modules/{x}` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:308 |
| `/v1/registry/modules/{x}/versions/{x}` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:394 |
| `/v1/registry/products` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:272 |
| `/v1/registry/products?limit=50` | MATCHED | ios/Modula/Features/Discover/DiscoverRepository.swift:100 |
| `/v1/registry/releases/{x}/descriptor?platform=ios&hostVersion={x}` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:437 |
| `/v1/reports` | MATCHED | ios/Modula/Features/Browser/ModulaInAppBrowser.swift:877 |
| `/v1/reports/me?limit=50` | MATCHED | ios/Modula/Features/Settings/Real/SettingsNotificationPages.swift:295 |
| `/v1/saves` | MATCHED | ios/Modula/Features/Saved/SavedModels.swift:18 |
| `/v1/search?q={x}&entityType=profile&limit=6` | MATCHED | ios/Modula/Features/Creation/Composer/CreationStudioStore.swift:160 |
| `/v1/search?{x}` | MATCHED | ios/Modula/Features/Discover/DiscoverRepository.swift:122 |
| `/v1/sessions` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:245 |
| `/v1/sessions/current` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:264 |
| `/v1/sessions/refresh` | MATCHED | ios/Modula/Core/Networking/GreenfieldClient.swift:689 |
| `/v1/sessions/{x}` | MATCHED | ios/Modula/Core/Networking/GreenfieldAccountClient.swift:95 |
| `/v1/status` | MATCHED | ios/Modula/Features/Settings/SettingsServiceModels.swift:198 |
| `/v1/stickers/packs` | MATCHED | ios/Modula/DesignSystem/AdvancedInteraction/ModulaComposerMediaPanel.swift:425 |
| `/v1/stories` | MATCHED | ios/Modula/Features/Stories/StoryModels.swift:104 |
| `/v1/stories/items/{x}/viewed` | MATCHED | ios/Modula/Features/Stories/StoryModels.swift:105 |
| `/v1/stories/rail` | MATCHED | ios/Modula/Features/Stories/StoryModels.swift:102 |
| `/v1/stories/{x}` | MATCHED | ios/Modula/Features/Stories/StoryModels.swift:103 |
| `/v1/support/cases` | MATCHED | ios/Modula/Features/Settings/SettingsServiceViews.swift:402 |
| `/v1/support/contact` | MATCHED | ios/Modula/Features/Settings/SettingsServiceViews.swift:395 |
