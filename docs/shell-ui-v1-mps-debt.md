# Shell UI V1 — MPS convergence debt

This mission must not wire the shell against MPS `0.1-DRAFT`. Presentation stays generic so MPS can replace adapters later.

Recorded on `origin/main` `a0d4d7966f4a3ae8f12736d1bb8dff169a3d0227`.

---

## Product-specific host special cases (do not expand)

| Location | Behaviour | Why it exists | MPS replacement |
| --- | --- | --- | --- |
| `src/features/modules/identity/moduleArtwork.ts` | Kind map includes `vault-notes`, `tasks`, `crm`, `gaia`, … | Host-owned palette/fallback while registry artwork is incomplete | Product artwork from MPS package assets |
| `src/features/modules/identity/productCopy.ts` | `KNOWN_COPY` for Vault Notes and Tasks | Sanitises engineering copy; supplies taglines | Publisher/product copy from MPS |
| `src/features/modules/components/product-detail/ProductCover.tsx` | `digital.modula.vault-notes` uses bundled `vault-notes-cover.png` | Only verified cover currently in-repo | MPS screenshot/cover role |
| `src/features/modules/components/presentation/ModulePreview.tsx` | Vault Notes preview frames | Local preview pack | MPS preview media |
| `src/features/modules/components/ModuleArtwork.tsx` | `kind === 'vault-notes'` drawing path | Honest fallback illustration, not a Marketplace icon hack for every product | Generic fallback + MPS art |
| `src/features/marketplace/screens/ModuleDetailScreen.tsx` | `VAULT_NOTES_CANONICAL_SOURCE = 'modula-mod/modula-vault-notes'` | Provenance label | MPS source/provenance |
| `src/features/feed/postActions/runPostAction.ts` | Save-to-notes deep-links `/module/digital.modula.vault-notes/note-editor` | Existing contribution | Contribution point from MPS |
| `src/features/board/screens/BoardScreen.tsx` | `vault-notes` widget ↔ `digital.modula.vault-notes` | Board widget mapping | Widget contribution |
| `src/features/profile/components/ProfileModuleCard.tsx` | Name containing `vault` routes to Vault Notes marketplace | Legacy id mapping | Profile module contribution |
| `src/features/activity/screens/ActivityScreen.tsx` | `moduleUpdate` previously opened Vault Notes | Hardcoded product | Activity payload `moduleId` from platform |

This mission **does not add** new `if Vault AI → custom icon` host hacks.

---

## Product artwork sources (current)

| Source | Used for | Fallback | Future MPS point |
| --- | --- | --- | --- |
| Bundled `assets/images/product-hub/vault-notes-cover.png` | Vault Notes cover only | — | MPS cover asset |
| `moduleArtwork.ts` palettes + `ModuleArtwork` drawings | Tile / icon / editorial when registry has no verified art | Generic `fallback` kind | MPS `moduleIcon` / `tileArtwork` |
| Registry fields on `ModuleCatalogueItem` | Name, publisher, install state | Honest empty / `—` | MPS catalogue projection |
| `ProductPreviewCarousel` empty state | “Screenshots not available” | Intentional unavailable | MPS preview frames |

Do not fabricate public product artwork in the shell.

---

## Frontend adapters to keep generic

| Adapter | Current | MPS later |
| --- | --- | --- |
| `presentProductHubCatalogue` | Maps React Query catalogue → loading / empty / partial / failure | Same view-model; swap query source |
| `productCopyFor(moduleId, name, description)` | Known copy + sanitise | MPS copy fields |
| `moduleArtworkPack(moduleId)` | Host palettes | MPS artwork pack |
| `resolveModuleInstallPresentation` | Install / Open / Soon / unavailable | Unchanged contract if possible |
| Composer `listComposerTools()` | Current contribution model | Extension-supplied tools |

---

## Intentionally not done in Shell UI V1

- Wiring draft MPS package format
- Registry schema or Greenfield protocol changes
- Removing valid Vault Notes runtime behaviour that would require backend/MPS work
- Hardcoding Vault AI / Voice / Formatting host chrome
