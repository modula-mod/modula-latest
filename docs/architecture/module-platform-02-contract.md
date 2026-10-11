# Universal module runtime contract (MP02)

Status: **frozen for MODULE-PLATFORM-02 implementation**

Base: `d13bb309fd09a8025733bf44fab4033591b485b6`

Addendum status: **frozen for MODULE-PLATFORM-02B completion**

This contract is module-neutral. Account and installation scope are derived by
the server from authenticated ownership and the selected installation; clients
must not gain access by asserting either scope.

## MP02B precision addendum

This addendum resolves implementation precision only; it does not replace or
redesign the frozen MP02 contract.

### Canonical mutation payloads

The server constructs the operation-specific payload; a client supplies
`mutationId`, never a trusted payload hash. After endpoint validation and
normalization, the server serializes the payload as deterministic JSON and
computes lower-case hexadecimal SHA-256 over its UTF-8 bytes.

- object keys are recursively sorted by Unicode code point; omitted object
  members are absent rather than equivalent to `null`;
- arrays preserve order and may contain explicit `null`, but may not contain
  holes or `undefined` values;
- strings, including object keys, are normalized to Unicode NFC before
  serialization;
- numbers must be finite JSON numbers; `NaN`, infinities and arbitrary-precision
  integer values are rejected, and negative zero canonicalizes as `0`;
- booleans and `null` use JSON literals;
- timestamps are validated and normalized to RFC 3339 UTC with millisecond
  precision before serialization;
- a record reference hashes as the exact normalized object
  `{moduleId,recordType,recordId}`; aliases are resolved before hashing;
- a media identity hashes as its authoritative asset ID plus normalized binding
  fields. Filenames, delivery URLs and other mutable presentation metadata are
  not substitutes for asset identity.

The canonical payload includes operation, canonical record identity, normalized
operation body and precondition (`expectedRevision` where required). Equal
`mutationId` plus equal canonical payload returns the stored original result;
equal `mutationId` plus any different canonical payload is
`MUTATION_REUSE_CONFLICT`.

### Revisions and purge

Revision is a monotonically increasing positive integer scoped to
`{account,moduleId,recordType,recordId}`. Once allocated it is never reused.
Create allocates 1; update, delete and restore each allocate the next value.
Restore copies readable historical content into a new current revision and
never edits history. Re-creation after delete continues the sequence rather
than replacing historical rows. Privacy purge is a distinct destructive
lifecycle: current content and normal history may be physically removed under
account/privacy policy, a non-content purge marker/change may remain, and old
sync cursors may be invalidated. Recovery after a production purge is by the
documented backup/restore process, not revision reuse.

### Sync cursor and tombstones

Cursor internal format v1 is an authenticated envelope containing only
`version`, canonical account scope, installation scope, module scope and last
ordered change sequence. It is base64url encoded and HMAC-SHA-256 signed. It is
opaque to clients; unknown versions, invalid signatures, wrong scope and
expired retention fail as `INVALID_CURSOR`.

Tombstone kinds are:

- `deleted`: the caller is still entitled to identify the record; identity and
  latest revision may be returned, never deleted content;
- `visibility-lost`: the client receives only an opaque cache-eviction key it
  already obtained while authorized and no title, owner, share state or other
  current record metadata;
- `purged`: the caller may receive an opaque eviction marker when already in
  scope; otherwise the cursor is invalidated without confirming existence.

Share expiry/revocation and policy changes are evaluated at read time. A stale
index, cursor or cached share never extends access.

### Shared-editor media contribution

An active `edit` share may bind an asset the recipient legitimately owns or is
otherwise authorized to use. The binding belongs to the shared record; the
asset remains owned by its original owner and is never silently transferred.
Record access governs binding visibility. Share expiry/revocation removes the
recipient's access to the record and its bindings without deleting the owner's
asset. Unbinding does not delete the asset.

### Host function request lifecycle

A host request has stable request identity and exactly one state transition
path: `created -> dispatched -> completed`, or from a non-terminal state to
`cancelled`, `timed-out`, `host-unavailable`, or `module-unloaded`. Completion
is accepted once, validates the declared output schema and is rejected after a
terminal state. Cancellation is best effort but terminal server state wins;
late/duplicate completions cannot create side effects. Timeout is declared or
platform-bounded and begins when dispatched. MP02B defines negotiation and
lifecycle only; it does not execute native code.

### Inter-module request capability

