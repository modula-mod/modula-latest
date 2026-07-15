# Native Project Policy

Modula uses Expo without treating native projects as disposable forever.

## Intended model

```text
Expo SDK modules
+ React Native
+ committed iOS project
+ committed Android project
+ Xcode builds
+ Gradle builds
+ optional EAS builds
```

## Phase 0 rules

1. Do not generate `ios/` / `android/` until the JS foundation passes typecheck, lint, and practical web smoke.
2. Generate with `pnpm exec expo prebuild --clean`.
3. Commit both native directories after a clean prebuild.
4. Prefer `ios/Modula.xcworkspace` over the `.xcodeproj` once CocoaPods is integrated.
5. Do not edit generated native files before the clean prebuild commit.
6. Do not configure EAS Update, update channels, or runtime-version OTA policies in Phase 0.
7. Native builds must initially run the JavaScript bundle included with that build.

After native customisation begins, treat `ios/` and `android/` as first-class source.

## expo-doctor note

After `ios/` and `android/` are committed, `expo-doctor` may warn that app config fields will not sync unless prebuild runs in the build pipeline. This is expected for Modula’s native-controlled model: regenerate with `pnpm prebuild:clean` when app config identity or plugins change, then review the native diff before committing.
