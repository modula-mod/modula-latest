# Web presentation: Liquid and Material

## Why Konsta exists

Konsta UI 5.4.0 is Modula's web/PWA presentation implementation layer. It is not the application framework, design system, router, product authoring SDK, or module contract. Screens and products continue to consume semantic Modula APIs. On web those APIs may use Konsta for platform-shaped component internals; on iOS and Android the existing native implementations continue to resolve.

```text
application or compiled product artifact
                 |
                 v
       Modula semantic primitive
                 |
        +--------+--------+
        |                 |
        v                 v
  native adapter       web adapter
  @expo/ui / RN     Base UI mechanics + Konsta visuals
```

Direct `konsta/react` imports are restricted to `src/platform/ui/adapters/konsta/**/*.web.tsx`. Feature screens, routes, the generic product host, authoring packages, compiler packages, and native files cannot import it. Tailwind is a build-time web CSS dependency only. MUI and NativeWind are not used.

## Independent appearance axes

`webPresentation: 'liquid' | 'material'` is separate from colour mode, accent, surface type, and accessibility preferences. It defaults to `liquid`, persists through the existing appearance cache, and remains local when account appearance records are merged because the server contract does not yet own this browser-only field. Native providers return their children unchanged and native renderers ignore the stored value.

The one internal resolver maps:

| Modula setting | Konsta theme | Root class |
|---|---|---|
| Liquid | `ios` | `k-ios` |
| Material | `material` | `k-material` |

The `ios` value is private adapter vocabulary and never appears in user-facing settings. `data-modula-presentation="liquid|material"` is Modula's stable styling contract. Presentation changes update provider context, the application root, and the document root in one React commit without changing the route or keying/remounting the application.

## CSS and colour ownership

`src/app/_layout.tsx` imports the platform-resolved `src/styles/load-web-styles` entry and delegates layout implementation to `src/shell/RootLayout.tsx`. On web, `load-web-styles.web.ts` imports `web.css`; the default/native-safe sibling is a no-op. The bridge lives outside the Expo Router route directory because Router includes platform route filenames in its context even when they are not selected at runtime. This structure keeps the stylesheet out of the resolved iOS graph.

The web stylesheet imports Tailwind's theme registry and utilities plus Konsta's theme entry, but deliberately omits `tailwindcss/preflight.css`. Modula already owns global reset, typography, content, form, and icon behavior. This prevents the Tailwind reset from silently changing notes, headings, lists, borders, and existing controls. Konsta's global platform font and `.dark` canvas ownership are neutralized after the imports. Konsta 5.4.0's theme entry already registers its package source directories, so no broad `node_modules` scan is configured.

Modula tokens remain canonical. `konstaCssVariables` writes both general Konsta variables and the generated iOS/Material roles actually consumed by components: primary, on-primary, primary/secondary containers and foregrounds, surfaces, elevated surfaces, outlines, separators, error roles, selection, focus, and interaction colors. Runtime accent changes update those values while overlays are open. Modula controls `dim`, `dark`, and `oled`; Konsta receives only the resolved dark boolean. OLED therefore retains Modula's true-black canvas.

The document element and the application element receive the same presentation class, dark class, data attributes, type inheritance, token variables, accessibility overrides, and reduced-motion state. React portals keep context while the document root supplies the lost CSS ancestry.

## Overlay ownership

Every web overlay has one behavior owner. Konsta surfaces are kept permanently open inside that owner with their backdrop, fixed positioning, transform, and transition behavior disabled.

| Concern | Owner |
|---|---|
| Focus trap, initial focus, focus restoration | Base UI through the Modula adapter |
| Escape and outside dismissal | Base UI through the Modula adapter |
| Background scroll lock | Base UI through the Modula adapter |
| Portal placement and anchored positioning | Base UI through the Modula adapter |
| Drawer pan/snap coordination | Base UI Drawer or the existing Modula navigation gesture |
| Drawer page drill-in and retained page state | `ModulaDrawerNavigator` |
| Motion tokens and reduced motion | Modula |
| Surface, elevation, glass, component theme | Konsta visual adapter fed by Modula tokens |

Overlay layers are allocated relative to their parent scope. A menu opened from a dialog therefore resolves above that dialog even though the base popover token is normally below the base modal token. Persistent expanded navigation is nonmodal. Toasts announce status and never trap focus.

