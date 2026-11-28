# Moliboo Genesis — server design note

Status: implemented on branch `feature/moliboo-genesis-certificates`
(migrations 099–100, main tip 095 at branch time). Not merged, not deployed,
nothing signed. Merge needs Andrei's go + certification per governance;
a deploy is needed before anything is live.

Source of truth: `~/workspace/user/files/MOLIBOOS_complete_ecosystem.md`
("MOLIBOOS — The complete ecosystem"): Genesis §3, birth certificate §4.1,
Registry §5, DNA §6, data architecture §16.

## What Genesis is

When an account is created, a Personal Moliboo is born — it is not chosen.
The companion is a private, non-transferable personal agent identity, born
on registration day. Its registry identity is `MLB-GEN-[UUID]`
(`greenfield_moliboo_genesis_instances.instance_registry_id`); its
Certificate of Origin is `MLB-CERT-[UUID]`
(`greenfield_moliboo_genesis_certificates.certificate_registry_id`).

Hard separations (non-negotiable, enforced by design):

- The Genesis companion is Personal and non-transferable. A marketplace
  transaction must never transfer private memory, credentials, or accounts.
- The commercial character and the private companion stay separate even if
  they share an appearance. The instance's `character_id` is a nullable
  appearance lineage and is **unassigned at birth** — no character is
  claimed for a companion until that linkage is decided deliberately.
- Private memory never appears in a certificate or in any verification
  response. Public verification returns registry facts only: registry IDs,
  origin, born date, bond, transfer status, hash, signature status.

## Birth at registration — and why it cannot fail registration

`MolibooGenesisService.ensureGenesisForAccount(accountId)` is called from
`AccountsService.register()` **after the registration transaction commits**,
inside a try/catch that only logs. If Genesis fails, registration still
succeeds. The backfill/retry path is `GET /v1/me/moliboo/genesis`, which
births the companion on first read (the name and list endpoints do the same).

Idempotency: `ensureGenesisForAccount` takes a per-account advisory lock
and does the whole birth (instance + DNA + certificate) in one transaction,
returning `{companion, created}`. Concurrent births for the same account
collapse to one companion — verified by a 5-way concurrent-birth test.

## Migrations

- **099** `099_moliboo_genesis_registry.sql` — creates
  `greenfield_moliboo_genesis_instances`,
  `greenfield_moliboo_genesis_dna`,
  `greenfield_moliboo_genesis_certificates`. Immutability triggers: instance
  identity fields are immutable; a certificate allows exactly one later
  update — applying the Ed25519 signature while it is still unsigned.
  Grants mirror migration 095's pattern. Forward-only down file (refuses
  automated downgrade): registry records are permanent.
- **100** `100_moliboo_genesis_first100_seed.sql` — seeds **16 rows** into the
  existing `greenfield_moliboo_characters`: Pip #001 (`originals`) and the
  Dreamers 086–100 (Dozi, Lulli, Moona, Nuzzle, Drifty, Hushby, Swayla,
  Snoomi, Velvi, Minku, Tufti, Winkle, Sonata, Comfi, Somna; `dreamers`),
  series 1, wearable. `ON CONFLICT DO NOTHING`; forward-only down file.

Numbers 096–098 are reserved for PR #205's renumber (092–094 → 096–098),
so Genesis uses 099–100. Main's tip at branch time was 095; no open PR
claimed 099–100.

Seeded only what the master doc confirms. Deliberately **not** seeded:
#002–085 (names unconfirmed in the master doc), Pebble (character sheet
v2.1 exists, no number assigned in the doc), any 041–070 family assignment
(the family-rename flag is unresolved — see "Open canon flags" below).
Nothing was invented, nothing renumbered.

## DNA

`services/greenfield-api/src/domains/moliboo-genesis/dna.ts` (pure logic,
no I/O). A 32-byte seed is generated at birth and stored server-side
(`greenfield_moliboo_genesis_dna.seed_hex` — never exposed through any
endpoint). `deriveDna(seed)` deterministically derives, via SHA-256 field
derivation: body/silhouette, eyes, palettes, humour, patience,
communication, and 2 aptitudes from the doc §7.2 list of 14. Same seed
always gives the same DNA; a different seed gives a different companion.

## Certificate of Origin (§4.1)

Fields per the doc: registry ID, born date, origin (Modula Genesis),
family/lineage, bond (Original), transfer status (Non-transferable).

Integrity: the certificate hash is SHA-256 over a canonical JSON statement
of the **immutable fields only** — `bond`, `born`, `certificateRegistryId`,
`instanceId`, `instanceRegistryId`, `origin`, `transferStatus`, `type`.
A name, wardrobe, or personality change never invalidates the certificate,
because none of those are in the statement.

### The signature — and its honest limitation

