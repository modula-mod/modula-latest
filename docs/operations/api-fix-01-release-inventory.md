# API-FIX-01 First-Party Release Inventory

Captured read-only on 2026-10-07 against the production database served by API and Worker revision `736056445f5e09f968488a3ec66dddfaffea6f08`; production counts and signing state were rechecked unchanged on 2026-10-08. No production row, GitHub release, signing key, or signature was changed.

## Result

- Production contains 12 `published` and 2 `superseded` first-party releases.
- Publisher `modula` is `verified` / `firstParty`, but has zero registered signing keys.
- All 14 rows have release and adapter-manifest digests, but none has a row signature or signature-evidence row. All 14 therefore remain **unsigned and untrusted**.
- Twelve rows have a GitHub release tag, package asset, and provenance sidecar. For every one, the resolved tag commit, downloaded package SHA-256, provenance release commit/tag/repository/package digest, and Greenfield manifest digest exactly match production.
- Two superseded legacy rows do not have sufficient release-asset provenance for signing.
- Only Vault Notes 1.7.0 and 1.8.0 currently have their release package bytes in `greenfield_release_asset_blobs`. Ten otherwise verified GitHub packages are absent from that production blob store; distribution completeness remains API-FIX-02 work.
- Eight rows have MPS and frontend projections. The other six are four older published releases plus the two superseded legacy releases. The signing protocol truthfully permits `null` MPS/frontend digests, but their distribution capability is correspondingly incomplete.

## Per-release evidence

`GitHub match` means tag commit + downloaded package digest + provenance identity/package/adapter-manifest fields all matched the production row. `Projection` is the production MPS/frontend projection, not merely a file in the GitHub package.