The canonical capability is
`module.action:request:<targetModuleId>:<actionId>:<version>`. It must be
requested by the source release and explicitly granted by its exact-release
permission review. A wildcard is not implied. The target separately declares
the action and applies its own invocation policy.

### Capability provenance and Product UI versions

Every host capability descriptor states provenance as one of `native`,
`fallback`, `emulated`, or `unavailable`, with capability ID, semantic contract
version, renderer/provider identity where applicable, availability, limits and
an explicit fallback descriptor. Emulation may not claim native provenance.

Product UI uses contract version `1.0.0` for the MP02 primitives. Each primitive
declaration carries that version, typed input model, emitted events/actions,
required and optional capability IDs, explicit fallback, and loading, empty and
error states. Any incompatible semantic change requires a new contract version;
renderer-only improvements do not.

## Canonical identities

```ts
type RecordIdentity = {
  moduleId: string
  recordType: string // current storage name: collection
  recordId: string
}

type RevisionIdentity = RecordIdentity & { revision: number }

type MutationIdentity = {
  mutationId: string // client stable, max 200, installation scoped
  payloadHash: string // server calculated canonical SHA-256
}

type SyncCursor = string // opaque, signed/versioned, scope-bound

type RecordReference = {
  record: RecordIdentity
}

type MediaBindingIdentity = {
  bindingId: string
  record: RecordIdentity
  assetId: string
}

type ShareIdentity = { shareId: string; record: RecordIdentity }

type FunctionIdentity = {
  moduleId: string
  functionId: string
  version: string
}

type InterModuleActionIdentity = {
  targetModuleId: string
  actionId: string
  version: string
}

type SearchProjectionIdentity = {
  kind: 'module-record'
  moduleId: string
  recordType: string
  recordId: string
}
```

Record IDs need only be unique inside `{account, moduleId, recordType}`. API
responses never expose another account's identity. Existing globally unique IDs
remain valid.

## Authorization invariant

Every runtime operation starts with:

1. authenticated account;
2. owned installation (foreign installations are `NOT_FOUND`);
3. published, cryptographically trusted release;
4. enabled installation when execution/data access is requested;
5. completed permission review for the exact release;
6. effective capability grant;
7. operation-specific record/share/media policy.

Manifests request permissions; they never grant them. Missing review grants
nothing. Sharing grants only the named record operation and never grants module
functions, settings, unrelated records or other module operations.

## Settings permissions

- `settings:register`: release may declare a settings schema/defaults.
- `settings:read`: installation may read its effective non-secret settings.
- `settings:write`: installation may change its settings. Write does **not**
  imply read; the write response is an acknowledgement/version unless read is
  also granted.

Historical `settings:register` consent is not upgraded. A release newly asking
for read/write enters `PERMISSION_REVIEW_REQUIRED` unless the accepted review
literally contains the requested capability. Explicit denial remains denied.

## Records, relationships and history

All create/update/delete/restore operations require `mutationId`. Update,
delete and restore require `expectedRevision`. Reuse of a mutation ID with the
same canonical payload returns the original result; reuse with a different
payload is `MUTATION_REUSE_CONFLICT`.

A successful mutation atomically writes current state, immutable revision,
mutation ledger, normalized references, sync change, audit entry and outbox
event. Revision metadata contains actor identity, timestamp, base revision,
resulting revision, mutation identity and operation. No update or delete is
permitted on revision rows through API/worker roles.

References are extracted only from fields declared as reference fields and are
validated as `RecordReference`. Forward reads and reverse queries apply current
visibility/share policy. A reverse query accepts a target identity and optional
source record type/field-path filters; inaccessible source records are omitted
without revealing counts.

History operations are:

- list revisions (metadata only by default);
- get a specific readable revision;
- get current revision identity;
- restore a selected revision as a new mutation.

Restore never changes or deletes a prior revision.

## Incremental sync

`sync(after, limit)` returns ordered changes, tombstones, the latest revision
identity and `nextCursor`. The cursor is opaque, versioned and cryptographically
bound to account, installation and module. Invalid scope/signature/retention is
`INVALID_CURSOR`.

Every page is authorized against current policy. A cursor never carries access.
Permission/share revocation must remove the record from subsequent readable
state and emit a visibility tombstone when safe; it must not reveal a record
the caller can no longer identify. Physical privacy purge may invalidate older
cursors according to documented retention.

## Media bindings

