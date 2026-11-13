# GUBIC-01: Gubic capability gap map (read-only)

- **Mission:** GUBIC-01 (Mosaic). Inspect the play flag, catalogue, package signatures and GameHost/PackageManager, and produce a file-backed gap map of what actually exists. Source: context-2026-11-13 §14.2.
- **Date:** 2026-11-13
- **GreenField (modula-mod/modula-latest) main:** `a91d490e61ebfff38069378ddf757429eb000449` (fetched anonymously 2026-11-13, "Merge pull request #168"). Read from a fresh worktree on that SHA.
- **Modula Native (modula-mod/modula-native) main:** `5db0f027dd29c6a877b04aa98e0b457ee2b82e2d` (anonymous clone 2026-11-13, "Merge pull request #289").
- **Mode:** read-only. No source code was changed. Nothing was pushed or published, and production was not touched.
- **FIRST-20-MISSIONS.md:** contains no GUBIC entry (grep -i "gubic" found 0 matches). Scope therefore comes from context §9 and §14.2.

File:line references use the `GF:` prefix for GreenField and `NA:` for Native. GF paths are relative to the repo root (`svc/` = `services/greenfield-api/`), and NA paths are relative to `ios/Modula/` unless they start with `ios/` or `docs/`.

## 0. Evidence I executed vs. evidence I only read

| Item | Status |
|---|---|
| GF vitest: `gubic.manifest`, `gubic.lobby-hub`, `gubic.play.integration`, `registry-trust.github-sync`, `greenfield-mps-v1.ingest` against a disposable local Postgres (127.0.0.1:55432) | **Executed. 5 files / 43 tests passed, 0 skipped, 0 failed.** |
| Native XCTest / XCUITest (`GubicBridgeTests`, `WebGameInstalledIsolationTests`, `WebGameRegistryUITests`) | **Not executed.** The box is Linux with no Xcode and no simulator. |
| `docs/evidence/game-platform-02/qa-registry/README.md` (simulator install/update/play of signed Phaser and PlayCanvas QA games) | **Read only.** It is a historical claim that I did not re-run. Its own text says physical-device gameplay and the game-specific rollback matrix still need evidence (NA: `docs/evidence/game-platform-02/qa-registry/README.md:105-119`). |
| Physical iPhone, sandboxed Gubic launch, and live registry | **Not verified.** |

## 1. MODULA_GUBIC_PLAY_ENABLED

| | Evidence |
|---|---|
| Defined | GF `svc/src/config/env.ts:133-137`: zod `string().optional().transform(v => v === 'true')`. Only the exact string `true` enables it. |
| Mapped | GF `svc/src/config/env.ts:582` sets `gubic: {playEnabled: Boolean(raw.MODULA_GUBIC_PLAY_ENABLED)}`. The type is at `env.ts:287`. |
| Gated | GF `svc/src/gubic/routes.ts:27`: `if (!config.gubic.playEnabled) return`, so none of the play routes are registered. That covers library, sessions, achievements, lobbies plus the WS socket, developer submissions, and admin review (`routes.ts:51-122`). Called from `svc/src/app/register-routes.ts:2737`. |
| Default | Off. The spec says the same (GF `docs/gubic/GUBIC-PLATFORM-SPEC.md:20`). No compose, yml, env or Dockerfile in the repo sets it. Searching `GUBIC` across *.yml, *.yaml, .env*, *.example, Dockerfile* and *.sh found 0 matches. |
| Set to true | Only in tests (GF `svc/tests/gubic.play.integration.test.ts:46`) and the local api-atlas capture (GF `tools/api-atlas/lib.mjs:608`). |
| **Not gated by it** | The G0 catalogue routes: `/v1/gubic/games`, `/featured`, `/new-releases`, `/categories`, `/publishers/:id`, `/games/:id`, `/versions`, `/eligibility`, `/install-plan` and `/my-games` (GF `svc/src/modules/routes/index.ts:190-290`). Their only gate is `GREENFIELD_MODULE_REGISTRY_ENABLED` through `requireRegistry` (`index.ts:164-170`; `env.ts:87-90`, also default off). The catalogue admin and publisher writes live in `svc/src/developers/routes.ts:50-51` and are also outside the play flag. |
| Native counterpart | NA `Features/GUBIC/GubicModels.swift:10-21`: `GubicFeature.enabled()` defaults on in DEBUG and off in Release unless the `dev.gubic.enabled` UserDefault is set. `--gubic-disabled` forces it off. It is consumed at NA `App/RootView.swift:303`, `Features/Sidebar/ShellSidebar.swift:467` and `Features/GUBIC/GubicHubView.swift:91`. |

