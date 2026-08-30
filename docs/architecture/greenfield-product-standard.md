# Greenfield × Product Standard

These three contracts are **not** the same version:

| Contract | Role | Version |
| --- | --- | --- |
| **Modula Product Standard (MPS)** | External product contract (`modula.product.json`) | 1.0-RC |
| **Greenfield Protocol** | Platform protocol (records, assertions, ledger, fabrics) | `greenfield.v1` |
| **Module Standard** | Module profile inside MPS | 2.1 |

Greenfield consumes MPS as the external product contract. Module Standard 2.1
is the module profile. Greenfield Protocol `greenfield.v1` is the platform
protocol. These three version lines are independent.

See `docs/GREENFIELD-V1-CORE-FREEZE.md` and `docs/greenfield-mps-convergence-matrix.md`.

MPS also owns the authoritative generic frontend contract. Greenfield stores a
verified, immutable, exact-release projection and serves it only to an enabled
account installation. Greenfield does not define product-specific UI and does
not fetch arbitrary frontend URLs. See `docs/MODULA-PRODUCT-HOST-V1.md`.

For `backend.mode = greenfield-records`, generic publication also supplies the
package-relative JSON Schema artifacts declared by MPS. Greenfield validates
closed, bounded object schemas and projects record fields plus the frontend's
declared query policy into the same exact release. The publisher verifies that
the MPS manifest, frontend, and record schemas are byte-identical to the tagged
immutable package before ingestion. No product ID participates in projection.

Host security posture: **IN_PLACE_REMEDIATED — NOT CLEAN-IMAGE_REBUILT**.
