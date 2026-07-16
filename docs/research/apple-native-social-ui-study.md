# Apple-Native Social UI Study — Phase 4.5

Implementable findings for Modula. Not a paste of links. Format: Pattern / Why / Where / What not to copy / A11y / Platform.

Modula UI skill compliance: product screens consume Modula wrappers (`src/platform/ui/*`, primitives, `src/components/system/*`). Never import `@expo/ui/swift-ui` from features.

---

## Apple Human Interface Guidelines

### Tab bars
- **Pattern:** Persistent bottom destinations for peer sections; selected SF Symbol variants; system materials.
- **Why:** Users recognise system chrome instantly; Liquid Glass/iOS 26 behaves correctly only with real `UITabBar`.
- **Where:** Home, Discover, Board, Activity, Profile via `NativeTabs`.
- **What not to copy:** Custom oversized centre create buttons that break system tab metrics.
- **A11y:** Labels + selected state; Dynamic Type; Reduce Transparency → opaque bar.
- **Platform:** iOS system tab bar; Android Material navigation; web adaptive rail with same definitions.

### Navigation bars & toolbars
- **Pattern:** Leading identity/back, centred title, trailing actions in the bar — not in content safe area.
- **Why:** Predictable hit targets and large-title/search integration.
- **Where:** Per-tab Stack headers (compose/messages on Home; Share/More on Profile).
- **What not to copy:** Duplicate back arrows inside content when Stack already provides back.
- **A11y:** Button traits on trailing items; 44pt minimum.
- **Platform:** Expo Router Stack options; avoid bespoke safe-area header views on phone.

### Sheets & modality
- **Pattern:** Detents, grabber, swipe-to-dismiss, controlled presentation state.
- **Why:** Fixes custom drawer race conditions and matches iOS muscle memory.
- **Where:** Account panel (iPhone), Composer Tools, confirmation dialogs.
- **What not to copy:** Full-screen Pressable that is both trigger parent and backdrop.
- **A11y:** Focus moves into sheet; restore to trigger on dismiss.
- **Platform:** Expo UI BottomSheet / ModulaSheet adapters; web drawer/dialog equivalents.

### Menus & context menus
- **Pattern:** Long-press context menus; visible More → Menu; destructive items separated.
- **Why:** Removes custom action modals for simple command lists.
- **Where:** Post More, profile More, media long-press. Keep action lists extensible (e.g. Translate later).
- **What not to copy:** App-branded action sheets that ignore platform menus.
- **A11y:** Named actions; disabled states announced.
- **Platform:** ModulaMenu / ModulaContextMenu wrappers over Expo UI.

### Buttons, materials, safe areas, SF Symbols, motion
- **Pattern:** Hierarchical button roles; materials for chrome only; automatic content insets; SF Symbols for actions; system transitions with Reduce Motion.
- **Why:** Contrast and hierarchy stay readable under Dynamic Type and Increase Contrast.
- **Where:** ModulaButton roles; tab/nav materials; FlatList `contentInsetAdjustmentBehavior="automatic"`; semantic icons.
- **What not to copy:** Glass on every post body; continuous avatar pulses; accent on every icon.
- **A11y:** Role/label/selected/disabled; colour-independent selection.
- **Platform:** Token-driven colours; Android Material symbol equivalents via the same ModulaTabDefinition.

---

## UIKit mapping

| UIKit | Modula use |
|---|---|
| `UITabBarController` / `UITabBarAppearance` | `NativeTabs` + `disableTransparentOnScrollEdge` |
| `UINavigationController` / `UINavigationBarAppearance` | Per-tab Stack headers/toolbars |
| `UISheetPresentationController` + detents | Account panel + Tools sheet |
| `UIButton.Configuration` | ModulaButton roles (primary/secondary/plain/destructive) |
| `UIContextMenuInteraction` | ModulaContextMenu |
| `UISplitViewController` | Adaptive account panel on iPad/web wide |
| `UISearchController` | Discover native search |

---

## Expo

