# Native Sync Policy

1. `ios/` and `android/` are first-class source.
2. Native changes must be reviewable.
3. `prebuild --clean` must never be used casually.
4. Config-plugin changes require an explicit native-sync step.
5. A native sync must begin from a clean Git working tree.
6. The generated diff must be inspected before committing.
7. CocoaPods must be refreshed after native dependency changes.
8. Native build validation must follow native dependency changes.

For Phase 2, runtime APIs are preferred for `expo-system-ui` and `expo-navigation-bar`.

Do not add their config plugins merely to change runtime colours.

After pulling Phase 2 native dependency changes on macOS:

```sh
pnpm install
cd ios
pod install
cd ..
```
