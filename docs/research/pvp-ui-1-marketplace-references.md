# PVP-UI-1 marketplace reference study

Structure only. Not a licence to copy Apple or Google pixels, ratings, or commerce copy.

## Apple App Store

| | |
| --- | --- |
| WHAT IT DOES WELL | Large-title hierarchy; editorial Featured story; horizontal shelves vs compact rows; Get/Open/Update as a small capsule; artwork as the product; search that morphs into the field; sticky compacting chrome; almost no technical metadata in the first viewport. |
| WHAT MODULA SHOULD LEARN | Featured is a story, not a card gallery. Rows are dense and grouped by hairlines. Status is one verb. Search is a signature interaction. |
| WHAT MODULA MUST NOT COPY | Exact layout, Today-tab editorial cards, star ratings, charts, prices, “Get” blue, Apple glyph language, pixel-identical radii, or fake review chrome. |

## Apple Music

| | |
| --- | --- |
| WHAT IT DOES WELL | Artwork-forward shelves; listen-now hero; compact now-playing chrome; search that feels native. |
| WHAT MODULA SHOULD LEARN | Horizontal shelves are discovery, not a grid of identical tiles. Media can dominate without boxing every row. |
| WHAT MODULA MUST NOT COPY | Mini-player as Product Hub content; album-grid density for modules. |

## Apple Podcasts / media storefronts

| | |
| --- | --- |
| WHAT IT DOES WELL | Show artwork + short publisher line + one action. Collections as editorial groups. |
| WHAT MODULA SHOULD LEARN | Publisher sits quietly under the product name. Coming Soon can be muted without looking broken. |
| WHAT MODULA MUST NOT COPY | Episode counts, charts, or “Editor’s Choice” badges invented for fullness. |

## iOS Settings search / header

| | |
| --- | --- |
| WHAT IT DOES WELL | Large title collapses; search sits in the header and becomes the field; cancel is explicit; keyboard is first-class. |
| WHAT MODULA SHOULD LEARN | Compact header = title + search trigger + avatar. Do not keep a large title and a compact title at once. |
| WHAT MODULA MUST NOT COPY | Settings grouped-list chrome as the Product Hub body. |

## Google Play / Material marketplace (Android)

| | |
| --- | --- |
| WHAT IT DOES WELL | Same IA (featured, categories, installed) with Material 3 type, motion, and dynamic colour; install chips; no iOS large-title clone. |
| WHAT MODULA SHOULD LEARN | Keep the information hierarchy. Use Modula’s Android adapters (Compose/Material segmented, ripple only where Material is the language). |
| WHAT MODULA MUST NOT COPY | Play Store cards, review stars, or wallpaper-driven Material You overriding Modula Appearance. |

## Borrowed principles vs Modula implementation

| Borrowed principle | Modula implementation |
| --- | --- |
| Editorial Featured hierarchy | Vault Notes privacy-led visual story (`Private by design`) |
| Compact Get/Open/Update | `ModuleAction` capsule: Install / Open / Update / Coming Soon / Unavailable |
| Horizontal discovery shelf | Made by Modula — artwork, name, short line; not a boxed grid |
| Dense rows + hairlines | New for Modula / Your modules — no per-row card |
| Search as a morphing control | `ProductHubSearch` contract; native `Stack.SearchBar` evaluated then adapted |
| Sticky compacting chrome | `ProductHubHeader` large → compact; native stack search deferred because it forces the system header visible |
