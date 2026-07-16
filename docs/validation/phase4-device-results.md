# Phase 4 Device Results

No physical-device result is claimed until the combined Phase 4 development client is built and tested.

| Target | Status | Evidence |
|---|---|---|
| Web development | PASS | `CI=1 BROWSER=none pnpm web --port 8090`; requested routes returned HTTP 200 |
| Web export | PASS | `pnpm exec expo export --platform web` exported 44 static routes |
| iOS Simulator | NOT TESTED | Pending development-client run |
| Physical iPhone development client | NOT TESTED | Pending EAS/dev-client build and device test |
| Android emulator | NOT TESTED | Pending emulator run |
| Android physical device | NOT TESTED | Pending device run |

SecureStore physical-device test status: NOT TESTED.

Offline local-mode physical-device test status: NOT TESTED.

Screenshot matrix status: NOT CAPTURED.

## Local Validation Notes

Passing:

- `pnpm install`
- `pnpm exec expo install --check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm verify:phase1`
- `pnpm verify:phase2`
- `pnpm verify:theme`
- `pnpm verify:phase3`
- `pnpm verify:phase4`
- `pnpm exec expo export --platform web`
- `git diff --check`

Expo Doctor:

`pnpm exec expo-doctor` reports 19/20 checks passing and fails only the known native-folder/non-CNG warning: native project folders exist while native config remains in `app.config.ts`, so EAS Build will not sync those config fields.

Web dev-server notes:

- Expo attempted to install React Native DevTools and Electron failed because the process runs as root without `--no-sandbox`.
- A Node `NO_COLOR`/`FORCE_COLOR` warning appears during web bundling.
- No Phase 4 auth require-cycle warning remains.