Module records reuse the attachment asset and delivery platform. Bind, unbind,
list and reorder operate on:

```ts
type MediaBinding = MediaBindingIdentity & {
  fieldPath?: string
  role?: string
  order: number
  caption?: string
  mediaType?: string
  filename: string
  size: number
  contentType: string
  createdAt: string
}
```

Binding requires asset ownership/authorized access, matching account and
installation scope, the module capability and edit access to the record. A
binding never makes an arbitrary asset readable by ID alone.

## Record sharing

A record share names owner, recipient account, `read|edit`, optional expiry and
revocation time. Create/revoke are idempotent audited transactions. Expired or
revoked grants fail closed. Link sharing is outside MP02 unless an existing
platform link-token contract can satisfy the same policy.

## Functions and inter-module actions

A function declaration includes identity/version, input/output JSON schemas,
required permissions and execution mode:

- `host`: invoked by a host capability; server returns
  `CAPABILITY_UNAVAILABLE` when no host executor is negotiated;
- `server`: only a platform-reviewed registered implementation may run;
- `remote`: disabled by default; only a reviewed trusted backend registration
  and network policy may enable it;
- `community`: unsupported and fails `FUNCTION_NOT_AVAILABLE`.

Invocation checks the authorization invariant, declared function, all required
permissions, input schema, allowed mode and output schema. It records a
redacted invocation ledger/audit entry. No manifest embeds executable code.

Inter-module actions identify the authenticated source installation from its
runtime credential, not a caller-supplied module ID. The target installation
must be owned/authorized, enabled and trusted; the action must be declared by
the target; the source must have a reviewed request capability; the target must
allow invocation; and input/output must validate. The target owns all writes.
There is no cross-module table access.

## Search projection

A collection declares indexable fields. The generic projector converts record
events to a `module-record` document with allowlisted text/metadata and the
canonical projection identity. Delete/purge/share/permission changes produce
appropriate removal or visibility updates. Search applies the same current
record access evaluator as direct get; the index is never authority.

## Intelligence

```ts
type IntelligencePolicy = 'localOnly' | 'preferLocal' | 'allowRemote'
type IntelligenceTask =
  | 'summarize' | 'rewrite' | 'classify' | 'extract'
  | 'semantic-related' | 'question-answer'
```

Modules submit task, policy, input, optional structured output schema and stream
preference without naming a provider. `localOnly` is a host-only request and
MUST NOT transmit content to GreenField or any remote provider. `preferLocal`
uses host execution when negotiated and may fall back only within reviewed
privacy policy. `allowRemote` still requires provider authorization and data
classification policy.

Capability discovery reports provider class (`local|remote`), tasks, maximum
input, streaming and accepted privacy classes. GreenField orchestrates remote
eligible work; it never claims to execute the user's on-device Nodus model.

## Product UI and host capability discovery

Product UI primitives are semantic, renderer-neutral and versioned. MP02
defines contracts for `RichDocumentEditor`, `EditorToolbar`, `PropertyEditor`,
`ReferencePicker`, `AttachmentGallery`, `RevisionBrowser`, `Graph`,
`RecordTable`, `RecordBoard` and `CommandMenu` in addition to existing basic
primitives.

`host.capabilities` returns semantic capability IDs, version, availability,
renderer, optional fallback and limits. Required capabilities block a view;
optional unavailable capabilities activate only a declared fallback. A renderer
must never mark a primitive available by rendering an uninformative generic
box.

Future native renderers map Button, Search, Menu, Toolbar, Sheet, Form and List
to platform controls. Business contracts refer to `biometrics`, `share`,
`mediaPicker`, `backgroundTask` and `secureStorage`, never SwiftUI/UIKit, Face
ID, `UIActivityViewController` or Apple filesystem paths. The same semantics
must be implementable by a future Android ModuleHost.

## Canonical errors

MP02 adds or normalizes: `PERMISSION_REVIEW_REQUIRED`,
`MODULE_PERMISSION_DENIED`, `INSTALLATION_DISABLED`, `UNTRUSTED_RELEASE`,
`REVISION_CONFLICT`, `MUTATION_REUSE_CONFLICT`, `INVALID_CURSOR`,
`FUNCTION_NOT_AVAILABLE`, and `CAPABILITY_UNAVAILABLE`. Foreign ownership is
`NOT_FOUND`. Compatibility aliases are explicit, bounded and test-covered.
