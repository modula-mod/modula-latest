# Modula — UI enhancement opportunities

**Date:** 2026-07-18
**Status:** Exploration — ranked after owner brief; not Phase 6S merge criteria
**Product brief:** `docs/product/overview.md`

---

## Owner brief (filled)

```text
Who is Modula for?
People who want one configurable digital environment — social + tools —
instead of juggling disconnected apps. Builders and operators who will
install (and later create) modules: CRM, agents, automations, notes, etc.

Tagline:
Your digital world, built around you. / Simplifying Digital.

What it is:
A Social OS — a social network with modules (packages / GitHub),
running in one Modula shell on Greenfield. Not Bluesky. Not AT-first.

First 10 seconds should feel like:
Calm control. My place. Social is alive, but the product is bigger than a feed.
Identity and environment are mine to shape.

Must never feel like:
A Bluesky/AT client, a thin social clone, a family-tree lifestyle app,
pastel purple “AI default” SaaS, or a dashboard of random widgets.

Next surfaces to elevate (priority):
- [x] Onboarding / first-run (Modula identity → environment → modules)
- [x] Profile-as-platform + Board empty/first-module states
- [x] Extension Centre (modules feel installable / buildable)
- [ ] Home / presence rail (secondary — map to Focus/modules, not IG Stories)
- [ ] Composer tools drawer craft
- [ ] Activity polish (timestamps, filters)

Emotional keywords (3):
Configurable · Coherent · Capable

Reference products that are "close but wrong":
- Bluesky / generic AT clients (protocol-shaped social)
- Instagram Stories-first apps (ephemeral social as the core)
- Family tree / pastel onboarding kits (wrong domain)
- Lovable / Bolt (right energy for *future* Module Builder — not the social shell itself)
```

**Ignore for product vibe:** Bluesky branding, AT Protocol as the product, permanent upstream overlay architecture. Historical scaffold only.

---

## Chosen vibe direction

**Primary:** Spatial OS + soft craft
Board / Profile / first-run feel like a personal environment; social feed is calm and media-aware.

**Secondary (Extension Centre + future Builder):** Builder precision
Catalogue, install states, and (later) module creation should feel like a capable tool — clear hierarchy, honest status, no fake success.

Accent remains **Modula Teal** (`#369CAA`) unless the user overrides via Appearance.

---

## Inspiration attached — remap to Modula

| Reference pattern | Modula translation |
| --- | --- |
| Soft gradient onboarding stage | Welcome: identity → “your environment” → modules/extensions |
| Large CTA + Skip + dots | Keep; copy must be Modula (not family) |
| Floating message overlays | Only on first-run “live” proof — not permanent feed stickers |
| Centre-magnified avatar arc | **Presence / Focus / active modules / Inner Circle** rail — not Instagram Stories core loop |
| Partial gradient rings | Unread module activity, Focus change, or unviewed presence — always with non-colour cue |
| Glass chrome | Surface Type Glass/Glay when materials are real; Reduce Transparency fallbacks |

Do **not** copy pink–purple brand wash or family-tree IA.

---

## Ranked opportunities (what else we could do)

### P0 — Product-defining craft (do next when ready)

| ID | Opportunity | Why now |
| --- | --- | --- |
| P0.1 | Modula first-run (3 steps) | Sets Social OS expectation before the feed |
| P0.2 | Profile owner vs visitor first viewport | “Profile becomes platform” must be visible |
| P0.3 | Board empty → first module | Modules are the differentiator; empty Board is the pitch |
| P0.4 | Extension Centre shelves + calm failure | GitHub/registry modules must feel trustworthy |

### P1 — Social craft (baseline is done; elevate)

| ID | Opportunity | Why |
| --- | --- | --- |
| P1.1 | Activity human timestamps | Quick win (Simulator showed ISO strings) |
| P1.2 | Reaction bloom + haptics polish | Phase 6S control exists |
| P1.3 | Media glows / text breathes on shared post renderer | One renderer — raise the craft once |
| P1.4 | Intentional motion set (feed enter, tab select, reaction) | 2–3 motions, Reduce Motion safe |
| P1.5 | Presence rail (modules/Focus) | Steal arc carousel energy without Stories product |

### P2 — Builder foreshadow (before Lovable-class builder ships)

| ID | Opportunity | Why |
| --- | --- | --- |
| P2.1 | “Create module” / Developer section honesty | Preview CTA that does not fake a builder |
| P2.2 | Manifest → human permissions UI | Users understand what a GitHub module may do |
| P2.3 | Install from registry states | Installing → enabled → needs configuration |

### P3 — Appearance engines

| ID | Opportunity | Why |
| --- | --- | --- |
| P3.1 | Real Glass / Glay / Minimal Spatial hierarchy | Surface Type must change more than radius |
| P3.2 | OLED + Reduce Transparency matrix | Required for credible native feel |

---

## First implementation slice (started 2026-07-18)

Shipped on `phase6s-social-product-completion`:

1. **Welcome + `/onboarding`** — atmospheric stage, 3-step Social → Profile-OS → Modules, PresenceArc
2. **Module pre-screens** — `ModulePreScreenHero` on marketplace module detail + Forge catalogue entry
3. **Profile-OS pre-screen** — `/profile/os` with Focus Halo arc + CTAs
4. **Board craft** — Focus copy, empty pinned/modules invitation, link to Profile-OS
5. **Activity timestamps** — ISO → relative via `formatRelativeTime`

Still open: reaction bloom polish, real Surface Type engines, Forge builder itself, full offering screens.

Keep Phase 6S physical / TestFlight gates on a separate track.

---

## What not to do

- Do not reintroduce Bluesky/AT as the product identity.
- Do not redesign everything while finishing device acceptance.
- Do not ship fake Stories or a fake Lovable builder.
- Do not hardcode modules into the host as permanent feature code.
- Do not use pastel purple defaults or family-app IA.

---

## Related

- `docs/product/overview.md`
- `docs/design/social-ui-inspiration.md`
- `docs/design/modula-appearance-guidelines.md`
- `docs/product/theme-architecture-v5.md`
- `docs/architecture/module-boundary.md`
