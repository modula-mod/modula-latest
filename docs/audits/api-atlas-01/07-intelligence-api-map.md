# GreenField Intelligence API Map

## Surface and production state

Eleven authenticated mission routes cover create, list, detail, start, ledger, evidence, decisions, approvals, approve/reject and proposal execution under `/v1/intelligence/missions`. Production rows: missions=0, plans=0, proposals=0, AKI decisions=0, Governor decisions=0, approvals=0, runs=0, ledger events=0.

The contract and enforcement pipeline exists, but no live mission has exercised it in production.

## GAIA

- `services/greenfield-api/src/intelligence/service.ts:18` wires the deterministic planner from `packages/intelligence-governance`.
- `gaia.ts:10-86` recognizes four exact acceptance objectives and otherwise returns `CAPABILITY_UNKNOWN`. This is an operational fixture, not a general planner.
- Mission/plan/action/evidence/failure state are persisted through repository methods.

## AKI

`packages/intelligence-governance/src/aki.ts:103-141` enforces schema, declared capability, permission, evidence, policy and risk. Verdict semantics observed in code:

| Verdict | Handling |
| --- | --- |
| ALLOW | Only eligible read actions can proceed autonomously |
| ALLOW_WITH_CONDITIONS | Conditions remain attached and Governor decides next state |
| REQUIRE_APPROVAL | Human approval row/token required before command execution |
| DENY | Governor records blocked; no autonomous execution |
| ABSTAIN | Governor records human_required; no autonomous execution |

## Governor and approvals

`governor.ts:176-189` maps DENY to blocked and ABSTAIN to human-required. Non-read writes require approval. Approve/reject endpoints are account-scoped and the command layer validates approval identity, expiry and completion state.

## Command layer and ledger

`command.ts:204-224` rechecks actor identity, capability, permission, workspace, payload schema, approval state and expiry, then atomically claims execution for idempotency/replay resistance. Repository transitions and ledger appends link mission, action, actor, decision, evidence/result/failure and timestamps. The discovered HTTP execution path cannot skip these checks.

The current runtime boundary in `services/greenfield-api/src/intelligence/action-boundary.ts` supports only Vault record query/create. Direct ordinary module record APIs exist outside the mission ledger by design; governed actions must not call them without the command boundary. No separate intelligence action bypass was found statically.

## Provider reality

| Provider | State | Mode |
| --- | --- | --- |
| provider:anthropic | unconfigured | platform-managed |
| provider:development-mock | available | development-mock |
| provider:gemini | unconfigured | platform-managed |
| provider:local | unconfigured | local |
| provider:ollama | unconfigured | local |
| provider:openai | unconfigured | platform-managed |

Models: available:active:enabled=true=1, unavailable:preview:enabled=false=5. Credentials=0, requests=1, executions=0, streams=0, product actions=0. The sole available model is a development mock and the production resolver excludes development mocks (`services/greenfield-api/src/ai/providers/resolver.ts:53`). No real provider is operational.

## Nodus readiness

Reusable mission/plan/proposal/evidence/decision/approval/ledger contracts are a viable boundary for local intelligence. Missing: a Nodus-named adapter, local handshake, capability advertisement, offline proposal transport, reconnect/conflict semantics and approval/ledger synchronization. Nodus must remain local/offline; it is not represented as a cloud provider.

## Real-time surface

`GET /v1/ai/executions/:executionId/stream` is SSE event replay. It is not a persistent social/intelligence socket, nginx has no WebSocket upgrade and no APNs/web-push subscription infrastructure was discovered.
