# Modula product-host guardrails

`modula-latest` owns the Modula Shell, the generic Module Host, shared semantic
UI primitives, native platform adapters, accessibility defaults, and lifecycle
presentation.

Do not implement a normal product or module-specific frontend in this
repository. If a feature belongs to one installable product, its default home
is that product repository. Define the experience through the MPS frontend
contract and consume it through the generic host.

- Do not add product-ID or product-name branches to the Module Host or renderer.
- Product repositories may author controlled `@modula/product-ui` TypeScript/TSX,
  which MPS statically compiles during release build. Do not download or execute
  product source, arbitrary JavaScript, JSX, HTML, CSS, native code, remote
  bundles, or generic WebView product UIs.
- Do not bypass installation, release verification, permissions, capabilities,
  entitlement, account, or product data boundaries.
- New generic primitives require an MPS contract, validator/testkit coverage,
  host rendering support, and a neutral non-Vault fixture.
- Product frontend updates are immutable release artifacts. Never replace an
  artifact behind an existing version or tag.
- Preserve semantic theme tokens, system appearance, accessibility, responsive
  layout, and native adaptation in shared host UI.
- Create new products with the canonical product generator; do not clone Vault
  Notes as a template.

Historical name mappings and product-specific shortcuts must be explicitly
documented as legacy compatibility and must not intercept new MPS frontend
releases.
