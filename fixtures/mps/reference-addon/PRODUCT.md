# Product specification

- Kind: `addon`
- Publisher: Modula
- Users: developers validating MPS 1.0-RC
- Goal: Prove target relationship, host contribution, and capability dependency.
- Non-goals: production publication, Greenfield deployment, live credentials
- Acceptance: `pnpm mps verify .` passes in development mode; `--public` fails because this is a test fixture
