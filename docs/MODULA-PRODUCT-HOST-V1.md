# Modula Product Host V1

Status: **implementation candidate**. It becomes **STABLE** only after the MPS
1.0 combined invariant and neutral product update proof pass.

## Ownership

The Shell owns platform UI. A product owns its product-specific experience and
assets. The Product Host bridges them without executing arbitrary downloaded
code.

| Owner | Responsibility |
| --- | --- |
| Product repository | routes, views, actions, bindings, settings content, approved contributions, product assets |
| MPS | authoritative frontend source/artifact contract, validation, limits, compatibility and provenance |
| Greenfield | release-bound verified frontend projection, installation/lifecycle authorization and data/action services |
| `modula-latest` | generic route, renderer, native adapters, semantic theme, accessibility baseline, failure boundary and host chrome |

## Generic route and resolution

The only normal application route is:

`/module/[productId]/[[...path]]`

Resolution is installation-first and exact-release:

1. Resolve the account-scoped installed product.
2. Require a published, enabled release.
3. Find the MPS ingestion bound to that exact release ID, product ID and
   version.
4. Require its verified immutable frontend projection.
5. Resolve the product-owned logical route.
6. Adapt the validated MPS tree into the existing generic renderer.

The API is `GET /v1/modules/:moduleId/frontend`. It returns `source: mps` with
the release ID, artifact SHA-256, compatibility and validated projection. It
returns `source: legacy` only when the installed historical release has no MPS
ingestion at all. A malformed or incomplete MPS release never falls back to
legacy UI.

## Artifacts and caching

Migration 055 stores frontend artifact metadata and the validated declarative
projection in `greenfield_release_frontends`. It is not an executable bundle
store. The immutable identity is:

`product ID + release ID/version + frontend artifact SHA-256`

Clients invalidate the frontend query on install, enable, disable, update and
uninstall. A release update activates one coherent release set; it does not mix
old frontend metadata with a new backend or manifest.

## Renderer and navigation

`ModuleViewRenderer` remains the single renderer. The MPS adapter resolves
logical product routes, route parameters, redirects and cycles, and converts
generic components/actions/fields into its semantic host contract. Product
route actions are scoped below `/module/<productId>`; products never register a
new global router.

The host supplies safe primitives and maps semantic presentation to web, iOS
and Android. `richText` currently maps to the generic multiline host control;
a richer `ui.richText@1` native adapter may be admitted only as a generic,
versioned capability.

## Actions, data and settings

Record actions use account- and product-scoped Greenfield record services.
Settings use Greenfield's generic product settings service. Route and share
actions are host-mediated. Unsupported action/capability families are not
executed as remote code or arbitrary network calls.

Collection bindings may declare bounded scalar filters and an explicit active
or deleted record state. The host preserves scalar types over the API boundary;
Greenfield validates filter fields against the installed release. Declarative
forms may add bounded defaults and the versioned `richText.plainText@1`
projection. Restore and permanent purge use the existing Greenfield lifecycle
endpoints, and purge always requires product-declared confirmation plus the
host confirmation surface.

Host contributions remain declared, permission checked, installation scoped,
enable/disable aware and failure isolated. For an MPS frontend release, the
host contribution presentation is selected from the exact release frontend
artifact; a missing matching contribution does not fall back to the legacy
manifest declaration.

## Compatibility and failure handling

- unsupported frontend schema major: do not render;
- missing or incoherent MPS projection: verified frontend unavailable;
- disabled product: do not resolve or render product UI;
- headless product: report no standalone product view;
- unknown route or redirect cycle: route-not-found state;
- renderer failure: product-scoped error boundary with Retry/Back/Settings;
- global navigation remains available and unaffected.

## Security invariants

- remote arbitrary JavaScript: 0
- arbitrary native module downloads: 0
- generic product WebView UI: 0
- unverified frontend rendering: 0
- undeclared network requests: 0
- cross-account or cross-product record access: 0
- path traversal: 0

Frontend artifacts are size-, depth-, route-, node-, resource- and hash-bounded
by the MPS validator before their projection is stored.

## Verification

Run:

`CI=true pnpm verify:greenfield-mps-v1`

`CI=true pnpm verify:product-frontend-v1`

Host V1 may be declared stable only after Vault-owned frontend migration,
Reference Tasks zero-core generation, and a frontend update without a Shell
deployment all pass.