- **Scope:** Gubic-specific.
- **Gaps:**
  - **F1.** There is no single kill switch. With the play flag off, catalogue discovery and the game install plan stay live whenever the registry flag is on.
  - **F2.** Native does not ask the server whether play is enabled. It infers this from 404s (NA `GubicModels.swift:5-7` comment).
  - **F3.** No staging config enables the flag for an isolated QA run.
- **Risk:** Low. Everything fails closed by default.

## 2. Gubic catalogue: data model, routes, assertCatalogueInstallAllowed, trust options

**What exists**
- **Data model:**
  - GF `svc/migrations/078_gubic_game_catalogue.sql:5-69` adds `greenfield_game_catalogue_entries` and its events. `runtime_category` CHECK is at `:13`, `availability` defaults to `unavailable` at `:17`, and `publication_status` defaults to `draft` at `:20`.
  - GF `svc/migrations/082_gubic_play_platform.sql` adds library items (`:7`), play sessions (`:22`), lobbies (`:41`) and members (`:59`), achievements (`:73`), unlocks (`:87`) and submissions (`:108`). Both migrations have down files.
- **Contracts:** GF `packages/greenfield-module-registry-contracts/src/gubic.ts:1-61`.
- **Service:** GF `svc/src/modules/gubic-service.ts`.
  - `listGames` (`:55-153`) joins catalogue entries with registry `productKind:'game'` and keeps only `trustSummary.verified` (`:94`).
  - `eligibility` (`:218-234`) checks availability, then entitlement, then the distribution package plan.
  - `upsertCatalogueEntry` (`:308-351`) checks publisher ownership and that the registry release is of kind game.
  - `reviewCatalogueEntry` (`:353-395`) is admin-only. Publishing requires a trusted registry release owned by that publisher (`:372-378`).
- **assertCatalogueInstallAllowed:** GF `gubic-service.ts:291-306`. If the module has a `registry_kind='game'` ingestion, install requires a catalogue entry that is `published` and `available`, plus entitlement. It is called by `install-preview` (`index.ts:767`), `install-plan` (`:779`), `package-install-plan` (`:798`) and `install` (`:815`).
- **Trust options:** GF `svc/src/modules/registry-trust-service.ts:59-65`. `parseTrustOptions` handles `hostVersion` (semver) and `platform` ∈ ios/android/web/desktop/server. Compatibility is evaluated at `:264-291`.
- **Tests (executed, PASS):** GF `svc/tests/registry-trust.github-sync.test.ts:635`, "projects a signed external game through governed GUBIC discovery, entitlement and publisher isolation". It covers draft, coming-soon, unowned, rejected and revoked installs all being denied (403 or ≥400), and an owned install returning 202.

**Gaps**
- **C1. Update and rollback skip the catalogue gate.** `POST /v1/modules/:id/update` (GF `index.ts:978-1014`) and `/rollback` (`:1016-1042`) never call `assertCatalogueInstallAllowed`. A game that is retired, rejected, unavailable or no longer entitled can still be updated or rolled back by an existing installer. Registry trust and revocation still apply through the distribution plan. *Generic route, Gubic policy. Risk: Medium.*
- **C2. Three runtime vocabularies don't line up.**
  - Catalogue: `html5-javascript|phaser|playcanvas|browser-runtime|streamed` (GF `gubic.ts:7-12`, `gubic-service.ts:33-35`).
  - Submission manifest: `html5|phaser|playcanvas` (GF `svc/src/gubic/manifest.ts:15`).
  - Signed MPS `gameRuntime.engine`: only `phaser|playcanvas` (GF `svc/src/modules/github-release-sync-service.ts:239`).
  - So a plain-HTML5 game can be catalogued and submitted but **cannot be ingested as a signed web game**, and none of the three lists has a Skia or `modula.game-lite` value. *Gubic-specific. Risk: High for GUBIC-03.*
