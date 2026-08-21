# Phase 7N UI reconstruction backlog

This is a **roadmap**, not authorisation to start every phase. 7N-A froze a baseline; later phases must cite these stills.

Evidence: `modula-mod/modula-evidence-screenshots` `phase-7n/a/`
Core-7 contact sheet: `contact-sheets/CORE-7-CONTACT-SHEET.png`

## Shared invariants (every later phase)

- Expo SDK 57. Do not copy SDK 55 Expo UI samples.
- Tracked `ios/` and `android/` stay first-class.
- No production deploy unless a later mission says so.
- Canonical module remains `digital.modula.vault-notes` @ 1.1.0. No invented 1.2.0.
- Do not reintroduce B8 UI over B9 Product Hub / Module Detail architecture.

---

## 7N-B1 — Foundations + shared controls

**Scope.** Spacing tokens, typography roles, Button contract, canonical Sheet vs Alert, floating-tab inset, icon adapter check.
**Components.** AppButton / ModulaButton, AuthField, Sheet, Alert, BottomNav inset, Search field truncation.
**Reference screenshots.** Login, Register, Hub search idle, Profile About (clipped), Module Install Alert, Gaia Following chip vs Hub Install teal vs Module navy Install.
**Functional invariants.** Auth still signs in; tab bar still routes; no visual “premium” restyle of screens.
**Expected routes.** `/sign-in`, `/register`, `/marketplace`, `/profile?tab=about`, `/settings`.
**Visual target.** One button language; sheets that can dismiss; Profile/About content fully above the tab bar.
**Acceptance evidence.** iPhone 17 Pro stills of Login, Hub, Profile About, one Sheet open/closed; Large Text Login.
**Dependencies.** None.

## 7N-B2 — Product Hub + Module Detail

**Scope.** MetadataStrip as one divided rail; CapabilityStrip as one row; Install CTA consistency; local install-preview fallback or honest disabled state; search-active/results; installed/updates empty vs real.
**Components.** ProductMetadataStrip, ProductCapabilityStrip, ProductActionGroup, InstallPreviewSheet, ModuleEditorialHero, ModuleRow, ModuleShelf, search reducer UI.
**Reference screenshots.** `7n-a-ios-product-hub-light-native-top.png`, `7n-a-ios-module-vault-notes-light-native-top.png`, `7n-a-ios-module-vault-notes-install-light-native.png`.
**Functional invariants.** Vault Notes remains `digital.modula.vault-notes` 1.1.0; ratings `—` when undeclared; no fake reviews.
**Expected routes.** `/marketplace`, `/marketplace/digital.modula.vault-notes`.
**Visual target.** Founder Product Hub / Vault Notes rails without rebuilding unrelated OS chrome.
**Acceptance evidence.** Hub top + lower (scroll), search idle/active/results, module top/mid/bottom, install review without a blocking `Alert` for the local-data case.
**Dependencies.** 7N-B1 button/sheet.

## 7N-B3 — Profile

**Scope.** Stats hierarchy, Focus Halo, photographic avatar when seed provides one, edit overlap bug, action rail on profile posts, public vs owner.
**Components.** ProfileHero, ProfileStats, ProfileTabContent posts, Profile edit form.
**Reference screenshots.** owner-top, about, public Gaia, edit.
**Functional invariants.** `?tab=` continues to work; owner vs public actions stay different.
**Expected routes.** `/profile`, `/profile?tab=*`, `/profile/gaia.modula`, `/profile/edit`.
**Visual target.** Social identity header that does not steal first viewport with a stats puzzle; no avatar/handle overlap on edit.
**Acceptance evidence.** Owner top/mid/bottom, each tab, public profile, edit, Large Text Profile.
**Dependencies.** 7N-B1 inset + button; 7N-B4 if sharing post chrome.

## 7N-B4 — Post foundation + image/text/carousel

**Scope.** One PostShell for Home vs `/post/:id`; image + text; carousel if real in seed.
**Components.** PostShell, ImagePost, TextPost, Carousel, PostHeader, Caption.
**Reference screenshots.** Home following, `7n-a-ios-post-image-light-native-resting.png`, `7n-a-ios-post-local-1-light-native.png`.
**Functional invariants.** Media that loaded on 7N-A still loads; no lorem captions.
**Expected routes.** `/`, `/post/post-showcase-bali`, `/post/post-local-1`.
**Visual target.** Dedicated post does not grow a white “Post” title bar the feed lacks, unless that chrome is an intentional product rule documented here.
**Acceptance evidence.** Feed resting + dedicated post, text post, carousel if present.
**Dependencies.** 7N-B1.

