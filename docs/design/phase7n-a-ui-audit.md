# Phase 7N-A UI audit

Audit of **captured 2026-08-21 iPhone 17 Pro Simulator stills**, not memory and not B9 founder mockups as if they were current. No founder visual approval is implied.

CAPTURE SET: `modula-mod/modula-evidence-screenshots` `phase-7n/a/`
CORE-7 CONTACT SHEET: `phase-7n/a/contact-sheets/CORE-7-CONTACT-SHEET.png`

## Route scoreboard

| Route | Classification | Why (from stills, not adjectives) |
| --- | --- | --- |
| PROFILE | NEEDS_REWORK | Hero cover is useful, but identity/stats split left-column counts from a 2×2 metadata grid; letter avatar; TikTok-style action rail on profile posts; floating tab bar clips About content. |
| MODULE DETAIL | NEEDS_REWORK | Cover, artwork, Private-by-design badge, title, Install CTA, version **1.1.0** are real. MetadataStrip is six separately padded cells, four of them `—` on local data. Trust/capabilities is four independent rounded cards. |
| PRODUCT HUB | NEEDS_REFINEMENT | Vault Notes featured card + New-for-Modula row + Made-by-Modula shelf are a coherent marketplace. Search idle only. Installed/Updates not visible. |
| POST | NEEDS_REWORK | Image post is immersive and media loads. Dedicated `/post/:id` adds a white “Post” chrome bar the Home feed does not use. Right action rail is overlay-circle social, not a product-consistent control. |
| LOGIN | NEEDS_REFINEMENT | Identity-only first step: large title, one grey field, full-width teal Continue, two text links, large empty canvas below. |
| REGISTER | NEEDS_REWORK | Same AuthShell as login; only Display name + Email captured. Password/handle/terms steps exist in `CreateAccountScreen` but were not photographed. |
| ONBOARDING | NEEDS_REFINEMENT | Real 3-step pre-account tour from Welcome “Get started”, **not** post-registration setup. Step 1 captured. |

## Onboarding truth

Welcome `/welcome` is the marketing landing (orbit diagram, Get started / Sign in / Explore as guest).
`Get started` routes to `/onboarding` (world → profile → modules).
`CreateAccountScreen` (`/register`, `/create-account`) does **not** navigate to `/onboarding` after `register()`. There is no captured post-account avatar/interests/module onboarding. Do not call registration “onboarding”.

## Profile

### Audit questions (answered from stills)

| Question | Evidence |
| --- | --- |
| Social identity vs settings page? | Social identity: cover, avatar, bio, posts, follow counts. Not a settings list. |
| Avatar/cover prominent? | Cover is a full-bleed mountain photo. Avatar is a large overlapping letter “A”, not a portrait. |
| Focus Halo visible? | Thin teal ring around the owner avatar. Easy to miss; not a distinct halo object. |
| Cover useful? | Yes — landscape photograph, not empty canvas. |
| Counts/hierarchy clear? | Split: “4 Posts / 1.8K Followers” under the avatar; join/location/link/visibility in a 2×2 grid on the right. Two pagination pills imply a swipeable header that was not scrolled. |
| Tabs good? | Posts / Media / About / Modules / Links exist and `?tab=` works. |
| Excessive cardification? | Header is not a card; posts use large rounded cards with overlay rails. |
| Empty space? | First viewport is filled by cover + identity; not an empty 38% canvas. |
| Public vs owner? | Gaia public: Following button, no edit/compose chrome, “Follows you”, grey media well. |
| Modules integrated? | Modules tab exists; first viewport of owner is Posts. |
| Buttons native? | Edit/share/more sit in a frosted pill. Following on Gaia is a light-blue filled chip. |
| Images rendering? | Owner cover yes. Avatar letter glyph. Gaia post well is grey — possible missing media. |

### Profile components

