# Phase 7G After Screenshots

Captured: 2026-08-08
Commit marker: `f7a1902d856563ee2fbde302b5ecfdc87d645897`
Artifact: rebuilt `dist/` after checkpoint remediation.

Capture method:

```sh
python3 route-rewrite static server on http://127.0.0.1:4173
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=390,844 --virtual-time-budget=6000 --screenshot=...
BROWSER=none pnpm web -- --port 8082
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=390,844 --virtual-time-budget=12000 --screenshot=...
```

Screenshots:

- `home-390x844.png`
- `stories-390x844.png`
- `appearance-390x844.png`
- `web-dev-home-390x844.png` - captured the web dev-server nested-button overlay before the context-menu fallback fix.
- `web-dev-home-fixed-390x844.png` - Home after `ModulaContextMenu` web fallback stopped rendering a nested button wrapper.

Limitations:

- Static web screenshots do not prove native iOS behavior.
- The static session still shows offline cards for protected data surfaces.
- Story media picker cannot be exercised in headless Chrome.
- `pnpm web` starts under `BROWSER=none`, but root execution still logs DevTools/open-browser sandbox warnings and route/client hydration timing can make direct `curl /` report 404 before the rendered app is available in Chrome.
