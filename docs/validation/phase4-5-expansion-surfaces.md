# Phase 4.5 Expansion Surfaces — Validation

Branch: `phase4-5-native-ui-recovery`  
Scope: social UX expansion (Marketplace, Settings hierarchy, account panel destinations, Discover/Board/Activity wiring).

## Routes added / upgraded

| Route | Surface |
|---|---|
| `/marketplace` | Browse Featured / New / For you, categories, search |
| `/marketplace/[moduleId]` | Module detail + Preview install |
| `/marketplace/seller/[sellerId]` | Creator preview card |
| `/messages`, `/messages/[threadId]` | Seeded inbox + thread |
| `/lists`, `/lists/[listId]` | Custom lists / feeds Preview |
| `/collections`, `/collections/[collectionId]` | Saved collections Preview |
| `/drafts` | Composer drafts Preview |
| `/communities`, `/communities/[topicId]` | Communities + trending topic pages |
| `/creator`, `/creator/insights`, `/creator/monetization` | Creator Studio Preview |
| `/help`, `/help/[articleId]`, `/help/shortcuts` | Help center + shortcuts |
| `/whats-new` | Release notes |
| `/account/switcher` | Account switcher Preview (modal) |
| `/share-profile` | QR / share profile sheet |
| `/report` | Multi-step report Preview |
| `/reactions` | Sticker/reaction picker Preview |
| `/post/[postId]/analytics` | Post analytics from View engagement |
| `/settings/privacy` | Privacy & Safety |
| `/settings/notifications` | Notification toggles |
| `/settings/content` | Content & Media |
| `/settings/language` | Language & Translate |
| `/settings/marketplace` | Marketplace preferences |
| `/settings/data` | Data & storage |
| `/settings/about` | About / version (long-press → Developer in `__DEV__`) |
| `/settings/help` | Help settings |
| `/settings/mute-words` | Mute words Preview |
| `/settings/blocked` | Blocked accounts Preview |
| `/settings/inner-circle` | Inner circle Preview |

## Account panel

Extras registered via `registerAccountPanelDestination` in  
`src/features/social/registerExpansionDestinations.ts` (imported from root layout):

- Lists, Collections, Drafts, Creator Studio, Help & Support, Accounts

Core destinations (Board, Saved, Messages, Marketplace, Appearance, Settings, Developer) remain owned by Phase 4.5 panel API.

## Dummy links removed

| Before | After |
|---|---|
| Settings rows → `Alert` stubs | Real nested Settings screens |
| Marketplace FeaturePreview dead end | Seeded browse + detail + seller |
| Board module `Alert` | `/marketplace/[moduleId]` |
| Discover topics non-pressable | `/communities/[topicId]` |
| Discover modules non-pressable | Marketplace detail |
| Activity action buttons inert | Profile / Marketplace / Teams / Home |
| Composer “Browse tools” Alert | Navigates to Marketplace |
| View engagement Alert | `/post/[postId]/analytics` |
| Report / Mute Alerts | `/report`, `/settings/mute-words` |

## Verifiers

- `pnpm typecheck`
- `pnpm verify:phase4`
- `pnpm verify:phase4-5`

Marketplace seed data lives in `src/features/marketplace/data/catalog.ts` with **no** `@/demo/*` imports.

## Manual smoke (Simulator)

1. Open account panel → Lists / Marketplace / Help / Creator
2. Settings → each preference row opens a real page
3. Discover → topic pill → community topic page
4. Board pinned Marketplace / Saved
5. Activity filter menu + row destinations
6. Composer Tools → Browse tools → Marketplace
7. Post More → View engagement → analytics Preview