| Product | Version | State | Production source SHA | Production package SHA-256 | GitHub match | Projection | DB blob | Disposition / exact blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `digital.modula.vault-notes` | 0.1.0 | superseded | `915bbf234818fd0eec2e83c6fa0b7fd52837184c` | `0e2b259f22106aea7c43cf41141b3b5780413b2d8e803b684468fe6d11d44c2e` | BLOCKED | none | absent | Not signable: commit exists, but the row records no tag/asset; repository tag `vault-notes-v0.1.0` resolves to a different commit and there is no corresponding GitHub Release asset/provenance sidecar. |
| `digital.modula.vault-notes` | 0.2.0 | superseded | `54ab8edac1ba469f0081c636e11f6059d712becc` | `39df3ec1064869e19a58a8714b2d2d1955778c065ce1bed514b56fdd75c7db1c` | BLOCKED | none | absent | Source tag `v0.2.0` matches the row commit, but its GitHub Release has no package asset or provenance sidecar; the production package digest cannot be independently reconstructed from release evidence. |
| `digital.modula.vault-notes` | 1.2.0 | published | `c62f47a468c6d33fc5412db2d30f2b5d1c0bb2ce` | `98489d3c145fc4768c1bb86e8f470a1e58e509d0acee62fe3324410430cff935` | PASS | none | absent | Artifact/provenance reconciled; blocked only on approved Ed25519 key custody, public-key registration, supported signing/import ceremony, and verification. Distribution projection/blob remains incomplete. |
| `digital.modula.vault-notes` | 1.5.0 | published | `bf497185a55584d4d36841f97c5d7055e85950b8` | `694ec87cb891d59bae097d85343da981001fb6c55f4c210fd1f097b750b5c713` | PASS | MPS + frontend | absent | Artifact/provenance reconciled; blocked on key custody/registration and supported signing/import verification. Package blob remains distribution work. |
| `digital.modula.vault-notes` | 1.6.0 | published | `30f73030c32f9ab49f96fe89f22d28a1320d2ad1` | `e44daa477920baf0293d27dfe4082844ba47dc91887bb4dc932bff5868334d27` | PASS | MPS + frontend | absent | Artifact/provenance reconciled; blocked on key custody/registration and supported signing/import verification. Package blob remains distribution work. |
| `digital.modula.vault-notes` | 1.7.0 | published | `106b57d40a456e2812e9b3a6e9f3bb32fb15e11d` | `b3beb063b7464462d700ab12cc7a2c2c206aa7f05379fb750a9a54ba2c316ac0` | PASS | MPS + frontend | present | Artifact/provenance/distribution bytes reconciled; blocked only on key custody/registration and supported signing/import verification. |
| `digital.modula.vault-notes` | 1.8.0 | published | `d45190e1f47c6802c5f15797a4abb36fa6bfdbe4` | `a5a4fbe2d5221315620af75e21d79a9e4256948a9ef724b07ad2396cae1f4a27` | PASS | MPS + frontend | present | Artifact/provenance/distribution bytes reconciled; blocked only on key custody/registration and supported signing/import verification. |
| `digital.modula.vault-notes.ai` | 0.1.0 | published | `da5dd9ce5002bd4aa28b67e5603d55b87b64e407` | `bbff7af5fb4fcfaf0b95fae797a1d1ca1dacd700a34d26cd7d47cbeb9ada2e9c` | PASS | none | absent | Artifact/provenance reconciled; blocked on key custody/registration and supported signing/import verification. Distribution projection/blob remains incomplete. |
| `digital.modula.vault-notes.ai` | 0.4.0 | published | `79f1437bf28bafc383842304246eeba7d73353ab` | `4e468f54ec9bded12af7a9c6d641afc83a5aea737ced3d7c2ecbeb625b2d4157` | PASS | MPS + frontend | absent | Artifact/provenance reconciled; blocked on key custody/registration and supported signing/import verification. Package blob remains distribution work. |
| `digital.modula.vault-notes.ai` | 0.5.0 | published | `c748b9414eb10192d3911b08741491f6da87a57c` | `7206a84d353871dcdcebaa4a5fdfc232e36cd2f41b9c25dc0afbe27da6eabdae` | PASS | MPS + frontend | absent | Artifact/provenance reconciled; blocked on key custody/registration and supported signing/import verification. Package blob remains distribution work. |
| `digital.modula.vault-notes.formatting` | 0.1.0 | published | `9a6359cd9184b810798a4fb03aff0d2617f15602` | `984ad473e3f37e5bf8cd6d2f10b3cc4cd83100cf020492f989f39b35e4ae9a66` | PASS | none | absent | Artifact/provenance reconciled; blocked on key custody/registration and supported signing/import verification. Distribution projection/blob remains incomplete. |
| `digital.modula.vault-notes.formatting` | 0.4.0 | published | `f38525c315586b094637e12ee281d61dd07f167a` | `6e31038086a603e02f07d14f52319ace0b3efe9dddae70ad2b15252c13bd0d2e` | PASS | MPS + frontend | absent | Artifact/provenance reconciled; blocked on key custody/registration and supported signing/import verification. Package blob remains distribution work. |
| `digital.modula.vault-notes.voice` | 0.1.0 | published | `df3f275a0bfd53c96add635607d72f70f65f0714` | `13a937cb8e7ad11aa89a3736c8cf709ba67eff0e9368164580ca041bb512c48b` | PASS | none | absent | Artifact/provenance reconciled; blocked on key custody/registration and supported signing/import verification. Distribution projection/blob remains incomplete. |
| `digital.modula.vault-notes.voice` | 0.4.0 | published | `40f24340091255c410bcac359d394374fe244fb8` | `123d55de1af744b00e82112c8dd51fe453360a6af49f90f4c354eef85bccfa10` | PASS | MPS + frontend | absent | Artifact/provenance reconciled; blocked on key custody/registration and supported signing/import verification. Package blob remains distribution work. |

## Signing disposition

The 12 `PASS` rows have enough immutable public release evidence to prepare the registry-rebuilt `modula.publisher-release.v1` statement. They must **not** be marked trusted yet. The remaining mandatory sequence is:

1. approve publisher key ownership and custody;
2. generate/hold the Ed25519 private key outside the registry, repository, images, CI output, and Atlas evidence;
3. register only the public key through the supported publisher-key path;
4. rebuild each statement from registry facts and sign it through an auditable ceremony;
5. ingest each signature through the supported release pipeline and require the normal verifier to record `verified`;
6. independently recheck trust and install/update eligibility.

The two superseded `BLOCKED` rows require canonical package/provenance recovery before that sequence. They should remain untrusted or be retired; their production digests must not be signed merely because a row exists.

## Verification method

- Production facts were selected in a read-only transaction from release, source, MPS, frontend, integrity, signature, and asset-blob tables.
- GitHub tag commits were resolved through the commits API.
- Expected package assets and provenance sidecars were downloaded to a disposable `/tmp` directory, outside the repository.
- Each package was hashed locally with SHA-256. Sidecar repository, tag, release commit, package filename/digest, Greenfield manifest digest, and—where projected—product manifest and frontend digests were compared to production.
- No credentials, private keys, signatures, package bytes, or provenance sidecars are stored in this document.
