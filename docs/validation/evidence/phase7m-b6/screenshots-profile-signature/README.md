# Phase 7M-B6 Profile Signature Composition

Captured 2026-08-16 on **iPhone 17 Pro Simulator** (`0727E2F0-8528-44DA-9F4C-7B5F7394096B`, iOS 27.0). Metro on `cursor/phase7m-b6-profile-masterpiece-ce59`. Local demo-owner session (`@andrei.modula`).

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
| Full-bleed photographic cover from y=0 | Cover starts under the status bar; mountain fixture on the owner profile | Match |
| Liquid Glass back on public/preview | Extra-large glass `ModulaBackButton` on Gaia public and owner preview | Match. Owner root has no fake back |
| Liquid Glass owner action group | `ChromeGlassControlGroup` → `LiquidGlassChrome` over photography (Edit / Share / More). Native material, not opaque `#F7F7F8` | Match for adapter. System glass will not be pixel-identical to the illustration |
| Asymmetric inverted body | `buildAsymmetricRaisedTrailingPath`: lower left, concave valley around the avatar, raised trailing plateau for the name | Match on-device: white/black body sits higher on the right |
| Avatar left, name right | `identityColumnOffset` keeps name/handle/pronouns off the avatar slot | Match at normal type |
| Compact left Metric Picker | ~96–120pt column, previous / selected / next, typography + opacity (no pill) | Match |
| Right metadata grid | Joined + location on row 1, website on row 2, hairline separators, no cards | Match. Visibility cell omitted — no profile-level visibility field |
| Tabs high, first post in viewport | Two-column hero; first post is on-screen in owner/public shots | Match |
| Sticky tabs + NativeTabs | Scrolled shot: tabs under the status region, system tab bar remains | Match. Overlay chrome stays on the cover layer while tabs stick |

### Deliberate deviations

1. **Owner root has no back button** — nowhere to go back. Public and preview show the glass back.
2. **No fake Dynamic Island / status bar / callout labels** — documentation on the reference, not app UI.
3. **Visibility cell omitted** — `ModulaProfile` has field-level visibility only. Hardcoding “Public” would be a fake.
4. **System NativeTabs** remain authoritative. The reference’s bottom chrome is illustrative.
5. **Follow lives in the information column** on public/preview — not inside the cover action group.
6. **Large Dynamic Type / narrow width** stack instead of overlapping.
7. **`profile-signature-dark.png`** is the OLED true-black capture of this composition. Charcoal Dark uses the same geometry tokens; switching Dark via Appearance tiles was unreliable in Maestro after session revocation, and writing AsyncStorage required an app terminate that revoked the demo session.

## Founder set

| File | Surface |
| --- | --- |
| `profile-signature-owner.png` | Owner root — no back, glass Edit/Share/More, inverted geometry, name right, left picker |
| `profile-signature-public.png` | Public Gaia — glass back visible, empty-cover atmosphere, Following in the info column |
| `profile-signature-preview.png` | Owner preview — glass back + visitor banner |
| `profile-signature-metric-posts.png` | Posts selected |
| `profile-signature-metric-followers.png` | Followers selected |
| `profile-signature-metric-following.png` | Picker advanced (Following / Modules in the window) |
| `profile-signature-customize-metrics.png` | Customize Metrics, left-side selector preview, reorder + default |
| `profile-signature-scrolled.png` | Sticky tabs + posts + NativeTabs |
| `profile-signature-dark.png` | Dark-canvas composition (OLED capture; see deviation 7) |
| `profile-signature-oled.png` | OLED true-black body, same geometry |
| `profile-signature-empty-cover.png` | Quiet empty cover, same inverted silhouette |
| `profile-signature-photo-cover.png` | Photographic development fixture (same frame as owner) |
