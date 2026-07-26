# Phase 7C Native Acceptance

Status: BLOCKED
Date: 2026-07-26
Repository: `/home/andrei/modula-latest`
Branch: `phase7c-modula-product-realisation`
Deployment commit: `1e9e7009fb7a648517594cfd4a1302100e971f8b`
Build number: not produced
Device information: not recorded
Physical iPhone: not accepted
TestFlight candidate: not produced
API version: `v1`
Environment: live Greenfield backend at `https://api.modula.digital`
Tester: pending physical-device validation
Result: BLOCKED

## Evidence

Native acceptance has not been completed for this branch. The required physical iPhone replay, clean iOS development build installation, and TestFlight candidate installation/upgrade checks are still pending.

Completed supporting evidence:

- Web after screenshots are recorded in `docs/validation/phase7c-after/README.md`.
- Live Greenfield API acceptance is recorded in `docs/validation/phase7c-live-acceptance.md`.
- The deployed API, Worker, migrations, media persistence, Board persistence, Product Hub module lifecycle, and Vault Notes install/enable/disable/uninstall flows have passed live VPS validation.

Pending physical iPhone checks:

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

Pending build checks:

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

## Current Blocker

This environment has completed VPS, deployed web and live API acceptance, but it has not completed physical iPhone validation or TestFlight candidate validation. Phase 7C must remain in Release Candidate status until this document can be updated to `Status: ACCEPTED` with real device and build evidence.

Phase 7D work has not started.

## Verification commands

```bash
pnpm exec expo install --check
pnpm typecheck
pnpm lint
pnpm exec eas build --platform ios --profile development
pnpm exec eas build --platform ios --profile preview
node scripts/verify-phase7c-native-readiness.mjs
node scripts/verify-phase7c-release-candidate.mjs
node scripts/verify-phase7c-founder-alpha.mjs
```

Do not mark this file accepted until the physical iPhone, development build and TestFlight candidate evidence are recorded.
