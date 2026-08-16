# Phase 7M-B6 NativeTabs / Liquid Glass recapture

Captured 2026-08-16 on **iPhone 17 Pro Simulator** (iOS 27.0, light) from `digital.modula.app` + Metro on `cursor/phase7m-b6-native-tabs-6d0c`.

These are **after** shots of Expo Router `NativeTabs` (system iOS 26 Liquid Glass `UITabBarController`) and overlay trailing groups sized like Profile.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
```

## Overlay group = Profile size

Customize and Module Detail do **not** use compact SwiftUI `ControlGroup`. Trailing share/save + overflow is an RN capsule:

- **44pt** hits (`TOOLBAR_HIT`, same as Profile `unstable_headerRightItems`)
- **22pt** gap (`HEADER_ICON_PAIR_GAP`)
- **110×44pt** lock (`44 + 22 + 44`)

### Size check (three passes, iPhone 17 Pro @3x)

| Pass | Profile capsule | Customize group | Module group |
| --- | --- | --- | --- |
| 1 | 113.3 × 45.3 pt | 110.0 × 44.0 pt | 110×44 coded; shadow bbox ~120 × 50 |
| 2 | 113.3 × 45.3 pt | 110.0 × 44.0 pt | same |
| 3 | 113.3 × 45.3 pt | 110.0 × 44.0 pt | same |

Customize matched the coded 110×44 on all three passes (Δ Profile ≤ 4pt). Isolated crops: `04-profile-group-crop.png`, `10-customize-group-crop.png`, `07-module-detail-group-crop.png`.

## Shots

| File | Surface | What to look at |
| --- | --- | --- |
| `01-home.png` | Home | System NativeTabs: Home / Discover / Activity / Profile. No Create tab. No dark Callstack pill |
| `03-activity.png` | Activity | Same NativeTabs; selected Activity. Header control group is mark-read + settings + overflow |
| `04-profile.png` | Profile | Same NativeTabs; selected Profile. Share + overflow are plain glyphs in the native header capsule |
| `05-board.png` | Board | Root stack (drawer destination). No hidden-tab crash. No tab bar |
| `07-module-detail.png` | Vault Notes | extraLarge glass back; share + overflow in one **110×44** capsule. No tab bar |
| `08-settings.png` | Settings | extraLarge glass back + overflow circle. No tab bar (root stack) |
| `10-customize.png` | Customize | extraLarge glass back; save check + overflow in one **110×44** capsule. No tab bar |

## Still visible on device (not claimed fixed)

- iOS 26 NativeTabs is itself a floating glass capsule — that is the system bar, not the retired Callstack pill
- Cover atmosphere placeholders still show when there is no cover photo
- Founder visual approval is still required
