# Shell UI V1 — before / after

Visual acceptance: a reconstructed route PASSes only when before/after screenshots are obviously different in composition, hierarchy, typography, spacing, chrome, surfaces, iconography, or density.

Foundation/correctness on `a64194f` is retained and is **not** sufficient by itself.

**Evidence SHAs (continuation start)**

- origin/main: `a0d4d7966f4a3ae8f12736d1bb8dff169a3d0227`
- shell branch then: `a64194ff792456654e5f889990dc5d7857dfb183`

iOS device: iPhone 17 Pro Simulator. Interaction was previously blocked by the Expo “Open in Modula?” prompt and a locked `loginwindow` display.

| Route | Before (main / prior pass) | After (this continuation) | Composition | Hierarchy | Accessibility | Interaction | Gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | Overlay media cards, compact rail, “Start a post” pill | List-layout text posts; inline action bar; grouped composer “What’s happening?”; wordmark title | Text posts are documents, not 1:1 cards | Author → body → actions | Post group label; 44pt actions | Composer + More as tap alternatives | Pending screenshot |
| Profile | Full-bleed cover already present | Unchanged architecture; inherit a11y/type | Cover/avatar pocket kept | Metrics/About already reconstructed | Cover decorative | Floating chrome | Pending screenshot |
| Search / Discover | PageIntro “Explore” + glass search + interests CTA | Large Discover title, `ModulaSearchField`, canvas background | Header is product chrome, not a marketing intro | Title → search → categories | Search labelled | Keyboard search | Pending screenshot |
| Activity | Timestamp under copy; unread colour dot | Leading unread bar (shape), weight, trailing timestamp | Event list, not cards | Actor → sentence → time | Unread not colour-only | Open / mark read | Pending screenshot |
| Composer | Tools drawer exists | Unchanged this pass except inherited type/motion | — | — | Tools remain labelled | — | Pending screenshot |
| Settings root | Two buckets, plain glyphs, mixed destinations | Grouped native sections, saturated 29pt tiles, trailing values, keyword search | Scanable groups | Profile / Personalisation / Privacy / Platform / About / Developer | Tiles decorative; one row control | Search navigates real routes | Web dark/light captured (`web-settings-dark.png`); iOS pending |
| Appearance | Slider + boolean switches mixed with theme studio | Theme studio + link to Display & Text Size | Theme vs system adaptation separated | Mode tiles then Display & Text Size push | Adaptive prefs | Pickers announce name + value | Pending iOS |
| Accessibility | Text slider + fake-feeling toggles | Hero + Vision / Physical and Motor / Hearing / Speech **link rows** (Display & Text Size, Hover Text, Motion are child routes) | iOS Settings push navigation | Intro then domains | Honest; no fake Hover Text toggle | Chevron always pushes | Web dark/light (`web-accessibility-dark.png`, `web-display-and-text-dark.png`, `web-hover-text-dark.png`); iOS pending |
| Product Hub | Editorial hero + flash-to-empty hardening | Hardening kept; visual still Direction M | — | — | Product rows labelled | Catalogue remains visible | Pending screenshot |
| Module Detail | Full-bleed cover direction exists | Inherit type/contrast/motion | — | — | Floating chrome labels required | — | Pending screenshot |

Until fresh iPhone 17 Pro top/scrolled captures exist for each P0 route, treat visual gates as **not yet evidenced**. Code composition changes for Home, Discover, Activity, and Settings are the reconstruction — screenshots must prove them.
