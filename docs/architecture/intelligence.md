# Governed Intelligence (GAI-01)

**Status:** Greenfield governed-intelligence foundation
**Canonical rule:** GAIA proposes. AKI verifies. The Governor authorizes. The Runtime executes. The Ledger remembers.

## Runtime separation

Greenfield owns shared and server authority: missions, structured plans, proposals, AKI decisions, Governor authorizations, approvals, the Command Layer, runtime dispatch, evidence references, Circuit definitions, and the persistent Ledger.

`modula-native` owns device-local intelligence: `ModulaIntelligence`, local provider routing, Apple system inference, future Modula local models, and bounded offline execution. Greenfield does not control a Swift model directly, and a native provider does not become GAIA. A later phase may connect the runtimes through explicit capabilities and APIs.

```text
USER / MODULE / SYSTEM OBJECTIVE
                │
                ▼
              GAIA             What should we do?
                │
                ▼
       STRUCTURED PROPOSAL
                │
                ▼
               AKI             Is it valid, permitted, evidenced and safe enough?
                │
                ▼
          AGI GOVERNOR         Is it autonomous, supervised, human-required, or blocked?
                │
                ▼
        APPROVAL (if needed)
                │
                ▼
         COMMAND LAYER         Is this exact command still valid now?
                │
                ▼
         MODULA RUNTIME        Perform the registered capability.
                │
                ▼
         GOVERNED LEDGER       Record what actually happened.
```

Within Modula, “AGI” names the Governor subsystem. It is not a claim of human-level intelligence.

## Package boundaries

| Layer | Location | Responsibility |
| --- | --- | --- |
| Provider semantics | `@modula/intelligence-core` | Provider, privacy, local/remote routing, generic tools |
| Governed domain | `@modula/intelligence-contracts` | Missions, plans, proposals, decisions, approvals, executions, evidence, ledger, circuits |
| Deterministic governance | `@modula/intelligence-governance` | GAIA planner interface, deterministic planner, AKI v0, Governor v0, Command boundary rules |
| Persistent runtime | `services/greenfield-api/src/intelligence` | Ownership, persistence, state changes, runtime revalidation, API orchestration |
| Real capability runtime | Existing Greenfield module runtime | Account-scoped record query/create and future registered actions |

Contracts do not depend on React, Swift, Fastify, Kysely, database clients, or model SDKs.

## GAI-01 planner

`GaiaPlanner` is provider-neutral. GAI-01 installs `DeterministicTestPlanner` solely for CI and reproducible acceptance. It supports these explicit fixtures:

- `Find my five most recently updated Vault Notes.` → owner-scoped `record.query`, limit 5, `updatedAt DESC`.
- `Create the isolated GAI-01 approval fixture note.` → owner-scoped `record.create` with a database-backed idempotency key and human approval.
- Unknown-capability and financial fixtures used to prove blocking.

No paid model API, orchestration framework, or model provider is required. Dynamic planning belongs to GAI-02.

## Mission lifecycle

The application and PostgreSQL both enforce the state graph:

```text
draft → planning → awaiting_verification → awaiting_authorization
                                              ├─→ running → completed
                                              └─→ awaiting_approval → running → completed
```

`failed`, `cancelled`, and `blocked` are terminal alternatives. Terminal missions cannot return to `running`. Meaningful changes append Ledger events; projection rows may update independently.

## AKI v0

AKI is an independent decision fabric, not a second call to GAIA's model. GAI-01 performs deterministic schema, registration/capability, permission, risk, evidence, and policy checks. Stable check reason codes are persisted.

- Malformed action or missing permission → `deny`.
- Unknown capability or unknown risk → abstain/deny, never autonomous.
- Financial capability → `deny`; GAI-01 contains no financial executor.
- Unsupported derived “model reasoning” is not accepted as evidence.
- No required evidence → `INSUFFICIENT_EVIDENCE`; no optional evidence → `NO_EVIDENCE`.

The `DecisionEngine` contract permits future deterministic validators, policy engines, local/specialist/frontier models, and ensembles without making a provider “AKI”.

## Governor v0

| Input | Authorization |
| --- | --- |
| AKI allow + permitted read-only | `autonomous` |
| Reversible write | `human_required` |
| Irreversible write | `human_required` |
| External side effect | `human_required` |
| Privileged action | `human_required` |
| AKI abstain | `human_required` |
| AKI deny | `blocked` |
| Financial | `blocked` |

The invariant `AKI deny → autonomous` is impossible in the policy and explicitly tested.

## Command Layer and runtime

Immediately before execution, the Command Layer checks proposal/authorization identity, allowed capability, current permission, current workspace access, current schema/registration, current approval, and existing execution state. The existing `GreenfieldModuleRecordService` rechecks installation, collection declaration, account ownership, and permission at the runtime boundary.

The Command Layer exposes no shell, JavaScript evaluation, raw SQL, filesystem, SSH, Docker, arbitrary HTTP, or unrestricted provider tool. Content and model output are data, not authority.

Mutations require a proposal idempotency key. `intelligence_runs.proposal_id` is unique, and `(mission_id, proposal_id, idempotency_key)` is unique. Row locks and conditional transitions prevent two workers or two approval resolvers from claiming the same side effect.

## Persistence and Ledger

Migration `056_gai01_governed_intelligence` adds normalized missions, plans, steps, proposals, evidence, AKI decisions, Governor decisions, approvals, runs, run steps, artifacts, Ledger events, Circuits, and Circuit revisions. Lifecycle and ownership columns remain relational and indexed; structured checks, payloads, and metadata use bounded JSONB.

The Ledger is append-only. PostgreSQL rejects `UPDATE` and `DELETE`. It records actor, mission, correlation, ownership, linked decision/execution/artifact identifiers, schema version, and sanitized payloads. Structural durations are recorded for planning, AKI, Governor, approval wait, execution, and the full mission. Metrics can be derived without using objectives or record content as labels.

Circuit cards/revisions are versioned and scoped. A successful mission never automatically activates a Circuit. Circuits remain subject to AKI, Governor, permission, approval, and Command checks.

## API representation

Authenticated routes under `/v1/intelligence` expose mission list/detail, start, Ledger, evidence, decisions, approvals, approval/rejection, and governed execution. Every lookup starts with owner authorization; UUID entropy is not authorization. Database rows are mapped into explicit lifecycle DTOs rather than being treated as the public contract.

## Kaizen and Atlas foundations

Durable identifiers relate mission → plan → step → proposal → decisions → approval → execution → artifact → Ledger. Outcomes, failure codes, decision results, timings, correlation IDs, and artifacts are retained for later Kaizen capture/classify/investigate/propose workflows and Atlas visualization.

GAI-01 performs no autonomous code, policy, or prompt changes; no deployment or merge; no automatic Circuit selection; and no visual Atlas work.

## Future native boundary

Native may later perform explicitly local-only, narrowly scoped operations offline. It may not fabricate server permissions, workspace authority, approvals, shared mission state, Governor authorization, or Greenfield Ledger events. Synchronization and reconciliation are separate future work.
