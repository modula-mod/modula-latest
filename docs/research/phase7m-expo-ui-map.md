# Phase 7M Expo UI map (installed 57.0.10)

Inspected on 2026-08-15 from `node_modules/@expo/ui@57.0.10`.

Do not assume docs.expo.dev “latest” matches this tree.

## Import policy

| Allowed importer | Allowed import |
| --- | --- |
| `src/platform/ui/**` adapters | `@expo/ui`, `@expo/ui/swift-ui`, `@expo/ui/jetpack-compose`, `@expo/ui/community/*` |
| Product screens / features | Modula adapters only (`@/platform/ui`, primitives) |

## Universal (`import { … } from '@expo/ui'`)

BottomSheet, Button, Checkbox, Collapsible, Column, FieldGroup, Host, Icon, List, ListItem, Picker, Row, ScrollView, Slider, Spacer, Switch, Text, TextInput.

**Icon:** native SF Symbols / Material Symbols. Expo documents that universal Icon does not render on web. Any ModulaIcon web path must be SVG, not a re-export.

## SwiftUI (`@expo/ui/swift-ui`)

Requires Host. Includes Alert, BottomSheet, Button, ContextMenu, Form, GlassEffectContainer, List, Menu, Picker, Popover, ProgressView, SecureField, and stacks.

## Jetpack Compose (`@expo/ui/jetpack-compose`)

AlertDialog, Button, Card, Checkbox, DatePicker, DropdownMenu, FAB, and related hosts.

## Community (`@expo/ui/community/*`)

bottom-sheet, datetime-picker, masked-view, menu, pager-view, picker, segmented-control, slider.

Community modules may pull extra native deps. Admission still goes through `modula-dependencies`. Segmented-control community path overlaps the already-installed `@react-native-segmented-control/segmented-control@2.5.7`.

## Capability acceptance (7M-B)

Before a production adapter switches substrate:

1. Open the installed `.d.ts` for that component.
2. Build a UI Lab example on iOS simulator, Android (when available), and web.
3. Record missing props (keyboard, detents, a11y labels, web).
4. Only then choose Expo UI vs existing Modula vs later library.

Sheet specifically: test Expo universal/SwiftUI BottomSheet on this SDK before proposing TrueSheet.
