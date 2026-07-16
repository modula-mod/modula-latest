# Phase 3 Profile Test Plan

Local validation:

```sh
pnpm install
pnpm exec expo install --check
pnpm exec expo-doctor
pnpm typecheck
pnpm lint
pnpm verify:phase1
pnpm verify:phase2
pnpm verify:theme
pnpm verify:phase3
pnpm exec expo export --platform web
git diff --check
```

Web route checks:

- `/profile`
- `/profile/edit`
- `/profile/customize`
- `/profile/preview`
- `/profile/andrei.modula`
- `/profile/andrei.modula/followers`
- `/profile/andrei.modula/following`
- `/profile/gaia.modula`
- `/profile/design.modula`
- `/profile/andrei.modula?tab=media`
- `/profile/andrei.modula?tab=modules`

Viewport checks:

- 390px
- 768px
- 1024px
- 1440px

Physical-device acceptance remains required before declaring Phase 3 complete.
