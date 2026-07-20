# Video / Appearance Advanced — branch handoff

**Date:** 2026-07-20  
**Repo:** [modula-mod/modula-latest](https://github.com/modula-mod/modula-latest)  
**Clone path (local):** `/Users/msjoy/Developer/modula-latest`  
**Branch:** `cursor/video-appearance-advanced-0f9c`  
**Base:** `phase6-greenfield-sovereign-core`  
**PR:** https://github.com/modula-mod/modula-latest/pull/7  

---

## 1. What this branch is

Large craft track on Modula’s greenfield Expo app: **video foundation**, **Appearance Advanced**, **shell chrome** (progressive blur, liquid glass, sticky feed modes), **Stories dial**, **Reels**, **pull-action tray**, **Customize / Product Hub** depth, and related native wiring.

It is **not** a Bluesky fork patch set. UI is reimplemented against Modula tokens, `@expo/ui` adapters, and Callstack liquid glass (gated).

---

## 2. Repository facts

| Item | Value |
| --- | --- |
| Remote | `https://github.com/modula-mod/modula-latest.git` |
| Package manager | `pnpm` |
| App | Expo / React Native (Modula) |
| Native liquid glass | `@callstack/liquid-glass` (dynamic require; Expo Go falls back) |
| Theme accent | Modula Teal `#369CAA` via tokens |

### Skills / policy (must follow)

- `.cursor/skills/modula-architecture/SKILL.md` — host vs modules, no Bluesky fork copy
- `.cursor/skills/modula-ui/SKILL.md` — tokens, primitives, Expo UI adapters
- `.cursor/skills/modula-dependencies/SKILL.md` — dependency admission

---

## 3. High-level additions on this branch

### 3.1 Shell chrome

| Surface | Behavior |
| --- | --- |
| **Progressive blur headers** | `ProgressiveBlurBand` + MaskedView; secondary / native stack headers |
| **Shell bottom edge wash** | `ShellBottomProgressiveBlur` — physical `bottom: 0` gradient (not a BlurView slab tied to the tab pill) |
| **Persistent floating tab bar** | `PersistentShellTabBar` → `ModulaLiquidGlassTabBar` when native module available |
| **Tab bar compact on scroll** | `shellTabBarCompact` — ~20% scale (`0.8`), bottom-anchored, ~480ms ease |
| **Expand on press** | `expandShellTabBar()` from tab / + `onPressIn` / press handlers |
| **Chrome obscure on pull** | `shellChromeObscure*` + `ShellChromeObscureView` / `useShellChromeObscureStyle` |

### 3.2 Home feed modes (Following / For You / Modules)

| Mode | Implementation |
| --- | --- |
| **Inline (scrollable menu)** | `ModulaSegmentedPicker` `appearance="plain"` + `scrollable` |
| **Sticky under nav** | `HomeStickyFeedModes` — denser liquid-glass capsule + **embedded track** segmented control |
| **Handoff** | Scroll-linked shrink → hard handoff at `stickAtY`; spring enter / snap-back |
| **Bleed fix** | Opaque underlay **under** glass (sibling), not opaque fill that kills Callstack glass |
| **Avoid** | Expo UI `Host`/`Picker` segmented inside absolute sticky overlays (layout breakage) |
| **Avoid** | `stickyHeaderIndices` for modes (incorrectly pinned Stories) |

### 3.3 Stories / Presence

- Dial-style Stories rail (rings / focus growth)
- Left-biased start; Add Story visibility insets
- Home Stories caption removed (`showCaption={false}`)

### 3.4 Segmented picker platform control

`ModulaSegmentedPicker` appearances:

| Appearance | Role |
| --- | --- |
| `segmented` | iOS Expo UI `Picker` (Host) when not scrollable / not embedded |
| `track` | Shared RN muted track + raised thumb |
| `glass` | Liquid-glass wrapper + token thumbs |
| `plain` | Chip / label menu (prefer with `scrollable`) |
| `embedded` | Track nested in outer glass (sticky modes) |

Files:

- `src/platform/ui/controls/modula-segmented-picker.types.ts`
- `src/platform/ui/controls/modula-segmented-picker.shared.tsx`
- `src/platform/ui/controls/modula-segmented-picker.native.tsx`
- `src/platform/ui/controls/modula-segmented-picker.tsx`

### 3.5 Video / Reels / Appearance Advanced

- Reel player adapters (`modula-reel-player*`)
- Draggable video controls
- Appearance Advanced camera / masked blur paths
- Expo Camera / Expo Video pods reflected in `ios/Podfile.lock` when linked

### 3.6 Pull-action tray (Home)

- Replace classic PTR with pull stages: refresh / close / search
- Shimmer edge (Skia when available)
- Feed fade + shell chrome hide while pulling
- Search modal from pull

### 3.7 Media posts

- Inverted-corner media tray, progressive blur on media, double-tap like
- Liquid-glass overlays where gated

### 3.8 Product / Customize

- Customize hub, layout studios, feature gates
- Product Hub / Feature Atlas depth (broader branch commits)

### 3.9 Removed / simplified on Home

- Quick-actions row removed
- Nested glass discs reduced on header icon chrome
- Plain Expo UI icon buttons for many chrome actions

---

## 4. Critical geometry contracts (bottom chrome)

These were iterated heavily; treat as source of truth:

### Tab bar

- Container: **`bottom: 0`**
- Safe area: **`paddingBottom: max(insets.bottom, spacing[2])`** (internal — glass reaches physical edge)
- Do **not** offset the whole pill with `bottom: insets.bottom` (creates black strip under home indicator)
- Liquid glass effect on pill: prefer **`clear`** so the pill does not read as a heavy rectangular “bottom progressive blur”
- Compact: scale to `0.8`, `transformOrigin: 'bottom'`, expand via `expandShellTabBar()`

### Shell bottom wash (`ShellBottomProgressiveBlur`)

- Pinned **`bottom: 0`**
- Soft **LinearGradient** edge wash (not MaskedView BlurView slab on this edge — that composited as a hard band)
- Height ≈ home-indicator inset + short rise (owned in the component)
- Job: dissolve / fill the physical edge; **not** replace tab liquid glass

### ProgressiveBlurBand (headers / media / drawers)

- Top-heavy gradients in local coords; bottom-anchored bands **flip 180°** so opaque end lands on the physical edge
- Still used for headers, media trays, drawers — not for the shell edge wash above

### Constants

`src/platform/ui/navigation/chrome-insets.ts`

- `CHROME_HEADER_ROW`, `CHROME_FADE_EXTENSION`, `CHROME_BLUR_INTENSITY`
- `CHROME_BOTTOM_FADE` (56) / `CHROME_BOTTOM_BLUR_INTENSITY` — shared; shell bottom owns final strip geometry

---

## 5. Key files (chrome / sticky / tabs)

| File | Role |
| --- | --- |
| `src/features/feed/components/HomeStickyFeedModes.tsx` | Sticky clone + inline handoff hooks |
| `src/features/feed/screens/HomeFeedScreen.tsx` | Wires sticky, scrollY, stickAtY, tab padding |
| `src/platform/ui/navigation/shell-bottom-progressive-blur.tsx` | Absolute bottom edge wash |
| `src/platform/ui/navigation/persistent-shell-tab-bar.tsx` | Root floating tab host + compact scale |
| `src/platform/ui/navigation/modula-liquid-glass-tab-bar.tsx` | Liquid glass tab UI + expand-on-press |
| `src/platform/ui/navigation/shell-tab-bar-compact.ts` | Shared compact SharedValue + expand API |
| `src/platform/ui/navigation/floating-tab-bar-inset.ts` | Content `paddingBottom` for screens |
| `src/platform/ui/navigation/chrome-insets.ts` | Shared chrome geometry constants |
| `src/components/materials/ProgressiveBlurBand.tsx` | Masked progressive blur primitive |
| `src/platform/ui/materials/liquid-glass-chrome.tsx` | Liquid glass / BlurView chrome helper |
| `src/app/_layout.tsx` | Mounts bottom wash + persistent tab bar |

---

## 6. Pitfalls (do not reintroduce)

1. **Expo UI Host segmented picker inside absolute sticky overlays** — broken layout / single “Following” pill + bleed.
2. **`stickyHeaderIndices` for mode tabs** — stuck Stories instead of modes.
3. **Opaque fill as child of Callstack liquid glass** — kills glass; use sibling underlay under glass.
4. **Tab bar `bottom: insets.bottom`** — black gap under home indicator.
5. **BlurView / MaskedView as full-width shell bottom slab** — reads as muddy hard band behind tabs; shell edge uses gradient wash.
6. **Dual opacity crossfade of inline + sticky clones** — bad scroll-up; prefer hard handoff + springs.
7. **Features importing `@expo/ui/swift-ui` directly** — use platform adapters only.
8. **Speculative dependency installs** — follow Modula dependency admission.

---

## 7. How to run / verify

```bash
# From repo root
pnpm install
cd ios && pod install && cd ..
pnpm exec expo run:ios   # liquid glass needs native binary; Expo Go falls back
pnpm exec tsc --noEmit
```

### Manual checks

- [ ] Home: scroll until Following / For You / Modules stick under nav — all three segments, no feed text through glass
- [ ] Inline modes are plain scrollable chips; sticky is track-in-glass
- [ ] Scroll down: tab bar shrinks ~20% in place (not snappy, not mid-screen)
- [ ] Press tab or +: bar expands to full size
- [ ] Physical bottom: no black strip under home indicator; glass reaches edge
- [ ] Shell edge wash starts at absolute bottom (not at tab pill bottom)
- [ ] Pull-action tray still hides chrome and drives refresh/search
- [ ] Stories dial / Reels / Appearance Advanced paths still load without crash

---

## 8. PR / merge notes

- **Draft PR #7** → base `phase6-greenfield-sovereign-core`
- Branch tip includes iOS project / `Podfile.lock` updates (ExpoCamera, ExpoVideo, Skia, etc.) from native linking — keep if the video/Skia track is intentional for this PR; otherwise split native lock churn in review.
- Prefer reviewing chrome contracts (§4) before merging further sticky/blur experiments.

---

## 9. Related docs

- `docs/validation/phase4-5-liquid-glass-tabs.md` — liquid glass tab gating
- `docs/design/apple-liquid-glass-inspiration.md`
- `docs/product/theme-architecture-v5.md`
- `docs/architecture/dependency-register.md`
- `.cursor/skills/modula-ui/SKILL.md`

---

## 10. Recent iteration summary (sticky + bottom chrome)

1. Sticky morphing feed modes under nav (Instagram-like).
2. Moved from Host segmented → plain scrollable inline + track-in-glass sticky.
3. Tab compact ~20% on scroll down; expand on press.
4. Bottom progressive blur repeatedly corrected:
   - Must start at **physical `bottom: 0`**
   - Must not look like it starts at the tab bar bottom
   - Tab glass uses **internal** safe-area padding
   - Shell edge wash is a **gradient**, not a BlurView slab tied to the pill
5. Sticky capsule: opaque underlay under dense liquid glass + `embedded` track picker.
