# Phase 7M-B6 Profile Signature Composition

Captured on **iPhone 17 Pro Simulator** (`0727E2F0-8528-44DA-9F4C-7B5F7394096B`). Metro on `cursor/phase7m-b6-profile-masterpiece-ce59`. Local demo-owner session (`@andrei.modula`).

This folder is the founder visual set for the signature composition pass. It is not founder approval.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
FOUNDER VISUAL APPROVAL = PENDING
```

## Profile Signature Composition Comparison

The founder-approved reference is the primary visual target. Implementation is a responsive layout, not a screenshot recreation.

| Target | Implementation | Match / deviation |
| --- | --- | --- |
| Full-bleed photographic cover from y=0 | `ProfileCover` still starts under the status bar with `disableAutomaticContentInsets` and negative top margin | Match |
| Liquid Glass back on public/preview | `ProfileCoverChrome` + `ModulaBackButton` (`chrome="glass"`) when `mode !== 'owner'` | Match. Owner root has no fake back |
| Liquid Glass owner action group | Native `ChromeGlassControlGroup` now wraps Expo UI glyphs in `LiquidGlassChrome` (Callstack → expo-glass-effect → BlurView). Feature code does not import SwiftUI | Match for adapter. Native material will not be pixel-identical to the illustration |
| Asymmetric inverted body | `buildAsymmetricRaisedTrailingPath` — lower left shoulder, concave valley around the avatar, raised trailing plateau | Intentional geometry, not a rounded-rect clip |
| Avatar left, name right | Identity column uses `identityColumnOffset`; name/handle sit on the raised plateau | Match at normal type. Stacks below the avatar when `fontScale ≥ 1.35` or width `< 340` |
| Compact left Metric Picker | Column width from `profileMetricColumnWidth` (~30%, clamped 96–120). Previous / selected / next in a 3-row window | Match |
| Right metadata grid | `ProfileMetadataGrid` 2-column joined / location / website. No hardcoded Public cell — there is no profile-level visibility field | Deliberate: omit empty/hardcoded visibility |
| Sticky tabs, NativeTabs | Unchanged `stickyHeaderIndices={[1]}` and system `NativeTabs` | Match |
| First post in the first viewport | Hero is two-column instead of stacked metrics+metadata | Density target; confirm on-device |

### Deliberate deviations

1. **Owner root has no back button** — nowhere to go back. Public and preview show the glass back.
2. **No fake Dynamic Island / status bar / callout labels** — those are documentation on the reference, not app UI.
3. **Visibility cell omitted** — `ModulaProfile` has field-level visibility, not a profile-level Public/Private enum. Hardcoding "Public" would be a fake.
4. **System NativeTabs** remain authoritative. The reference's bottom chrome is illustrative.
5. **Large Dynamic Type / narrow width** collapse to avatar → name → bio → picker → metadata so text cannot overlap the avatar.

## Founder set

| File | Surface |
| --- | --- |
| `profile-signature-owner.png` | Owner root — no back, glass Edit/Share/More, inverted geometry, name right, left picker |
| `profile-signature-public.png` | Public/preview — glass back visible |
| `profile-signature-metric-posts.png` | Posts selected |
| `profile-signature-metric-followers.png` | Followers selected |
| `profile-signature-metric-following.png` | Following selected |
| `profile-signature-customize-metrics.png` | Customize Metrics |
| `profile-signature-scrolled.png` | Sticky tabs + NativeTabs |
| `profile-signature-dark.png` | Dark |
| `profile-signature-oled.png` | OLED |
| `profile-signature-empty-cover.png` | Quiet empty cover, same geometry |
| `profile-signature-photo-cover.png` | Photographic development fixture |
