# GreenField V1-CLOSEOUT-FINAL-R1 evidence

This directory contains sanitized, reproducible evidence for the 2026-10-15
through 2026-10-16 R1 continuation. No credential values, user payloads,
signing private keys, or direct user identifiers are included.

- `soak-30m.json`: atomically retained mixed-load/process/database measurements
  and final PASS status; SHA-256
  `a2c6a9c431ffebca13de4510ce1659911c504a36011e27707663e61255a6128b`.
- `soak-30m-single-ip-rate-limit.json`: the complete first run, retained as a
  truthful FAIL because one loopback identity correctly exhausted abuse limits;
  its service/resource stability is bounded-backpressure evidence only;
  SHA-256
  `7e7e0e34179dc916c6a045579ec61b7f97c99731fa9f70993e953626548daa5a`.
- `pristine-api-suite*` and `api-live-harness-classification.log`: fresh
  migration-074 API results and the separately satisfied live-harness case.
- `pristine-worker-suite*`: fresh migration-074 worker results with database
  tests enabled.
- `local-ci-equivalent*`: contract, permission, typecheck, lint, build, Atlas,
  and secret-verifier run.
- `image-identities.json`, `hardened-image-smoke.json`, and
  `scanner-identities.json`: exact image and scanner identities plus runtime
  boot proof.
- `api-sbom.spdx.json` and `worker-sbom.spdx.json`: exact-image SPDX SBOMs.
- `api-trivy.json`, `worker-trivy.json`, and `trivy-summary.json`: exact-image
  vulnerability and secret scans.
- `supply-chain-evidence.sha256`: portable checksums for the SBOM/scan files.
- `external-backup-discovery.json`: the reason Gate A is blocked.
- `offline-signer-scan.json`: absence proof without secret values.

The small `*-pre-hardening.json` summaries and pre-hardening image identities
show why the runtime-image remediation was required. Large raw pre-hardening
reports are retained mode 0600 in the operator evidence store rather than
inflating the repository; final candidate raw reports are committed here.
