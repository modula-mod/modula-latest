# Modula — UI enhancement opportunities

**Date:** 2026-07-18  
**Status:** Exploration only — not a build plan, not Phase 6S merge criteria  
**Context:** Phase 6S social product baseline is largely complete in-repo + VPS; physical iPhone / TestFlight still open. This document captures *what else we could do* for presence, motion, and screen craft.

---

## Do you want me to tell you what Modula is?

**Yes — please do.**

In-repo we already have a strong brief (`docs/product/overview.md`):

> **Simplifying Digital.** One identity. One environment. Infinite configurations.  
> A modular **Social Operating System** — the user’s profile becomes their platform.

That is enough to *reject* a literal “family tree app” clone. It is **not** enough to vibe the emotional register (warm / precise / playful / editorial / spatial / quiet luxury / builder-tool, etc.).

If you tell me, in your words:

1. who Modula is for  
2. how it should *feel* in the first 10 seconds  
3. what must never look like “another social network”  
4. which surfaces matter most next (Board, Profile-as-platform, Composer, Extension Centre, onboarding, …)

…then the opportunities below can be ranked into a real visual direction instead of generic polish.

---

## Inspiration attached (what to steal vs leave)

Two references were shared:

1. **Onboarding carousel** — soft gradient stage, large rounded media cards, glass chrome, black primary CTA, Skip secondary, progress dots, floating message overlays.  
2. **Stories / presence arc** — horizontal avatar carousel with centre magnification, partial gradient rings for unviewed state, pill “Add Story” + black + control.

### Steal (Modula-compatible)

| Pattern | Why it fits Modula |
| --- | --- |
| Soft atmospheric stage (gradient / depth) behind first-run | Brand atmosphere without flat single-colour chrome |
| One job per onboarding step | Matches “one composition / one job per section” |
| Large primary CTA + quiet Skip | Clear hierarchy |
| Floating, ephemeral overlays for “live” social proof | Presence without dashboard clutter |
| Centre-weighted avatar carousel | Strong motion + hierarchy for presence / Focus / modules / Inner Circle |
| Partial ring = unread / new | Non-colour-only state (pair with shape/label for a11y) |
| Glass used as *material*, not decoration | Aligns with Surface Type = Glass / Glay (when engines are real) |

### Leave (do not copy literally)

| Pattern | Why |
| --- | --- |
| Family-tree product copy and relationship pills (“Sister”) | Wrong product; Modula is Social OS / profile-as-platform |
| Pastel pink–purple “AI default” brand wash | Conflicts with Modula Teal `#369CAA` and appearance families |
| Hero as inset rounded media card on marketing surfaces | Prefer full-bleed / edge plane for promotional heroes |
| Permanent floating message stickers on feed | Hero/feed overlays become noise; use sparingly on onboarding only |
| Stories as Instagram-clone core loop | Only if product brief says ephemeral presence is first-class; otherwise map to Modula concepts (Focus, Board moments, module status) |

---

## Opportunity map (ranked loosely)

### A. First-run & identity (high leverage)

| Opportunity | Idea | Notes |
| --- | --- | --- |
| A1. Modula welcome sequence | 3-step composition: identity → profile-as-platform → extensions/modules | Not family copy; reuse CTA/Skip/dots craft |
| A2. Invite / verify as designed journey | Beautiful empty/waiting states for invite-only preview | Currently functional; can feel cold |
| A3. Session restore presence | Soft launch frame that does not flash default theme | Ties to appearance sync rules |

### B. Presence & motion (medium–high)

| Opportunity | Idea | Notes |
| --- | --- | --- |
| B1. Centre-magnified presence rail | Arc carousel for Focus / Inner Circle / active modules / stories-*like* moments | Map rings to Modula states, not IG stories |
| B2. Intentional motion set (2–3) | Feed enter, reaction confirm, tab selection | Reduce Motion must dampen |
| B3. Reaction bloom | Long-press reaction picker with scale + haptic | Phase 6S control exists; craft can rise |
| B4. Composer sheet choreography | Keyboard + quoted-post preview motion | Keep comment composer separate |

