# Phase 7H Secret Rotation Register

Date: 2026-08-08
Scope: all secrets that may have been accessible to the affected VPS.

Do not store secret values in this file.

## Rule

Assume exposure for every credential reachable from the affected host. A clean host may receive only new or reissued credentials. Rotation proof belongs in private operator records, not in Git.

## Register

| Secret class | Examples | Status | Required clean-host action | Proof required |
| --- | --- | --- | --- | --- |
| PostgreSQL passwords | app role, migration/admin role, backup role | Rotation required | Create new roles/passwords or rotate existing credentials before restore becomes live. | DB login test from clean host, old credential rejected. |
| Redis password | queue/cache/session Redis if used | Rotation required | Generate new password and update only clean-host env. | Auth test and old credential rejected. |
| Greenfield session secrets | session signing, refresh/session storage secrets | Rotation required | Generate new high-entropy secrets. | New sessions work; old sessions invalidated per policy. |
| JWT/signing secrets | API signing keys, token issuers | Rotation required | Generate new signing material and retire old material. | Token issuance/validation proof and old-token rejection policy. |
| Cookie secrets | web/API cookie signing/encryption | Rotation required | Generate new cookie secrets on clean host. | Login/session smoke test. |
| OAuth secrets | any social/auth/provider client secrets | Rotation required if present | Reissue provider credentials. | Provider callback works; old secret revoked. |
| SMTP credentials | transactional SMTP username/password or API SMTP credential | New credential required | Provision least-privilege sender credential for `no-reply@modula.digital` or chosen sender. | Verification and reset email delivery proof. |
| Cloudflare token | DNS deployment token | New least-privilege token required | Use zone-scoped DNS token for `modula.digital`; do not use Global API key. | DNS read/edit task succeeds; token scope recorded privately. |
| GitHub deployment token | deploy keys, PATs, Actions tokens | Rotation required if present on old host | Replace with scoped deploy credential. | Clone/deploy works with new credential; old token revoked. |
| Hestia API credentials | Hestia admin/API credentials | Rotation required | Recreate/admin rotate on clean host. | Hestia login/API health proof. |
| Object storage credentials | media/module artifact storage | Rotation required | Issue new access key with least privilege. | Read/write smoke test; old key revoked. |
| AI provider keys | hosted model/API provider keys | Rotation required if present | Reissue keys; keep hosted smoke tests opt-in. | Provider health check using new key only. |
| Webhook secrets | inbound/outbound service webhooks | Rotation required | Reissue signing secrets and update webhook endpoints. | Signed webhook verification test. |
| Module signing credentials | module release/signing keys | Rotation required if present | Reissue or move to offline/controlled signing path. | Module provenance verification passes. |
| Backup encryption credentials | backup encryption key/passphrase | Rotation required | Generate new encryption material and re-encrypt future backups. | Restore drill using new backup generation. |
| Service-to-service credentials | API-worker, internal bridges, registry credentials | Rotation required | Generate new service credentials and scopes. | API and worker integration tests pass. |
| SSH credentials | root and admin SSH keys | Rotate where practical | Remove unneeded keys, issue named admin keys, disable weak auth. | Two-session lockout-safe SSH proof. |

## Cutover Gate

Before DNS cutover, every row must be one of:

- `rotated and proven`;
- `not present on affected host, proven by evidence`;
- `retired and no longer used`.

No row may remain `unknown` for live Alpha.
