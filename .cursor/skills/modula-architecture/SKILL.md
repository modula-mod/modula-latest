---
name: modula-architecture
description: >-
  Modula host vs modules architecture, startup contract, protocol-independent
  social UI, and no-Bluesky-fork rules. Use when changing shell structure,
  providers, social contracts, module boundaries, startup, or when tempted to
  copy from Bluesky / the old Modula fork.
---

# Modula Architecture

## When to use

- Adding routes, providers, or shell chrome
- Touching `src/social`, `src/modules`, `src/shell`, `src/app`
- Evaluating code from `/home/andrei/modula` or `/tmp/bluesky-social-app`
- Designing module host / registry behaviour

## Hard rules

1. **Host owns startup and shell.** Modules must not gate first frame.
2. **Social UI is protocol-independent.** Depend on `SocialProvider` contracts only — never AT Proto types in UI.
3. **No Bluesky fork.** Study patterns; reimplement on Modula primitives. Forbidden: copying shell, provider tree, ALF, gesture architecture, `@bsky.app/*`.
4. **Startup contract** (`docs/architecture/startup-contract.md`): no network required for first frame; optional features stay optional.
5. **Module boundary** (`docs/architecture/module-boundary.md`): manifests, permissions, error boundaries — host stays launchable with zero modules.
6. **Routes stay thin** under `src/app/`; logic lives in `features/`, `components/`, `social/`.

## Checklist

- [ ] First frame works offline (mock/local data OK)
- [ ] No new global provider without architectural approval
- [ ] No AT Proto / Bluesky packages in UI imports
- [ ] Module failures cannot crash the host
- [ ] Documented in `docs/architecture/` if structure changes

## Pointers

- `docs/product/overview.md`
- `docs/architecture/startup-contract.md`
- `docs/architecture/module-boundary.md`
- `docs/architecture/bluesky-inspiration-policy.md`
- `docs/architecture/screen-map.md`

## Screen parity

- Deliver navigable Bluesky IA (especially Settings → Account) via **reimplementation**.
- Stub auth-backed actions; do not omit screens from navigation.
- Modula-first: Board, Modules, Marketplace stubs stay in the tree.
- Keep `docs/architecture/screen-map.md` and `component-parity.md` current.
