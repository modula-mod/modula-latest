# Product specification

- Kind: `service`
- Publisher: Modula
- Users: developers validating MPS 1.0-RC
- Goal: Prove service protocol, health, capabilities, network, and secrets without credentials.
- Non-goals: production publication, Greenfield deployment, live credentials
- Acceptance: `pnpm mps verify .` passes in development mode; `--public` fails because this is a test fixture
