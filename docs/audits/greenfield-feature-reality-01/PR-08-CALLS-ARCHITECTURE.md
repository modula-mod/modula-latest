# GREENFIELD FEATURE REALITY 01 — PR-08 Calls architecture

Date: 2 November 2026
Mission item: PR-08
Repository: `modula-mod/modula-latest`
Branch: `docs/qa-calls-signalling`
Base SHA: `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`
Environment: source-level design candidate only
Production deployment: prohibited and not performed

## Completion record

MISSION ITEM: PR-08 — CALLS ARCHITECTURE DESIGN ONLY
STATUS: PASS — design deliverable only; no runtime capability is claimed
BRANCH: `docs/qa-calls-signalling`
PR URL: pending draft PR publication
BASE SHA: `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`
HEAD SHA: The draft PR head is authoritative after publication
ROUTES ADDED: 0 implemented routes; 14 HTTP proposals and 1 WebSocket proposal are isolated as design vocabulary
ROUTES MODIFIED: 0
ATLAS UPDATED: NO — intentional; proposed calls contracts are not implemented capabilities
MIGRATIONS: NONE; conceptual records are documented only
TESTS PASSED: custom design-contract validation PASS for 14 routes, 0 duplicate method/path pairs and 0 implemented-Atlas collisions; API Atlas 95/95 assertions
TESTS FAILED: 0
TESTS SKIPPED: runtime, integration, Native and physical-device tests are not applicable to this documentation-only workstream and are not reported as passed
SECURITY RESULTS: PASS for design threat model covering authorization, blocking, replay, signalling injection, TURN theft, abuse, privacy, retention and sensitive-log controls
QA INTEGRATION RESULTS: NOT RUN — runtime implementation is explicitly prohibited by this mission item
NATIVE COMPATIBILITY: DESIGN GAP RECORDED — current Native main has ordinary APNs and messaging but no CallKit, PushKit, WebRTC, calls repository or calls UI
BLOCKERS: implementation approval; media topology/provider; TURN/SFU procurement and failover; PushKit entitlement; retention/privacy approval; Native implementation; multi-replica realtime infrastructure; physical-device acceptance
APPROVAL REQUIRED: Andy for implementation, infrastructure procurement, retention policy, Native enablement, deployment and any production capability claim

## Delivered design

The design specifies secure future 1:1 audio and video calls bound to accepted direct-message conversations. PostgreSQL remains authoritative for identity, participants, lifecycle revisions, immutable terminal results and audit history. A dedicated authenticated WebSocket relays ephemeral offer/answer and ICE signalling across API replicas through Redis; WebRTC carries encrypted media directly where possible and through mandatory TURN fallback.

The state machine covers start, ringing, accept, decline, cancel, missed, connect, active, disconnect, ICE restart, reconnect, end and failure. Idempotency, optimistic revisions, ordered actor locks, first-device-wins acceptance, worker deadline races and crash recovery are explicit.

The proposed contract file defines strict request shapes, authorization, errors, idempotency and concurrency for:

- call creation, recovery, history and lifecycle commands;
- single-use signalling tickets and short-lived media credentials;
- separate PushKit VoIP device registration bound to existing server-owned device identities;
- server-backed call privacy settings;
- WebSocket authentication, frames, events, limits, ordering and recovery.

The architecture also defines PushKit/CallKit behavior, foreground/background/cold-launch handling, microphone and camera permission boundaries, STUN/TURN requirements, P2P encryption claims, relay-only privacy, rate limits, retention, observability, infrastructure options and future SFU/group-call extensibility.

## Capability isolation

- No Fastify route, schema, migration, worker, socket, nginx rule, feature flag or Native file was added or changed.
- Proposed routes are marked `design-only`, `implemented: false`, `deployed: false` and `atlasContract: false` in the machine-readable file.
- The implemented API Atlas remains unchanged and contains none of the proposed paths.
- The calls paths must not be advertised to Native or entered into the implemented Atlas until a separately approved runtime implementation passes its own database, security, realtime, TURN, PushKit/CallKit and physical-device gates.

## Repository and Native findings

- Existing direct conversations, memberships, message-request state and two-way block checks are the correct identity and policy boundary.
- The current GUBIC in-memory WebSocket hub is not durable or horizontally scalable enough for call signalling.
- Redis is present in the current composition but is not yet the API's shared realtime bus.
- The existing APNs worker provides useful transport primitives but its quiet hours, retry count and one-day expiry are unsafe for incoming-call semantics.
- The current nginx catch-all clears connection-upgrade headers and needs a dedicated reviewed WebSocket location if calls are approved.
- The observed single-VPS API/worker/Redis/PostgreSQL topology is not sufficient production redundancy for calling.
- Native remote main `e50fc3916fb4738b7c63b7bed92bef49a8076eb8` has ordinary push and messaging polling, but no call controls, CallKit, PushKit, WebRTC or call-state repository.

## Verification

The documentation candidate is checked for:

- valid machine-readable JSON;
- unique proposed method/path pairs;
- required design-only capability flags;
- explicit implemented-Atlas exclusion;
- complete required lifecycle states and commands;
- matching HTTP proposal counts between architecture and machine-readable contracts;
- trailing whitespace and patch integrity.

The Atlas verifier was run in a disposable detached worktree after a fresh candidate-runtime capture. All source-registered optional domains were explicitly enabled for capture, matching the maintained Atlas contract. It reported 535 application routes, 223 framework-derived routes, zero source-only routes, zero runtime-only routes and 95/95 passing assertions. Generated Atlas artifacts remained confined to the disposable worktree; this branch does not change them.

No runtime test, simulator test or physical-device test was executed or inferred. The future verification matrix in `CALLS-ARCHITECTURE.md` is a requirement for an approved implementation, not evidence from this PR.

## Rollback and recovery

This PR is documentation only. Reverting its commit removes the proposed design vocabulary and has no database, API, worker, Native, storage or deployment effect. It does not authorize a migration or operational change.

## Files

- `docs/audits/greenfield-feature-reality-01/CALLS-ARCHITECTURE.md`
- `docs/audits/greenfield-feature-reality-01/calls-state-machine.mmd`
- `docs/audits/greenfield-feature-reality-01/CALLS-PROPOSED-CONTRACTS.json`
- `docs/audits/greenfield-feature-reality-01/PR-08-CALLS-ARCHITECTURE.md`

## Decisions requiring Andy

The design records explicit approval decisions for implementation authorization, P2P versus SFU direction, provider and budget, relay-only policy, busy/call-waiting behavior, incoming-call privacy, retention and deletion, recording prohibition, push fallback, supported platforms, production SLOs, feature rollout and whether a dedicated security/privacy review is mandatory before Native enablement.