### C. Social craft (medium)

| Opportunity | Idea | Notes |
| --- | --- | --- |
| C1. Post media glow / text breathe | Enforce post presentation principle more visibly | Media-led posts vs text-led |
| C2. Quoted-post / unavailable states | More editorial “no longer available” treatment | Already contracted |
| C3. Activity timestamps | Human-relative time (Simulator showed raw ISO) | Quick win |
| C4. Thread connectors | Restrained lines, bounded indent (already specified) | Polish density on large text |
| C5. Notification filters | Finish visual language of chips without pill-cluster clutter | |

### D. Profile-as-platform (high product fit)

| Opportunity | Idea | Notes |
| --- | --- | --- |
| D1. Owner vs visitor compositions | Distinct first viewport for owner Board vs public profile | Core Modula idea |
| D2. Profile tabs as modules | Tabs feel installed, not generic social tabs | Phase 7 adjacent |
| D3. Focus status as presence | Richer Focus chip/surface without overlay stickers | |

### E. Extension Centre & Board (differentiator)

| Opportunity | Idea | Notes |
| --- | --- | --- |
| E1. Catalogue cards → shelves | Installed vs Available as spatial shelves, not dense lists | Still no raw JSON |
| E2. Plugin failure calm UI | “Modula still works” reassurance with motion restraint | Phase 6S requirement — craft can improve |
| E3. Board empty / first module | Onboarding-quality empty Board | |

### F. Appearance engines (foundation for all of the above)

| Opportunity | Idea | Notes |
| --- | --- | --- |
| F1. Real Glass / Glay / Minimal Spatial | Surface Type must change hierarchy, not only radius | Documented deferred in theme skill |
| F2. OLED true black audit | Feed, sheets, tab bar | |
| F3. Reduce Transparency overrides | Prove glass → solid fallbacks in screenshots | |

---

## Suggested “vibe passes” (once product brief is confirmed)

Pick **one** direction and run a short pass — do not mix all three.

1. **Spatial OS** — Minimal Spatial + restrained glass; Board and Profile dominate; social is calm.  
2. **Soft social craft** — Light/Dim + Glay; presence rail + reaction bloom; onboarding atmosphere.  
3. **Builder precision** — Solid/Native; denser information; Extension Centre and Composer feel like tools.

Modula Teal stays the accent anchor unless Appearance already allows user override.

---

## What not to do next

- Do not redesign the whole app while Phase 6S physical / TestFlight gates are open.  
- Do not copy family-app IA or pastel-purple brand defaults.  
- Do not add a second social-state implementation for prettier UI.  
- Do not ship Stories as a fake feature without Greenfield contracts.  
- Do not treat Simulator screenshots as physical acceptance.

---

## Owner brief (fill in)

Paste answers here (or reply in chat):

```text
Who is Modula for?

First 10 seconds should feel like:

Must never feel like:

Next surface to elevate (pick 1–2):
- [ ] Onboarding
- [ ] Home / presence rail
- [ ] Profile-as-platform
- [ ] Board
- [ ] Composer
- [ ] Activity
- [ ] Extension Centre
- [ ] Appearance showcase

Emotional keywords (3):

Reference products that are "close but wrong":
```

---

## Recommended sequence

1. You write the brief above (even rough).  
2. We pick one vibe pass + 3 concrete screens.  
3. Implement motion + craft on those screens only.  
4. Capture appearance matrix on Simulator, then physical when device is available.  
5. Keep Phase 6S merge gates separate from this enhancement track.

---

## Related

- `docs/product/overview.md`  
- `docs/design/social-ui-inspiration.md`  
- `docs/design/modula-appearance-guidelines.md`  
- `docs/product/theme-architecture-v5.md`  
- `docs/architecture/bluesky-inspiration-policy.md`  
