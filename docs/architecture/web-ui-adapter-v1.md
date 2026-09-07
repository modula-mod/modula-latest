# Web UI Adapter V1

Web UI Adapter V1 upgrades web and installed-PWA interaction mechanics without changing the public Modula UI ownership boundary. Screen and product-host code consumes semantic Modula components. Only approved `.web.tsx` adapter files import the web headless implementation.

## Architecture

```text
screen or product host
        |
        v
Modula semantic UI contract
        |
   +----+----+
   |    |    |
  iOS Android Web/PWA
              |
       Base UI + DOM + CSS
```

The iOS and Android resolution paths remain the existing native implementations. Web uses React Native platform resolution for `.web.tsx` adapters; no web dependency may appear in a native entry file. Downloaded product artifacts remain declarative and cannot request raw DOM, CSS, `className`, arbitrary props, Base UI, or executable component source.

The existing MPS 1.0 artifact contract was not revised in this phase. Its generic host continues to consume the same `src/platform/ui/product-ui.ts` bridge. Host-owned product contribution composition may use the safe Drawer navigator, but downloaded artifacts cannot inject routes, browser history, or executable navigation logic. Adding new artifact component kinds would require an independently versioned product-standard change, compiler/testkit support, and a neutral fixture; this adapter does not silently widen that frozen contract.

## Presentation policy

One deterministic resolver consumes viewport class, pointer precision, hover capability, installed-PWA state, and platform. It does not inspect the user agent.

| Intent | Compact or touch-first web | Desktop web |
|---|---|---|
| Actions / context | Drawer | Menu |
| Picker / search | Drawer | Popover |
| Filters / comments | Drawer | Sheet |
| Configuration / details | Drawer | Sheet |
| Tools / media / focused task | Drawer | Dialog |

Drawer is gesture-first, supports snap points, and owns mobile scroll handoff. Sheet is an edge task panel without reliance on drag. Dialog is a centered focused task. Popover is anchored lightweight content. Menu is a discrete action list.

## Drawer mechanics

The web Drawer is composed from root, portal, backdrop, viewport, popup, title, description, one scroll body, handle, and optional footer. Simple actions are content-sized and all drawers cap against `dvh`; body scrolling activates only when content exceeds the available extent. Base UI owns pointer dismissal, focus containment/return, scroll locking, true nested-modal coordination, swipe thresholds, and scroll-to-drawer handoff.

The adapter maps semantic points as follows:

- `content`: content height, clamped by the popup and viewport.
- `medium`: 56% viewport, clamped to content.
- `large` and `full`: full available drawer height, bounded by the safe maximum.
- Explicit fractions and pixel heights remain supported and clamped.

### Drawer navigation versus true nested modal

Hierarchical tool and settings flows use `ModulaDrawerNavigator`: one existing responsive shell, one overlay, one handle, one rounded boundary, and an internal route stack. Touch action-menu submenus use this same path, so a menu drill-in cannot create a second visible sheet. Its generic controller supports `push`, `pop`, `replace`, and `reset` without touching browser history. Previous pages remain mounted but hidden from layout and accessibility, preserving local state. The navigator snapshots the one Drawer body scroll position per route, restores it on Back, focuses the new page heading on push, and returns focus to the originating row on pop. On desktop the same state model follows the presentation resolver into a Dialog rather than imitating a mobile bottom drawer.

The canonical navigation header owns Back, title, optional subtitle, and trailing action alignment. Forward/back transitions use short 10px translations plus opacity; Reduce Motion removes translation and animation. A measured page viewport animates content-height changes while the existing Drawer maximum height keeps long pages inside the single scrolling body. Escape always closes the entire responsive overlay; it does not pop an internal page. Ephemeral pages never add browser-history entries.

A true nested modal is different: an independent task with its own confirmation/dismissal contract. It continues to use Base UI nesting, renders its popup through a sibling portal layer, and causes the parent surface to recede. The hidden parent handle leaves one obvious foreground handle. Navigation rows, formatting screens, settings submenus, and font pickers must not use this pattern.

