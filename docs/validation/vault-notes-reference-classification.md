# Vault Notes reference classification

Part 22 inventory. Open path is the generic Module Host:

`/module/digital.modula.vault-notes`

There is no Vault Notes feature screen, renderer, CRUD controller, or dedicated router in the host.

## Allowed

| Location | Kind |
| --- | --- |
| `packages/greenfield-contracts/src/canonical-module-identity.ts` | Canonical ID + aliases |
| `services/greenfield-api/src/modules/canonical-manifest.ts` | Import overlay |
| `services/greenfield-api/src/modules/identity-migration-service.ts` | Data/install migration |
| `services/greenfield-api/src/modules/beta-catalogue-policy.ts` | Legacy product hidden |
| `services/greenfield-worker/src/search/vault-notes-projector.ts` | Search projector for the module family |
| `docs/architecture/vault-notes-*.md` | Decision / lineage |
| Tests, fixtures, verifiers, dump script | Proof |
| `src/features/feed/postActions/runPostAction.ts` `saveToVault` | Known module ID constant → generic `/module/...` |
| `src/components/composer/ComposerToolsDrawer.tsx` | Known module ID constant → generic host |
| `src/features/board/screens/BoardScreen.tsx` widget `vault-notes` | Board widget id → marketplace/host routes |
| Demo/profile featured IDs `module-vault-notes` | Legacy alias resolved before Product Hub |

## Forbidden (verified absent)

- `src/features/vault-notes/`
- `src/app/vault-notes.tsx`
- `VaultNotesScreen`
- Module Host / view renderer / route resolver special-cases

## Legacy marketplace paths repaired in 7M-B2

- `ProfileModuleCard` → `/marketplace/digital.modula.vault-notes`
- `ActivityScreen` moduleUpdate → canonical marketplace id
- `FeedPostItem` marketplace helper → canonical id
