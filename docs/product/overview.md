# Modula — Product Overview

> In-repo source of truth for product intent. Engineering phases (Phase 6S, Greenfield, etc.) live under `docs/validation/` and `docs/architecture/`.

## Motto

**Your digital world, built around you.**
**Simplifying Digital.**

> One identity. One environment. Your modules. Your rules.

## What Modula is

Modula is a **modular social operating system**: a social network with installable modules, not a thin client for someone else’s network.

It brings identity, communication, productivity, content, services, and digital tools into **one configurable application shell**. Users decide what their environment contains, how it looks, and how it behaves.

Central idea:

> The user’s profile becomes their platform.

A Modula installation can grow to include social feeds and conversations, customisable profiles, independent modules (CRM, agents, automations, notes, tasks, …), widgets and boards, privacy controls, themes/surfaces, and later AI-assisted tools — through **shared contracts**, shared identity, shared permissions, shared design tokens, and shared navigation.

## What Modula is not

- Not a Bluesky-branded client or permanent AT Protocol UI shell
- Not “another social network” with bolted-on settings
- Not a monolith that hardcodes every tool as core feature code
- Not dependent on Gaia, a marketplace, or DIMON to be useful on day one
- Not a family-tree / pastel lifestyle clone (inspiration may inform craft only)

## Current technical reality (2026)

| Topic | Status |
| --- | --- |
| App stack | Expo SDK 57 / React Native / TypeScript (greenfield Modula host) |
| Social backend | **Greenfield** (`api.modula.digital`) — Modula-owned accounts, posts, social graph |
| AT Protocol | Optional / inactive for the core product path — not the identity or feed authority |
| Bluesky upstream | Historical engineering scaffold only — not product branding, analytics, or architecture destination |
| Modules | First-party catalogue + lifecycle in Greenfield; production modules intended as **external packages / GitHub repos** resolved by registry |
| Module builder | Planned — in-Modula builder (Lovable / Bolt–class) for creating modules; not yet the current phase |
| Production readiness | Active development — not production-ready |

## Core concepts

| Concept | Role |
| --- | --- |
| Social foundation | Modula posts, feeds, reactions, comments, profiles — Greenfield-first |
| Profile-as-platform | Owner OS vs visitor public profile — same identity |
| Board | Configurable home environment driven by registered capabilities |
| Modules | Independent tools (Vault Notes, Tasks, CRM, Agents, Automations, …) hosted outside the main app when possible |
| Extension Centre | Install / enable / configure host extensions, tools, plugins, connections |
| Composer tools | Registry-driven creation tools, not a fixed icon strip |
| Appearance | Colour mode × theme family × accent × Surface Type (materials must change hierarchy) |
| Marketplace / builder | Later: discover modules; eventually **build** modules inside Modula |
| Gaia / DIMON | Future intelligence / optional decentralised layer — inactive until intentional |

## Content presentation principle

**Media glows. Text breathes. Links contain.**

## Near-term product priorities

1. Stable universal application shell
2. Modula social foundation (Greenfield) — Phase 6S track
3. External module standard and runtime (Phase 7+)
4. First official modules (external packages)
5. Marketplace + developer ecosystem
6. In-Modula module builder
7. Deeper automation and Gaia (permission-aware)

## Related

- `docs/product/modula-product-direction.md` — full offering catalogue (Shell → Forge → DIMON)
- `docs/design/modula-ui-enhancement-opportunities.md` — UI vibe / opportunity map
- `docs/product/theme-architecture-v5.md`
- `docs/architecture/module-boundary.md`
- `docs/architecture/startup-contract.md`
- `docs/architecture/bluesky-inspiration-policy.md` — study patterns only; no fork/copy of Bluesky product UI