Escape normally cancels dialogs, including destructive confirmations. Destructive actions still require an explicit confirmation and the safer action receives initial focus where appropriate. A dismissal restriction requires a workflow-specific reason.

## Drawer and sheet contract

| Interaction | Implementation |
|---|---|
| Left/right navigation panel | Konsta Panel as the visual surface behind the Modula navigation adapter |
| Bottom drawer or sheet | Modula/Base UI behavior with Konsta Actions or Sheet as the visual surface |
| Tools to Formatting to Font | Internal navigation within one `ModulaDrawerNavigator` shell |

The drill-in path keeps one overlay, one surface, one handle, one scroll owner, and mounted page state. `ResizeObserver` drives restrained height changes. Focus and per-page scroll positions restore on Back. Konsta Panel is not used as a bottom sheet, and Konsta Sheet is not credited with snap, drag-dismissal, or drill-in behavior it does not implement.

Snap points and semantic detents are implemented by the Base UI Drawer path. An edge-sheet/dialog presentation does not silently accept those capabilities: development builds emit a specific warning when snap interaction props reach a presentation that cannot honor them. Directional sheets remain content-sized and use their documented dismissal behavior.

## Product authoring and host boundary

The product pipeline remains:

```text
product TSX -> compiler -> immutable declarative artifact -> generic Host -> platform renderer
```

Konsta belongs only in the Host's web rendering implementation. The frozen `MODULA_PRODUCT_UI_V1_COMPONENTS` artifact contract is unchanged. Authoring/compiler packages do not import Konsta, DOM code, CSS, Liquid/Material names, or presentation classes. Adding another declarative component kind still requires a versioned schema, compiler/testkit work, permissions review, a neutral fixture, and native parity.

Vault Notes is proved with its already-published 1.7.0 artifact. The product repository and artifact hashes are captured before and after web verification; the product is not rebuilt or republished to switch presentation. The same semantic `button`, `field`, `search`, `recordList`, `recordRow`, `toolbar`, and state/action payloads flow through the generic host in both modes.

## Public semantic API

Application code uses names such as `ModulaButton`, `ModulaDrawer`, `ModulaSheet`, `ModulaDialog`, `ModulaPopover`, `ModulaSegmentedPicker`, `ModulaSwitch`, `ModulaSearchField`, `ModulaList`, `ModulaDataTable`, `ModulaNotification`, and `useModulaToast`. It does not use `KPanel`, `KActions`, `KGlass`, utility classes, or Konsta color props.

To create another adapter:

1. Confirm an existing Modula semantic primitive and real consumer. Do not name the public API after Konsta.
2. Put direct Konsta imports in a narrow `src/platform/ui/adapters/konsta/*.web.tsx` visual adapter.
3. Keep behavior in the existing Modula/headless owner. For platform separation, add or preserve `.web.tsx` and `.native.tsx` entry points.
4. Map Modula tokens and semantic tones inside the adapter; never accept arbitrary Konsta colors or caller utility classes.
5. Add UI Lab states, interaction/Axe coverage, import-boundary checks, a web production build, and native graph inspection.

## Coverage decisions

