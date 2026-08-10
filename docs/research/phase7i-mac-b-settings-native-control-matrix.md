# Phase 7I-MAC-B — Settings native control matrix

| Control | Current | Native candidate | Expo UI candidate | Custom required? | Decision |
|---|---|---|---|---|---|
| Settings nav row | Custom `SettingsLinkRow` + chevron | UITableView-style row | — | Brand density yes | **KEEP** custom row; match iOS grouped inset |
| Settings toggle | Was custom; now `SystemSwitch` → `ModulaSwitch` | UISwitch | `@expo/ui` Switch via adapter | No | **ADOPT** (done) |
| Appearance colour mode | Tile grid | Segmented / radio list | Picker / Segmented | Visual tiles are brand | **KEEP** tiles; optional native segment for compact |
| Surface Type | Tile / list | Picker | Picker | Semantics custom | **KEEP** custom with clearer material preview |
| Accent swatches | Custom chips | — | — | Brand | **KEEP** |
| Text size / Bold / Reduce motion | Toggle / stepper | UISwitch / stepper | Switch | No | **ADOPT** Switch via `SystemSwitch` |
| Confirmation (sign out, revoke) | Custom / alert | UIAlertController | — | No | **ADOPT** system confirmation |
| Overflow / menus | `ModulaMenu` / action sheet | UIMenu | ContextMenu / Menu | Some chrome custom | **ADOPT** Menu for overflow; keep branded composer tools |
| Search in Settings | Custom field | UISearchBar | — | No | Consider native search later |
| Date/time | None yet | UIDatePicker | DateTimePicker | No | **ADOPT** when needed |
| Connections toggles | Custom | UISwitch | Switch | No | **ADOPT** via adapter |

## Rule

Feature code → Modula / `components/system` → platform adapter → Expo UI. Never `import … from '@expo/ui/swift-ui'` in features.
