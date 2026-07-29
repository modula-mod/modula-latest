# Phase 7E Platform Expansion

Phase 7E is now treated as a platform-maturity phase before broad frontend expansion. The priority is to finish the backend substrates that future AI, module, Notes, DIMON, connector, automation and Product Hub features will share.

## Priority Order

1. Complete Greenfield backend maturity: API contracts, events, search, observability, ownership, idempotency, optimistic concurrency, pagination, filtering, sorting, version headers and deprecation metadata.
2. Publish Modula Module Standard 1.0 as an independently versioned public specification and package.
3. Build the developer SDK, validator, CLI, module templates, compatibility tooling, signing support and release automation.
4. Complete the immutable module registry, compatibility resolver, update channels and rollback flow.
5. Deliver Vault Notes 1.0 as the reference module and Modula knowledge centre.
6. Build the AI platform, prompt registry, context builder, memory controls and social AI surfaces.
7. Complete the first production connector, GitHub, then Nextcloud.
8. Introduce the automation platform across Notes, AI, modules and connectors.
9. Deliver the DIMON internal testnet, wallet, append-only ledger, validator and explorer.
10. Finish production backup, migration, deployment, live acceptance, merge and branch cleanup.

## Backend Maturity Scope

Every Greenfield endpoint must converge on a common operational contract:

- generated OpenAPI and typed SDK coverage;
- request and response validation;
- request IDs and correlation propagation;
- account and actor ownership checks;
- audit events for consequential writes;
- idempotency for repeatable writes;
- optimistic concurrency where records can be edited;
- cursor pagination, filtering and sorting standards;
- API version headers and deprecation metadata;
- sanitized error envelopes with no stack traces, SQL errors, provider payloads or secrets.

## Internal Event Bus

Greenfield domain events are append-only facts. They are separate from immediate worker jobs, though worker jobs may later subscribe to them.

Initial flow:

```
domain write transaction
  -> audit event
  -> current transactional outbox jobs
  -> greenfield domain event
```

Future subscribers can fan out from the same event:

- notifications;
- unified search indexing;
- AI indexing and context refresh;
- analytics;
- automations;
- DIMON audit anchoring;
- connector synchronization.

The event payload rule is record references and operational metadata only. Post bodies, note content, connector tokens, provider responses and credentials do not belong in event payloads.

## Search Platform

Search becomes a backend capability, not a module-specific implementation detail. The long-term indexable surfaces are posts, comments, profiles, modules, tasks, CRM records, Vault Notes, marketplace listings, AI conversations, files and connector resources. Retrieval must enforce visibility and ownership before content enters ranking or AI context.

## Module Standard 1.0 Expansion

The standard is treated as a specification, not only a package. It must define lifecycle, compatibility, capability negotiation, rendering, actions, permissions, storage, networking, versioning, upgrades, declarative migrations, trust, validation, signing, rollback, diagnostics and observability.

Compatibility metadata should include:

- `standardVersion`;
- `supportedStandards`;
- `minimumStandard`;
- `maximumStandard`;
- `deprecatedStandards`;
- host and platform requirements.

Module capability negotiation must allow modules to request capabilities such as AI, search, notifications, graph, files and connectors, then degrade when the host declines or lacks a capability.

Module diagnostics should expose health, startup, runtime, dependencies, permissions, capabilities, warnings, errors, storage and performance so Product Hub can present real status.

## Vault Notes Direction

Vault Notes becomes the reference Standard 1.0 module and the Modula knowledge centre. Phase 7E should build the durable notes substrate first, then AI workspace features, rich attachments, backlinks, graph metadata, exports and offline-first synchronization foundations. AI actions must respect explicit user policy before note content is sent to providers.

## AI Platform Direction

AI is a governed Greenfield service. The platform owns provider adapters, model registry, prompt registry, context builder, structured outputs, streaming, usage accounting, data boundaries and inspectable memory. Frontend surfaces request AI actions through Greenfield only.

## DIMON Direction

DIMON is a platform layer, not a public financial promise. Phase 7E targets wallet, ledger, deterministic genesis, permissioned validator operation, signed test transactions, blocks, balances, explorer API and Modula identity linkage. Marketplace payments, public token claims and production transfers remain later gated work.

## Observability Direction

Each major subsystem must expose structured diagnostics: API latency, worker queue depth, connector health, AI provider health, module runtime health, Notes synchronization status, DIMON node health, automation execution statistics, storage utilization and cache performance. These diagnostics should later power a System Health or Developer surface without adding ad hoc debug UI to each feature.
