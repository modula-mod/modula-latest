# Vault Notes frontend audit

Audit date: 2026-08-29
Repository: `modula-mod/modula-latest`
Baseline: `aab39cba5fc45ad9375372f5e169a7923a98218e`

## Result

There is no dedicated `src/features/vault-notes` implementation and no
Vault-specific branch in `ModuleHost` or `ModuleViewRenderer`. The active
module route and renderer are generic. The remaining name-specific frontend
references are Shell shortcuts, marketplace/demo presentation, and historical
compatibility. New MPS releases must use the product-owned frontend path and
must not be intercepted by them.

## Product-experience components

| Current path / function | Function | Data dependency | Host dependency | Move to product frontend? | Generic MPS need | Legacy only? |
| --- | --- | --- | --- | --- | --- | --- |
| `src/features/modules/runtime/module-host.tsx` / `ModuleHost` | Generic installed module route | installed release + frontend projection | navigation, lifecycle, error boundary | No; Host-owned | route/view resolution | No, host-generic |
| `src/features/modules/runtime/module-view-renderer.tsx` / `ModuleViewRenderer` | Generic record/form/settings renderer | scoped records/settings/actions | semantic controls, theme, share | No; Host-owned | generic components/actions | No, host-generic |
| `src/features/board/screens/BoardScreen.tsx` / `openBoardWidget` | Vault-specific Board shortcut and status | installed modules | Board shell/router | Replace with product widget/contribution | widget contribution | Yes |
| `src/components/composer/ComposerToolsDrawer.tsx` / Vault name match | Opens Vault directly for a tool name | tool catalogue | composer/router | Replace with declared composer contribution/action | composer tool + route action | Yes |
| `src/features/feed/postActions/runPostAction.ts` / save-to-Vault route | Opens historical `note-editor` deep link | post identity/permalink | post actions/router | Product action/contribution owns destination | parameterized product route/action | Yes |
| `src/features/modules/components/presentation/ModulePreview.tsx` / `previewsForModule` | Hardcoded Vault marketplace preview captions | product ID | Product Detail shell | Product supplies screenshots/captions as assets/metadata | presentation assets | Yes |
| `src/features/modules/components/product-detail/ProductCover.tsx` / `VAULT_NOTES_COVER` | Hardcoded marketplace cover asset | product ID | Product Detail shell | Asset moves to product release; shell remains | product cover asset role | Yes |
| `src/features/modules/components/ModuleArtwork.tsx` / `ArtworkScene` | Product-specific fallback artwork | product artwork kind | marketplace surfaces | Prefer product icon/cover; retain only historical fallback | product assets | Yes |
| `src/data/repositories/api/ApiModuleRepository.ts` / local catalogue fallback | Vault-specific local metadata/permissions | local demo source | repository offline fallback | Do not use for remote MPS releases | registry metadata | Yes |
| `src/features/marketplace/screens/ModuleDetailScreen.tsx` / canonical-source assertion | Canonical provenance guard | registry source/version | Product Detail shell | Metadata stays product-owned; guard becomes generic provenance | provenance projection | Yes |

Vault-owned target views are root/dashboard, notes collection, note detail,
new/edit form, module search/filter, empty/error states, settings and
product-specific menus. They will be authored and released from
`modula-mod/modula-vault-notes`.

## Search classification

The audit command was:

`rg -l -i "Vault Notes|digital\\.modula\\.vault-notes|vault-notes" src services packages scripts fixtures`

It returned 137 files at this baseline. Every result belongs to one of these
exhaustive path rules:

| Rule | Category | Treatment |
| --- | --- | --- |
| `src/features/modules/runtime/**` | HOST-GENERIC | Runtime is product-neutral; textual hits are verifier/diagnostic only |
| `src/features/modules/components/**`, `src/features/marketplace/**`, `src/features/board/**`, `src/components/**`, `src/features/feed/**`, `src/features/activity/**`, `src/features/profile/**` | LEGACY COMPATIBILITY or HOST-GENERIC | Shell/marketplace stays; product-name branches and embedded assets are bounded legacy debt |
| `src/demo/**`, `src/api/local/**`, `src/features/**/data/**`, `src/features/secondary/**`, `fixtures/**` | TEST/FIXTURE | Non-authoritative local preview/demo data; cannot activate a remote MPS release |
| `services/**/tests/**`, `packages/**/tests/**`, `scripts/verify-*`, `scripts/*test*` | TEST/FIXTURE | Regression and canonical-product proof |
| migrations 004/006/022/039/054, worker search projector, record/search/AI services | DATA or LEGACY COMPATIBILITY | Historical schema/projections remain for data compatibility; not product frontend UI |
| `packages/greenfield-contracts/src/canonical-module-identity.ts`, identity migration, registry scripts | LEGACY COMPATIBILITY | Canonical ID aliases and immutable historical release support |
| generic registry, Product Hub and installed-module files | HOST-GENERIC | Platform management UI fed by product metadata |

No result is classified as a new active Vault-specific renderer
implementation. The legacy Shell shortcuts above remain open migration debt and
must not be reused for MPS 1.0 releases.

## Capability findings

- Notes collection/forms/settings fit existing generic MPS primitives.
- Rich text is reusable and is declared as `ui.richText@1`; the current host
  safely degrades it to the generic multiline editor.
- Share is host-mediated.
- Product-specific route names do not require a global Shell route.
- No arbitrary JSX, remote JavaScript, raw HTML, WebView or native bundle is
  required.
