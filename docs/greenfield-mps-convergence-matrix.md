# Greenfield × MPS 1.0-RC convergence matrix

Classifications: `ALREADY_SUPPORTED` | `ADAPTER_REQUIRED` | `GENERIC_GREENFIELD_EXTENSION_REQUIRED` | `MPS_CORRECTION_REQUIRED` | `NOT_APPLICABLE`.

NO UNKNOWN. MPS open questions MPS-Q001–Q010 are resolved in the Product Standard
`DECISIONS.md` (MPS 1.0-RC).

| MPS concept | Greenfield primitive | Current compatibility | Required change | Owner | Verification | Classification |
| --- | --- | --- | --- | --- | --- | --- |
| Identity | `greenfield_developer_products.product_id` + aliases | Nested Vault IDs published | Keep IDs; store `identity.aliases` | BOTH | ingest + 054 seed | ADAPTER_REQUIRED |
| Product Kind | `product_kind` / `greenfield_extension_kind` | 10 generator kinds; MPS names differ | Map + CHECK extend engine/game/integration/theme | BOTH | kinds.ts + 054 | GENERIC_GREENFIELD_EXTENSION_REQUIRED |
| Publisher | `greenfield_publishers` | Exists | Map `identity.publisher` | Greenfield | ingest | ALREADY_SUPPORTED |
| Namespace | `greenfield_namespaces` | Exists | Map `identity.namespace` | Greenfield | ingest | ALREADY_SUPPORTED |
| Family | none → `greenfield_product_families` | Missing | Generic family tables | Greenfield | 054 + ingest | GENERIC_GREENFIELD_EXTENSION_REQUIRED |
| Relationships | none → `greenfield_product_relationships` | Missing | Generic relationship rows | Greenfield | 054 + ingest | GENERIC_GREENFIELD_EXTENSION_REQUIRED |
| Presentation | marketplace copy fields | Partial | Ingest marketplace block | Greenfield | ingest | ADAPTER_REQUIRED |
| Assets | artifact hashes, no roles | Missing roles | `greenfield_release_presentation_assets` | Greenfield | 054 + ingest | GENERIC_GREENFIELD_EXTENSION_REQUIRED |
| Frontend | Module Host views/routes | Host exists | Map MPS frontend modes; no remote JS | Greenfield | mapping.ts | ADAPTER_REQUIRED |
| Backend | `backend_mode` enum | frontend-only / greenfield-managed / module-managed | Map MPS none / greenfield-records / service / engine-backed | BOTH | mapping.ts | MPS_CORRECTION_REQUIRED |
| Storage | data ledger + module-owned DB TEST_ONLY | Exists | Logical storage.mode mapping; no table names in MPS | Greenfield | mapping.ts | ADAPTER_REQUIRED |
| Data | records + export/delete | Exists | Privacy + data declarations | Greenfield | 054 privacy | ADAPTER_REQUIRED |
| Capabilities | capability broker | Exists | provides/requires/requests | Greenfield | ingest | ALREADY_SUPPORTED |
| Permissions | permission policy | Exists | machine + human | Greenfield | ingest | ALREADY_SUPPORTED |
| Providers | multiple providers + defaults | Exists TEST_ONLY | notes.provider + reference-notes | Greenfield | fixtures | ALREADY_SUPPORTED |
| Dependencies | resolver, cycles = 0 | Exists | range + graph | Greenfield | ingest | ALREADY_SUPPORTED |
| Extensions | extension fabric, depth 16 graph / 3 contribution | Exists | Document dual bound | BOTH | DECISIONS | ADAPTER_REQUIRED |
| Events | event fabric | Exists | `{productId}.{entity}.{verb}.vN` | MPS | Q007 | MPS_CORRECTION_REQUIRED |
| Jobs | job fabric | Exists | behavior not table state names | Greenfield | mapping | ADAPTER_REQUIRED |
| Services | service fabric | Exists | no arbitrary URLs; assertion v1 | BOTH | Q001 | MPS_CORRECTION_REQUIRED |
| Engines | engine fabric | Exists | capability not vendor | Greenfield | mapping | ALREADY_SUPPORTED |
| Connectors | service + secret + events | Partial | OAuth metadata without credentials | Greenfield | fixture | ADAPTER_REQUIRED |
| Secrets | secret fabric | Exists; prod refs = 0 | requirement IDs not secret:// | MPS | Q006 | MPS_CORRECTION_REQUIRED |
| Network | SSRF / service policy | Exists | ARBITRARY URLS = 0 | Greenfield | services.urls empty | ALREADY_SUPPORTED |
| Privacy | none → declarations table | Missing | ingest privacy | Greenfield | 054 | GENERIC_GREENFIELD_EXTENSION_REQUIRED |
| Security | review gates | Exists | security contact + baseline mps-1.0 | BOTH | validator | ADAPTER_REQUIRED |
| Marketplace | catalogue / hub APIs | Exists | consume registry not GitHub | Greenfield | live routes | ALREADY_SUPPORTED |
| Offers | commerce | Exists; money NOT_CONFIGURED | map offers | Greenfield | mapping | ALREADY_SUPPORTED |
| Entitlements | entitlement engine | Exists | capability-string IDs | MPS | Q005 | MPS_CORRECTION_REQUIRED |
| Usage | metering / quotas | Exists | AI/storage/job via fixtures | Greenfield | mapping | ALREADY_SUPPORTED |
| Compatibility | install checks | Exists | MPS version + `greenfield.v1` | BOTH | Q009 | MPS_CORRECTION_REQUIRED |
| Release | channels + artifacts `.tgz` | Exists | package `modula-product-tgz` | MPS | Q010 | MPS_CORRECTION_REQUIRED |
| Provenance | source SHA, hashes, builder, signature | Exists | map 1:1 | Greenfield | ingest | ALREADY_SUPPORTED |
| SBOM | build service SPDX/CycloneDX | Exists | do not freeze one format | BOTH | Q unresolved→accept both | ALREADY_SUPPORTED |
| Signing | build service | Exists | do not invent second signer | Greenfield | existing | ALREADY_SUPPORTED |

## Invariant

NORMAL NEW PRODUCT REQUIRES GREENFIELD CORE CODE CHANGE = **NO**

Product-specific Greenfield runtime cases on the MPS ingest path = **0**
