# Phase 7M-B4 — typography roles

Do not style type independently per screen. Do not make everything giant. Social density requires a compact body.

These are **roles**. Implementation must map onto existing theme tokens in `src/theme` after founder selection — not a new type context.

| Role | Job | Approx iPhone size / weight (study) | Where |
| --- | --- | --- | --- |
| `display` | Product identity, rare | 28–34 / semibold–bold, tight tracking | Auth wordmark line, Vault Notes name, Product Hub featured title |
| `screenTitle` | Name of the place | 17–22 / semibold | Nav title or large title once, never duplicated |
| `sectionTitle` | Named group in a scroll | 13–15 / semibold, sometimes small-caps/uppercase tracking | “Featured”, “Made by Modula”, “Explore” |
| `headline` | Post author, product name in a row | 15 / semibold | Author row, hub list name |
| `body` | Post text, descriptions | 15 / regular, line-height ~1.35 | Feed, hub subtitle, auth supporting line |
| `bodyEmphasis` | One stressed sentence | 15 / medium | Auth voice line, empty-state explanation |
| `metadata` | Handle, time, publisher, “Free” | 12–13 / regular | Author secondary, hub publisher |
| `caption` | Legal, progress, errors | 12 / regular | Install progress, field errors |
| `control` | Buttons, tabs, search | 15–17 / medium | Continue, Get, tab labels |

## Rules

- One `screenTitle` per screen. 7M-B2 Product Hub printed “Product Hub” in the nav and again as a hero — forbidden.
- Feed uses `headline` + `body` + `metadata`. No display type in the stream.
- Errors use `caption` on the field, not a display paragraph of debug language.
- Dynamic Type: roles scale; layouts wrap; tab bars follow system large-content behaviour (WWDC26).
- Custom display faces are allowed only if they scale; otherwise SF.

## Colour of type

- Primary text: ink (appearance-aware).
- Secondary: metadata grey.
- Accent text: almost never. Links in-feed may use ink underline. Teal text is not a hierarchy.

Trace: Threads 15/13 compact scale; Airbnb 14 body in catalogues; WWDC26 Gentler Streak using SF with width/rounded variants; constitution density rule.
