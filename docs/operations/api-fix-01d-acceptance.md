# API-FIX-01D isolated production trust acceptance

The accepted-source CLI `ops:api-fix-01d-crypto-acceptance` is a guarded one-off
test, not a release-ingestion or signing workflow. It generates two ephemeral
Ed25519 pairs in process memory, registers only their public keys under a new
audit publisher, and creates three `test.modula.api-fix-01d-*` releases. The
`test.modula.*` namespace is hidden from Product Hub and direct public module
detail. No production signing key, legitimate release, or user installation is
modified. Its synthetic package digests are test facts, not published package
blobs; the CLI tests registry trust and the real HTTP install transition, not
artifact delivery.

Before any write, confirm origin/main, API/worker image SHA, migration 067,
live/ready 200, fresh worker heartbeat, clean VPS checkout, and Atlas pass.
The CLI itself requires `--expected-sha`, an exact production runtime marker,
the protected `api-atlas-a` identity, and migration 067. It defaults to a
read-only dry run. Run IDs are eight lowercase hex characters and may not be
reused while fixture rows exist.

From the clean accepted `/root/modula-latest` checkout, with the accepted SHA
as `SOURCE_RELEASE_SHA` and its actual image build timestamp as
`SOURCE_BUILT_AT` (and the deployed tip as `SOURCE_EXPECTED_MIGRATION`; the
production Compose file has no defaults - `eval "$(ops/deploy/running-release-env.sh)"`
sets all three from the running API labels), load `/etc/modula/api-atlas.env` into the shell without
printing values. Run the one-off production API image on the existing Compose
network with `--no-deps --rm`, forwarding only `API_ATLAS_A_EMAIL`,
`API_ATLAS_A_PASSWORD`, and `API_ATLAS_BASE_URL` by variable *name*. Invoke:

```text
pnpm --filter @modula/greenfield-api ops:api-fix-01d-crypto-acceptance --expected-sha <accepted-sha> --run-id <8-hex>
pnpm --filter @modula/greenfield-api ops:api-fix-01d-crypto-acceptance --expected-sha <accepted-sha> --run-id <8-hex> --apply
```

The first invocation is dry-run. The second creates only hidden audit releases,
starts each with a cryptographically verified signature, and then uses the
normal verifier to record respectively an invalid signature, changed artifact
digest, or revoked *audit* signer. For each state it calls the deployed HTTP
`POST /v1/modules/:moduleId/install` as `api-atlas-a` and requires
`403 UNTRUSTED_RELEASE`, zero installations, zero reviews/plans, and zero
install/update outbox effects. It deactivates the synthetic releases and keys
through domain services in `finally`. An interrupted run can be deactivated
with the same command and `--cleanup`; that command refuses to revoke a release
while any synthetic installation remains active, so a failed trust gate must be
investigated and any audit installation uninstalled through the normal route.

Afterward verify no audit installation is active, audit releases remain hidden
and revoked, the audit keys are revoked, the real `modula-2026-10-offline-01`
key is active, five first-party signatures still verify, all active releases
are trusted, Vault Notes 0.2.0 stays historical/untrusted, and reaction dead
letters remain zero. Re-run health, worker heartbeat, Atlas, lineage, and the
secret scan. Audit key and release history is append-only evidence; do not
delete it manually.

The CLI intentionally does not create a valid installed audit baseline. Update,
downgrade, and version-switch operations share
`GreenfieldModuleVersionSwitchService.releaseBlockers` for target trust; their
disposable-PostgreSQL regressions remain the proof for those transitions. The
production acceptance in this phase is the real install path for the three
isolated negative states.