| Component | CURRENT IMPLEMENTATION | CURRENT LOCATION | SCREENSHOTS | CURRENT PROBLEMS | FUNCTIONAL STATE | ACCESSIBILITY STATE | PLATFORM STATE | DESIGN CLASSIFICATION | TARGET REFERENCE | DEPENDENCIES | NEXT PHASE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ProfileCover | Full-bleed photo in `ProfileHero` | `src/features/profile/components/ProfileHero.tsx` | owner-top, edit | Useful; edit layout lets avatar overlap handle text | Working | Unmeasured | iOS captured | KEEP | Founder profile hero | Media pipeline | 7N-B3 |
| ProfileAvatar | Letter glyph in circle + white ring | ProfileHero | owner-top, public Gaia | Not photographic; public Gaia uses “G” | Working | Unmeasured | iOS | REFINE | Portrait-first identity | Avatar contracts | 7N-B3 |
| FocusHalo | Teal ring only | ProfileHero | owner-top | Not a distinct Focus Halo treatment | Working | Unmeasured | iOS | REFINE | Focus Halo spec | Appearance tokens | 7N-B3 / 7N-B1 |
| ProfileIdentity | Name, verified, handle, pronouns, bio | ProfileHero | owner-top | Hierarchy competes with stats grid | Working | Unmeasured | iOS | KEEP | Social identity | — | 7N-B3 |
| ProfileActions | Frosted edit/share/more pill | ProfileCoverChrome | owner-top | Owner-only; public uses share/more | Working | Unmeasured | iOS | REFINE | Native more menu | Modula menus | 7N-B1 |
| ProfileStats | Vertical 4 Posts / 1.8K Followers | ProfileHero | owner-top | Detached from identity; followers has a stray down-chevron | Working | Unmeasured | iOS | REWORK | Single stats rail | — | 7N-B3 |
| ProfileTabs | Posts Media About Modules Links | ProfileTabBar | owner tabs | Good; sticky vs hero not captured on scroll | Working (`?tab=`) | Unmeasured | iOS | KEEP | Compact underline tabs | — | 7N-B3 |
| ProfilePostGrid/List | Card + overlay action rail | ProfileTabContent | posts/about | Rail copies Home/Post overlay language onto Profile | Working | Unmeasured | iOS | REWORK | Profile-appropriate actions | Post foundation | 7N-B3 / 7N-B4 |
| ProfileModulePresentation | Modules tab | ProfileTabContent | modules tab | Not audited at scroll depth | Working | Unmeasured | iOS | REFINE | Integrated modules | Product Hub | 7N-B3 |
| ProfileAbout | Repeats bio + type/location | ProfileTabContent | about | Bio duplicated from header; tab bar clips last rows | Working | Unmeasured | iOS | REFINE | Single about surface | Shell inset | 7N-B3 / 7N-B1 |
| ProfileLinks | Links tab | ProfileTabContent | links | Not inspected beyond tab switch | Working | Unmeasured | iOS | REFINE | Link list | — | 7N-B3 |
| ProfileEditSheet/Form | Full-screen Edit Profile | `/profile/edit` | edit | Avatar overlaps “@andrei.mu…”; cover long-press hint | Working | Unmeasured | iOS | REWORK | Native form, no overlap | — | 7N-B3 |

## Module Detail (Vault Notes 1.1.0)

