# Phase 7F-B — UI Defect Inventory (from Phase 7F-A baseline)

**Baseline commit:** `34ba1dc` (`phase7f-a-mac-ios-smoke`)  
**Evidence:** `docs/validation/evidence/phase7f-a-ios-simulator/`  
**After screenshots:** `docs/validation/evidence/phase7f-b-native-product/` (filled during Checkpoint G)

Severity: `BLOCKER` · `HIGH` · `MEDIUM` · `LOW` · `NATIVE_DEVICE_ONLY` · `DEFERRED`

| # | Screen | Defect | Severity | Root cause | Target component | Fix | Before | After |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Home | Stories rail missing | BLOCKER | Empty `people`; no Stories API; rail returns `null` | Presence rail + Stories repository | Real query + Add Story empty state | `03-authenticated-home.png` | `05-home-with-stories.png` |
| 2 | Home | Feed mode control is custom RN pills, not native segmented | HIGH | `appearance="plain"` + `scrollable` bypasses native path | Community `SegmentedControl` via `ModulaSegmentedPicker` | Default `segmented`; short labels; no scroll bar | `03-authenticated-home.png` | `07`–`09` home modes |
| 3 | Home | Quiet Feed lengthens segment (“For You · Quiet”) | MEDIUM | Label mutation inside segment options | SegmentedControl + external quiet badge | Keep labels `Following \| For You \| Modules` | `03-authenticated-home.png` | `08-home-for-you.png` |
| 4 | Home | Focus + Merge banners consume vertical space above feed | MEDIUM | Always-on chrome when Focus active | Layout / Focus affordances | Keep functional; tighten spacing; Stories must remain visible under header/modes | `03-authenticated-home.png` | `05-home-with-stories.png` |
| 5 | Auth | Registration blocked on invite-only remote | BLOCKER (env) | `api.modula.digital` `inviteOnly: true` | Dev Greenfield env | Mutable non-prod env with registration + SMTP/mailbox | `02-login.png` | `02-create-account.png` |
| 6 | Auth | Valid new-account login not completed in 7F-A | HIGH | Invite-only + no smoke credentials | Auth screens + session | Full register → verify → login → restore | `02-login.png` | `04-login.png` / `26-session-restored.png` |
| 7 | Auth | Demo account path vs remote Greenfield | MEDIUM (fixed UI) | Demo passwords rejected remotely | Sign-in / Session Lab | Keep safe error UX; no demo token in product | `11-error-state.png` | `04-login.png` / offline |
| 8 | Settings | RN list rows / search; not Expo UI List/FieldGroup | HIGH | SystemListRow + RN TextInput | Universal List/ListItem/FieldGroup + Switch adapters | Native-style settings forms | `05-settings.png` | `21-settings-native-list.png` |
| 9 | Settings | Switches are RN `SystemSwitch` | HIGH | No Expo UI Switch adapter | Universal Switch adapter | Persist real preference state | (Appearance/prefs sub) | `22-appearance-segmented.png` |
| 10 | Appearance | Dark-depth Dim/Dark/OLED not native segmented | MEDIUM | Custom selectors / lists | SegmentedControl when Dark selected | `Dim \| Dark \| OLED` native segments | `09-light.png` / `10-oled.png` | `22-appearance-segmented.png` / `24-oled.png` |
| 11 | Product Hub | Empty registry for smoke account | HIGH (env/data) | No modules installed for account | Hub UI + seed tool | Real registry + install path; Expo UI segments | `06-product-hub.png` | `18-product-hub.png` |
| 12 | Vault Notes | Unavailable / not in registry | HIGH (env/data) | Module not installed for account | Module host + seed | Install via real lifecycle; open/edit/autosave | `07-vault-notes.png` | `20-vault-notes.png` |
| 13 | Profile | Posts “Could not load” in smoke | MEDIUM | API/profile posts path | Profile + feed contracts | Real posts load/edit | `08-profile.png` | `15-profile.png` |
| 14 | Shell | Nested tab name warning `index > index` | LOW | Expo Router nesting | Tabs layout | Repair if low-risk; else document | smoke log | nav verifier |
| 15 | Drawer | Automation hard without Assistive Access | LOW (tooling) | Simulator a11y | Deep link `openDrawer=1` | Preserve; re-verify open stays open | `04-drawer.png` | journey notes |
| 16 | Composer | Tool drawer / dead Camera risk | HIGH | Unsupported tools may still show | Expo UI BottomSheet + gated tools | Hide non-working tools; photo library on sim | (not in 7F-A set) | `10-composer.png` |
| 17 | Feed cards | Debug-ish acceptance copy density | LOW | Seeded Block 14 posts | Real acceptance seed script | Synthetic but domain-persisted content | `03-authenticated-home.png` | `07`–`11` |
| 18 | Glass / blur | Risk of blur on wrong surfaces | MEDIUM | Glass used broadly historically | Glass policy | Restrict to chrome/sheets; solid fallback | OLED/home | `23`/`24` |
| 19 | Activity | Need real filters + native segments | HIGH | Incomplete native product pass | SegmentedControl + notifications API | `All \| Mentions \| Modules` real only | (partial 7F-A) | `14-activity.png` |
| 20 | Discover | Trends/fake risk; search modes | HIGH | Trends without backend | Search + optional segments | Hide Trends unless real; People/Posts/Modules | (partial) | `13-discover.png` |
| 21 | Board | May advertise non-operational destinations | MEDIUM | Static cards historically | Registry-backed destinations | Only Vault Notes / Installed / Hub / Activity / Settings when real | (partial) | `17-board.png` |
| 22 | Offline / errors | Need clear retry UX | MEDIUM | Incomplete surfaces | Error banners + adapters | No red screen; preserve drafts | `11-error-state.png` | `25-offline-error.png` |
| 23 | Icons | Mixed families risk | MEDIUM | Historical SF + other sets | Central semantic map | One strategy per control family | multiple | shell polish |
| 24 | Keyboard layouts | Auth/composer/notes may clip | HIGH | Tab bar + keyboard insets | Keyboard adapters / sheet rules | Usable with iOS keyboard | — | auth + notes screenshots |
| 25 | Sticky segmented | Host historically breaks in sticky overlays | MEDIUM | Native Host + absolute sticky | Community SC test; track fallback | Document accepted fallback if needed | sticky clone | home modes |

## Mandatory audit areas — status

| Area | Baseline observation | Phase 7F-B action |
| --- | --- | --- |
| Home top padding | Usable; banners dominate | Preserve safe area; keep Stories visible |
| Missing Stories | Confirmed absent | Repair (RCA doc) |
| Segmented selector | Custom pills | Native community SC |
| Tab bar visibility | Floating glass bar OK | Preserve shell |
| Drawer | Works via deep link | Re-accept |
| Feed cards | Real remote posts; sparse UI | Keep real; polish density lightly |
| Composer | Entry present | Canonical flow + sheet tools |
| Settings | RN grouped lists | Expo UI List/Switch/Form |
| Product Hub | Empty match state | Seed + install UX |
| Vault Notes | Unavailable honest state | Install + editor |
| Profile | Loads chrome; posts flaky | Fix load/edit |
| Empty states | Some honest | Real CTAs, no fixtures |
| Authentication | Sign-in + restore; no register | Full auth journey |
| OLED | True black verified | Keep + Appearance segments |
| Keyboard layouts | Not fully proven | Auth/composer/notes |

## Fix tracking

Update the **After** column and severity as each defect closes. Final classification rolls into `phase7f-b-native-product-ui-auth-browse.md`.
