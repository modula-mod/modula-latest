# Product specification

- Kind: `engine`
- Publisher: Modula
- Users: developers validating MPS 1.0-RC
- Goal: Prove trusted infrastructure profile semantics. Host remains trust authority.
- Non-goals: production publication, Greenfield deployment, live credentials
- Acceptance: `pnpm mps verify .` passes in development mode; `--public` fails because this is a test fixture
