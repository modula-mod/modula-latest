# Product Hub — founder reference breakdown

**Phase:** 7M-B9  
**Authority:** Founder-supplied mockups, locked  
**Scope:** Vault Notes product detail and the Product Hub component language derived from it  
**Implementation status:** REFERENCE GATE; no B9 Product Hub JSX changed before this document existed

## Locked references

| ID | File | Dimensions | SHA-256 | Use |
| --- | --- | --- | --- | --- |
| `FM-PH-VN-001` | `docs/validation/evidence/phase7m-b9/founder-references/FM-PH-VN-001.jpg` | 592 × 1280 | `1a81055f5dc1500c91ce295d52221be140395c7b51bbe4e9a6f9728c33a25812` | Inset editorial cover; explicit cover/edit relationship; full lower information section. |
| `FM-PH-VN-002` | `docs/validation/evidence/phase7m-b9/founder-references/FM-PH-VN-002.jpg` | 592 × 1280 | `656b478846673492c95d0ba64eaef762c73cc77dd6f0fb6d1a4e99796cbd6d73` | Full-bleed hero variant; strongest identity overlap and primary page rhythm. |

These replace the lower-resolution B8 copies as the B9 comparison sources. They are visual specifications, not product-data specifications.

## Product jobs and hierarchy

The page must let a customer answer, in this order:

1. What is this product?
2. Who publishes it and why should I trust it?
3. Can I install, update, enable, or open it now?
4. What can it use?
5. What changed?
6. What does the real module look like?
7. Which platforms and product guarantees are actually supported?
8. Where can I inspect technical, privacy, source, and lifecycle detail?

Primary hierarchy: artwork + name + current action.  
Secondary hierarchy: truthful metadata, tabs, capability summary, What's New, and previews.  
Tertiary hierarchy: long description, source/trust disclosures, manifest detail, checksums, and compatibility diagnostics.

## Zone-by-zone visual contract

Percentages describe relationships to the phone viewport or the bounded desktop content column. They are not hard-coded device pixels.

