# MODULE-DISTRIBUTION-03 Native handoff

This document is the implementation contract for `MODULEHOST-NATIVE-01`. It is platform-neutral; no Android or iOS implementation is part of this GreenField phase.

## Install

1. Request `POST /v1/modules/:moduleId/install-plan` with the actual host version, Module SDK version, Product UI contract version, platform, and semantic host-capability descriptors.
2. Present compatibility reasons, requested permissions, and total required download bytes. Do not continue when `allowed` is false. Obtain explicit permission choices when `permissionReviewRequired` is true.
3. Send the idempotent install request with the target version and explicit reviewed permissions. Persist the returned canonical `installationDescriptor`; do not treat `installed: true` alone as sufficient.
4. Download every `currentRelease.artifacts[]` entry whose `requiredForOfflineLaunch` is true. Bearer authorization is required when the descriptor says `authorization: bearer`.

## Verify before storing or executing

For every release:

1. Validate the release descriptor schema/payload version and Ed25519 evidence against the trusted publisher public key/key ID.
2. Reconstruct/verify the canonical signed statement semantics for `signaturePayloadVersion: 1`. Do not infer a different historical payload.
3. Hash every downloaded artifact with SHA-256 and require exact equality with its descriptor digest. `ARTIFACT_DIGEST_MISMATCH` means delete the bytes and never execute them.
4. Validate the package/manifest/frontend digests and compatibility facts bound by the signature/package.
5. Re-evaluate host, Module SDK, Product UI, required capabilities, and revocation immediately before activation.
6. Mark a release ready for offline launch only when all `requiredForOfflineLaunch` artifacts are present and verified.

HTTPS protects transport; it does not replace local signature and digest verification.

## Local cache state machine

```text
NOT_INSTALLED
    | install
    v
DOWNLOADING
    | every required artifact verified
    v
STAGED
    | atomic activation + local health gate
    v
ACTIVE
    | later update downloaded and verified
    +------------------------> PREVIOUS_GOOD + STAGED
```

- `ACTIVE` is the only release used for normal launch.
- `STAGED` is complete, trusted, compatible, and verified but not yet active.
- `PREVIOUS_GOOD` is the last locally healthy activation. GreenField's rollback candidate is eligibility metadata, not proof that this device launched it successfully.
- A corrupt/incomplete/incompatible `STAGED` slot is deleted; `ACTIVE` remains untouched.
- Activation is an atomic slot/pointer swap. Keep the old active bytes as `PREVIOUS_GOOD` until the new release passes the Native health gate.
- If activation fails, atomically restore `PREVIOUS_GOOD`, retain non-sensitive diagnostics, and do not reinterpret the failed client report as a trust decision.

## Cache-first launch

```text
tap installed module
    -> read local installation descriptor and cache index
    -> verify/use ACTIVE locally
    -> render local/cached product data immediately
    -> hydrate ModuleHost runtime
    -> background: conditional descriptor refresh, data sync, update-feed check
```

Launching an installed product must not redownload its code or declarative frontend. Network failure during background refresh must not prevent a still-trusted, locally compatible `ACTIVE` artifact from launching under Native's cached-revocation policy. Native should age/revalidate trust metadata according to product security policy and react when GreenField later reports revocation.

## Conditional refresh

Store `descriptorRevision` and the installation descriptor ETag. Send `If-None-Match` to the descriptor and update-feed routes. `304` means the local descriptor remains current. A `200` with a different revision requires re-evaluating enabled state, selected release, reviewed grants, compatibility, trust, and revocation before launch/activation.

## Background staging and update

1. Poll the account update feed once, not once per module. Stable installations must not consume beta/RC/dev targets unless their server policy explicitly follows that channel.
2. For an eligible item, request the update plan. Preserve `expectedDescriptorRevision`.
3. Show/obtain review for every added permission. Removed permissions alone need no new review. Never turn absence of a response into permission uplift.
4. Download `targetArtifacts` quietly using ETag and byte ranges. If the server returns `206`, append only when `Content-Range`, ETag, expected size, and final SHA-256 agree. On `416`, changed ETag, or no range support, restart that artifact.
5. Verify the entire target release and put it in `STAGED`.
6. Submit the idempotent update with the expected descriptor revision and exact permission decision. A revision conflict means discard the plan, refresh, and reconsider; do not blindly replay stale consent.
7. Do not activate while the module is performing unsafe local mutation unless the Native activation contract can quiesce it.

## Rollback

Local crash recovery uses `PREVIOUS_GOOD` immediately and does not wait for GreenField. If server installation selection must also move backward, call the governed rollback/version-switch API using the advertised candidate, expected descriptor revision, and a stable idempotency key. Still verify target trust, compatibility, exact-release permission state, and schema safety. Never derive the target as “version minus one,” and never roll back to unsigned Vault 0.2.

## Revocation and failed rollout

When a refresh reports release or signer revocation:

- do not newly install, stage, activate, or roll back to that release;
- cancel in-flight downloads where practical and discard unactivated staged bytes;
- retain user data and the installation record;
- show the structured reason and any safe target from the update plan/feed;
- apply Native's explicit policy to an already-running/active instance—do not silently destroy data.

## Uninstall and data choice

An uninstall response/removal from installation descriptors tells Native to remove local release/cache slots. Module data deletion is a separate user choice and server operation. Removing cached artifacts must not imply deleting GreenField records. On reinstall, fetch the canonical descriptor again and honor the product's actual keep/delete data policy.

## Optional diagnostics

Native may later report bounded, non-sensitive events such as download success, digest failure, activation success/failure, crash, and local rollback. Do not include user content, tokens, filesystem paths, or raw artifacts. These events may inform rollout health/support but can never create trust or override registry revocation.
