# Accessibility support matrix

**Product:** Modula  
**Date:** 2026-08-28  
**Branch:** `cursor/shell-ui-v1-reconstruction`  
**Installed:** Expo SDK 57.0.16 / React Native 0.86.2 / iOS Simulator iPhone 17 Pro  

**Sources:** [Apple iPhone Accessibility](https://support.apple.com/guide/iphone/get-started-with-accessibility-features-iph3e2e415f/ios), [Display & Text Size](https://support.apple.com/guide/iphone/adjust-the-display-and-text-size-iph3e2e1fb0/ios), [VoiceOver](https://support.apple.com/guide/iphone/turn-on-and-practice-voiceover-iph3e2e415f/ios), [Human Interface Guidelines — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).

**Legend**

| Class | Meaning |
| --- | --- |
| INHERITED | Modula uses the OS behaviour without an app preference |
| DETECTABLE | Public API reports the current OS state |
| SUPPORTED | Core Modula workflows remain usable with the feature |
| APP_OVERRIDE_AVAILABLE | Modula can force On/Off; default is System |
| SYSTEM_ONLY | OS-owned; Modula must not expose a fake toggle |
| NOT_APPLICABLE | Not a Modula product concern |
| NOT_AVAILABLE_ON_THIS_PLATFORM | No public API or not present |

`System` in Settings always means: follow the current operating-system preference.

**Preference precedence** (where an app override exists):

1. Explicit Modula override (`on` / `off` / custom text scale)
2. System accessibility preference
3. Theme / default behaviour

System-only features: the system preference wins. System state is observed, never persisted as a user setting.

---

## Vision

| Feature | iOS | Android | Web | Classification | Modula exposure |
| --- | --- | --- | --- | --- | --- |
| VoiceOver / TalkBack / screen reader | DETECTABLE via `AccessibilityInfo.isScreenReaderEnabled` | DETECTABLE | Partial (browser AT) | SYSTEM_ONLY + DETECTABLE. SUPPORTED is **not claimed** until VoiceOver manual journey PASS | Info row: Active / Uses your device settings |
| Zoom | INHERITED | INHERITED | INHERITED | SYSTEM_ONLY. Layout uses scalable type, not rasterised essential text | Compatibility note only |
| Hover Text | INHERITED | N/A | N/A | SYSTEM_ONLY. Labels remain text, not images | Compatibility note |
| Dynamic Type / font scale | INHERITED + SUPPORTED (`allowFontScaling` when Text Size is System) | INHERITED | Browser zoom | INHERITED + SUPPORTED + APP_OVERRIDE_AVAILABLE | Display & Text → Text Size |
| Bold Text | DETECTABLE (`isBoldTextEnabled`) | Limited | No | INHERITED + DETECTABLE + APP_OVERRIDE_AVAILABLE | Bold Text System/On/Off |
| Increase Contrast | DETECTABLE (`isHighTextContrastEnabled` / `isDarkerSystemColorsEnabled`) | Limited | `prefers-contrast` not wired | DETECTABLE + APP_OVERRIDE_AVAILABLE | Increase Contrast System/On/Off |
| Reduce Transparency | DETECTABLE (`isReduceTransparencyEnabled`) | Limited | No | DETECTABLE + APP_OVERRIDE_AVAILABLE | Reduce Transparency System/On/Off |
| Differentiate Without Color | **No public RN API** | No | No | APP_OVERRIDE_AVAILABLE. System cannot be inherited until an API exists (System currently resolves off) | Differentiate Without Color System/On/Off |
| On/Off Labels (iOS) | **No public RN API** | N/A | N/A | APP_OVERRIDE_AVAILABLE as Modula “On/Off Indicators” | Controls section |
| Reduce White Point | SYSTEM_ONLY | N/A | N/A | INHERITED. No app brightness hack | Not exposed |
| Colour Filters / Smart Invert / Grayscale | Grayscale + invert DETECTABLE | Partial | No | INHERITED. Semantic meaning is not colour-only when Differentiate Without Color is On | Not exposed as toggles |
| Audio Descriptions | SYSTEM_ONLY | SYSTEM_ONLY | If media has tracks | Preserve tracks if present. Do not claim tracks that do not exist | Not a fake toggle |
| Live Recognition | SYSTEM_ONLY | N/A | N/A | Do not interfere | Not exposed |

## Motion

| Feature | Classification | Modula |
| --- | --- | --- |
| Reduce Motion | INHERITED + DETECTABLE + APP_OVERRIDE_AVAILABLE | Resolved motion tokens swap to reduced springs; list/post/sheet paths should use the resolved flag via `useReduceMotion` |

## Physical and motor

| Feature | Classification | Modula |
| --- | --- | --- |
| Touch / 44pt targets | SUPPORTED (target) | Settings rows, switches, inline post actions use min 44pt |
| Gesture alternatives | SUPPORTED (target) | Post overflow is tappable More, not drag-only. Comments also have a Comment control |
| Voice Control | SYSTEM_ONLY + labels required | Actionable controls must have names. Manual Voice Control = NOT_RUN until proven |
| Switch Control | SYSTEM_ONLY | Focusable pressables; custom islands must not drop out of the tree |
| Keyboard | SUPPORTED on web | Tab / Shift+Tab / Enter / Escape on menus. iOS hardware keyboard NOT_RUN |
| Eye / Head tracking | SYSTEM_ONLY / NOT_APPLICABLE as a setting | Large stable targets only |
| AssistiveTouch | SYSTEM_ONLY | No essential hidden gestures for core tasks |
| Camera Control / Watch mirroring | NOT_APPLICABLE | Not shown as Modula settings |

## Hearing

| Feature | Classification | Modula |
| --- | --- | --- |
| Captions | SYSTEM_ONLY + media-dependent | Show caption controls only when tracks exist |
| Live Captions | SYSTEM_ONLY | Compatibility note |
| Music Haptics | SYSTEM_ONLY | Not exposed |
| Sound Recognition | SYSTEM_ONLY | Not exposed |
| Audio-only information | SUPPORTED (target) | Toasts/errors have text; haptics are optional |

## Speech

| Feature | Classification | Modula |
| --- | --- | --- |
| Live Speech / Personal Voice / Vocal Shortcuts / Dictation | SYSTEM_ONLY | Do not break keyboard entry in Composer or Settings search |

## Cognitive

| Feature | Classification | Modula |
| --- | --- | --- |
| Assistive Access | SYSTEM_ONLY + audit | Compatible layout claimed, not full optimisation |
| Guided Access / Siri / Accessibility Shortcut / Per-App Settings | SYSTEM_ONLY | Per-app iOS visual settings should flow through Dynamic Type / contrast / Reduce Motion |
| Destructive confirmation | SUPPORTED | Sign out and similar use explicit confirmation |

## Runtime observation

`src/theme/accessibility/useSystemAccessibility.ts` listens for:

- boldTextChanged
- reduceMotionChanged
- reduceTransparencyChanged
- screenReaderChanged
- grayscaleChanged
- invertColorsChanged
- highTextContrastChanged
- darkerSystemColorsChanged

App code should consume `useModulaAccessibility` / `useAppearance` rather than calling `AccessibilityInfo` per screen.

No private UIKit APIs. No Settings URL schemes.