| Zone | Reference geometry and hierarchy | Material / behaviour | B9 semantic component decision |
| --- | --- | --- | --- |
| 01 Safe Area | Status-safe top region; reference chrome begins about 4–6% below the top edge. Content ends clear of the home indicator/tab chrome. | Canvas owns the safe area; floating controls remain readable in all appearance modes. | Existing safe-area hooks + page composition; `ADAPT`. |
| 02 Cover | `FM-PH-VN-001`: inset about 92% viewport width, about 14% viewport height, 3.5–4% side insets. `FM-PH-VN-002`: full-width upper scene about 19–21% viewport height. Warm desk image establishes identity before copy. | Editorial media, continuous corners only when inset. Responsive crop; no panoramic desktop stretch. | `ProductCover`; new canonical component under existing Product Hub tree, `CUSTOM` composition over `expo-image`. |
| 03 Floating Navigation Controls | Back at upper-left; Share + More paired upper-right. Circular family about 44–48 pt with even inset and strong icon contrast. No opaque full-width navbar. | Small floating chrome. Native/glass where proven; material-adapter fallback; labels “Back”, “Share Vault Notes”, “More actions”. | `ProductTopChrome`; `ADAPT` existing `ModulaBackButton`, chrome groups, icon registry. |
| 04 Module Artwork | About 22–26% viewport width. Left aligned to content grid. Overlaps cover-to-content transition by roughly one-third to one-half of its height in the strongest reference. Continuous square with paper texture and folded corner. | Artwork is a product object, not OS accent. Hero/row/compact/fallback modes. | Extend canonical `ModuleArtwork`; `REFACTOR`, not a second artwork system. |
| 05 Privacy Badge | Small warm-neutral label above the title: lock icon + `PRIVATE BY DESIGN`. Height about one line of micro text. | Quiet supporting identity; must not compete with title. | `ProductBadge`; compose with semantic icon and real privacy policy. |
| 06 Product Title | `Vault Notes` is the dominant text object beside artwork. Starts near the artwork's upper third and uses tight leading. | Display type; wraps rather than clips at large text. | `ProductIdentity`; `CUSTOM` composition using `AppText`. |
| 07 Subtitle | One short consumer sentence directly below title with a tight 4–8 pt relationship. | Secondary text, not registry description. | `ProductIdentity`; truthful copy: “Private notes and knowledge.” |
| 08 Publisher | Publisher/source line sits immediately below subtitle; visually quieter, with verification semantics. | `Modula` and verified/first-party truth only. Raw publisher IDs stay in disclosure. | `ProductIdentity`; existing copy and trust data. |
| 09 Primary CTA | Directly below publisher and aligned to the title column. In the reference it is compact, high contrast, and visually stronger than secondary actions; not full width. | Exactly one dominant visible CTA: Install / Installing… / Open / Update / Updating… / Enable. | `ProductActionGroup`; consolidate current `ModuleAction` and state projection. |
| 10 Secondary Actions | Two scarce circular actions alongside the primary action in the mockup. B9 renders only actions that exist. Share belongs to top chrome; management menu is valid where actions exist. | No decorative Save/Notifications placeholders. | `ProductActionGroup`; optional real actions only. |
| 11 Metadata Strip | Inset about 92% width. Dense horizontal strip with 3–5 equal cells, 1 px vertical dividers, strong value above a tiny caption. Reference height about 6–7% viewport. | One grouped strip, not cards. Scrolls horizontally only when required by large text/narrow width. | `ProductMetadataStrip`; replace generic three-cell stats use for product detail. |
| 12 Section Tabs | Full-width quiet rail immediately under metadata. Compact labels, selected soft capsule, thin accent indicator. About 3.5–4% viewport height. | Tabs change real content; web keyboard semantics; state restoration where routed. | `ProductTabs`; extend existing semantic tab/control owners; no giant pills. |
| 13 Capability Strip | One inset grouped strip with 3–4 compact items and fine dividers. Icon + label + strong value + short explanation. | Only backed capabilities. No positive offline/sync claim without operational evidence. | `ProductCapabilityStrip`; data projection from registry/runtime support. |
| 14 What's New | Typographic section, not a card. Heading left, optional real Version History action right, version/date line, then concise release notes. | Uses release data. No fabricated date or “1 week ago”. | `ProductWhatsNew`; source from `ModuleDetail` release data only. |
| 15 Version History Link | Trailing link aligned with What's New heading. | Render only if a real release history can open; otherwise omit. | Conditional action inside `ProductWhatsNew`. |
| 16 Preview Section | Strong `Preview` heading with optional viewer action. Appears in the middle of the editorial flow, directly after What's New. | Real app captures only. | `ProductPreviewCarousel`; replaces illustrative SVG mocks. |
| 17 Preview Cards | Portrait cards roughly 31–34% viewport width in a three-up glimpse; headline above the screenshot; screenshot occupies most of the card. | Horizontal paging/scroll; labels name real screen state. | `ProductPreviewCard` within carousel; `expo-image`; screenshot provenance required. |
| 18 Page Indicator | Small, quiet indicator centred below previews. Selected marker uses scarce accent. | Updates from actual page/scroll position. Reduce Motion removes flourish, not state. | Internal carousel indicator. |
| 19 Platform Strip | Thin row below previews with platform icons and truthful names; about one text line plus vertical padding. | Supported registry platforms only: iOS, Android, web. Do not claim iPad optimisation. | `ProductPlatformRow`. |
| 20 Product Description | Short consumer lead, left aligned and visually quiet. `FM-PH-VN-002` uses two compact lines. | Product language first; technical wording lives lower. | `ProductDescription`. |
| 21 Product Information Strip | One shared inset strip with four items in the reference. Strong semantic labels, short values, fine dividers/indicator. | Truthful mapping: Privacy, Source, Price, Developer. Not separate cards. | `ProductInformationStrip`. |
| 22 Information Disclosure | Final compact disclosure row after the information strip. | Opens privacy/source/developer/technical detail with focus-safe accessible behaviour. | `ProductInformationDisclosure`; compose over existing disclosure/menu/dialog owners. |

## Vertical rhythm map

The intended phone sequence is:

```text
safe area / cover / floating chrome
               ↓ overlap
artwork + badge + title + subtitle + publisher
               ↓ tight
primary action + scarce secondary actions
               ↓ 18–24
metadata strip
               ↓ 12–16
tabs
               ↓ 12–16
capability strip
               ↓ 20–28
What's New
               ↓ 18–24
preview heading + horizontal cards + indicator
               ↓ 12–18
platform row
               ↓ 16–24
consumer description
               ↓ 12–18
information strip
               ↓ 8–12
information disclosure
```

The reference gains hierarchy from overlap, typography, fine rules, grouped strips, and controlled white space. It does not use a rounded card around each section.

## Responsive geometry

### Phone

- One editorial column.
- 16–24 pt content insets, with cover either matching the content grid or deliberately full bleed.
- Artwork/title share a row while readable; at large text the identity may stack without changing information order.
- Metadata/capability/information strips scroll horizontally before text is clipped.
- Preview cards show about 2.4–3.0 cards across depending on width.

### Tablet / intermediate web

- Bounded column around 760–900 pt.
- Cover may widen while retaining approximately the phone hero-to-identity ratio.
- Preview rail may show more complete cards; the title/action hierarchy does not move into an unrelated sidebar.

