# Phase 7C Native Packaging Deferral

Status: DEFERRED
Date: 2026-07-28
Repository: `/home/andrei/modula-latest`
Branch: `phase7c-modula-product-realisation`
Deployment commit: `1e9e7009fb7a648517594cfd4a1302100e971f8b`
Build number: intentionally not produced during Phase 7C
EAS Build: deferred to native packaging phase
Device information: deferred to native packaging phase
Physical iPhone: deferred to native packaging phase
TestFlight candidate: deferred to native packaging phase
API version: `v1`
Environment: live Greenfield backend at `https://api.modula.digital`
Tester: Codex local and VPS validation
Result: DEFERRED; not a Phase 7C release blocker

## Evidence

Native packaging is deferred by Phase 7C-C policy. This phase deliberately excludes EAS Build, EAS Submit, TestFlight upload, development-client generation, provisioning profiles, Apple signing and App Store submission.

Phase 7C native scope is limited to readiness checks: dependency alignment, app config presence, platform UI boundaries, and documentation that the later native packaging phase owns physical device and TestFlight acceptance.

Completed supporting evidence:

- Web after screenshots are recorded in `docs/validation/phase7c-after/README.md`.
- Live Greenfield API acceptance is recorded in `docs/validation/phase7c-live-acceptance.md`.
- The deployed API, Worker, migrations, media persistence, Board persistence, Product Hub module lifecycle, and Vault Notes install/enable/disable/uninstall flows have passed live VPS validation.
- `node scripts/verify-phase7c-native-readiness.mjs` verifies the Expo SDK 57 dependency/config baseline and platform UI import boundary.

Deferred physical iPhone checks for the native packaging phase:

- Navigation
- Drawer
- Gestures
- Keyboard
- Safe areas
- Dark mode
- OLED mode
- Accessibility
- Blur
- Animations
- Haptics
- Deep links, where implemented
- Onboarding
- Login
- Feed
- Composer
- Media upload
- Notifications
- Board
- Product Hub
- Settings
- Appearance
- Accessibility preferences
- Logout

Deferred build checks for the native packaging phase:

- Clean iOS development build
- Physical iPhone development-build installation
- Physical iPhone development-build launch
- API connectivity from device
- TestFlight candidate production
- TestFlight installation
- TestFlight upgrade path
- TestFlight launch
- TestFlight login
- TestFlight feed, posting, image upload, Board, Product Hub, Settings and logout

## Phase 7C Release Gate

Phase 7C release-candidate verification must require backend completion, frontend completion, deployment evidence, migration evidence, backup evidence, live product validation and completed documentation.

Phase 7C release-candidate verification must not require physical iPhone acceptance, EAS Build, EAS Submit, development-client generation, TestFlight upload or App Store submission. Those activities are intentionally moved to the later native packaging phase.

Phase 7D work has not started.

## Verification commands

```bash
pnpm exec expo install --check
pnpm typecheck
pnpm lint
node scripts/verify-phase7c-native-readiness.mjs
node scripts/verify-phase7c-release-candidate.mjs
node scripts/verify-phase7c-founder-alpha.mjs
```

Do not convert this file to native acceptance evidence during Phase 7C. Create a separate native packaging acceptance record when physical device, development build and TestFlight validation actually happen.
