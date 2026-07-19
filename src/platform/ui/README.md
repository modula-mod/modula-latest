# Platform UI

Thin Modula adapters for native chrome. Feature screens consume these wrappers — never `@expo/ui/swift-ui` directly.

Developer evaluation gallery (adapted from expo-ui-playground): `src/platform/ui/dev/expo-ui-lab/` → Settings → Developer → Expo UI Lab.

## Ownership (Phase 4.5)

| Area | Owner |
|---|---|
| `buttons/`, `sheets/`, `navigation/`, declarative menu hosts | Phase 4.5 shell agent |
| `keyboard/`, `camera/`, imperative overflow helpers | Keyboard / camera / post-actions sibling |

## Sibling modules (this checkpoint)

- **keyboard** — `KeyboardSafeScreen`, keyboard height, sheet bottom inset helpers
- **camera** — ImagePicker / camera presentation with Choose Photo · Take Photo
- **menus** — `presentModulaActions` + `confirmModulaAction` (ActionSheetIOS / Alert; upgradeable to Expo UI hosts)
