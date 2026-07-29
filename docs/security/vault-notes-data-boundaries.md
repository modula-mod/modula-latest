# Vault Notes Data Boundaries

Vault Notes content is private account data.

## Allowed Storage

Note title, structured document, plain-text projection, tags, folder reference, provenance metadata and timestamps are stored in generic module records.

## Disallowed Leakage

Note content must not appear in:

- API logs;
- worker logs;
- audit metadata;
- diagnostics;
- event failure details;
- ordinary domain event payloads.

## Search

Search documents are account-scoped. They may index title, plain-text projection, tags, folder name, saved-source title and saved-source author where permitted.

Deleted records are tombstoned and excluded from active search results.

## Enforcement

The host enforces:

- active account ownership on every record access;
- module enabled state before record actions;
- granted collection capabilities;
- `NOTE_REVISION_CONFLICT` on stale writes;
- confirmation before permanent deletion;
- quarantined release blocking.
