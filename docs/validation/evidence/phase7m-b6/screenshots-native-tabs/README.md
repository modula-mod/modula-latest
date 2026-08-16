# Phase 7M-B6 NativeTabs / Liquid Glass recapture

Captured 2026-08-16 on **iPhone 17 Pro Simulator** (iOS 27.0, light) from `digital.modula.app` + Metro on `cursor/phase7m-b6-native-tabs-6d0c`.

These are **after** shots of Expo Router `NativeTabs` (system iOS 26 Liquid Glass `UITabBarController`) and overlay `ControlGroup` capsules. Earlier sets remain in `screenshots/` (rejected founder chrome), `screenshots-chrome-consistency/`, and `screenshots-toolbar-back/`.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
```

## Shots

| File | Surface | What to look at |
| --- | --- | --- |
| `01-home.png` | Home | System NativeTabs: Home / Discover / Activity / Profile. No Create tab. No dark Callstack pill |
| `03-activity.png` | Activity | Same NativeTabs; selected Activity. Header control group is mark-read + settings + overflow |
| `04-profile.png` | Profile | Same NativeTabs; selected Profile. Share + overflow are plain glyphs in the native header capsule |
| `05-board.png` | Board | Root stack (drawer destination). No hidden-tab crash. No tab bar |
| `07-module-detail.png` | Vault Notes | extraLarge glass back; share + overflow in **one** ControlGroup capsule. No tab bar |
| `08-settings.png` | Settings | extraLarge glass back + overflow circle. No tab bar (root stack) |
| `10-customize.png` | Customize | extraLarge glass back; save check + overflow in one ControlGroup. No tab bar |

## Still visible on device (not claimed fixed)

- iOS 26 NativeTabs is itself a floating glass capsule — that is the system bar, not the retired Callstack pill
- Cover atmosphere placeholders still show when there is no cover photo
- Founder visual approval is still required
