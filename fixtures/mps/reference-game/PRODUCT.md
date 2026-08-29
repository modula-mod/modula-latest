# Product specification

- Kind: `game`
- Publisher: Modula
- Users: developers validating MPS 1.0-RC
- Goal: Represent game saves, sessions, leaderboards, assets, and native requirements without becoming a game engine.
- Non-goals: production publication, Greenfield deployment, live credentials
- Acceptance: `pnpm mps verify .` passes in development mode; `--public` fails because this is a test fixture
