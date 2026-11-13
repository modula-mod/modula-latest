# GF-MSG-01 — Messaging v3 two-account E2E harness (disposable stack)

Mission GF-MSG-01 (GF-RECON-01 queue #4). Base: `modula-latest` main
`a91d490e61ebfff38069378ddf757429eb000449`, migration tip `090_calls_v1`.
No migration, route, runtime, dependency or feature-flag change: the harness is
test tooling only.

## What it is

`tools/e2e/messaging-v3-two-account.mjs` stands up a throwaway stack and drives
it end to end. It:

1. refuses to start unless every URL is a literal loopback address
   (`127.0.0.1` or `[::1]`). `localhost`, any DNS name, `*.modula.digital` and
   `test.modula.*` are all refused (`tools/e2e/loopback-guard.mjs`). This is
   stricter than the mission text, pending ATLAS confirmation;
2. creates a fresh database `gf_msg_01_<run>` on the loopback Postgres and
   applies the full migration chain;
3. starts a **real API process** (`services/greenfield-api/dist/main.js`),
   bound to `127.0.0.1` on a free port, with a fixed development environment.
   It does not inherit the caller's `MODULA_*` variables, so a stray production
   setting cannot leak in;
4. registers two accounts (alice, bob) plus one outsider used only for denial
   checks. It uses development-mode email verification tokens and connects
   them through public HTTP routes only (follow, block, unblock, message
   requests). **The harness never writes to the database.** Actor ids come
   from the messaging socket's `hello` frame;
5. runs the scenario over HTTP and the messaging WebSocket (Node's built-in
   `WebSocket`, so there is no new dependency);
6. stops the API and drops the database (`--keep-db` keeps it). Exit code: 0
   when everything passed, 1 on a failed check, 2 when it refused to run.

## Run it (one command)

Prerequisites: a loopback-only disposable Postgres with a superuser that can
`CREATE DATABASE`, and the API built once.

```sh
pnpm install --frozen-lockfile
pnpm --filter "@modula/greenfield-api..." build
MODULA_E2E_ADMIN_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55533/postgres \
  node tools/e2e/messaging-v3-two-account.mjs          # add --json for a machine-readable report
node --test tools/e2e/loopback-guard.test.mjs          # guard unit tests
```

The admin URL above is a dummy credential for a local throwaway cluster, not a
secret. Never point this at a shared database.

## Acceptance matrix

| Case | What is asserted | Result |
|---|---|---|
| `setup` | 3 accounts via register → verify-email → session; follows via `POST /v1/profiles/:id/follow`; actor id via socket `hello` | PASS |
| `capabilities` | `version 3`, `voiceNotes`, `photoVideo:false`, `realtime.socketPath`, **`realtime.singleInstance:true`**; 401 without auth | PASS |
| `socket-auth` | upgrade with no token or a garbage token → 401 before the handshake; a valid bearer → 101 | PASS |
| `dm` | DM opens; for a follower it lands in the inbox, not in message requests | PASS |
| `realtime` | `message.created` reaches the member socket, without a body; the outsider socket gets nothing; typing on a foreign conversation → `not-found` | PASS |
| `reconnect` | bob's socket drops; 2 messages are sent; after reconnect the socket does **not** replay them, and the **REST thread has both** (REST is the source of truth); live events resume after reconnect | PASS |
| `receipts` | `readBy` lists the reader; `delivery: read`; outsider 404; with receipts off, `read` never shows; reciprocal `receiptsDisabled` / empty `readBy` | PASS |
| `typing` | published over REST and delivered on the socket; the privacy toggle stops publishing | PASS |
| `groups` | create; outsider 404 on read and post; a member cannot rename (403); owner promotes to admin; admin renames; mentions resolve to members only; realtime group event; leave → 404 | PASS |
| `presence` | contact online, non-contact hidden; `nobody` hides in both directions | PASS |
| `attachments-voice` | upload → voice note; member playback 200; outsider and anonymous 403; unsend revokes playback; `kind:media` refused (403) while photo/video is off | PASS |
| `privacy-search` | search and thread scoped to participants; outsider gets 0 hits and 404s | PASS |
| `idempotency` | 3 concurrent sends with one `clientMessageId` → one 201 + two 200, one message id, one REST copy | PASS |
| `blocks` | after a block neither side can send; the blocked message never reaches the blocker; the blocked user cannot be added to a group; unblock | PASS |
| `attachments-photo-video` | photo/video messages | **DEFERRED**: `photoVideo` is off by default and deliberately not enabled |
| `multi-instance-fanout` | socket fan-out across API replicas | **DEFERRED**: `realtime.singleInstance:true`; multi-replica fan-out is not implemented |

Local evidence: PostgreSQL 17.5 on `127.0.0.1:55533` (CI uses 16), Node
24.22.1. 14 cases PASS, 2 DEFERRED, 0 FAIL, 81 checks. Stable over repeated
runs, and every per-run database was dropped afterwards.

## Limitations

- Local, single-process, loopback acceptance only. This is not staging,
  device or production evidence, and it does not exercise nginx, TLS, APNs or
  multiple replicas.
- Push delivery content (preview / mute / mention rules) needs a registered
  device token, and no public route mints one without APNs, so it stays
  covered by `messaging-v3.integration.test.ts` (DB-level) rather than here.
- The API runs as the Postgres superuser on its own throwaway database, not
  through the restricted `modula_api` role.
- The harness is not wired into CI; it needs a built API and a
  `CREATE DATABASE`-capable loopback Postgres.
