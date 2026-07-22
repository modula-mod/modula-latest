# Phase 7B Browser Validation

Date: 2026-07-21
Branch: `phase7b-greenfield-module-host`

## Tooling

- Installed system browser outside the repository dependency graph: `Google Chrome 150.0.7871.128`.
- No Playwright, Puppeteer, or browser package was added to `package.json`.
- Static build served from `dist/` through an Expo Router-aware local static server on `http://127.0.0.1:8100`.

## Export

- `CI=1 BROWSER=none EXPO_NO_DEVTOOLS=1 pnpm exec expo export --platform web`
- Result: exported 172 static routes to `dist/`.

## Route Checks

All returned HTTP 200 from the local validation server:

- `/product`
- `/marketplace`
- `/marketplace/digital.modula.vault-notes`
- `/settings/modules`
- `/settings/modules/digital.modula.vault-notes`
- `/module/digital.modula.vault-notes`
- `/module/digital.modula.vault-notes/note-editor`
- `/compose`
- `/post/phase7b`

## Screenshot Matrix

Screenshots were captured into `docs/validation/phase7b-screenshots/` for four viewports:

- 390 x 844
- 430 x 932
- 768 x 1024
- 1440 x 900

Screens captured:

- Product Hub: `product-hub-*`
- Module catalogue: `module-catalogue-*`
- Module detail: `module-detail-*`
- Settings -> Modules: `settings-modules-*`
- Module management: `module-management-*`
- Generic module route gate: `generic-module-route-*`
- Vault Notes editor route gate: `vault-notes-editor-*`
- Composer route: `composer-tool-*`
- Post route: `post-save-to-vault-*`

Notes:

- Static unauthenticated screenshots intentionally show safe permission/install gates for hosted module routes.
- Authenticated Vault Notes CRUD, install/enable/update/uninstall, and Save to Vault return-intent flows require live Greenfield API and Worker acceptance.
- Native iOS, physical iPhone, TestFlight, and Android native acceptance remain deferred by Phase 7B scope.
