# Phase 7I-MAC-B — Component inventory

Classifications from authenticated Simulator audit (Expo SDK 57 / RN 0.86).

| Component | Location | Classification | Notes |
|---|---|---|---|
| AppButton / ModulaButton | primitives / platform | KEEP | Adapter path OK |
| AppText / AppScreen | primitives | KEEP | |
| AuthField | auth primitives | REPAIR | testIDs added; email autoCorrect off |
| SystemSwitch / ModulaSwitch | system / platform | REPLACE_WITH_ADAPTER | Adopted for Settings toggles |
| SettingsLinkRow / SettingsSection | settings | KEEP | Native-feel grouped lists |
| SettingsToggleRow | settings | REPAIR | Now uses SystemSwitch |
| NavigationDrawer / Account panel | shell / platform | KEEP | Preferred architecture; crash fixed |
| Floating tab bar | platform navigation | KEEP | Product identity; inset helpers required |
| ProgressiveBlurBand / ShellBottomProgressiveBlur | chrome | KEEP | Keep semantically separate |
| HomeStickyFeedModes | feed | REPAIR | Latch fix; avoid Host in absolute sticky |
| Feed mode control | feed | CUSTOM | Prefer Modula track / glass-embedded |
| Stories rail / StoryAvatar | presence | KEEP | Brand; empty = real data |
| PostCard / FeedPostItem | feed | KEEP | Tone down borders later |
| Reaction control | feed | KEEP | Like/Love/Laugh/Fire vocabulary |
| Composer + tools | composer | KEEP | Extensible tools; not flat icon strip |
| Product Hub cards / filters | product | REPAIR | Fewer zero-count pills; sheet filters |
| Module detail / host | modules | KEEP | Improve native feel generally |
| Focus Halo (profile) | profile | KEEP | Brand |
| Avatar | primitives | KEEP | |
| SecondaryScreenHeader | shell | KEEP | |
| ChromeOverflowMenu / ModulaMenu | platform | KEEP / ADAPT | Good Expo UI Menu candidates |

## Retain as custom (product identity)

Stories rail · Focus Halo · Post Card · Reaction picker · Liquid Glass tab bar · Progressive blur chrome · Product Hub cards · Module presentation · Composer Tools.
