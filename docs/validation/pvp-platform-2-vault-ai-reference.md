# PVP Platform Phase 2 Vault AI reference

Recorded: 2026-08-24

Repository: `modula-mod/modula-vault-ai`

Product ID: `digital.modula.vault-notes.ai`

Kind: `addon`

Release: `vault-ai-v0.1.0`

Release commit: `da5dd9ce5002bd4aa28b67e5603d55b87b64e407`

Artifact SHA-256: `bbff7af5fb4fcfaf0b95fae797a1d1ca1dacd700a34d26cd7d47cbeb9ada2e9c`

## Result

Vault AI is an independent repository and immutable registry product targeting
Vault Notes `>=1.2.0 <2.0.0`. It contributes declared note actions, editor
commands, settings, functions, and background actions. Vault Notes does not
import it and the generic Host contains no Vault AI product check.

The provider interface is vendor-neutral. The implemented actions are:

- summarise current note;
- rewrite selected text;
- generate title;
- extract tasks;
- ask about the current note.

With no configured real provider, the runtime returns
`AI_PROVIDER_UNAVAILABLE`. This is the accepted VPS result; no fake summary is
reported. A deterministic adapter exists only when both `NODE_ENV=test` and
`VAULT_AI_TEST_ONLY=true` are explicit, and the verifier proves it is rejected
outside that boundary.

## Acceptance

| Gate | Result |
| --- | --- |
| Separate repository and clean main | PASS |
| Add-on manifest and target compatibility | PASS |
| Immutable provenance and checksum | PASS |
| Install, capability review, enable | PASS |
| Note/editor/settings contribution discovery | PASS |
| Disable removes all contributions | PASS |
| Re-enable restores contributions | PASS |
| Uninstall with `KEEP_DATA`, reinstall, restore | PASS |
| `notes.delete` or undeclared access | DENIED |
| Raw Greenfield user bearer forwarding | 0 |
| Summarise/rewrite/title/tasks/ask | `PROVIDER_NOT_CONFIGURED` |
| Core Vault Notes availability with AI disabled/unavailable | PASS |

Commands:

```text
CI=true pnpm verify
```

```text
CI=true pnpm verify:vault-ai-reference
```

The second command is run from `modula-latest` with the disposable Greenfield
database URL for integration modes. Production service configuration was not
changed.
