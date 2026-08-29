# Agent guidance

This is an MPS reference fixture, not a production product.

- Identify product type from `identity.kind` in `modula.product.json`.
- Do not add Greenfield table names, Redis queues, or raw credentials.
- Do not call AI providers or fake provider success.
- Do not add cross-product SQL.
- Do not special-case Vault product IDs in validators.
- Verify with `pnpm mps verify .`
