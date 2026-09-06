# Modula UI System V1

## Status and scope

UI System V1 closes the shared UI architecture without reopening MPS, backend, schema, or product ownership. Its canonical source is `src/platform/ui`. The existing theme runtime remains the only authority for colour, material, spacing, radius, typography, motion, accessibility, and surface inheritance.

This phase does not add a general-purpose UI dependency and does not permit remote executable product UI. Database work: **none**.

## Architecture

```text
theme foundations
  -> semantic primitives
     -> shared compositions
        -> shell + generic MPS host + product-owned declarations
```

The three levels have distinct responsibilities:

1. Foundations define semantic geometry and rendering tokens. A visible compact control and its minimum 44pt target are separate values.
2. Primitives own interaction states, accessibility semantics, platform adaptation, and Reduce Motion/Transparency behavior.
3. Screens and products compose primitives. They may own product content and layout, but not a new button, field, search control, menu, sheet, list row, tab rail, or toolbar implementation.

## Canonical families

| Family | Canonical owner | Contract |
| --- | --- | --- |
| Button / IconButton / ActionButton | `src/platform/ui/buttons` | Semantic role and action lifecycle; compact paint inside 44pt+ target |
| Field / input / form / selection | `src/platform/ui/controls` and `forms` | Label, control, helper, error; system text size; native switches and pickers where valuable |
| Sheet / action sheet / tool drawer / picker | `src/platform/ui/sheets` | One semantic API with presentation and detent intent; keyboard-safe fixed footer; focus containment |
| Drawer | `src/platform/ui/drawers` | Shared modal, backdrop, pan, settle, and Reduce Motion behavior |
| Menu / context menu / popover | `src/platform/ui/menus` | Native menu on iOS and accessible popover/menu elsewhere |
| List / row / separator / icon tile | `src/platform/ui/lists` | Navigation, toggle, value, action, person, product, notification, destructive variants |
| Tabs / picker | `src/platform/ui/tabs` | Navigation, segmented, scrollable product, and underline presentations |
| Navigation header / toolbar | `src/platform/ui/navigation` and `toolbars` | Compact, large-title, transparent hero, and scrolled header intent; semantic toolbar roles |
| Search | `src/platform/ui/controls/modula-search-field.tsx` | Navigation, screen, settings, product, and module variants |
| Surface / type / spacing | theme runtime plus `Surface` | Canvas, grouped, raised, overlay, glass, floating, and inset semantic roles |
| Feedback / loading / errors | `src/platform/ui/feedback` | Notices, toast/banner compositions, undo/progress, skeleton sections, empty and recoverable error states |
| Identity / catalogue rows | `src/platform/ui/identity` | Badges, product artwork, ProductRow, and UserRow |
| Composer | `src/platform/ui/composer` | Shell, input, toolbar, attachment, tool action, and audience compositions |
| Floating controls | `src/platform/ui/floating` | FloatingButton, FloatingGroup, and FloatingToolbar over inherited chrome |

Named motion is resolved through `useModulaMotionSpec`: `sheet.enter`, `sheet.exit`, `drawer.expand`, `drawer.collapse`, `menu.open`, `menu.close`, `button.press`, `list.insert`, `list.remove`, `tab.change`, `navigation.push`, and `navigation.pop`. Reduced Motion removes spatial travel at the primitive level. Semantic haptics are optional and never required to understand state.

## Product UI boundary

`src/platform/ui/product-ui.ts` is the current host equivalent of `@modula/product-ui`. Product-owned MPS frontend artifacts declare semantic nodes. The generic adapter maps those nodes onto the same Modula renderers used by the shell. The bridge does not accept product JavaScript, remote bundles, raw native symbols, colours, radii, or platform-specific mechanics.

A new Tasks product can declare `button`, `field`, `search`, `recordRow`, `toolbar`, `tabs`, `picker`, `menu`, `badge`, `emptyState`, `errorState`, and `loadingState`; the host supplies their shared implementation. Product-specific components such as `VaultNotesButton`, `TasksRow`, and `CRMCard` are forbidden in the shared system.

## Shared-component admission

A new primitive is admitted only when all are true:

- It is useful to multiple surfaces.
- Its semantics are generic rather than product-specific.
- It can adapt by platform without changing the product API.
- Its role, state, focus, label, value, and disabled/loading behavior are clear.

If those conditions are not met, keep it as product composition. Before creating any visual control, search `src/platform/ui` and the public barrel. Local composition is allowed; local recreation of a normal button, sheet, input, menu, tabs, list row, search control, or toolbar is not.

## UI Lab

The development-only route remains `/settings/developer/modula-ui-lab` and is guarded by `canAccessDeveloperLabs()`. `UI_SYSTEM_LAB_MATRIX` records the acceptance axes: Light, Dark, OLED; Native, Solid, Glass, Glay, Minimal Spatial; default and large text; normal and increased contrast; normal and reduced transparency; normal and reduced motion.

Visual evidence must be captured from the lab under the relevant combinations before merge. A web screenshot does not replace physical iPhone VoiceOver, Dynamic Type, keyboard, Reduce Motion, Increase Contrast, Reduce Transparency, touch inspection, or installed-PWA acceptance.

## Initial propagation

- Settings sections, rows, separators, and icon tiles use the generic list system.
- Home search uses shared Sheet, Search, ListRow, and person rows.
- Product Hub uses shared Search, Tabs, ActionButton, Badge, and module runtime primitives.
- Vault Notes and future products resolve fields, search, buttons, rows, toolbar, feedback, and states through the generic product UI bridge.
- Activity uses SelectionSheet and ModulaActivityRow.
- Composer uses semantic Tool sheet/list compositions and ComposerInput.
- Profile connections and owner controls use shared Search, Toolbar, ActionButton, and IconButton.
- Secondary routes use ModulaNavigationHeader; the shell name remains a compatibility export.
- Shell navigation delegates drawer mechanics to ModulaDrawerFrame.

## Verification and exceptions

`pnpm verify:ui-system-v1` proves the required owners, product bridge, developer gate, first-surface propagation, touch/visual separation, named motion vocabulary, and absence of normal-case raw Modal/TextInput implementations in the audited surfaces.

Raw modal mechanics remain valid only for explicitly classified full-screen security gates, media viewers, gesture-driven comments, and reaction pickers. Those are not normal action sheets or form pickers and must still use theme, accessibility, and motion contracts.
