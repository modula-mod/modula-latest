# Module Record Versioning

Phase 7E Block 6 extends generic module records with bounded version snapshots.

## Model

`greenfield_module_records.revision` remains the active record revision.

`greenfield_module_record_versions` stores prior data snapshots for audited recovery and conflict analysis:

- account ID;
- module ID;
- collection;
- record ID;
- previous revision;
- next revision;
- data snapshot;
- payload hash;
- change source;
- created timestamp.

Snapshots are bounded to the latest 25 versions per account, module, collection and record.

## Conflict Rule

Mutations that include `expectedRevision` must match the current revision. Stale writes return `NOTE_REVISION_CONFLICT` with HTTP 409.

Vault Notes autosave must surface that state as a conflict. It must not silently overwrite newer changes.

## Events

Module record events and domain events use record IDs, revisions, schema references and payload hashes. They do not include note bodies or full structured documents.
