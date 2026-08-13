# Phase 7L-A Media Rendering Audit

Date: 2026-08-13
Evidence:

- `docs/validation/evidence/phase7l-a/browser-public/runtime-events.json`
- `docs/validation/evidence/phase7l-a/browser-public/network-resources.json`
- `curl -fsSI https://api.modula.digital/v1/media/3a058370-a6fe-43ef-b318-e0579599cfa0.png`
- Source media call sites found under `src/features/*`, `src/components/primitives/*`, and `src/platform/ui/*`

## Production media defect

| Media | HTTP status | MIME | Size | Browser result | Classification | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `https://api.modula.digital/v1/media/3a058370-a6fe-43ef-b318-e0579599cfa0.png` | `200` | `image/png` | `68` bytes | `net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` | CORS/CORP | BROKEN | P1 |

The image endpoint returns `Cross-Origin-Resource-Policy: same-origin` from `api.modula.digital`. The web app origin is `modula.digital`, so Chrome blocks the image even though the HTTP response is `200`.

## Public route media observations

| Screen | Images in DOM locator audit | Runtime media failures | Status |
| --- | --- | --- | --- |
| Login/Register/Forgot/Verify | `0` | `0` | WORKING |
| Home | `0` DOM image locators, but runtime image request observed | `1` blocked API media request | BROKEN |
| Discover | `0` DOM image locators | `0` in unauthenticated crawl | INCOMPLETE |
| Product Hub/Vault Notes/Profile/Activity | Redirected/protected or sign-in state | `0` media proof | INCOMPLETE |

## Source media surfaces requiring authenticated inspection

| Surface | Source evidence | Status | Priority |
| --- | --- | --- | --- |
| Avatars/profile images | `Avatar.tsx`, `AppAvatar.tsx`, `ProfileAvatar.tsx`, `ProfileCover.tsx` | INCOMPLETE | P1 |
| Story thumbnails/media | `useStoriesRailQuery.ts`, `StoryViewerScreen.tsx`, `StoryCreateScreen.tsx` | WORKING_WITH_DEFECTS | P1 |
| Post media | `post-body.tsx`, `media-post-card.tsx`, `FeedPostItem.tsx` | BROKEN | P1 |
| Discover media | `DiscoverScreen.tsx` | INCOMPLETE | P1 |
| Marketplace/module icons/screenshots | module registry API has no rendered screenshot proof in public crawl | INCOMPLETE | P1 |
| Local bundled images/logos | Splash asset is bundled; static deployed HTML exposes only JS and favicon | WORKING_WITH_DEFECTS | P2 |

## Required Phase 7L-B repair

Fix media response headers or media origin strategy so authenticated production web can render `https://api.modula.digital/v1/media/...` from `https://modula.digital` without CORP/CORS blocking. This is a P1 rendering defect because image posts can publish successfully but fail to render on web.
