# MP02B Vault special-case inventory

Status: integration-candidate audit at base `5ed0382db158a051190b1ef6119028815d3c60c9`.

The reproducible count is the exact canonical Vault module ID in TypeScript
runtime source. Fixture, test, historical SQL migration, local API and developer
lab paths are excluded. The base contained 29 occurrences across 17 runtime
files. MP02B generalized 3 occurrences in 2 runtime files (GAIA discovery and
planning), leaving 26 occurrences across 15 explicitly bounded compatibility
files. Search projectors and the universal intelligence broker contain zero
Vault references.

| Area | Why it existed | Generic replacement | State | Compatibility/removal condition |
|---|---|---|---|---|
| Search projection and subscriptions | Search originally subscribed to Vault note/folder event names | Canonical `module.record.changed`, collection-declared allowlists, generic `module-record` identity | Generalized | Historical DB subscriptions remain temporarily for rolling deploy and old-event replay; remove after all old API artifacts and replay backlog age out |
| Intelligence broker | Vault AI was the only complete product route | Module-neutral tasks/policies, negotiated local/remote providers and reviewed privacy gates | Generalized | Vault product-action transformation remains a bounded legacy adapter until product releases declare equivalent semantic actions |
| GAIA action selection | Action discovery enumerated only Vault notes | Enumerate every trusted/enabled installation and every reviewed record collection | Generalized | Objective strings and fixture payload remain acceptance fixtures; runtime discovery has no product ID |
| Migration overlays | Vault 1.8 converts legacy rows/settings | Generic runtime for all normal records; isolated legacy adapter for historical data | Remaining | Remove after migration support window and production inventory prove zero eligible legacy installations |
| Board widgets | Founder board predates contribution-driven widget hydration | Manifest widget IDs, routes and renderer-neutral Product UI | Remaining | Remove in host presentation convergence after widget contribution hydration is authoritative |
| Composer/feed capture | Save-to-note predates inter-module actions | Reviewed source-to-target inter-module action | Remaining | Remove after the target module contributes its action and legacy payloads are backfilled |
| Presentation fallbacks | Some supported releases lack immutable artwork/copy/route metadata | Product-owned release presentation metadata | Remaining | Remove after the metadata becomes mandatory and old releases age out |
| Canonical release aliases | Historical IDs/repositories coexist in stored production state | Generic canonical identity resolution | Remaining | Retain while any supported stored identifier uses a legacy alias |

Every remaining exact-ID use is enumerated with an occurrence cap, reason and
removal condition in `vault-special-cases.json`. The verifier rejects new
unlisted uses, increases to a bounded file, or any Vault reference in generic
search, module SDK/UI contract, action discovery, worker search or ModuleHost
runtime paths.