| Component | CURRENT IMPLEMENTATION | CURRENT LOCATION | SCREENSHOTS | CURRENT PROBLEMS | FUNCTIONAL STATE | ACCESSIBILITY STATE | PLATFORM STATE | DESIGN CLASSIFICATION | TARGET REFERENCE | DEPENDENCIES | NEXT PHASE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ProductCover | Full-bleed desk/notebook photo | `product-detail/ProductCover.tsx` | vault-notes-top | Keep; light status bar over photo | Working | Unmeasured | iOS | KEEP | FM-PH-VN cover | Artwork pack | 7N-B2 |
| ModuleArtwork | Tan document+pencil tile | `ModuleArtwork.tsx` | vault-notes-top | Keep | Working | Unmeasured | iOS | KEEP | Founder artwork | moduleArtwork.ts | 7N-B2 |
| ProductBadge | PRIVATE BY DESIGN + lock | ProductIdentity | vault-notes-top | Keep | Working | Unmeasured | iOS | KEEP | Privacy badge | — | 7N-B2 |
| ProductIdentity | Title, subtitle, Modula + Verified | ProductIdentity | vault-notes-top | Keep | Working | Unmeasured | iOS | KEEP | Title block | — | 7N-B2 |
| ProductActionGroup | Navy/black Install | ProductActionGroup | vault-notes-top | Keep; differs from Hub teal Install | Working | Unmeasured | iOS | REFINE | One Install CTA language | Button contract | 7N-B1 / 7N-B2 |
| MetadataStrip | Six cells: Rating Age Chart Developer Size Version | ProductMetadataStrip | vault-notes-top | Four local values are `—`. Cells are separately padded rounded surfaces, not one divided rail | Local data incomplete; UI working | Unmeasured | iOS | REWORK | Single information rail | Ratings API on remote | 7N-B2 |
| ProductTabs | Overview Features Permissions Reviews Related | ProductTabs + ModulaSegmentedPicker | vault-notes-top | Overview only captured | Working | Unmeasured | iOS | KEEP | Segmented product tabs | — | 7N-B2 |
| CapabilityStrip | Four cards: Private / Offline / Sync / Platforms | ProductCapabilityStrip | vault-notes-top | Four independently padded rounded surfaces. Offline/Sync “Not declared” | Working | Unmeasured | iOS | REWORK | One capability row | Marketplace declarations | 7N-B2 |
| WhatsNew | Version 1.1.0 + two bullets + Version History | ProductWhatsNew | vault-notes-top | Keep | Working | Unmeasured | iOS | KEEP | What’s New | Provenance 1.1.0 | 7N-B2 |
| PreviewCarousel | Section header visible, frames below fold | ProductPreviewCarousel | vault-notes-top | Not fully captured (no scroll) | Unknown visually | Unmeasured | iOS | REFINE | Preview cards | — | 7N-B2 |
| PlatformRow | Declared iOS, Android, Web via capability | capabilitiesFor() | vault-notes-top | Combined into capability card | Working | Unmeasured | iOS | REFINE | Platform strip | — | 7N-B2 |
| InformationStrip | Below fold on Overview | ProductInformationStrip | not in first viewport | NOT CAPTURED | Working in source | Unmeasured | — | REFINE | Info rail | — | 7N-B2 |
| StickyProductHeader | Source exists | ProductStickyHeader | not captured | Needs scroll | Working in source | Unmeasured | — | KEEP | Sticky install | — | 7N-B2 |
| InstallReview | Sheet + teal “Install Vault Notes” | InstallPreviewSheet | install still | System Alert “couldn’t be prepared” because local `/install-preview` has no fallback | LOCAL PREVIEW FAIL isolated | Alert not dismissible without tap | iOS | KEEP UI / INCOMPLETE data | Review sheet | Local install API | 7N-B2 |
| InstallProgress | Stage machine in ModuleDetailScreen | ModuleInstallProgress | none | Not reached | INCOMPLETE locally | — | — | MISSING in evidence | Progress | Backend install | 7N-B2 |

## Product Hub

| Component | CURRENT IMPLEMENTATION | CURRENT LOCATION | SCREENSHOTS | CURRENT PROBLEMS | FUNCTIONAL STATE | ACCESSIBILITY STATE | PLATFORM STATE | DESIGN CLASSIFICATION | TARGET REFERENCE | DEPENDENCIES | NEXT PHASE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ProductHubHeader | Display title + subtitle + avatar | ProductHubMarketplaceScreen | hub-top | Keep | Working | Unmeasured | iOS | KEEP | Hub header | — | 7N-B2 |
| Search | Pill “Search Product Hub” idle | search reducer | hub-top | Active/results not captured | Working in source | Unmeasured | iOS | REFINE | Morphing search | — | 7N-B2 / 7N-B1 |
| EditorialHero | FEATURED Vault Notes card + Install | ModuleEditorialHero | hub-top | Large rounded card; teal Install vs navy on detail | Working | Unmeasured | iOS | KEEP | Featured hero | Local catalogue | 7N-B2 |
| ModuleRow | New for Modula list + Install | ModuleRow | hub-top | Keep | Working | Unmeasured | iOS | KEEP | List row | — | 7N-B2 |
| ModuleShelf | Made by Modula horizontal cards | ModuleShelf | hub-top | Third card clipped; Tasks/DIMON still in shelf | Working | Unmeasured | iOS | REFINE | Shelf | Catalogue | 7N-B2 |
| Collection | Build your workspace below fold | screen | hub-top | Label only | Working | Unmeasured | iOS | REFINE | Collections | — | 7N-B2 |
| InstalledRow | Filtered on installationState | screen | none | NOT IMPLEMENTED in local data (no installs) | Empty | — | iOS | MISSING | Installed | Install path | 7N-B2 |
| UpdateRow | Same | screen | none | NOT IMPLEMENTED locally | Empty | — | iOS | MISSING | Updates | — | 7N-B2 |
| CategoryFilter | Browse categories in search-active | search browse | none | Not captured | Working in source | Unmeasured | — | REFINE | Filters | Search | 7N-B2 |
| SectionHeader | FEATURED / New / Made by Modula | HubSectionHeader | hub-top | Keep | Working | Unmeasured | iOS | KEEP | Section labels | — | 7N-B2 |

