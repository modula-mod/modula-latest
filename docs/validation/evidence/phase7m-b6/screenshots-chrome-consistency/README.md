# Phase 7M-B6 chrome-consistency recapture

Captured 2026-08-16 on **iPhone 17 Pro Simulator** (iOS 27.0, light) from `digital.modula.app` + Metro on `cursor/phase7m-b6-chrome-consistency-6d0c` (`0a035bc` plus the Customize switch-label fix).

These are **after** shots of the chrome remake. The rejected founder set remains in `screenshots/`.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
```

## Shots

| File | Surface | What changed vs rejected set |
| --- | --- | --- |
| `01-home.png` | Home | Header icons are glyphs inside the iOS 26 shared capsule — not glass discs nested in a glass pill |
| `04-profile.png` | Profile | Avatar overlaps cover only; compact Edit Profile on the avatar row; no overlapping identity sheet / More brick |
| `10-customize.png` | Customize | Grouped Settings list + switch; long-press to reorder; no up/down circles |
| `07-module-detail.png` | Vault Notes | One compact Open pill; Disable / Configure / Uninstall moved to overflow |
| `08-settings.png` | Settings | Overlay circular glass back + overflow (correct layer — not a native header capsule) |
| `05-board.png` | Board | No ControlGroup-in-Menu on module rows; overflow is header chrome |
| `03-activity.png` | Activity | Header overflow is a plain glyph in the capsule |

## Still visible on device (not claimed fixed)

- Compose plus is a filled teal circle next to outline tab icons (same 44pt hit, different fill)
- Cover atmosphere placeholders still show when there is no cover photo
- Floating tab bar still sits over the last Customize rows until you scroll
- Founder visual approval is still required
