# Modula module boilerplate

Copy this folder to start a new **external** Modula module package.

## Rules

1. Modules live outside the host app (`modula-latest`).
2. Declare everything in `modula.module.json` using Modula Module Standard 1.0.
3. Use host design tokens — do not ship a parallel design system.
4. Use namespaced storage only.
5. Fail closed behind error boundaries.
6. Never import private host internals.

## Checklist

- [ ] Unique `id`
- [ ] `standardVersion`, `moduleVersion`, `manifestSchemaVersion`, `dataSchemaVersion`
- [ ] Honest permissions list
- [ ] Host, runtime, standard, and platform compatibility ranges
- [ ] Lifecycle and uninstall policy chosen
- [ ] Records, views, actions, functions, events, diagnostics, health, release, and trust declared
- [ ] No fake balances / untrusted code execution
- [ ] README documents user-visible permissions

## Local preview in host

Until Registry install ships, the host shows marketplace / Forge **pre-screens** only.
Use Forge Builder (`/product/forge`) to draft a manifest aligned to this shape.

## Standards

See the independent standard repository at `/home/andrei/modula-mod/modula-module-standard`.
