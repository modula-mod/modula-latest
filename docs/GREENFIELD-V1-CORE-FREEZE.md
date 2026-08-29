# Greenfield V1 core freeze

Status: **PRODUCT-STANDARD-COMPATIBLE / CORE-FREEZE-CANDIDATE** after MPS 1.0-RC
ingestion lands.

NORMAL NEW PRODUCT REQUIRES GREENFIELD CORE CODE CHANGE = **NO**

Host security posture remains:

**IN_PLACE_REMEDIATED — NOT CLEAN-IMAGE_REBUILT**

## External vs platform contracts

| Contract | Role | Version |
| --- | --- | --- |
| Modula Product Standard (MPS) | External product contract (`modula.product.json`) | 1.0-RC |
| Greenfield Protocol | Platform protocol (records, assertions, ledger) | `greenfield.v1` |
| Module Standard | Module profile inside MPS | 2.1 |

Greenfield must not encode product names such as Vault Notes, Vault AI, CRM, or
Tasks as runtime special cases. Published identities remain data (aliases /
families), not `if productId === …` branches.

## Frozen ordinary-product primitives

These are considered stable for ordinary products:

- product identity (immutable published IDs; aliases for supersession)
- publishers / namespaces / developer programme
- product registry
- release / provenance / signing / SBOM reference
- install lifecycle (resolve → install → enable → open → update → disable → uninstall)
- dependencies (cycle rejection)
- extensions and contribution depth (MPS contribution depth 3; dependency graph bound 16)
- capabilities and permissions (machine scope + human explanation)
- services, storage bindings, events, jobs, secrets, engines
- entitlements / offers / usage (real money remains NOT_CONFIGURED)
- developer / build / release tooling
- generic MPS ingestion (parse → validate → normalize → profile → compatibility → security → release binding → registry)
- exact-release product frontend projection (verified artifact metadata + validated declarative runtime representation)

## What may still change after freeze

- bug fixes, security fixes, performance, observability
- backward-compatible schema extensions
- new protocol versions (`greenfield.v2` would be a new primitive)
- new platform primitives that are genuinely not expressible as product/profile

## What must not require a Greenfield core change

- a new Notes module (second provider)
- a new Tasks / CRM / widget / tool / connector / plugin / add-on
- a new AI product using existing engine capabilities
- a new game product using existing game-services capabilities
- a new paid product (offers/entitlements already exist; merchant remains off)
- a new service-backed product using Service Fabric
- a backend-free plugin (`backend.mode = none`)

## Freeze escalation rule

If a future product appears to require Greenfield modification, first ask:

> Is this really a new platform primitive?

If not: fix the product or the MPS profile. Do not expand Greenfield for a name.

## Product-specific runtime cases

Required: **0**. Legacy Vault overlay in `release-service.ts` is an adapter for
already-published IDs until Product Migration V1; new ingest (`ingest-service.ts`
and `@modula/greenfield-product-standard`) must not branch on Vault IDs.

## Schema

Generic MPS tables ship in migration **054** (`greenfield_product_families`,
release-bound presentation assets, privacy declarations, identity aliases,
ingest audit). Migration **055** adds the immutable product frontend projection
and artifact hash. Production apply only after ACL-preserving backup and exact
restore/up/down/reapply rehearsal on the in-place-remediated host.
