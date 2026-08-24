# PVP Platform Phase 2 event and job runtime

## Existing infrastructure retained

Phase 2 uses the existing PostgreSQL domain-event registry, transactional
outbox, event subscriptions/deliveries/inbox, leased background jobs, and
Greenfield worker. It does not introduce Kafka, NATS, or a second broker.

## Event ownership

Modules publish versioned events, for example `vault.note.updated.v1`. The
record service chooses the module-declared event name when available and emits
only after the owning record transaction. Extensions declare subscriptions in
their immutable manifest and must hold the target capability ending in
`.events.subscribe`.

Install creates two linked registrations:

- account/product-scoped `greenfield_extension_event_subscriptions`;
- generic `greenfield_event_subscriptions` targeting
  `extension.event.dispatch`.

The generic filter includes both account and target product. Enabling requires
an active grant; disabling, quarantine, or uninstall disables/removes delivery.

## Delivery guarantees

Delivery is at least once. The existing event inbox and unique execution
idempotency key make the extension projection idempotent. Event type suffixes
carry the schema version. Retry and dead-letter behaviour remain owned by the
existing worker runner.

The extension event handler receives a redacted envelope, rechecks account,
product, enabled installation, and capability grant, then creates one extension
job. A mismatched account or target returns without creating work.

## Jobs

Only an enabled, declared `background.action` contribution can be enqueued by a
client. Each execution records:

- owner account and extension installation;
- extension/target/action;
- attempt and maximum attempt counts;
- idempotency key and request ID;
- input hash and redacted metadata;
- lifecycle timestamps and safe failure code.

The lifecycle is `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `RETRYING`, or
`CANCELLED`. Private content keys are replaced with `[redacted]`; note content
is never an operational job field.

## Vault Notes events

The reference release declares:

- `vault.note.created.v1`
- `vault.note.updated.v1`
- `vault.note.deleted.v1`
- `vault.note.archived.v1`
- `vault.collection.created.v1`
- `vault.collection.updated.v1`

Optional subscriber failure cannot roll back or block the core Vault Notes
operation.
