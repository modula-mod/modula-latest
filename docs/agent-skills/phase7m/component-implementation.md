# Implement a Modula component

Given `COMPONENT_NAME`:

1. Search all current implementations/usages (`rg`, `src/platform/ui`, primitives, features).
2. Write an inventory before changing source (KEEP / REFACTOR / CONSOLIDATE / REPLACE / REMOVE).
3. Pick canonical location under **existing** trees (`src/platform/ui`, `src/components/primitives`, `src/theme`). Do not create `packages/ui` unless inventory proves no owner.
4. Write props/types before JSX.
5. Build the plain semantic state first.
6. Add platform adapter(s). Validate APIs against installed `@expo/ui` 57.0.10 (or whatever `package.json` now resolves).
7. Add Surface resolver usage (no per-screen blur).
8. Add motion tokens only from the motion system.
9. Add accessibility semantics.
10. Add loading / error / disabled / selected states.
11. Add `testID`.
12. Add UI Lab examples: normal, disabled, loading, error, long content, large text, Light, Dark, OLED, each Surface Type, Reduce Motion.
13. Add tests using existing Playwright / Vitest infrastructure. Do not add arbitrary CI packages just to create `verify:phase7m-ui`.
14. Capture screenshots under `docs/validation/evidence/phase7m/`.
15. Write provenance YAML (see `docs/design/modula-component-contracts.md`).
16. Migrate exactly one representative screen.
17. Compare before/after for functional regressions (save, session, API).
18. Only then migrate all usages.

## 7M-A exception

Stop after step 2. No production component work.