## Post

| Component | CURRENT IMPLEMENTATION | CURRENT LOCATION | SCREENSHOTS | CURRENT PROBLEMS | FUNCTIONAL STATE | ACCESSIBILITY STATE | PLATFORM STATE | DESIGN CLASSIFICATION | TARGET REFERENCE | DEPENDENCIES | NEXT PHASE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PostShell | Rounded card on Home; full-bleed on `/post/:id` | feed + post route | home, post-image | Two chromes for one object | Working | Unmeasured | iOS | REWORK | One post shell | — | 7N-B4 |
| PostHeader | JW avatar, name, verified, time, location | overlay | post-image | Keep on media | Working | Unmeasured | iOS | KEEP | Overlay identity | — | 7N-B4 |
| Avatar | Letter circles JW / A | — | home, profile | Seed glyphs | Working | Unmeasured | iOS | REFINE | Photos | — | 7N-B4 |
| FocusRing | Not visible on post avatars in stills | — | post-image | MISSING on post | — | — | iOS | MISSING | Focus | — | 7N-B4 |
| ImagePost | Bali sunset loads | post-showcase-bali | post-image, owner-media | Keep | Working | Unmeasured | iOS | KEEP | Immersive image | Media | 7N-B4 |
| TextPost | post-local-1 captured | `/post/post-local-1` | post-local-1 | Not visually inspected in this write-up beyond existence | Working | Unmeasured | iOS | REFINE | Text post | — | 7N-B4 |
| Carousel | Controlled carousel in source | B7 work | none | NOT IN EVIDENCE | Unknown | — | — | MISSING evidence | Carousel | — | 7N-B4 |
| VideoPost | — | — | none | NOT IN EVIDENCE | — | — | — | MISSING | Video | — | 7N-B6 |
| MusicPost | — | — | none | NOT IN EVIDENCE | — | — | — | MISSING | Music | — | 7N-B6 |
| ActionRail | Vertical translucent circles: more, like 25K, comment 368, save, share 1.2K | overlay | post-image, home | Replicated on Profile cards; not a Modula product rail | Working | Unmeasured | iOS | REWORK | Founder action rail | — | 7N-B4 / 7N-B5 |
| ReactionPicker | — | — | none | NOT CAPTURED | — | — | — | MISSING evidence | Reactions | — | 7N-B5 |
| ContextMenu | more button present | — | post-image | NOT OPENED | — | — | — | MISSING evidence | Menu | Modula menus | 7N-B5 |
| CommentsSheet | — | — | none | NOT CAPTURED | — | — | — | MISSING evidence | Comments | — | 7N-B5 |
| CommentRow / Composer | — | — | none | NOT CAPTURED | — | — | — | MISSING evidence | — | — | 7N-B5 |
| Caption | Overlay location on image | — | post-image | Keep | Working | Unmeasured | iOS | KEEP | Caption | — | 7N-B4 |
| PostMetadata | Counts on rail | — | post-image | Keep with rail rethink | Working | Unmeasured | iOS | REFINE | Metadata | — | 7N-B4 |

## Auth

| Component | CURRENT IMPLEMENTATION | CURRENT LOCATION | SCREENSHOTS | CURRENT PROBLEMS | FUNCTIONAL STATE | ACCESSIBILITY STATE | PLATFORM STATE | DESIGN CLASSIFICATION | TARGET REFERENCE | DEPENDENCIES | NEXT PHASE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WelcomeHero | Orbit diagram + Get started / Sign in / guest | WelcomeScreen | welcome | Keep as landing, distinct from `/onboarding` | Working | Unmeasured | iOS | KEEP | Welcome | — | 7N-B7 |
| AuthHeader | “Modula” + “Sign in” / “Create Modula Account” | AuthShell | login, register | Large leftover canvas under links | Working | Unmeasured | iOS | REWORK | Tighter auth stack | Spacing tokens | 7N-B1 / 7N-B7 |
| TextField | Grey rounded Email / Display name | AuthField | login, register | Placeholder repeats label | Working | Unmeasured | iOS | REFINE | Native field | — | 7N-B1 |
| SecureField | Password step | CreateAccountScreen / SignInScreen | none | NOT CAPTURED | Working in source | Unmeasured | — | MISSING evidence | SecureField | — | 7N-B7 |
| OTPField | emailCode step | ModulaOTPField | none | NOT CAPTURED | Working in source | Unmeasured | — | MISSING evidence | OTP | — | 7N-B7 |
| PrimaryButton | Full-width teal Continue | AppButton / Auth | login, register, onboarding | Same shape everywhere; black label on teal | Working | Unmeasured | iOS | REFINE | Button contract | 7N-B1 | 7N-B1 |
| SecondaryButton | Welcome Sign in grey fill | WelcomeScreen | welcome | Keep | Working | Unmeasured | iOS | KEEP | Secondary | — | 7N-B7 |
| MethodChooser | Development demo + Create account links | SignInScreen | login | Demo is a text link, not a chooser | Working | Unmeasured | iOS | REFINE | Method chooser | — | 7N-B7 |
| ErrorMessage | Session revoked copy exists | SignInScreen | not in clean login still | Clean login has no error | Working | Unmeasured | iOS | KEEP | Error | — | 7N-B7 |
| Verification | `/verify-email` | Verify flow | verify-email | Captured route; not a success state | Working | Unmeasured | iOS | REFINE | Verify | — | 7N-B7 |
| RegistrationStep | invite/email/password/handle/terms | CreateAccountScreen | register identity only | Later steps uncaptured | Working in source | Unmeasured | iOS | REWORK | Multi-step register | — | 7N-B7 |

