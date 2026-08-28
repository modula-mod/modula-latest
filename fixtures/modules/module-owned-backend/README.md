# Module-owned backend fixture

`test.modula.module-owned-backend` is an internal acceptance fixture. It proves that a module can own a frontend surface, an out-of-process backend contract, and a dedicated PostgreSQL database while Greenfield retains the resource, service, event, job, export, and uninstall ledgers.

It is `TEST_ONLY` and must never appear in the public Product Hub.
