# Phase 7L-B Hydration Runtime Evidence

Date: 2026-08-13
Repo: `/root/modula-latest`
Branch: `main`
Verification tree: committed Phase 7L-B hydration repair slice
Status: `PASS_LOCAL`

## Scope

This evidence covers the Phase 7L-B React hydration/runtime `#418` repair for local production web builds.

It does not close live production acceptance. It also does not close the media/CORP defect. The Playwright test uses minimal API fixtures only when `MODULA_BROWSER_BASE_URL` points at `localhost` or `127.0.0.1`, because the production bundle served from a local origin is not an allowed public origin for `https://api.modula.digital`.

Live runs against `https://modula.digital` do not use these localhost fixtures.

## Root Causes Fixed

1. `src/platform/ui/menus/chrome-overflow-menu.tsx`
   - `ChromeOverflowMenu` passed `ModulaIconButton` as the trigger into `ModulaMenu`.
   - On web, `ModulaMenu` already owns a pressable button, so the trigger produced invalid nested button markup.
   - The trigger is now a visual-only `View` with `AppIcon`, leaving one interactive menu button.

2. `src/platform/ui/navigation/platform-tabs.web.tsx`
   - Web tab layout selected desktop rail vs mobile bar from `useWindowDimensions()` during first render.
   - Static HTML cannot know browser width, so desktop browsers hydrated different markup from the server output.
   - The first client render now matches the server. Desktop rail activation occurs after hydration.

3. `scripts/serve-web-dist.mjs` and production `try_files ... /index.html`
   - Dynamic Expo routes such as `/profile/:handle` have HTML at `profile/[handle].html`.
   - Exact-path lookup missed those templates and fell back to Home `index.html`.
   - React then hydrated Home markup as `PublicProfileRoute`, which is runtime `#418`.
   - The dist server now resolves `[param]` and `[...catchAll]` templates before the Home fallback. Nginx uses the same exact-then-dynamic order.

## Verification

Command:

```sh
pnpm build:web
```

Result:

```text
web_version_marker_ok 89be7ac4b221b2d4716079bb959f4020fe04f1ae files=201
```

Command:

```sh
CI=true pnpm verify:phase7l-b:hydration
```

Result:

```text
Running 9 tests using 1 worker
9 passed
```

The hydration verifier is self-contained for local runs. `playwright.config.ts`
starts `pnpm build:web && node scripts/serve-web-dist.mjs` when
`MODULA_BROWSER_BASE_URL` targets `localhost` or `127.0.0.1`. Live runs against
`https://modula.digital` do not start a local server and do not install local API
fixtures.

Routes covered:

- `/sign-in`
- `/register`
- `/forgot-password`
- `/verify-email`
- `/`
- `/discover`
- `/settings`
- `/settings/appearance`
- `/settings/security`
- `/profile/phase7lb-hydration-probe`

Assertions:

- HTTP status `< 400`
- React hydration warnings/errors: `0`
- React `#418`: `0`
- `pageerror`: `0`
- `console.error`: `0`
- request failures: `0`

## Remaining Boundaries

- Live production still needs rerun after deployment of the fixed SHA.
- Authenticated hydration routes still require controlled-account browser proof.
- API media/CORS/CORP remains a separate Phase 7L-B P1 item and must be fixed at the production API/header layer.