## 7N-B5 — Reactions + Comments + Context Menu

**Scope.** ActionRail replacement, reaction picker, comments sheet, comment row/composer, overflow menu.
**Components.** ActionRail, ReactionPicker, ContextMenu, CommentsSheet, CommentRow, CommentComposer.
**Reference screenshots.** Post image resting (rail only; interactions were not captured in 7N-A).
**Functional invariants.** Counts remain real API numbers; no fake comment threads.
**Expected routes.** Home post, `/post/:id`.
**Visual target.** Product rail, not a third-party overlay clone.
**Acceptance evidence.** Picker open, comments partial/expanded, share/error if real.
**Dependencies.** 7N-B4.

## 7N-B6 — Video + Music

**Scope.** Only if those post types exist in product seed/API. Do not invent.
**Components.** VideoPost, MusicPost.
**Reference screenshots.** None in 7N-A (NOT IN EVIDENCE).
**Functional invariants.** Do not ship decorative fake players.
**Expected routes.** TBD from seed.
**Visual target.** Same PostShell as image/text.
**Acceptance evidence.** Resting + playback with Reduce Motion note.
**Dependencies.** 7N-B4.

## 7N-B7 — Auth + Register + Verification + Onboarding

**Scope.** Tighten AuthShell; capture/fix password, OTP, register later steps; keep Welcome vs Onboarding distinct; do not invent post-account onboarding.
**Components.** WelcomeHero, AuthHeader, fields, OTP, RegistrationStep, OnboardingScreen.
**Reference screenshots.** welcome, login, register, onboarding, verify-email, forgot-password.
**Functional invariants.** Demo owner still works on local; session restore still uses SecureStore.
**Expected routes.** `/welcome`, `/sign-in`, `/register`, `/onboarding`, `/verify-email`, `/forgot-password`.
**Visual target.** Same field/button language as B1; onboarding remains the 3-step Get started tour.
**Acceptance evidence.** Full register steps, login password, one error state, onboarding steps 1–3.
**Dependencies.** 7N-B1.

## 7N-B8 — Home + Stories + Shell

**Scope.** Home chrome, stories row, discover truncation, drawer, composer entry.
**Components.** TopChrome, Stories, Discover search/tabs, Drawer, FAB/Create.
**Reference screenshots.** home-owner, discover, stories, composer, activity.
**Functional invariants.** Following / For You / Modules still switch.
**Expected routes.** `/`, `/discover`, `/stories`, `/compose`, `/activity`.
**Visual target.** Discover tabs do not clip “Marketplace”; stories remain real.
**Acceptance evidence.** Home top, Discover, Stories, drawer open.
**Dependencies.** 7N-B1, 7N-B4.

## 7N-B9 — Settings + Security + Appearance

**Scope.** Settings list density; Appearance mode including Dim/OLED/Surface Types actually applied to Hub/Profile/Post.
**Components.** Settings screens, AppearanceScreen, surface playground.
**Reference screenshots.** settings-*, appearance, appearance-lab, surface-playground, profile-dark (only valid dark still).
**Functional invariants.** Appearance preferences persist; no Apple Settings clone claim.
**Expected routes.** `/settings`, `/settings/appearance`, `/settings/security`, `/settings/account`.
**Visual target.** OLED and Surface Types photographed on Core-3 (Hub, Profile, Post), not only on the picker.
**Acceptance evidence.** Light + OLED Core-7 or documented Core-3; Dim/Dark representative.
**Dependencies.** 7N-B1.

## 7N-C — Full visual consolidation

**Scope.** Re-capture Core-7 + supporting after B1–B9; one contact sheet; founder review. Not a new invention pass.
**Components.** All surviving KEEP/REFINE pieces.
**Reference screenshots.** This 7N-A pack as “before”.
**Functional invariants.** P0 0, P1 0, Vault Notes 1.1.0, no production surprise.
**Expected routes.** Core-7 + Home + Settings.
**Visual target.** One coherent OS, not seven restyles.
**Acceptance evidence.** New evidence folder `phase-7n/c/` plus REVIEW index. Founder approval is a separate gate.
**Dependencies.** B1–B9 as actually executed.
