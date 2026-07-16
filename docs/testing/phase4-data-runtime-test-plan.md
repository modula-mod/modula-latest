# Phase 4 Data Runtime Test Plan

Run from `/home/andrei/modula-latest`:

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
pnpm verify:phase4
pnpm exec expo export --platform web
git diff --check
```

Web route smoke test:

```sh
CI=1 BROWSER=none pnpm web --port 8090
```

Routes to test:

- `/`
- `/welcome`
- `/sign-in`
- `/create-account`
- `/recover`
- `/profile`
- `/profile/gaia.modula`
- `/profile/gaia.modula/followers`
- `/profile/gaia.modula/following`
- `/saved`
- `/settings/account`
- `/settings/developer`
- `/settings/developer/data-runtime`
- `/settings/developer/session`

Failure-path matrix: initial loading, slow loading, offline, timeout, 401/session expiry, 403, 404, 409, 429, 500, invalid response and cancelled request.

Physical-device acceptance must cover Phase 2 appearance, Phase 3 profile, Phase 4 data/auth, SecureStore restoration, offline local mode and screenshot matrix.