The signature field is **nullable at birth**. A certificate is created with
its hash and no signature. The server can never create a signature:
`applySignature` only **verifies** an externally-made Ed25519 signature
against a registered ACTIVE public key and stores it. The offline path is
Andrei's Mac key `modula-2026-10-offline-01` (Andrei holds the private half);
online Vault Transit signing is unconfigured (no production Vault, 0 online
signing identities). No key was invented and no server-side offline signing
is claimed.

`verifyCertificateByRegistryId` reports signature status honestly:
- `unsigned-awaiting-signature` — created, hash valid, waiting for the
  signing ceremony;
- `signed` — signature verifies against the registered key;
- `invalid` — a stored signature does not verify (treated as a hard failure
  to investigate, never silently accepted).

`verified` in the response means record-valid AND signature-valid. An
unsigned certificate is not a failure — it is the expected state until a
signing ceremony happens.

Applying a signature to an already-signed certificate returns CONFLICT; a
signature from a wrong/unregistered key is rejected.

## Endpoints

All follow the repo envelope `{ok, data, error: {code, details}}` and the
existing `/v1/moliboo/*` / `/v1/me/moliboos/*` route conventions
(`services/greenfield-api/src/app/register-moliboo-genesis-routes.ts`).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/v1/me/moliboo/genesis` | `social:read` | My companion + reveal data + DNA summary; births (backfills) on first read. Response includes `reveal: {isNew, bornAt, certificateRegistryId}`. |
| POST | `/v1/me/moliboo/genesis/name` | `profile:customize` | Naming/bonding. Name is mutable, 1–80 chars, no control characters; naming never affects the certificate hash. |
| GET | `/v1/me/moliboo/certificates` | `social:read` | My certificates (ensures the companion first). |
| GET | `/v1/moliboos/certificates/:certificateId` | public | Public verification (QR code target). Recomputes the hash, reports signature status. Returns registry facts only — never a name, account ID, or private memory. |
| POST | `/v1/admin/moliboo/certificates/:certificateId/signature` | `admin:ops` | Apply an externally-made signature (verified against a registered ACTIVE key). |

Atlas: 5 new routes, 633 → 638 application routes;
`pnpm api:atlas:verify` 103/103 checks passed on this branch.

## Tests

`services/greenfield-api/tests/moliboo-genesis.test.ts` — 18/18 passing:
5 pure unit tests (DNA determinism/variation, hash over immutable fields
only, Ed25519 sign/verify/tamper/wrong-key, name validation) and 13
integration tests (birth at registration, 5-way concurrent-birth
idempotency, backfill for pre-Genesis accounts, naming never invalidates
the certificate hash, bad names, auth required, list certificates, public
verification leaks no account ID/name, 404/400, offline signature apply +
verified-signed + CONFLICT on re-apply + NOT_FOUND, wrong-key rejection,
admin route 401/403, seed exactly the 16 confirmed rows +
`schema_version` 100).

Regression (same scratch DB, fresh each run):
- `greenfield.accounts.test.ts` 17/17; `registry-listing.compatibility` 1/1;
  `api-fix-01.migration` 3/3 (full chain to tip 100, incl. production-like
  065 and legacy QA 076 upgrades); `gf-native-endpoints` 5/5;
  `moliboo-signed-packs` 7/7 (with CI-style authority roles provisioned);
  `publisher-release-runner-boundary` 4 passed / 13 skipped (CI-gated).
- `greenfield-backend-v1.migration-ledger-security` 3/4: the one failure
  (backup-role sequence SELECT coverage for
  `greenfield_publisher_release_job_logs_log_id_seq`, created by migration
  085) reproduces on main without this branch — it is caused by running
  migrations as the `postgres` superuser in the scratch setup instead of
  `modula_migrator` (migration 073's default privileges are
  `FOR ROLE modula_migrator`), not by this change. Genesis creates no
  sequences.

## Open canon flags (not resolved here)

1. **100 vs 215 code registry**: the master doc's First 100 (MOL-001–100)
   does not match the code registry (215 characters: #001–100 Originals,
   #101–115 Legends non-wearable, #116–215 Series 2 drafts). Needs
   reconciliation; nothing renumbered unilaterally.
2. **041–070 family rename**: the master doc says Tech/Neon 041–055 and
   Underground/Nature 056–070; the earlier family bibles said Underground
   041–055 (The Underlight) and Enchanted 056–070 (Whispering Woods).
   The master doc is treated as current canon unless Andrei says otherwise;
   no family assignment for 041–070 was seeded.

## What is needed to go live

1. Andrei's go to merge this PR + certification per governance.
2. Deploy to production (production still runs the pre-#208 build).
3. A signing ceremony for certificates: either Andrei signs the first
   batch with the offline key on his Mac, or online Vault Transit signing
   is configured (production Vault + Transit key + authorised
   `MODULA_FIRST_PARTY` identity + drills/monitoring) and certificates are
   signed through it. Until then, certificates ship unsigned and the
   verification endpoint says so honestly.
