# MP02B contract addendum

Status: **frozen clarification**  
Parent: `module-platform-02-contract.md`  
Candidate base: `5ed0382db158a051190b1ef6119028815d3c60c9`

This addendum clarifies MP02; it does not replace or redesign the frozen
contract.

## Canonical mutation payloads

The server, never the client, calculates `payloadHash` as lower-case hexadecimal
SHA-256 over UTF-8 bytes of canonical JSON. Canonical JSON recursively sorts
object keys by Unicode code point, preserves array order, emits booleans and
`null` as JSON literals, rejects non-finite numbers, normalizes negative zero to
zero, and uses the shortest round-trippable JSON number form. Strings are valid
Unicode and are preserved without compatibility or case normalization. An
omitted object property is absent; an explicitly supplied `null` is present and
therefore hashes differently. API timestamps are parsed, validated and emitted
as UTC RFC 3339 with millisecond precision before hashing.

Record references hash as `{record:{moduleId,recordType,recordId}}` after module
identity alias resolution. Media references hash by stable platform `assetId`;
mutable filename, caption and delivery URL are not an asset identity. A record
mutation hashes its canonical module ID, record type, operation and normalized
payload. `mutationId` is ledger identity and is not included in its payload
hash. Same ID and hash returns the stored result; same ID and a different hash
is `MUTATION_REUSE_CONFLICT`.

## Revisions and purge

Revision is strictly monotonically increasing for
`{ownerAccount,moduleId,recordType,recordId}`. Numbers are never reused. Delete
and restore append revisions; restore never edits its source snapshot. A shared
editor's mutation appends to the owner's same revision line and records the
recipient actor. Recreating a logically similar record under a new record ID
starts a distinct line.

Privacy purge physically removes current state and may cascade auxiliary media
bindings and shares. Immutable revision retention or erasure follows account
privacy policy; it is not represented as a reversible edit. Operational
recovery after post-migration writes is backup/restore, not an assertion that a
down migration can reconstruct purged or newly written data.

## Sync cursor and tombstones

The MP02 cursor payload is version `1` and contains only version, account,
installation, canonical module ID and last global change sequence. It is
HMAC-SHA-256 signed and base64url encoded. Cursor content is an internal format;
clients treat it as opaque.

Tombstone reasons are `deleted`, `visibility-lost`, and `purged`. A deletion may
return the previously visible record identity and terminal revision. A
visibility-lost tombstone is emitted only to a recipient installation that
previously had access and contains no title, owner identity, share state, data
or media metadata. Purge invalidates inaccessible historical material and may
invalidate an old cursor under retention policy. Media add/remove/reorder and
metadata changes are ordered `resourceChanges` in the same cursor sequence.

## Media and sharing policy

Canonical media permissions are
`media:module.<moduleId>.<recordType>:read|write`; canonical sharing permissions
are `sharing:module.<moduleId>.<recordType>:read|write`. They are independent of,
and additionally require, the corresponding reviewed record capability.

An edit-share recipient may bind a ready asset that the recipient owns. The
binding belongs to the owner's record, the asset remains owned by the recipient,
and the binding never transfers ownership. Record revocation/expiry immediately
removes recipient access to the record, binding metadata and bytes. Knowledge of
an asset or binding ID grants no access.

Shares are account-named, record-level grants. Recipients must also have their
own trusted, enabled installation and exact-release reviewed record and sharing
capabilities. A share never grants settings, functions, actions, unrelated
records or module-wide search. Recipient history begins at that share's
`createdAt`; pre-share revision snapshots are not visible. Revoke and expiry fail
closed and sync emits a metadata-free `visibility-lost` tombstone.