Bottom drawers add `env(safe-area-inset-bottom)`. Overlays use dynamic viewport units. On WebKit touch browsers, the document body is positioned so absolute iOS Safari drawer backdrops cover the visual viewport at a non-zero scroll offset; other engines retain their normal body positioning. Base UI restores body position and focus after modal close. Modula Reduce Motion and Reduce Transparency settings override library defaults through semantic tokens and CSS state.

## Visual ownership

No default shadcn palette, radius, typography, shadow, spacing, or Tailwind utility layer was admitted. The adapter maps the active Modula canvas, surfaces, text, accent, separator, radius, spacing, scrim, focus, and motion tokens to CSS custom properties. Solid, glass, frost, neumorphism, OLED, reduced transparency, and increased contrast therefore remain host-owned modes.

## Dependency and provenance

- `@base-ui/react` 1.8.0, MIT, upstream `mui/base-ui`: used through its public component APIs; no source was copied.
- shadcn/ui Base UI Drawer documentation was reviewed on 2026-09-07 for composition, responsive adaptation, nested drawer, and iOS Safari behavior. No shadcn component source or default styling was copied.
- The `shadcn` CLI was used read-only to inspect the available registry; it is not a runtime or development dependency.
- No Radix package was added because the checkout did not contain a mature Radix implementation needing preservation.
- No Svelte, Vaul Svelte, Bits UI, Tailwind, or additional animation engine was added.

Upstream references:

- https://base-ui.com/react/components/drawer
- https://ui.shadcn.com/docs/components/base/drawer
- https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default

Removal path: replace the implementation inside the approved `.web.tsx` adapters, prove equivalent focus/keyboard/gesture/scroll behavior, remove `@base-ui/react`, and rerun the import and native-isolation gates. Screen and product-host imports do not change.

## Scope decisions

MultiSelect was not added. Repository search found schema and generic runtime handling but no current priority route requiring a new shared MultiSelect control. Building it without an owner route would be speculative.

Database work: **none**. This phase adds no schema, migration, backend endpoint, or persisted state.

## Bundle baseline

Exact start main: `74627b1246d9efd19e0a2a85c7e434f66f4db306`.

Before dependency admission, `CI=true pnpm build:web` produced:

- entry JavaScript: 4,347,042 bytes; gzip 1,033,467 bytes
- all web JavaScript: 4,350,182 bytes
- complete `dist`: 15,836,892 bytes

After the hierarchy-corrected verified adapter build:

- entry JavaScript: 5,007,484 bytes; gzip 1,199,633 bytes
- all web JavaScript: 5,010,624 bytes
- complete `dist`: 21,664,766 bytes

Measured change: +660,442 entry bytes and +166,166 gzip bytes (+16.1% gzip). This is a material cost, not a zero-cost claim. It covers the admitted Drawer/Dialog, Menu/ContextMenu, Popover, Select, Combobox, Tooltip, and Toast graphs plus the owned Drawer navigator; Tabs and ToggleGroup remain Modula-owned DOM code. Base UI Tabs were removed after proving incompatible with Metro package-import resolution. A later bundle-reduction phase should profile these shared internals before admitting more headless primitives. Native isolation is a separate static and native-build gate; a web bundle result is not native acceptance.

## Acceptance boundaries

Chromium automation and static verifier output are engineering evidence only; even an iOS simulator build would not replace the physical-device gates. Installed-iPhone PWA behavior, VoiceOver, Dynamic Type, keyboard, orientation, Reduce Motion, Reduce Transparency, Increase Contrast, Android, and founder visual approval remain explicit manual gates until performed on the specified hardware. Merge and production cutover are forbidden while any required gate is open.

The hierarchy correction evidence is indexed in `docs/validation/web-ui-adapter-v1/README.md`. The earlier double-surface nested screenshots are intentionally retained there as rejected before-state evidence and are not acceptance artifacts.
