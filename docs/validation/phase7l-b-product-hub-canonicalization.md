# Phase 7L-B Product Hub Canonicalization Evidence

Date: 2026-08-13
Repo: `/root/modula-latest`
Branch: `main`
Status: `FIXED_SOURCE`

## Scope

This source repair covers Product Hub duplicate/stale module identity handling and coherent installability copy.

It does not close live Product Hub acceptance. A disposable DB registry route run and authenticated public browser proof are still required before moving these items to `PASS_LOCAL` or `PASS_LIVE`.

## Source Contract

Canonical Vault Notes module ID remains:

```text
digital.modula.vault-notes
```

Normal beta Product Hub registry output now classifies module records before exposing them:

- `CANONICAL_PRODUCT`: visible beta product, one card per module ID.
- `COMING_SOON`: visible future product, not a red technical failure.
- `QUARANTINED`: visible only for non-fixture products that require security review.
- `DUPLICATE`: hidden legacy identity with canonical replacement.
- `INTERNAL_ONLY`: hidden internal capability namespace.
- `TEST_ONLY`: hidden generated/test fixture.

The source policy explicitly handles:

- `modula.module.vaultNotes` -> duplicate of `digital.modula.vault-notes`.
- `modula.module.tasks` -> duplicate of `digital.modula.tasks`.
- `modula.module.dimon` -> duplicate of `digital.dimon.core`.
- `digital.dimon.core` -> internal-only.
- `digital.modula.search-*` -> generated test fixture.

## Source Changes

- `services/greenfield-api/src/modules/beta-catalogue-policy.ts`
  - deterministic beta classification and installability projection.
- `services/greenfield-api/src/modules/registry-service.ts`
  - applies classification to registry list/detail/version paths.
  - emits `betaClassification` and `installability` on visible registry summaries/details.
- `packages/greenfield-module-registry-contracts/src/registry.ts`
  - adds typed classification/projection fields to registry summaries.
- `src/data/repositories/contracts/ModuleRepository.ts`
  - adds frontend Product Hub classification/projection types.
- `src/data/repositories/api/ApiModuleRepository.ts`
  - decodes backend installability instead of deriving every state from raw release status.
- `src/features/modules/components/ModuleCatalogueCard.tsx`
  - deduplicates contradictory status pills.
- `src/features/modules/components/ModuleStatusPill.tsx`
  - maps unavailable/quarantined/incompatible states to user-facing copy.

## Verification

Command:

```sh
pnpm --filter @modula/greenfield-api exec vitest run tests/phase7l.product-hub-policy.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       5 passed (5)
```

Command:

```sh
pnpm typecheck
```

Result: PASS.

Command:

```sh
pnpm lint
```

Result: PASS.

Command:

```sh
git diff --check
```

Result: no whitespace errors.

## Remaining Boundaries

- The Product Hub registry route still needs disposable DB acceptance with production-like records.
- The public authenticated Product Hub still needs browser proof after deployment.
- Vault Notes install/enable/open and CRUD lifecycle remain separate open defects.
- Generated module search/index acceptance remains pending for the full beta verifier, although existing search projector tests already hide quarantined module documents from normal search.
