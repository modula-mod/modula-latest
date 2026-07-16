# Phase 2 Device Test Plan

Run after installing the Phase 2 development client.

Command:

```sh
pnpm start:dev:clear
```

Appearance combinations:

- System + Native
- Light + Solid
- Dim + Minimal Spatial
- Dark + Glass
- OLED + Native
- Ocean + OLED + Glass
- Forest + Dark + Glay
- Plum + Dark + Neomorphic
- Espresso + Dark + Skeuomorphic

For every combination:

- launch app;
- open drawer;
- switch all tabs;
- scroll feed;
- open Composer;
- open Composer Tools;
- open Profile;
- open Board;
- open Settings;
- background and foreground;
- restart app;
- confirm preferences persist.

Accessibility:

- test text scale from 90% to 130%;
- test Bold Text;
- test Reduce Motion;
- test Reduce Transparency;
- test Increase Contrast;
- verify screen-reader labels for tabs, Create, drawer, appearance options, accent swatches, Surface Type cards, custom accent input, switches, text-size slider and reset.