- **C3. Hard cap of 100 games.** `listGames` reads the registry with `limit: 100` (GF `gubic-service.ts:64`), and `getGame`, `featuredGames`, `categories` and `publisherDetail` all derive from it (`:155-196`). A game outside the first 100 registry rows becomes NOT_FOUND. The cursor is always `nextCursor: null` (`:152`). *Gubic-specific. Risk: Medium at scale, Low now.*
- **C4. Install fallback skips the lock check on NOT_FOUND.** In `install`, a `NOT_FOUND` from `packageInstallPlan` is swallowed and install falls back to the legacy path without the lock-SHA check (GF `index.ts:826-828`). The same pattern appears in update (`:994-996`). This is the gap GF-MOD-01 is closing. *Generic. Risk: Medium.*
- **C5. No catalogue-level revoke or quarantine.** These come only from the registry (`gubic-service.ts:204`, `registry-trust-service.ts:108-109`). That is by design but has no Gubic UX. *Low.*

## 3. Package signatures: signing, verification, key provenance

**What exists (GreenField, generic platform)**
- **Statement:** `modula.publisher-release.v1`, Ed25519, base64url (GF `svc/src/modules/release-signing.ts:23`, `:109-114`). Only public keys are accepted, and anything containing `PRIVATE KEY` is rejected (`:118-130`).
- **Key registry:** register, rotate and revoke with an event log (GF `release-signing.ts:136-176`). Revoking a key also writes a `greenfield_module_revocations` row with scope `signingKey` (`:176`). Verification checks the key's publisher, revoked state, validity window and rotation time, then runs `crypto.verify` over the canonical statement (`:207-221`).
- **Key provenance:**
  - Registration is **operator-only**. `POST /v1/admin/registry/publishers/:id/signing-keys` requires `publishers.requireAdminAccount` (GF `svc/src/modules/routes/index.ts:1831-1852`).
  - The public listing is at `index.ts:412`.
  - No publisher proof-of-possession challenge appears in `register()` (`release-signing.ts:136-165`).
- **Trust block:** `verified` requires all of the following (GF `registry-trust-service.ts:137-143`):
  - state is published or superseded
  - release and manifest digests are present
  - integrity is recorded with no mismatch
  - the publisher is verified
  - the signature is `verified`
  - the release is not revoked or quarantined
- **Statement binding:** `signatureState` re-binds the stored statement to the current release, product-manifest and frontend digests (`:221-262`).
- **Runtime re-check:** trust is checked again at the module runtime boundary (GF `svc/src/modules/runtime-access.ts:64-73`). The development bypass `GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES` is refused outside development (GF `env.ts:381-382`).
- **Ingestion of signed web games:** GF `github-release-sync-service.ts:228-268`.
  - The archive digest must match. The archive is ≤50 MiB, offline, `network:'none'`, with entry `index.html`.
  - `verifyWebGameArchive` (`:465-493`) checks the inventory against the members and rejects traversal, native, `.wasm` and `__runtime` members.
  - The entry document must carry a CSP containing `default-src 'none'`, `script-src 'self'` and `connect-src 'none'`.
  - `native-engine-content` is rejected (`:265-267`).
- **Test-signer tooling:** GF `svc/scripts/prepare-web-game-release.ts:1-40` prepares the signed GitHub-release transport from an explicit key path and never reads a production key implicitly.

**What exists (Native)**
- **Registry installs:** NA `Features/ProductHub/ModuleDetail/ModuleVersions.swift:322-355`. `InstallDescriptorVerifier` matches the descriptor digests to the registry facts and pins refs to the registry host. It refuses revoked or quarantined releases and signature states `invalid|unknownKey|revokedKey`.
- **Local Ed25519 verifier:** NA `ModuleRuntime/ModuleReleaseTrust.swift:145-179` signs and verifies the **UTF-8 package digest** (the `modula sign` format).

