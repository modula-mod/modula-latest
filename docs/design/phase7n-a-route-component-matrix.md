# Phase 7N-A route × component matrix

Presence is from **captured iOS stills** plus source where a capture was blocked. ✓ = visible on that route in evidence. — = not on that route. ◐ = in source, not captured.

| Component | Profile | Hub | Module | Post | Login | Register | Onboarding |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TopChrome | ✓ | — | ✓ | ✓ | — | — | — |
| BottomNav | ✓ | — | — | — | — | — | — |
| Surface / canvas | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Avatar | ✓ | ✓ | — | ✓ | — | — | — |
| Cover / hero photo | ✓ | ✓ | ✓ | ✓ | — | — | ◐ preview card |
| Button (primary) | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| Button (secondary/ghost) | ✓ | — | ✓ | — | ✓ | ✓ | ✓ |
| TextField | ✓ edit | ✓ search | — | — | ✓ | ✓ | — |
| Sheet | — | — | ✓ install | ◐ | — | — | — |
| Alert | — | — | ✓ local install fail | — | — | — | — |
| Segmented tabs | ✓ | — | ✓ | — | — | — | — |
| Home feed tabs | — | — | — | ✓ on Home | — | — | — |
| MetadataStrip | — | — | ✓ | — | — | — | — |
| Capability cards | — | — | ✓ | — | — | — | — |
| ActionRail | ✓ on posts | — | — | ✓ | — | — | — |
| Search | — | ✓ idle | — | — | — | — | — |
| ModuleArtwork | ✓ modules tab | ✓ | ✓ | — | — | — | — |
| FocusHalo / ring | ◐ teal ring | — | — | — | — | — | — |
| AuthLink | — | — | — | — | ✓ | ✓ | ✓ |
| Floating tab inset | ✓ clips About | — | — | — | — | — | — |

Leverage: fixing **Button**, **Sheet/Alert**, **spacing tokens**, **tab-bar inset**, and **ActionRail** changes Profile + Hub + Module + Post + Auth together. Do not start with seven independent screen rebuilds.

## Additional captured routes (supporting)

Home, Discover, Activity, Stories, Saved, Composer, Messages, Settings, Account, Security, Appearance, Connections, Modules settings, Mail, Accessibility, Profile edit/customize/preview, public Gaia, Welcome, Forgot password, Verify email, Reset password, Recover.
