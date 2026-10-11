# Universal module runtime contract (MP02)

Status: **frozen for MODULE-PLATFORM-02 implementation**

Base: `d13bb309fd09a8025733bf44fab4033591b485b6`

This contract is module-neutral. Account and installation scope are derived by
the server from authenticated ownership and the selected installation; clients
must not gain access by asserting either scope.

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
