# Product specification

- Kind: `module`
- Publisher: Modula
- Users: developers validating MPS 1.0-RC
- Goal: Second notes.provider with no MPS special case.
- Non-goals: production publication, Greenfield deployment, live credentials
- Acceptance: `pnpm mps verify .` passes in development mode; `--public` fails because this is a test fixture
