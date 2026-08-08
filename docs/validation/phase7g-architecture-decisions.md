# Phase 7G Architecture Decision Log

Date: 2026-08-08

## ADR-7G-001: Treat `origin/main` as product baseline, not local `main`

Observed problem: local `main` diverged from `origin/main` by one local-only commit and 17 remote commits.
Current implementation: branch `phase7g-mainline-product-audit` was created directly from `origin/main`.
Alternatives: force local `main` to remote; merge local-only commit; audit from diverged local main.
Recommended change: preserve local `main`, audit from `origin/main`, reconcile the local-only docs commit later.
Reason: avoids destructive history changes while honoring GitHub main as canonical.
Migration cost: low.
Risk: low.
Priority: P1.

## ADR-7G-002: Keep Module Standard external and pin immutable artifacts for production

Observed problem: root `package.json` consumes Standard packages through mutable `file:../modula-mod/modula-module-standard/packages/*`.
Current implementation: development works from local filesystem packages.
Alternatives: keep file links forever; publish packages; vendor packages.
Recommended change: keep development `file:` workflow but require checksum-pinned Standard 2 artifacts before production deployment.
Reason: production must not depend on a mutable branch or filesystem path.
Migration cost: medium.
Risk: medium if packaging drifts.
Priority: P1.

## ADR-7G-003: Keep one generic module host

Observed problem: module/product history has multiple generations of host/runtime code.
Current implementation: `/module/[moduleId]/[[...path]]` resolves to one generic module host surface.
Alternatives: add Vault-specific host; add Standard-2-specific host.
Recommended change: keep one generic host and improve state handling for disabled/missing/incompatible/quarantined modules.
Reason: preserves module boundary and avoids product-specific shortcuts.
Migration cost: low.
Risk: low.
Priority: P1.

## ADR-7G-004: Canonicalize segmented controls through `ModulaSegmentedPicker`

Observed problem: multiple custom pill/segmented selectors exist, and native adapter currently trips `react-hooks/rules-of-hooks`.
Current implementation: adapter wraps Expo UI community segmented control for default native mode, shared RN fallback for sticky/glass/scrollable.
Alternatives: migrate all selectors to Expo UI directly; keep all custom pills.
Recommended change: fix adapter and forbid feature-level direct Expo UI imports. Use shared fallback only where the adapter is intentionally unsupported.
Reason: one product contract with native semantics where safe.
Migration cost: low.
Risk: low.
Priority: P1.

## ADR-7G-005: Do not keep Reels as a major product route unless real engagement/video is wired

Observed problem: Reels exposes local like/save/ranking actions and live data is preview-like.
Current implementation: `/reels` route exists with `ModulaReelPlayer` fallback to gradients and local engagement.
Alternatives: wire real reels fully now; hide route; label as lab.
Recommended change: hide or demote Reels until real video playback, persisted engagement, comments, saves, pagination, and memory behavior are proven.
Reason: fake major routes undermine product trust.
Migration cost: low to hide, high to complete.
Risk: medium if navigation/product copy relies on Reels.
Priority: P1.

## ADR-7G-006: Hide preview composer tools before adding new composer architecture

Observed problem: Composer mixes real text/photo actions with Preview/local tools.
Current implementation: GIF, Module, Location/Circle, Thread, Content Warning, hardcoded Link, and canned Poll are visible.
Alternatives: build all tools now; leave previews visible; hide/gate unfinished tools.
Recommended change: hide or lab-gate unfinished tools and keep one canonical composer.
Reason: Phase 7G prohibits new major features until audit completion; no visible control should remain fake.
Migration cost: low for hiding; medium/high to implement later.
Risk: low.
Priority: P1.

## ADR-7G-007: Separate user product information from developer diagnostics in Product Hub

Observed problem: Product Hub/Marketplace expose technical module metadata and future modules to ordinary users.
Current implementation: module registry and product routes mix user and developer concepts.
Alternatives: keep all metadata visible; split diagnostics into developer settings/admin.
Recommended change: user-facing Product Hub shows installability, trust, permissions, health, and value; developer diagnostics live under Settings -> Developer/admin.
Reason: Product Hub must feel like a product surface, not a schema browser.
Migration cost: medium.
Risk: medium.
Priority: P1.

## ADR-7G-008: Treat live API drift as deployment blocker, not local code proof

Observed problem: current main has Stories API routes, but live `/v1/stories/rail` returns 404.
Current implementation: production web build points at `https://api.modula.digital`.
Alternatives: ignore live mismatch; deploy immediately; document blocker.
Recommended change: document blocker now. Deployment is out of initial audit scope; do not claim Stories usable live until API parity is restored.
Reason: product truth depends on deployed runtime, not source existence.
Migration cost: deployment planning.
Risk: high if ignored.
Priority: P1.
