# Phase 7L-A Static Asset Audit

Date: 2026-08-13
Production origin: `https://modula.digital`

## Deployed static assets

| Asset | HTTP status | MIME | Cache | ETag | Size | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | `200` | `text/html; charset=utf-8` | `no-cache, must-revalidate` | none | `51336` bytes | WORKING |
| `/_expo/static/js/web/entry-c56be356e1a8d2c778391d4d0481229e.js` | `200` | `application/javascript; charset=utf-8` | `public, max-age=31536000, immutable` | `W/"6a7bad5c-3c7d01"` | `3964161` bytes | WORKING |
| `/favicon.ico` | `200` | `image/x-icon` | `public, max-age=31536000, immutable` | `W/"6a7b502b-38ae"` | `14510` bytes | WORKING |
| `/version.json` | `200` | `application/json` | `no-store` | `W/"6a7dd802-125"` | `293` bytes | WORKING |
| `/.well-known/apple-app-site-association` | `200` | `application/octet-stream` | `no-cache, must-revalidate` | `"6a7dd7f9-12d"` | `301` bytes | WORKING_WITH_DEFECTS |
| `/.well-known/assetlinks.json` | `200` | `application/json` | `no-cache, must-revalidate` | `W/"6a7dd7f9-186"` | `390` bytes | WORKING |
| Ionicons font TTF | `200` | `font/ttf` | `public, max-age=31536000, immutable` | `W/"6a7bad5c-5f25c"` | response body not measured in browser resource list | WORKING |

## Well-known contents

| File | Result | Status | Notes |
| --- | --- | --- | --- |
| `apple-app-site-association` | Contains `applinks` and `webcredentials` for `M29V4ZGUNK.digital.modula.app` | WORKING_WITH_DEFECTS | MIME is `application/octet-stream`; verify Apple acceptance in native phase |
| `assetlinks.json` | Contains Android package `digital.modula.app` and fingerprint `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C` | WORKING | Browser curl returned JSON |

## Staleness check

The deployed JS asset belongs to production commit `2ef3755082b46e49fe62424e93d4a4de9c6f1e17`, while source `main` is `fb4b58c07bf475d99ab6792d367058331257ea97`. This is expected beta pinning, not a missing hashed asset by itself.

## Defect classification

| Defect | Status | Priority | Evidence |
| --- | --- | --- | --- |
| Missing initial HTML CSS/font/image links | WORKING_WITH_DEFECTS | P2 | Expo web bundle loads most runtime assets from JS |
| AASA MIME not JSON | WORKING_WITH_DEFECTS | P2 | `content-type: application/octet-stream` |
| Stale production relative to `main` | STALE | P0 | Production pinned to beta tag by design |