| Konsta family | Modula disposition | Initial consumers / verification |
|---|---|---|
| Action Sheet | `ModulaActionSheet`; Base UI Drawer behavior + Konsta Actions visual | Post/module actions and UI Lab action drawer; keyboard/dismiss tests |
| Badge | `ModulaBadge` web adapter | Status labels and UI Lab |
| Block, Block Header/Footer/Title | Mapped to `Surface`, `Section`, `Stack`, and list section semantics; Konsta Block is not canonical | Existing settings/product sections; excluded as a redundant public foundation |
| Breadcrumbs | `ModulaBreadcrumbs` web adapter, hidden on compact layouts | UI Lab hierarchy; Axe |
| Button | Existing `ModulaButton` API with Konsta Button web internals | Existing screens, Vault Notes artifact, forms; action-dispatch test |
| Card | `Surface` remains canonical; Konsta Card intentionally not used as a foundation | Explicit platform/solid/glass UI Lab surfaces |
| Checkbox | `ModulaCheckbox` web adapter; native control retained | UI Lab form states |
| Chip | `ModulaChip` and `ModulaFilterChip` web adapters | Product Hub filters and UI Lab |
| Data Table | `ModulaDataTable`; Konsta table on expanded web, semantic cards on compact/native | UI Lab data section |
| Dialog | `ModulaDialog` / confirmation host; Base UI behavior + Konsta Dialog visual | UI Lab, destructive Escape/focus tests |
| FAB | Existing `ModulaFloatingButton` prominent web form uses Konsta FAB | UI Lab new-note action; global Tools behavior is unchanged |
| Glass | `Surface variant="platform|glass"`; Konsta Glass only inside web implementation | UI Lab surface matrix |
| List, List Item, List Button | Existing `ModulaList`/`ModulaListItem` web adapter; product `RecordList`/`Row` stays stable | UI Lab list section and generic product host |
| List Input | Existing DOM-controlled `ModulaTextInput`/Field semantics inside a Konsta ListInput frame | UI Lab and Vault Notes form events |
| Menu List | `ModulaNavigationMenu` web adapter | Expanded navigation specimen; Axe |
| Messagebar | Mapped to richer `ModulaComposerInput`/toolbar contract; Konsta Messagebar intentionally excluded | Composer needs attachments, actions, reply/edit/delivery semantics and must not inherit Konsta's data model |
| Navbar | Mapped to `ModulaNavigationHeader`; Konsta Navbar intentionally excluded from custom hero/detail chrome | Existing shell headers retain Modula geometry |
| Notification | `ModulaNotification` web adapter | UI Lab notification action/dismiss |
| Panel | Web navigation drawer visual surface | Shell navigation and drawer tests |
| Popover | `ModulaPopover`; Base UI behavior + Konsta Popover visual | UI Lab, responsive/portal tests |
| Popup | Mapped to `ModulaDialog`; Konsta Popup intentionally excluded as duplicate modal machinery | Dialog matrix |
| Preloader | Indeterminate `ModulaProgress` / loading state adapter | UI Lab loading |
| Progressbar | Determinate `ModulaProgress` adapter | UI Lab module install |
| Radio | `ModulaRadioGroup` web adapter; native control retained | UI Lab keyboard/disabled states |
| Range | `ModulaRange` web adapter; native Expo UI slider | UI Lab appearance value |
| Searchbar | Existing `ModulaSearchField` API with Konsta Searchbar web visual | Product Hub and Vault Notes semantics, UI Lab |
| Segmented | Existing `ModulaSegmentedPicker` API with Konsta Segmented web visual | Appearance live switch and UI Lab |
| Sheet | `ModulaSheet`; Base UI behavior + Konsta Sheet visual | Settings, filters, UI Lab directional sheets |
| Stepper | `ModulaStepper` web adapter and native semantic fallback | UI Lab numeric configuration |
| Tabbar | Existing `PlatformTabs` remains canonical; Konsta Tabbar intentionally excluded from the shell | Native uses NativeTabs/custom native implementation; web keeps Modula's responsive rail/bottom geometry |
| Toast | Existing queue/service and accessibility announcer with Konsta Toast visual | UI Lab, portal identity test |
| Toggle | Existing `ModulaSwitch` API with Konsta Toggle web visual | Appearance/settings and UI Lab |
| Toolbar | Existing `ModulaToolbar` remains canonical; Konsta Toolbar is used inside the floating adapter | UI Lab floating controls; custom product heroes remain unchanged |
| Toolbar Pane | `ModulaFloatingGroup` web adapter | Module/editor action clusters and UI Lab |

## Testing

The integration gate is intentionally focused on architecture and representative product use. Run:

```bash
CI=true pnpm lint
CI=true pnpm typecheck
pnpm verify:konsta-web-presentation
CI=true pnpm build:web
```

The focused browser check covers the live Settings switch, Product Hub, and the unchanged published Vault Notes artifact in Liquid and Material. The iOS `export:embed` source map must contain no Konsta, Tailwind/web CSS, Base UI, or application `.web.*` modules and must resolve the native semantic adapters.

The exhaustive breakpoint, Safari/PWA, dark/OLED combination, overlay-by-overlay, accessibility-permutation, Android build, profiling, zoom, and high-contrast matrices are explicitly deferred to the Konsta Web Presentation Hardening Pass. Adapter specimens remain in the developer UI Lab so that later pass can expand coverage without migrating more production screens.

Browser automation, installed-PWA testing, native bundle inspection, native compilation, and physical-device interaction are separate results. Never infer iPhone PWA, VoiceOver, Dynamic Type, Android, or physical native acceptance from Chromium or a source-only verifier.
