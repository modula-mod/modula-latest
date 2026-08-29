# Product specification

- Kind: `theme`
- Publisher: Modula
- Users: developers validating MPS 1.0-RC
- Goal: Presentation-only product proving unused directories are not required.
- Non-goals: production publication, Greenfield deployment, live credentials
- Acceptance: `pnpm mps verify .` passes in development mode; `--public` fails because this is a test fixture
