# Product

- Goal: prove the Greenfield module-owned backend contract end to end.
- Kind: module.
- Publisher: Modula test fixtures.
- Capability: isolated record CRUD, event publishing, service jobs, export, and deleteData uninstall.
- Data: dedicated PostgreSQL through a scoped credential handle.
- Backend: out-of-process service identity only; no Greenfield database access.
- UI surface: module route.
- Platforms: server and web.
- Non-goals: public distribution, real user content, or provider simulation.
- Acceptance: dedicated-role isolation, account isolation, ledger binding, CRUD, event, job, export, and uninstall tests pass.
