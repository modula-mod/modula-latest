# Phase 7I-MAC-B — Expo UI adoption (installed SDK)

**Installed:** Expo `~57.0.11`, React Native `0.86.2`, `@expo/ui` `~57.0.9` (do not assume newer docs).

## Adapter rule

```text
feature → Modula / system component → platform adapter → @expo/ui / RN
```

Forbidden in feature screens: direct `@expo/ui/swift-ui` imports.

## Candidates mapped to installed surface

| Need | Expo UI / native | Modula adapter | Decision |
|---|---|---|---|
| Switch | Switch | `ModulaSwitch` ← `SystemSwitch` | **ADOPTED** in Settings toggles |
| Button | Button | `ModulaButton` | Keep; refine roles |
| Text field | TextInput / SecureField | `ModulaTextInput` (RN on iOS — Host+matchContents collapsed) | KEEP RN-backed adapter |
| Menu / context menu | Menu / ContextMenu | `ModulaMenu` / present actions | Prefer for overflow |
| Segmented | Picker segmented | feed modes / profile tabs | Evaluate; **reject Host in absolute sticky** |
| Slider / stepper | — | Appearance text size | Future |
| Date/time | DatePicker | — | When product needs |
| Sheets | — | existing sheets | Keep Modula sheets for comments/tools |

## Rejected / deferred for this phase

- Putting Expo UI `Host` inside Home sticky feed-mode overlay (geometry regressions).
- Mass-replacing Post Card / Stories / tab bar with system controls (identity loss).
- Speculative third-party UI kits (dependency admission required).

## Adopted this phase

1. Settings toggles → `SystemSwitch` → `ModulaSwitch`.
2. Auth testIDs for reliable Simulator automation.
3. Identifier parsing compatible with Greenfield UUIDv7 (unblocks real auth).