## Shell

| Component | CURRENT IMPLEMENTATION | CURRENT LOCATION | SCREENSHOTS | CURRENT PROBLEMS | FUNCTIONAL STATE | ACCESSIBILITY STATE | PLATFORM STATE | DESIGN CLASSIFICATION | TARGET REFERENCE | DEPENDENCIES | NEXT PHASE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BottomNav | Floating pill Home Discover Activity Profile | tab layout | home, profile, discover | Clips Profile About last rows | Working | Unmeasured | iOS | REWORK inset | Shell inset contract | useFloatingTabBarContentPadding | 7N-B1 / 7N-B8 |
| TopChrome | Hamburger + Modula + +/messages pill | Home | home | Keep | Working | Unmeasured | iOS | KEEP | Home chrome | — | 7N-B8 |
| BackButton | Circle chevron | module, settings, profile | several | Keep | Working | Unmeasured | iOS | KEEP | Back | — | 7N-B1 |
| MoreButton | Horizontal ellipsis | post, profile, module | several | Keep | Working | Unmeasured | iOS | KEEP | More | Menus | 7N-B1 |
| ShareButton | Square+arrow | post, module, profile | several | Keep | Working | Unmeasured | iOS | KEEP | Share | — | 7N-B1 |
| Drawer | Hamburger present | Home | home | NOT OPENED | — | — | — | MISSING evidence | Drawer | — | 7N-B8 |
| Sheet | Install review + auth gate modal | InstallPreviewSheet, sign-in gate | install, gated pass-1 | Auth gate “Sign in to edit your profile” is a centred modal on navy scrim | Working | Unmeasured | iOS | REWORK toward one Sheet | Canonical Sheet | — | 7N-B1 |
| Popover | — | — | none | NOT CAPTURED | — | — | — | MISSING evidence | Popover | — | 7N-B1 |
| SearchMorph | Hub search idle; Discover search pill | Hub + Discover | hub, discover | Discover tabs truncate “Marketpla”; search placeholder truncates | Working | Unmeasured | iOS | REWORK truncation | Search | — | 7N-B1 / 7N-B8 |
| FAB/Create | Home + in header pill; composer route | compose | composer | Captured | Working | Unmeasured | iOS | REFINE | Create | — | 7N-B8 |

## Root problems (shared, not seven separate redesigns)

1. **Spacing / leftover canvas** — Auth first steps and some settings leave a large empty lower viewport; same teal full-width button.
2. **Typography roles** — Display titles on Hub/Auth vs overlay white type on posts are different systems; product metadata uses caption `—` cells.
3. **Sheet/Alert contract** — Install failure uses `Alert.alert`, auth gate uses a custom modal; neither is the canonical Sheet.
4. **Button contract** — Hub teal Install vs Module navy Install vs Auth teal Continue vs Gaia light-blue Following.
5. **Surface/grouping** — Module Detail wraps metadata and capabilities as many rounded cards; founder rail is one divided strip.
6. **Shell inset** — Floating tab bar overlaps Profile About.
7. **Action rail duplication** — Home, dedicated Post, and Profile posts share the overlay-circle rail.

## Media / icons

Inspected Core-7 light stills: no tofu glyphs. Cover, Bali image, Vault Notes artwork render. Owner avatar is a seed letter, not a broken URL.