### Desktop web

- Overall detail remains a bounded editorial product page, not a tiny phone island and not a full-width banner.
- Hero/identity may use a controlled two-column relationship inside a roughly 960–1120 pt container.
- Preview and information sections may use the extra width; ordering stays identical.
- Pointer hover, visible focus, semantic headings, arrow navigation, Escape, and focus return are required.

## Truth projection for the reference's illustrative metadata

| Mockup example | B9 rule |
| --- | --- |
| `4.8`, stars, `1.2K RATINGS` | Omit; Modula has no real ratings source. |
| `13+ AGE` | Omit unless a real age policy exists. |
| `No. 7 CHART` | Omit; no chart/ranking source. |
| `18.6 MB` | Omit unless registry exposes verified package size. |
| `0.2.0 VERSION` | May render because this is the live installable registry version. It is not inferred from the mockup. |
| `Modula DEVELOPER` | Render from verified publisher/first-party registry truth. |
| `Works offline Yes` | Do not render positively; runtime diagnostics currently describe offline declarations as metadata only. |
| `Sync Optional / end-to-end encrypted` | Do not render; no operational proof. |
| `iPhone, iPad` | Render registry platform truth as iOS/Android/Web. Do not claim iPad optimisation. |

Candidate truthful top-strip values include `PRIVATE / Privacy`, `0.2.0 / Installable version`, `MODULA / Developer`, `VERIFIED / Source`, and `UNIVERSAL / Platform`, but final rendering must derive from the loaded `ModuleDetail` record rather than hard-coded Vault Notes data.

## Existing-component inventory before implementation

| Existing owner | Decision | B9 direction |
| --- | --- | --- |
| `ModuleArtwork` + `moduleArtworkPack` | `REFACTOR` | Add cover/hero/row/compact modes and first-party media resolution; keep fallback generic and Vault Notes product-specific only in marketplace metadata. |
| `ModuleAction` | `CONSOLIDATE` | Preserve install state projection; strengthen product-detail action group; never duplicate hero/sticky CTA visibility. |
| `ProductStatsRow` | `ADAPT` | Keep generic chrome owner where used elsewhere; add Product Hub metadata-strip semantics without changing unrelated screens. |
| `ModulePreview` | `REPLACE` | Illustrative SVG screens fail B9. Replace in Product Hub with real screenshot media and accessible viewer. |
| `InstallPreviewSheet` | `REFINE` | Existing fixed `ModulaSheet` footer is the right architecture; improve consumer permission grouping and maintain reachable CTA. |
| `ProductHubSearchChrome` + reducer | `REFINE` | Extend state machine to explicit empty/error/focus/close semantics and full web keyboard behaviour. |
| Product Hub presentation folder | `KEEP / REFINE` | Existing canonical home for EditorialHero/ModuleRow/ModuleShelf; do not create another UI system. |
| `ModuleDetailScreen` | `REWORK` | Compose canonical components 01–15 in founder-reference order after component owners exist. |
| `ProductHubMarketplaceScreen` | `REFINE` | Keep editorial shelves/search architecture; remove registry/debug hierarchy and strengthen flagship composition. |
| Generic `module-host.tsx` | `KEEP` | No Vault Notes product-rendering branch. |

## Component implementation order

Implementation and review remain component-by-component:

`ProductCover` → `ProductTopChrome` → `ModuleArtwork` → `ProductBadge` → `ProductIdentity` → `ProductActionGroup` → `ProductMetadataStrip` → `ProductTabs` → `ProductCapabilityStrip` → `ProductWhatsNew` → `ProductPreviewCarousel` → `ProductPlatformRow` → `ProductDescription` → `ProductInformationStrip` → `ProductStickyHeader` → full detail composition → install review/progress/open state → Product Hub landing/search/shelves.

Each major component receives UI Lab states, Surface/Appearance checks, accessibility semantics, and reference/before/after evidence before broad propagation.

## Acceptance line

Side by side with `FM-PH-VN-001` and `FM-PH-VN-002`, the implementation must be immediately recognisable by its cover-to-artwork overlap, title prominence, compact primary action, unified metadata/tabs/capability rhythm, real preview hierarchy, and lower information strip. A generic stack of rounded cards is a rejection.

**Do not merely make Product Hub “better.” Reconstruct it. The founder-provided Vault Notes mockups define the visual target. Build the target component by component using the existing Modula architecture and truthful product data. If the final Vault Notes detail page does not immediately resemble the supplied reference in hierarchy, proportions, artwork prominence, metadata treatment, tabs, previews, and product information, the mission is not visually complete.**

**Do not move to the next subsystem until Product Hub is founder-approved.**
