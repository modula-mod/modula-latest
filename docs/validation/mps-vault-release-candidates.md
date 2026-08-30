# MPS Vault product frontend release candidates

These immutable beta releases are the Vault product-owned frontend line used by
the generic Greenfield MPS publisher and Modula Product Host.

| Product | Version | Release commit | Package SHA-256 | Frontend SHA-256 |
| --- | --- | --- | --- | --- |
| Vault Notes | 1.4.0 | `3f4e358df383ea84fe0af1ebf9d30d43e55de221` | `42f2e5c98106064d47690bf206db46e6ab0e2062e46ca7b45a3e1260376dfcd1` | `65f039de00040b0ad68bad1626b38d43f01aef28bdeeaa5cdbe6e9d559fefca7` |
| Vault Formatting | 0.3.0 | `b8a98990181aa112a8c95c2a7708f0e67cb677ba` | `eb31cb8c6a9eb6d2d0e9af9a86ef3780a99ce11c3368773abaafbd2902336b88` | `11e09a5f37bf8e177f0d0144d8a05380606eaee408894ccd54cbe60bd4bd5b3d` |
| Vault AI | 0.3.0 | `2c5bda72b5cd1413a9c79a4fbbfd10d88a6f2cce` | `4e7c4313b099e43652b05316e6840f9cded84d5ae46b1683196c7556b2e792f5` | `f5b78e8f1ea629dae34cd029a066aeb033b8d824fd419c6f38316657d9ff6375` |
| Vault Voice | 0.3.0 | `f753da13fec60226f362d316c5a49c977694998b` | `0690f50cdc8572e29edca36b93c216a0dbf2efa667e386aaa34aa7bcc3cb1955` | `ad757e7fed93290c9bc197881b68eaebbf0085ee9fde968525e1f0e166f1c8c9` |

Vault Notes source provenance points to final product implementation commit
`68d20e693562712c5ff57cb7c24a40845b7f074c`; the release commit adds only the
reviewed provenance chain. Vault AI and Vault Voice remain truthfully
`NOT_CONFIGURED` when no provider is available and do not fabricate output.

Run `CI=true pnpm verify:vault-products` to republish these exact tag-pinned
packages to disposable Postgres, validate all release/frontend projections,
and remove the database.
