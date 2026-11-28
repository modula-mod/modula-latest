# Native endpoints enablement — Nodus model download + Reels by id

Two main-only read routes in `services/greenfield-api/src/app/register-native-endpoint-routes.ts`
answer 404 in production until an operator enables them. Both are safe to leave
off: 404 is their designed "not configured" answer, and neither writes anything.

**Prerequisite for both: the post-#208 production deploy.** Production still runs
the pre-#208 build (`a3162b8b`, migration 091); these routes do not exist there at
all. Nothing below works until that deploy lands. (Merges and deploys still need
Andrei's explicit go for that specific action.)

**Where the settings live:** the API container reads `/etc/modula/greenfield-api.env`
(`env_file` in `ops/docker/compose.production.yml`). After editing that file the
API container must be recreated before the change takes effect
(`docker compose -f ops/docker/compose.production.yml up -d greenfield-api`, or
the next deploy). A restart alone is not enough if the container was created
before the edit. Never commit a real descriptor or any env-file value to the repo.

## 1. Nodus model download — `GET /v1/intelligence/nodus/releases/latest`

The native app fetches this unauthenticated to download the on-device Nodus R7
model (`platform=ios`). The only source is the operator setting
`MODULA_NODUS_RELEASE_IOS_JSON`. No descriptor is ever synthesised: unset,
blank, or invalid answers 404 and the app shows "Nodus isn't available to
download yet", falling back to Apple Foundation Models.

### Which R7 build — Andrei's call

The descriptor CONTENT (which R7 build, its version string, its artifact hash,
where its files are hosted) is Andrei's decision. **Do not invent a model
version.** The template below ships with clearly-marked placeholders and must
never be deployed as-is.

### Steps

1. Copy the template and fill in the real values:
   `cp docs/operations/nodus-release-ios.template.json /tmp/nodus-release-ios.json`
   then replace every `PLACEHOLDER` value:
   - `nodusVersion` — the real R7 release version (e.g. the R7 build tag).
   - `artifactHash` — `sha256:` + the 64 lowercase hex SHA-256 of the R7
     release artifact.
   - `manifestURL` + `manifestSHA256` — the HTTPS URL of the release manifest
     and its SHA-256 (64 lowercase hex).
   - `files[]` — one entry per model file: a safe relative `path` (no leading
     `/`, no `..`, no empty segments, never `nodus-manifest.json` itself),
     its HTTPS `url`, its SHA-256, and its `bytes` (positive integer).
     All URLs must be HTTPS with no userinfo; all digests lowercase hex.
2. Validate before touching production (same check the server runs at boot,
   mirroring `NodusModelRelease.validate()` in Native):
   `pnpm --filter @modula/greenfield-api nodus:validate-release -- /tmp/nodus-release-ios.json`
   - Exit 0 + `VALID:` — good to go. A `WARNING:` about remaining
     `PLACEHOLDER` / `example.test` values means the template was not fully
     filled in: fix it, do not deploy it.
   - Exit 1 + `INVALID: <reason>` — fix the named field and re-run.
   - Exit 2 — usage or unreadable file.
3. Put the descriptor on one line in the production API env file:
   `jq -c . /tmp/nodus-release-ios.json` prints the compact form; set it as
   `MODULA_NODUS_RELEASE_IOS_JSON=<that single line>` in
   `/etc/modula/greenfield-api.env`. The value must be a single line — a
   multi-line value will not load. Delete the temp file afterwards.
4. Recreate the API container (see header) and verify:
   - `curl -s https://api.modula.digital/v1/intelligence/nodus/releases/latest?platform=ios`
     → `200` with the descriptor body (raw JSON, no envelope).
   - `curl -s -o /dev/null -w '%{http_code}' 'https://api.modula.digital/v1/intelligence/nodus/releases/latest?platform=android'`
     → `404` (only the iOS channel exists).
   - If it still 404s for `platform=ios`, check the API boot log: an invalid
     descriptor logs `MODULA_NODUS_RELEASE_IOS_JSON is set but invalid` with
     the reason (`problem`), and the endpoint stays 404. Fix the descriptor
     (step 2) and repeat steps 3–4. A missing variable logs nothing — it is
     simply unset.

### Rollback

Remove `MODULA_NODUS_RELEASE_IOS_JSON` from `/etc/modula/greenfield-api.env`
and recreate the API container. The endpoint returns to 404 and the app falls
back to Apple Foundation Models. No data migration is involved.

## 2. Nodus model releases — the registry channel (migration 103)

The env descriptor above is the fallback. The registry channel is the
versioned, signed pipeline: releases live in the database
(`greenfield_nodus_model_releases` + `greenfield_nodus_model_release_signatures`),
`/latest` serves the published release stripped to the v1 shape, and the
server proxies model bytes resumably with full HTTP Range support. The
operator steps below are admin-only (an allowlisted handle in
`MODULA_ADMIN_HANDLES`, bearer token required). No step signs anything: the
Ed25519 manifest signature is made offline by whoever holds the private key,
and the server only verifies it against a registered ACTIVE publisher key.

### Which R7 build — still open

No R7 build is publishable today. The only R7 artifact is the experimental
candidate (NODUS-01C checkpoint, packaged by NODUS-01D for diagnostics):
lifecycle `experimentalCandidate`, `shippingAllowed = false`, Debug-only.
A publishable first release needs an **accepted** build — the full promotion
suite passing (general retention within 5 points per category, Modula
improvement ≥ +0.15, compatible ECE below 0.4400, freshness / abstention /
hallucination-resistance / unknown-capability / false-premise gates,
runtime / integrity / licensing) followed by explicit review — plus artifact
hosting and an offline signature over the canonical manifest. Do not publish
the experimental candidate. Until then the pipeline is proven with test
descriptors only.

### Publication flow

1. Build the v2 descriptor. It is the v1 shape plus `releaseNumber` (the next
   number for the platform: 1 for the first release), `signature` (base64url
   Ed25519 over the canonical manifest bytes — the canonical JSON of
   `{schemaVersion: 2, nodusVersion, artifactHash, files[]}` with files as
   `{path, sha256, bytes}`), `signingKeyId`, `publishedAt` (ISO timestamp;
   replaced by the real publication time at publish), and `supersedes`
   (the previous version, or `null` for the first release).
   `manifestURL` and every `files[].url` must be this server's own endpoints:
   `https://api.modula.digital/v1/intelligence/nodus/releases/<version>/manifest`
   and `.../files/<path>`. Validate it first:
   `pnpm --filter @modula/greenfield-api nodus:validate-release -- <file>.json`
   (exit 0 + `VALID:`; it also accepts v1 descriptors).
2. Create a draft (the server verifies the signature and the manifest hash
   and rejects anything else — fail closed):
   `curl -s -X POST -H 'Authorization: Bearer <admin-token>' -H 'Content-Type: application/json' -d '{"descriptor": <v2 descriptor object>, "originUrl": "https://<artifact-origin>"}' https://api.modula.digital/v1/admin/intelligence/nodus/releases`
   → `201` with the draft. `originUrl` is the artifact origin base (CDN /
   object storage); it is never served to the client. The draft is not
   served publicly: `/latest`, the list, and the per-version endpoints all
   still 404 / return the previous release.
3. Publish the draft:
   `curl -s -X POST -H 'Authorization: Bearer <admin-token>' https://api.modula.digital/v1/admin/intelligence/nodus/releases/<version>/publish`
   → `200`. The previously published release (if any) becomes `superseded`;
   `/latest` now serves the new release stripped to v1. Verify:
   `curl -s https://api.modula.digital/v1/intelligence/nodus/releases?platform=ios`
   and `curl -s https://api.modula.digital/v1/intelligence/nodus/releases/<version>/manifest`
   (the manifest bytes must hash to the descriptor's `manifestSHA256`).
4. Roll back by republishing a previous version (rows are never deleted):
   `curl -s -X POST -H 'Authorization: Bearer <admin-token>' https://api.modula.digital/v1/admin/intelligence/nodus/releases/<previous-version>/rollback`
   → `200`. The bad version becomes `deprecated` and is no longer served;
   `/latest` points at the previous version again, and clients downgrade.
   Superseded versions stay downloadable (rollback needs their bytes).
5. List everything including drafts (admin-only):
   `curl -s -H 'Authorization: Bearer <admin-token>' https://api.modula.digital/v1/admin/intelligence/nodus/releases`

### Rollback (env channel)

If a release was served from the env descriptor instead, remove
`MODULA_NODUS_RELEASE_IOS_JSON` as in §1. Note a DB-published release takes
precedence over the env descriptor: removing the env setting does not
unpublish a registry release — use the rollback endpoint above.

## 3. Single reel — `GET /v1/reels/:id`

`GET /v1/reels` (the list) already works in production. The single-reel route
the app calls when opening a reel detail is disabled unless
`MODULA_REELS_BY_ID_ENABLED=true`. It requires an authenticated session and
returns the same `ReelItemDto` shape as the list, under the same visibility
rules. No code or data change is needed — this is a flag flip.

### Steps

1. Add `MODULA_REELS_BY_ID_ENABLED=true` to `/etc/modula/greenfield-api.env`.
2. Recreate the API container (see header) and verify with a real reel id
   (take one from `GET /v1/reels`):
   - Unauthenticated: `curl -s -o /dev/null -w '%{http_code}' https://api.modula.digital/v1/reels/<id>`
     → `401` (the flag is on; auth is required).
   - Authenticated (a session bearer token):
     `curl -s -H 'Authorization: Bearer <access-token>' https://api.modula.digital/v1/reels/<id>`
     → `200` with the reel in the standard `{ok, data}` envelope.
   - An id that does not exist → `404`; a malformed id → `400`.
   - If an authenticated request still 404s for a reel the list shows, the
     flag did not load: confirm the line is in `/etc/modula/greenfield-api.env`
     and that the container was recreated after the edit.

### Rollback

Set `MODULA_REELS_BY_ID_ENABLED=false` (or remove the line) in
`/etc/modula/greenfield-api.env` and recreate the API container. The route
returns to 404 for everyone, including authenticated callers.
