# Phase 6S — Simulator social-product acceptance

**Date:** 2026-07-18  
**Branch:** `phase6s-social-product-completion`  
**Scope:** Static + code-path acceptance prior to physical iPhone / TestFlight.

## Status

| Gate | Result |
| --- | --- |
| Contracts (PART 1) | PASS |
| Backend social APIs (PART 2, in-repo) | PASS (`verify:phase6s-social-backend`) |
| Frontend social surfaces (PART 3) | PASS (`verify:phase6s-social-frontend`) |
| Interactive Simulator walk | **DEFERRED** — live API returned 502; resume after VPS restore |
| Physical iPhone | **BLOCKED** — no paired physical device |
| VPS migrate / backup restore | **DEFERRED** — SSH unlock when operator is home (`phase6s-backup-restore.md`) |
| TestFlight | **BLOCKED** — requires physical + VPS gates |

## Simulator checklist (resume after API healthy)

```text
Create account / Verify / Sign in
Home feed
React / Change reaction / Remove reaction
Comment / Reply / Edit / Delete
Repost / Quote / Save
Follow / Notifications / Search
Profile edit / Appearance
Extension Centre / Plugin lifecycle / Function execution
Offline state
```

Record PASS/FAIL only after an interactive run on Simulator. Do not equate Simulator with physical-device acceptance.

## Notes

- In-repo Phase 6S frontend/backend verifiers already PASS on Mac.
- Remote interactive acceptance waits on VPS SSH + API recovery.
- When home: restore API, then run `pnpm exec expo run:ios` and fill PASS/FAIL rows above.
