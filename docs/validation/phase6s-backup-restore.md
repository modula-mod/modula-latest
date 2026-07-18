# Phase 6S — Isolated backup restoration

**Date recorded:** 2026-07-18  
**Branch:** `phase6s-social-product-completion`  
**Git tip at record time:** `e548aa5a0ae49180b35591de4af7a67980e23496`  
**Status:** **DEFERRED** — VPS SSH unavailable from this Mac agent session.

## Why deferred

- Mac SSH to `87.106.40.136` fails with `Permission denied (publickey,password)`.
- Existing `~/.ssh/id_ed25519` is passphrase-protected and was not loaded into the agent (`ssh-add` not available without interactive unlock).
- Live API `https://api.modula.digital` returned **502** at record time, so production restore verification cannot be executed from Mac alone.
- Operator will unlock VPS access when home; this document is the checklist to complete then.

## Mandatory procedure (run on VPS only)

Do **not** restore against the active production database.

1. Create a fresh backup of the production Greenfield PostgreSQL database.
2. Record checksum (SHA-256) and size.
3. Create an isolated PostgreSQL restore target (separate database / instance).
4. Restore the backup into that isolated target.
5. Run `pnpm --filter @modula/greenfield-api db:status` and `db:migrate` against the restore target if required.
6. Verify account count, post count, reaction count, comment count.
7. Verify event hash chains and checkpoints.
8. Verify extension installations.
9. Start Greenfield API against the restored database.
10. Run smoke tests (register/sign-in/post/react/comment/appearance/extensions as applicable).
11. Capture evidence below.
12. Destroy the isolated restore environment after evidence is captured.

## Results (fill when home)

| Field | Value |
| --- | --- |
| Backup timestamp | _pending_ |
| Backup size | _pending_ |
| Checksum (SHA-256) | _pending_ |
| Source database version | _pending_ |
| Restore database version | _pending_ |
| Restore duration | _pending_ |
| Account count | _pending_ |
| Post count | _pending_ |
| Reaction count | _pending_ |
| Comment count | _pending_ |
| Hash-chain result | _pending_ |
| Checkpoint result | _pending_ |
| Extension installations | _pending_ |
| API smoke result | _pending_ |
| Cleanup result | _pending_ |

## Safety

- Do not include database passwords in this document.
- Do not publish raw verification or recovery tokens.
- Keep AT Protocol optional and DIMON inactive during restore verification.
