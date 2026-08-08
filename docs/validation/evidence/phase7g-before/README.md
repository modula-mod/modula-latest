# Phase 7G Before Screenshots

Captured: 2026-08-08
Commit: `f7a1902d856563ee2fbde302b5ecfdc87d645897`
Artifact: fresh `pnpm build:web` output served from `dist/`.

Capture method:

```sh
python3 route-rewrite static server on http://127.0.0.1:4173
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=390,844 --virtual-time-budget=6000 --screenshot=...
```

Limitations:

- This is web/static evidence only.
- It does not replace iOS Simulator screenshots.
- It does not prove authenticated remote sessions.
- Several data surfaces show offline/error cards because the static session had no authenticated live runtime.

Screenshots:

- `welcome-390x844.png`
- `create-account-390x844.png`
- `login-390x844.png`
- `home-390x844.png`
- `stories-390x844.png`
- `composer-390x844.png`
- `discover-390x844.png`
- `activity-390x844.png`
- `profile-390x844.png`
- `board-390x844.png`
- `product-hub-390x844.png`
- `marketplace-390x844.png`
- `module-detail-390x844.png`
- `vault-notes-390x844.png`
- `settings-390x844.png`
- `appearance-390x844.png`
- `reels-390x844.png`
- `error-390x844.png`