**Gaps**
- **S1. Native accepts `unsigned` and `unverified` descriptors.** The rejected set is only `invalid|unknownKey|revokedKey` (NA `ModuleVersions.swift:323`). Native relies on the server refusing untrusted installs and adds no defence of its own. *Generic. Risk: Medium.*
- **S2. Two incompatible signature formats.** The server signs the canonical `modula.publisher-release.v1` statement (GF `release-signing.ts:207-218`). Native's local verifier checks a signature over the raw digest string (NA `ModuleReleaseTrust.swift:146-174`). Native never verifies the publisher statement for registry modules or games; that verifier is used only for Moliboo (NA `Features/MolibooRegistry/MolibooPackages.swift:212`) and local packages (NA `Features/ProductHub/ProductHubView.swift:931-940`). *Generic. Risk: Medium.*
- **S3. Release builds trust no signers at all.** `ModuleTrustPolicy.production()` has `signers: []` (NA `ModuleReleaseTrust.swift:69-71`). DEBUG reads keys from the hard-coded `/Users/msjoy/.config/modula-dev` and the app sandbox, and allows unsigned local packages (`:82-121`, path at `:94`, flag at `:120`). There is no shipped trust root or key pinning for publisher keys. *Generic. Risk: Medium.*
- **S4. No proof of possession or key attestation.** Key provenance depends on an operator registering a PEM (`index.ts:1831-1841`). The PR #165 Vault Transit signer is unmerged (context §7.4). There is no test.modula.* Gubic signer key on record in either repo; the QA signer in the evidence doc is `modula-game-platform-02-qa` (NA evidence README `:43-47`). *Generic. Risk: Medium.*
- **S5. Server and native CSP checks differ.** Native requires `object-src 'none'` in the package CSP (NA `ModuleRuntime/WebGamePackage.swift:40-45`), but server ingestion does not (GF `github-release-sync-service.ts:489-491`). The server can accept a game that native will refuse at staging. *Gubic or web-game specific. Risk: Medium for GUBIC-03.*
- **S6. Skia-in-web is impossible as content.** `.wasm` is forbidden on both sides (GF `github-release-sync-service.ts:482`; NA `WebGamePackage.swift:171-174`), so CanvasKit can't ship inside a game. Skia would have to be a host-provided runtime. *Risk: High for "HTML5/Skia".*

## 4. GameHost and PackageManager: launch, sandboxing, update, rollback, revoke

**What exists (Native, generic PackageManager)**
- **Cache slots:** `ACTIVE`, `PREVIOUS_GOOD` and `STAGED` (NA `ModuleRuntime/ModuleArtifactStore.swift:5-7`).
  - `stage` (`:112-147`) uses an atomic `.partial` directory and a move.
  - `activateStaged` moves ACTIVE to PREVIOUS_GOOD and STAGED to ACTIVE, and rolls back on failure (`:188-210`).
  - `rollbackToPreviousGood` is at `:212-227`.
  - `removeModule` refuses while a game session pin is held (`:230-235`).
  - The shared runtime store and digest-protected reclamation are at `:262-376`.
- **Activation controller:** NA `ModuleRuntime/ModuleActivationController.swift`.
  - Staging refuses revoked or quarantined descriptors and digest mismatches, and parses the game archive (`:71-110`).
  - The activation health gate rolls back to PREVIOUS_GOOD and records an audit reason (`:112-138`).
  - Permission reviews are exact-release, and grants never carry across added permissions (`:16-36`).
- **Launch-time revoke check:** `ModuleReleaseVerifier` (NA `ModuleRuntime/ModuleRuntimeController.swift:480-490`).

**What exists (Native, GameHost: two separate hosts)**
- **A. Generic `WebGameHost`** (NA `ModuleRuntime/WebGameHost.swift`), launched by `ModuleHost` for `runtimeKind == .webGame` (NA `ModuleRuntime/ModuleHost.swift:52-53`).
  - Non-persistent website data store (`WebGameHost.swift:162`). Camera, mic and motion are denied (`:244-253`), and process termination is handled (`:262-264`).
  - A custom `modula-game://` scheme serves only reverified, inventory-listed bytes from a digest-named directory, with a per-account, per-module origin (`:276-334`).
  - The host forces a CSP and Permissions-Policy on HTML (`:280`, `:361-366`). There is no JS bridge, only one-way pause and resume events (`:107-114`).
  - Every launch re-verifies installed files (NA `WebGamePackage.swift:95-159`).
- **B. `GubicPlayerView`** with the `window.gubic` bridge for ready, score, achievement and gameOver (NA `Features/GUBIC/GubicPlayerView.swift:254-275`; `GubicRuntime.swift:96-125`). Unit tests exist in NA `ios/ModulaTests/GubicBridgeTests.swift` (not executed).
- **GreenField session API:** GF `svc/src/gubic/play-service.ts`. Covers start, heartbeat and end (`:137-203`), achievement unlock capped at 50 per session (`:436-444`), and submissions plus review (`:459-568`).

