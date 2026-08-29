# Product specification

- Kind: `integration`
- Publisher: Modula
- Users: developers validating MPS 1.0-RC
- Goal: Cross-product behaviour through events and contributions, never SQL.
- Non-goals: production publication, Greenfield deployment, live credentials
- Acceptance: `pnpm mps verify .` passes in development mode; `--public` fails because this is a test fixture
