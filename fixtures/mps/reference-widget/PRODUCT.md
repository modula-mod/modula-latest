# Product specification

- Kind: `widget`
- Publisher: Modula
- Users: developers validating MPS 1.0-RC
- Goal: Prove a bounded host-rendered UI contribution.
- Non-goals: production publication, Greenfield deployment, live credentials
- Acceptance: `pnpm mps verify .` passes in development mode; `--public` fails because this is a test fixture
