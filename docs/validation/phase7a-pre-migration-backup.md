# Phase 7A Pre-Migration Backup

- Date: 2026-07-20
- Scope: Greenfield database before `009_phase7a_module_platform`
- Status before migration: migrations `001` through `008` applied; `009_phase7a_module_platform` pending
- Backup file: `services/greenfield-api/backups/phase7a-pre-migration-20260720T124511Z.dump`
- SHA-256: `bcc216f72bdb76a4f85491e727698b38b7b1cbf16a0c832fb567d58d50cc06de`

The backup was created with the Greenfield migrator database URL. A first attempt with the regular API database user hit row-level security on `post_saves`; that partial artifact was removed and is not the recorded backup.
