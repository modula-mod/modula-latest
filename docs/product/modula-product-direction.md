# Modula — Complete product direction

**Status:** Defined direction. Not every item is production-ready.  
**One sentence:** Modula is a Social Operating System and Profile-OS where a person’s profile becomes a customizable digital environment containing social features, modules, tools, AI agents, widgets, integrations, identity, and ownership.

> Social is the foundation. The profile is the platform. Modules provide capabilities. Gaia provides intelligence. DIMON provides ownership. The Builder lets the ecosystem grow.

## Current engineering truth

| Layer | Position |
| --- | --- |
| Shell + Greenfield social | Active (Phase 6S track) |
| Module standard / Registry / Marketplace | Contracts + catalogue UI; runtime Phase 7+ |
| Forge (Module Builder) | Defined — not built |
| Gaia / Atlas | Defined — deferred |
| DIMON | Defined ownership/economy layer — **inactive** until shell, social, and module standard are reliable |
| Bluesky / AT Protocol | Not the product path; optional integration only if ever re-enabled |

## Offerings (catalogue)

1. **Shell** — navigation, search, notifications, account, themes, permissions  
2. **Board** — private operating dashboard / daily control centre  
3. **Social network** — posts, media, comments, reactions, feeds, graph, moderation, communities (later)  
4. **Profile-OS** — configurable public/private digital environment  
5. **Installable modules** — Vault Notes, Tasks, CRM, Calendar, Files, Wallet, Newsletter, Automations, Analytics, Communities, Media, Gaming, Mail, Commerce, …  
6. **Registry** — discovery, versions, signatures, channels  
7. **Marketplace** — modules, widgets, themes, templates, agents  
8. **Composer tools** — registry-driven `+` drawer  
9. **Gaia AI** — permission-aware agents (later)  
10. **Automations** — n8n-style workflows in Profile-OS (later)  
11. **Appearance engine** — modes, families, accents, Surface Types  
12. **Privacy & security** — permissions, Glass Privacy levels, sandboxing  
13. **Identity / SSO** — one Modula identity in the profile architecture  
14. **Teams** — shared profiles with roles  
15. **Focus Mode** + Focus Halo  
16. **Merge Feeds**  
17. **Messaging** (incl. protected / Vault chat)  
18. **Search & discovery** across permitted surfaces  
19. **External integrations** (Elements / connectors)  
20. **Widgets**  
21. **Feature control & version lock**  
22. **Developer ecosystem** (SDK, FXDigital, Fusion, Registry)  
23. **Creator economy**  
24. **Ownership & portability**  
25. **Cross-platform** iOS / Android / Web / PWA  
26. **Optional gamification / inventory**  
27. **Gaia Atlas / Neural Atlas** (late)

## Module pipeline

```text
Forge (Builder) → Module SDK → FXDigital → Fusion → Registry → Marketplace
```

Modules are **GitHub-backed packages**, not hardcoded host features. Execution must be permission-aware / sandboxed (not raw untrusted JS).

## DIMON

Ownership, identity, and economic layer (wallet, purchases, rewards, verified ownership). Not speculative crypto theatre. **Upcoming** — after shell, social, and module standard.

## UI craft track (started)

See `docs/design/modula-ui-enhancement-opportunities.md` and first implementation:

- First-run onboarding  
- Module pre-screens  
- Profile-OS pre-screen  
- Board empty / module invitation craft  
