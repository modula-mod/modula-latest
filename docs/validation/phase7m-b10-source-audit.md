# Phase 7M-B10 source and environment audit

**Recorded:** 2026-08-21  
**Starting commit:** `5b0ccbed43df9db5298a731c5d07ef0434b86d8c`  
**Starting branch:** `cursor/phase7m-b9-product-hub-exact-reconstruction`  
**B10 branch:** `cursor/phase7m-b10-product-hub-founder-fidelity`  
**Production deployment:** not authorised

## Checkout preservation

The requested `/Users/msjoy/Developer/modula-latest` checkout is on the older B8
branch and contains unrelated founder-owned changes. It was not cleaned or
switched. B10 was created as a dedicated worktree from the clean B9 worktree at
the exact requested commit.

## Registry and Vault Notes truth

- Canonical product ID: `digital.modula.vault-notes`.
- Canonical source: `modula-mod/modula-vault-notes`.
- Canonical source HEAD at audit: `d92e4455cd56f95b0109e3dc8f1df0c8a52c60da`.
- Immutable source release: `vault-notes-v1.1.0` at
  `f443972d53f94b6f192a37bcce8742bdf18a99b5`.
- Release date: `2026-08-01T16:34:15Z` (GitHub release); tag commit authored at
  `2026-08-01T15:41:25+01:00`.
- Release asset: `modula-vault-notes-1.1.0.tgz`, 26,458 bytes, SHA-256
  `46f918b07dc7d9c2734be4e6bb7729c137d316ceaa3f9d272da1bd7f78ad253a`.
- Production registry, inspected read-only through `ssh modula-vps`, still serves
  the historical `0.2.0` release and an empty normalized `marketplace` section.
- Production VPS checkout: detached at
  `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a`.
- Production was not modified.

The external Vault Notes repository already owns declarative home, collection,
detail, editor, search, favourites, archive, trash, folders, settings, empty,
and error views. B10 may add verified product metadata to that canonical module;
it must not move those screens into host feature code.

## Expo local-authentication audit

`expo-local-authentication@16.0.5` is directly declared in the root application,
not transitive. B8 added it for local App Lock. It is dynamically imported by
`src/features/security/app-lock/app-lock-context.tsx` and linked into the tracked
iOS project as `ExpoLocalAuthentication (16.0.5)`.

For the pinned Expo `57.0.15` SDK, `pnpm exec expo install --check` recommends
`expo-local-authentication@~57.0.2` and exits 1 while 16.0.5 remains installed.

### Isolated correction decision

The correction is safe and narrowly scoped: change only
`expo-local-authentication` to `~57.0.2`, refresh the package lock, and refresh
the matching CocoaPods resolution. Do not perform a broad dependency upgrade.
Afterward, rerun Expo install check, Expo Doctor, typecheck, and iOS Release.

## Expo Doctor native-folder warning

Both `ios/` and `android/` are intentionally committed and maintained as
first-class native projects. The warning that app-config fields may not sync in
a non-CNG project is therefore expected and already covered by
`docs/architecture/native-project-policy.md` and
`docs/architecture/native-sync-policy.md`.

- Cause: tracked native projects coexist with plugin/native fields in
  `app.config.ts`.
- Actionable in B10: no. B10 does not change native identity or plugins.
- Required discipline: mirror future native-affecting config changes explicitly,
  review native diffs, and rebuild both platforms.
- Forbidden response: deleting native folders or running `prebuild --clean`
  merely to silence Expo Doctor.