**Gaps**
- **G1. Gubic can't launch an installed catalogue game.** `GubicPlayerView` is only ever opened with `.sample`, the bundled, unsigned `digital.modula.gubic.sample.orbit-tap` with `serverBacked:false` (NA `GubicRuntime.swift:16-20`; `GubicHubView.swift:153`, `:170`, `:252`; `GubicSampleGame.swift:7`). Nothing in the repo creates a server-backed source (grep for `serverBacked: true` finds 0 matches). The detail page's "Get or open" hands off to Product Hub and the generic `WebGameHost` (NA `GubicGameDetailView.swift:82-84`), which has no Gubic bridge. Today there are two half-hosts: the verified one has no sessions or achievements, and the bridged one has no signed package. *Gubic-specific. Risk: High, and it blocks the GUBIC-03 launch criterion.*
- **G2. Play sessions aren't tied to an install or a trusted release.**
  - `startSession` only requires a published catalogue game (GF `play-service.ts:138`, `:582-584`).
  - `releaseVersion` is client-supplied and only checked for length (`:141`).
  - There is no installation lookup and no `runtime-access` trust re-check, unlike modules (GF `runtime-access.ts:64-73`).
  - *Gubic-specific. Risk: Medium.*
- **G3. Submissions aren't bound to the signed release.** The submission's `manifest_sha256` (GF `play-service.ts:484`) is never compared with the signed registry release or its `gubic.game.json`. Approval only checks that a trusted registry release exists for the gameId (`:544-547`; `gubic-service.ts:372-378`). Achievements declared in an unsigned submission become authoritative (`play-service.ts:549-558`). *Gubic-specific. Risk: Medium.*
- **G4. Achievements are client-attested.** The only limit is 50 per session (GF `play-service.ts:444`), with no anti-cheat. Context §9.4 already lists this. *Risk: Medium.*
- **G5. No Gubic UX for update, rollback or revoke.** Those flows exist only in the generic Product Hub module flow. The context §9.2 "Downloads/Updates" and "never show playable if runtime unavailable" screens are absent from `Features/GUBIC/*` (files listed in NA `Features/GUBIC/`). *Gubic-specific. Risk: Medium.*
- **G6. No Skia or `modula.game-lite` provider.** `@shopify/react-native-skia` appears only in the historical NA `docs/migration/dependencies.md:32` and in no current `package.json`. The ADR expects games to install before `modula.game-lite` exists (GF `docs/architecture/adr/ADR-015-greenfield-runtime-platform.md:60`, `:151`). *Generic provider. Risk: High for "Skia".*
- **G7. Revocation can't reach a device while it's offline.** The evidence doc states this explicitly (NA evidence README `:64-67`). A revoked game cached as ACTIVE keeps launching offline until the next online check. *Generic. Risk: Medium.*
- **G8. Lobby hub runs in one process.** It is single-node only (GF `docs/gubic/GUBIC-PLATFORM-SPEC.md` §2). Out of scope for GUBIC-03. *Low.*
- **G9. Existing QA games use `digital.modula.*` ids.** They are `digital.modula.orbit-phaser` and `digital.modula.orbit-dash` (NA `ios/ModulaUITests/EcosystemBasicLifecycleUITests.swift:23-24`). That breaks the `test.modula.*` rule for GUBIC-03 and needs new fixtures. *Risk: Low (process).*

## 5. Summary matrix

| Capability | Exists | Missing | Platform / Gubic | Risk |
|---|---|---|---|---|
| Play flag | Server flag default-off; native DEBUG flag | Single kill switch (F1), server capability probe (F2), staging enablement (F3) | Gubic | Low |
| Catalogue | 078 + 082 schema, projection, eligibility, install gate (tested) | Gate on update and rollback (C1), runtime vocabulary (C2), pagination (C3) | Gubic on generic registry | Med–High |
| Signatures (server) | Ed25519 statement, key lifecycle, trust block, runtime re-check | Proof of possession and online signer (S4) | Generic | Med |
| Signatures (native) | Descriptor/registry digest match, revoked/quarantined refusal | Rejects unsigned/unverified (S1), statement verify (S2), release trust root (S3) | Generic | Med |
| Web game ingest/stage | Archive inventory, CSP, native/wasm bans on both sides | CSP parity (S5), plain html5 engine (C2), Skia (S6) | Gubic/web-game | High |
| PackageManager | STAGED/ACTIVE/PREVIOUS_GOOD, health rollback, reclaim | Offline revoke (G7), Gubic UX (G5) | Generic | Med |
| GameHost | Verified `WebGameHost` sandbox; `GubicPlayerView` bridge for the sample only | Unified signed + bridged host (G1), session↔install binding (G2) | Gubic | **High** |
| Review/achievements | Submissions, operator review, append-only unlocks | Signed-manifest binding (G3), anti-cheat (G4) | Gubic | Med |
| Skia provider | Nothing | Everything (G6) | Generic provider | High |

