# 1:1 calls: coturn, env, migration and ports (runbook)

Status: **documented, not deployed.** Nothing here has been applied to the VPS.
Andy approves every step below before it runs.

Calls stay hidden in every client until the API reports
`GET /v1/messaging/capabilities` → `calls.enabled: true`. That only happens when
`MODULA_CALLS_ENABLED=true` **and** TURN URLs, the TURN secret and the ticket
pepper are all set. With any of them missing, every call route answers
`503 CAPABILITY_UNAVAILABLE` (`details.reason = CALLS_UNAVAILABLE`).

## What ships

| Piece | Where |
|---|---|
| Migration `090_calls_v1` (+ `.down.sql`) | `services/greenfield-api/migrations/` |
| HTTP lifecycle, history, settings, TURN credentials, VoIP registration | `src/app/register-calls-routes.ts`, `src/domains/calls/` |
| Signalling WebSocket `/v1/calls/:callId/signalling` (single-use ticket, checked before the 101) | same |
| PushKit VoIP lane (separate from alert pushes) | `services/greenfield-worker/src/push/voip.ts` |
| coturn compose service | `ops/docker/compose.calls.yml` |
| coturn config template | `ops/coturn/turnserver.conf.template` |
| nginx WebSocket locations (messaging + call signalling) | `ops/nginx/api.modula.digital.greenfield.conf` |

## 1. DNS and TLS

1. `turn.modula.digital` → A `87.106.40.136` (and AAAA if IPv6 relay is wanted).
2. Issue a certificate for `turn.modula.digital` (same tooling as the API cert).
   Copy `fullchain.pem` / `privkey.pem` into `/etc/modula/turn-tls/` (0640,
   readable by the container user). Renewal must restart coturn.

## 2. Secrets and env

Generate once, store in the existing secrets location:

```sh
openssl rand -base64 48   # TURN secret          (>= 32 chars)
openssl rand -base64 48   # signalling ticket pepper (>= 32 chars)
openssl rand -base64 32   # VoIP token key (exactly 32 bytes, base64)
```

`/etc/modula/greenfield-api.env`:

```sh
MODULA_CALLS_ENABLED=false            # flip to true only after the smoke test below
MODULA_CALLS_STUN_URLS=stun:turn.modula.digital:3478
MODULA_CALLS_TURN_URLS=turn:turn.modula.digital:3478?transport=udp,turn:turn.modula.digital:3478?transport=tcp,turns:turn.modula.digital:5349?transport=tcp
MODULA_CALLS_TURN_SECRET=<TURN secret>
MODULA_CALLS_TURN_TTL_SECONDS=600     # 60..3600
MODULA_CALLS_TICKET_PEPPER=<ticket pepper>
MODULA_CALLS_VOIP_TOKEN_KEY=<VoIP token key>   # optional; without it voipPush=false
```

`/etc/modula/greenfield-worker.env` (the worker decrypts PushKit tokens):

```sh
MODULA_CALLS_VOIP_TOKEN_KEY=<same VoIP token key>
MODULA_WORKER_VOIP_INTERVAL_MS=500    # optional, default 500
```

The worker only sends VoIP pushes when APNs is already configured
(`MODULA_APNS_*`) and the key is present. VoIP uses topic
`<bundle>.voip`, `apns-push-type: voip`, priority 10 and `apns-expiration: 0`;
the existing APNs auth key (.p8) works for it.

`/etc/modula/coturn.env` (only used to render the config, 0600):

```sh
TURN_REALM=turn.modula.digital
TURN_EXTERNAL_IP=87.106.40.136
TURN_STATIC_AUTH_SECRET=<same TURN secret>
TURN_CERT=/etc/modula/turn-tls/fullchain.pem
TURN_PKEY=/etc/modula/turn-tls/privkey.pem
```

Render:

```sh
set -a; . /etc/modula/coturn.env; set +a
envsubst '${TURN_REALM} ${TURN_EXTERNAL_IP} ${TURN_STATIC_AUTH_SECRET} ${TURN_CERT} ${TURN_PKEY}' \
  < ops/coturn/turnserver.conf.template > /etc/modula/turnserver.conf
chmod 0600 /etc/modula/turnserver.conf
```

## 3. Firewall (VPS + provider panel)

| Port | Proto | Why |
|---|---|---|
| 3478 | UDP + TCP | STUN / TURN |
| 5349 | TCP | TURN over TLS (`turns:`), for networks that block UDP |
| 49160–49200 | UDP | TURN relay allocations (`min-port`/`max-port`) |

41 relay ports cover roughly 20 simultaneous relayed calls; widen both the
config and the firewall together if needed. Do not open the coturn CLI
(5766; disabled with `no-cli` anyway).

## 4. Migration

The normal deploy script already runs migrations. Expected head after this
release is `090_calls_v1`; set `SOURCE_EXPECTED_MIGRATION=090_calls_v1` for the
build. The migration only adds new tables (no rewrite of existing data) and
has a tested down migration back to `089`.

## 5. nginx

Install the two new `location` blocks from
`ops/nginx/api.modula.digital.greenfield.conf` into the live vhost (the repo
file is not copied by the deploy script). Without them the default location
clears `Connection` and **both** the messaging socket and call signalling fail.
Then `nginx -t && systemctl reload nginx`.

## 6. Start coturn

```sh
docker compose -f ops/docker/compose.calls.yml up -d coturn
docker logs --tail 50 modula-calls-coturn-1
```

## 7. Smoke test before flipping the flag

1. With `MODULA_CALLS_ENABLED=false`, deploy the API/worker. Confirm
   `calls.enabled=false` and call routes answer 503.
2. Generate a credential by hand and test relay (from a machine outside the VPS):
   ```sh
   u="$(( $(date +%s) + 600 )):smoketest"; p=$(printf %s "$u" | openssl dgst -sha1 -hmac "$SECRET" -binary | base64)
   turnutils_uclient -y -u "$u" -w "$p" turn.modula.digital
   ```
3. Confirm relaying into private ranges fails (`denied-peer-ip`).
4. Set `MODULA_CALLS_ENABLED=true`, restart the API only, and confirm
   `calls.enabled=true`, then place a real call between two physical iPhones
   (one on cellular so TURN is exercised).

## Rollback

Set `MODULA_CALLS_ENABLED=false` and restart the API: clients hide call buttons
on the next capabilities fetch, and every call route returns 503. Stop coturn
with `docker compose -f ops/docker/compose.calls.yml down`. The migration can
stay; its down migration drops only call tables.

## Single-instance warning

Call signalling, the messaging hub and the deadline sweeper run in the API
process (`calls.singleInstance: true`). Running two API replicas would split
peers across processes and break relaying. Scale-out needs the Redis bus from
the architecture doc first.
