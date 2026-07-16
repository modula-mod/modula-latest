# Modula — Product Overview

> Condensed vision for the greenfield Expo SDK 57 application. Full owner brief lives in conversation history; this document is the in-repo source of truth for product intent.

## Motto

**Simplifying Digital.**

> One identity. One environment. Infinite configurations.

Secondary statement: Modula does not force users into one application. It gives them the foundation to create their own.

## What Modula is

A modular **Social Operating System** that unifies social interaction, personal productivity, digital identity, communication, services, and third-party tools inside one user-controlled environment.

Central idea:

> The user’s profile becomes their platform.

Capabilities (social, modules, marketplace, widgets, Elements, teams, appearance, optional AI/wallet) operate through **shared contracts**, shared identity, shared permissions, shared design tokens, and shared navigation — not as disconnected apps.

## What Modula is not

- Not only a social network, productivity suite, launcher, marketplace, wallet, or AI assistant
- Not a Bluesky fork or AT Protocol UI shell
- Not a monolith that hardcodes every module
- Not dependent on Gaia, Neural Atlas, or DIMON wallet to be useful

## Core concepts

| Concept | Role |
|---|---|
| Profile-as-platform | Owner sees a private OS; visitors see a public profile — same identity |
| Modules | Installable capabilities (Vault Notes, Tasks, CRM, …) via host contracts |
| Board | Personal configurable OS surface (cards, layouts, shortcuts) |
| Social foundation | Protocol-independent feeds/posts via `SocialProvider` |
| Marketplace | Distribution for modules, widgets, themes, tools |
| Widgets / Elements | Lightweight surfaces and external integrations |
| Appearance | Independent dimensions: colour mode × family × accent × Surface Type |
| Teams / privacy | Collaborative spaces and presence — later phases |

## Intentionally deferred

- Gaia / AI agents as platform core
- Neural Atlas
- Wallet / DIMON
- Real AT Protocol / auth / marketplace backend
- Full module runtime and dynamic code loading
- Full Glass / Liquid Glass material engines

## Early navigation (Phase 1)

```text
Modula
├── Board
├── Feed
├── Explore
├── Notifications
├── Profile
├── Composer (stub)
└── Settings
```

## Build order

| Phase | Focus |
|---|---|
| 0 | Foundation (Expo SDK 57, tokens, startup contract) — **done** |
| 0.5 / 1 | Theme runtime stubs + navigable shell + mock social |
| 2 | Appearance engine (Surface Types, families) |
| 3 | Profile as platform |
| 4 | Social foundation (real providers) |
| 5 | Module standard |
| 6 | Core modules (Vault Notes, Tasks, CRM) |
| 7 | Marketplace |
| 8 | Advanced (automations, teams, wallet, Gaia, Neural Atlas) |

## Related docs

- `docs/product/theme-architecture-v5.md`
- `docs/architecture/screen-map.md`
- `docs/architecture/module-boundary.md`
- `docs/architecture/bluesky-inspiration-policy.md`
- `docs/architecture/startup-contract.md`
