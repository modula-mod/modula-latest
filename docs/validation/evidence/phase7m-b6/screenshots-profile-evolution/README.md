# Phase 7M-B6 Profile evolution evidence

Captured 2026-08-16 on **iPhone 17 Pro Simulator** (`0727E2F0-8528-44DA-9F4C-7B5F7394096B`, iOS 27.0) with Metro on `cursor/phase7m-b6-profile-evolution-8344`.

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
FOUNDER VISUAL APPROVAL = PENDING
```

## What changed

The existing owner Profile on NativeTabs was evolved in place:

- Full-bleed cover still paints under the status bar
- Inverted canvas transition wraps the avatar
- Focus Halo is a compact status ring
- Inline stats became the Profile Metric Picker
- Metric order / visibility / default persist through Customize
- Profile tabs stick while content scrolls
- Content padding clears NativeTabs when automatic insets are disabled

## Shots

| File | Surface | What to look at | Status |
| --- | --- | --- | --- |
| `01-profile-owner-empty-cover.png` | Owner / empty cover | Banner at y=0, no white header, no back, share+overflow, inverted wrap, picker, tabs, first post visible | Captured |
| `02-profile-owner-photo-cover.png` | Owner / photo cover | Photo under status bar | **Not captured** — this seed has no `coverUri`; empty cover is the intentional fixture |
| `03-profile-metric-picker.png` | Metric picker | Previous empty at start / selected Posts / next Followers | Captured (same first viewport as 01) |
| `04-profile-metric-customize.png` | Customize | Profile Metrics shown list, default metric, Focus Halo | Captured |
| `05-profile-scrolled-tabs.png` | Scrolled | Sticky tabs, post content, NativeTabs still present | Captured |
| `06-profile-dark.png` | Dark | Attempted via Appearance; in-app mode stayed Light on this pass | Partial — see limitation |
| `07-profile-oled.png` | OLED | OLED tile is inside the dark-depth segmented control, not a primary tile | Partial — not a dedicated OLED profile header |

## Known limitations

- Founder visual approval is still required
- Photo-cover shot depends on a locally set cover; demo/device seed used here has none
- Compact identity header during collapse was omitted to avoid a second drifting header
- Module-contributed metrics are registry-ready only; no speculative backend
- Dark / OLED profile-header recapture needs a follow-up on the Appearance dark-depth segmented control