## 6. What GUBIC-03 needs

Target from context §9.4 and §14.2: a tiny first-party, legally distributable reference game, signed with a `test.modula.*` key, covering install, sandboxed launch, update, rollback and revoke.

**Fixtures (isolated only)**
1. Publisher `test.modula.gubic-qa` and game id `test.modula.gubic.reference-tap`, with a disposable DB and a QA registry. Never `digital.modula.*`, and never publish `digital.modula.vault-notes`.
2. A fresh Ed25519 test keypair. The private key stays outside both repos, and only the public PEM is registered through `POST /v1/admin/registry/publishers/:id/signing-keys` on the isolated node.
3. An original MIT/CC0 game: canvas 2D, about 100 lines, `index.html` plus `main.js` plus `game.files.json`. Its CSP must include `default-src 'none'; script-src 'self'; connect-src 'none'; object-src 'none'` to satisfy both validators (S5). No `.wasm`. Two versions, 0.1.0 and 0.1.1, with a visible difference.

**Decisions or small code changes needed first (separate PRs, each needs ATLAS approval)**
4. **Engine choice (C2/S6/G6).**
   - Option (a), no code change: ship the HTML5 canvas game declared as `engine:'phaser'` with a phaser runtime dependency. This works today but misdescribes the game.
   - Option (b): add `html5` (plain canvas) to the MPS `gameRuntime.engine` allow-list at GF `github-release-sync-service.ts:239` and align the three vocabularies.
   - **Recommendation:** (b). "Skia" should be deferred to a host-provided `modula.game-lite` provider mission, since WASM content is banned.
5. **G1:** have `GubicPlayerView` take a server-backed source built from an ACTIVE verified slot (`WebGamePackage.verifyInstalled`), or add the Gubic bridge to `WebGameHost` behind manifest `bridge.capabilities`. Prism should do this, as the native owner.
6. **C1:** call `assertCatalogueInstallAllowed` from the update and rollback routes, or document the deliberate exception.
7. **G2:** `startSession` should require an enabled installation and a trusted release version (reuse `runtime-access`).
8. **S1:** native should reject the `unsigned` and `unverified` descriptor states for registry installs.

**Acceptance matrix GUBIC-03 must execute (no PASS without logs plus the exact SHA)**

| Step | Proof |
|---|---|
| Ingest 0.1.0 signed → `trust.verified=true` | GF test plus API capture |
| Catalogue register → admin publish → `/v1/gubic/games` lists it | API |
| Draft/unavailable/rejected install → 403 | API (already covered generically by `registry-trust.github-sync.test.ts:635`) |
| Install → native STAGED→ACTIVE, permission review | Simulator XCUITest |
| Sandboxed launch: only listed files served; camera/mic/geo denied; no network | `WebGameInstalledIsolationTests` plus a new probe |
| Session start/heartbeat/end tied to the installed release | API plus native |
| Update 0.1.1 without a native rebuild; 0.1.0 retained as PREVIOUS_GOOD | Simulator |
| Rollback, both forced health-fail and the API `/rollback` | Simulator plus API |
| Revoke 0.1.1 → install/update/launch refused online; documented offline behaviour (G7) | API plus simulator |
| Signing-key revoke → `revokedKey`, install refused | API |
| Physical iPhone run | Prism; mark DEVICE VERIFIED only with logs |

## 7. Verdict against the GUBIC-01 criteria

| Criterion | Result |
|---|---|
| Inspect the play flag | PASS (§1) |
| Inspect the catalogue | PASS (§2) |
| Inspect package signatures | PASS (§3) |
| Inspect GameHost and PackageManager | PASS for source inspection (§4). Native tests were not executed (no Xcode). |
| File-backed gap map with file:line evidence | PASS (this file) |
| **Overall** | **PASS** for the read-only mission. No runtime, simulator or device claims are made. |
