# Phase 7M-B5 — stack inspect (do not assume)

Recorded 2026-08-15 on `cursor/phase7m-b5-visual-refinement-6d0c`.

```
PRODUCT_HEAD= (this branch; see git log)
PR19_HEAD=70a8f89  (cursor/phase7m-b2-vault-notes-canonical-b6a2)
MAIN_HEAD=6459087  (origin/main after fetch)
```

Resolved (never assumed):

| Package | Version |
| --- | --- |
| Expo | 57.0.12 |
| RN | 0.86.2 |
| React | 19.2.3 |
| RN Web | 0.21.2 |
| Expo Router | 57.0.12 |
| @expo/ui | 57.0.10 |
| Reanimated | 4.5.1 |
| Gesture Handler | 2.32.0 |
| expo-image | 57.0.2 |
| expo-video | 57.0.2 |
| expo-blur | 57.0.2 |
| expo-glass-effect | 57.0.1 |
| Skia | 2.6.2 |

`pnpm exec expo install --check` reports patch drift (wants expo 57.0.13 / @expo/ui 57.0.11). **Do not upgrade.** Mission forbids SDK upgrade.

`pnpm exec expo-doctor` historically 18/20: app.config non-CNG sync + package version mismatch. Same: do not “fix” by upgrading.
