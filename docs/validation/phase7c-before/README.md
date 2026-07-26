# Phase 7C Before Screenshots

Date: 2026-07-26
Source: active public web release at `https://modula.digital`
Viewport: `1440x900`
Browser: system Google Chrome headless

Command shape:

```bash
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=1440,900 --virtual-time-budget=8000 --screenshot=<file> https://modula.digital<path>
```

Captured surfaces:

- `home-1440x900.png` from `/`
- `discover-1440x900.png` from `/discover`
- `composer-1440x900.png` from `/compose`
- `activity-1440x900.png` from `/activity`
- `profile-1440x900.png` from `/profile`
- `board-1440x900.png` from `/board`
- `product-hub-1440x900.png` from `/product`
- `vault-notes-1440x900.png` from `/module/digital.modula.vault-notes`
- `settings-1440x900.png` from `/settings`
- `appearance-1440x900.png` from `/settings/appearance`
- `login-1440x900.png` from `/sign-in`
- `registration-1440x900.png` from `/register`

Notes:

- The first capture pass caught some skeleton/loading states; files were retaken with `--virtual-time-budget=8000`.
- Screens reflect the unauthenticated/browser-local state available to the public web release.