| API | Use |
|---|---|
| `expo-router/unstable-native-tabs` | Five static tab triggers; Create excluded |
| Expo Router Stack | Titles, trailing toolbar items, search |
| `@expo/ui` Button / Menu / ContextMenu / BottomSheet | Only inside `src/platform/ui/*` adapters |
| Expo Blur / Glass | Chrome materials only; respect Reduce Transparency |

Flow: feature → `@/platform/ui` or primitives → `@expo/ui` (native) / RN-web fallback.

---

## Social product analysis

### X
- **Pattern:** Compact text-first posts; underline feed selector; compose in toolbar.
- **Why:** Dense readable feed without card chrome.
- **Where:** Home post anatomy, Following/For You/Modules selector, compose action.
- **What not to copy:** Brand-specific side rail IA or bird iconography.
- **A11y:** 44pt engagement targets; tabular counts.
- **Platform:** Native toolbar compose, not centre tab.

### Reddit
- **Pattern:** Communities as discovery units; restrained list rows.
- **Why:** Topic discovery without visual noise.
- **Where:** Discover communities section.
- **What not to copy:** Karma-heavy chrome or alien branding.
- **A11y:** Clear section headings.
- **Platform:** Native search + section lists.

### Instagram
- **Pattern:** Stories rail; full-bleed media; immersive Reels.
- **Why:** Media hierarchy is unmistakable.
- **Where:** Home stories; Reels media layer + scrim + action rail.
- **What not to copy:** Permanent Reels tab unless product confirms; heart-only engagement model.
- **A11y:** Overlay tokens for contrast; Reduce Motion on immersive transitions.
- **Platform:** Reels as Stack destination, not a fifth tab.

### LinkedIn
- **Pattern:** Professional identity with restrained hero; people discovery.
- **Why:** Profile feels personal before administrative.
- **Where:** Profile hero simplification; Discover people.
- **What not to copy:** Dense employment widgets in hero.
- **A11y:** Plain About rows over pill badges.
- **Platform:** Native Share/More toolbar.

### TikTok
- **Pattern:** Immersive vertical media; right action rail; caption above home indicator.
- **Why:** Controls remain readable on busy media.
- **Where:** Reels recovery composition.
- **What not to copy:** Entire For You algorithm chrome or permanent tab takeover.
- **A11y:** mediaOverlay tokens; no black-on-teal.
- **Platform:** Hide native tab bar while immersive.

### Threads
- **Pattern:** Text-forward feed; light separators; compact compose prompt.
- **Why:** Calm social reading.
- **Where:** Home feed separators; “What are you building?” prompt.
- **What not to copy:** Meta-specific reply nesting UI wholesale.
- **A11y:** Body line height for multi-line text.
- **Platform:** Same shared Composer state from prompt and toolbar.

### Bluesky
- **Pattern:** Protocol-independent density; clear post actions; restrained chrome.
- **Why:** Study hierarchy only (Modula policy).
- **Where:** Post row roles, settings density inspiration.
- **What not to copy:** ALF, AT Proto types in UI, shell/gesture architecture.
- **A11y:** Token-driven contrast.
- **Platform:** Reimplement on Modula primitives only.

---

## Account panel interaction rules (implementable)

1. Explicit `openAccountPanel` / `closeAccountPanel` — no product `toggle`.
2. Pure reducer: closed → opening → open → closing → closed.
3. Ignore duplicate OPEN while opening/open; ignore duplicate CLOSE while closing/closed.
4. Close only via explicit control, swipe, backdrop, route navigation, or session reset.
5. Backdrop must not receive the opening touch’s release; trigger outside backdrop tree.
6. Instrument `__DEV__` events until instant-close is fixed, then keep a small diagnostic buffer.

## Composer / post menu extension points (sibling coordination)

- Shared Composer entry API remains stable for Home prompt + toolbar.
- Tools sheet is a ModulaSheet with Media/Create/Tools/Marketplace sections.
- Post overflow/context menus accept an extensible action list so Translate and similar actions can land without rewriting menus.
- Keyboard inset and camera presentation styling are sibling-owned polish; foundation leaves sheet/editor wrappers ready.
