# MP02B generic search and intelligence broker

Status: integration candidate
Base: 5ed0382db158a051190b1ef6119028815d3c60c9

This document records the runtime boundary implemented by the search and
intelligence lane. It clarifies the frozen MP02 contract without changing it.

## Generic module-record search

Normal record mutations emit 'module.record.changed' inside the same database
transaction as record state, revision, sync and product events. Migration 071
registers one generic search subscription. Historic Vault subscriptions remain
temporarily enabled for rolling-deploy and replay compatibility; the worker
routes both forms into the same product-neutral projector.

The projection identity is moduleId + recordType + recordId; the stored search
entity ID is an opaque composite including owner scope so equal record IDs in
different accounts or modules cannot collide. A collection is indexed only
when its active declaration has non-empty searchableFields. Search text, title,
tags and display metadata are derived only from declared, non-sensitive fields.
A missing or withdrawn declaration produces a hidden tombstone. The index never
makes a record public.

Every result is re-authorized against current state. The caller must have a
trusted, enabled installation, exact-release permission review and the reviewed
record-read capability. A non-owner additionally needs an active, unexpired
record share and reviewed share-read capability. Delete, revoke and expiry
therefore fail closed even if a stale active document remains in the index.
Share and record identity outside the allowed result metadata are not returned.

## Universal intelligence broker

The module request is provider-neutral:

- task: summarize, rewrite, classify, extract, semantic-related, or
  question-answer;
- policy: localOnly, preferLocal, or allowRemote;
- input and privacy class;
- optional output JSON schema; and
- optional stream preference.

Provider discovery is versioned and reports provider class, supported tasks,
maximum input, streaming, accepted privacy classes, provider version and actual
availability. Provider results are validated against the requested supported
JSON-schema subset before being returned.

The execution boundary is structural:

- a local provider must use host-capability transport;
- a remote provider must use greenfield-remote transport;
- localOnly reads and calls only the local slot;
- preferLocal considers remote only after all remote authorization gates;
- allowRemote still requires trusted release, exact review, capability grant,
  module remote policy, data-classification permission and provider permission.

Provider absence returns CAPABILITY_UNAVAILABLE; exact-review absence returns
PERMISSION_REVIEW_REQUIRED; a denied module capability returns
MODULE_PERMISSION_DENIED; and an untrusted release returns UNTRUSTED_RELEASE.
There is no silent policy downgrade.

The network-instrumented SDK test installs a remote executor whose only action
is an HTTP request, issues localOnly with no host provider, and proves both the
executor and fetch were called zero times. This is the server/runtime
negotiation boundary; MP02B does not implement on-device Nodus inference.

## Product UI and host provenance

All ten advanced Product UI primitives publish versioned descriptors covering
input bindings, events, actions, required and optional capabilities, fallback
behavior, and loading/error/empty states. Host capability discovery reports
native, fallback, emulated, or unavailable provenance plus renderer, provider
and bounded constraints. String-list constraints support truthful intelligence
task/privacy discovery without allowing unbounded host metadata.
