# Product specification

- Kind: `connector`
- Publisher: Modula
- Users: developers validating MPS 1.0-RC
- Goal: Model OAuth, scopes, revocation, privacy, and secret requirements without credentials.
- Non-goals: production publication, Greenfield deployment, live credentials
- Acceptance: `pnpm mps verify .` passes in development mode; `--public` fails because this is a test fixture
