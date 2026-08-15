# Vault Notes source identity overlay — Mac push

The cloud agent can read `modula-mod/modula-vault-notes` and cannot push
(`permissions.push: false` for the GitHub App). Do not use a bot-token
workaround.

On Mac, with the maintainer GitHub identity:

```bash
cd /Users/msjoy/Developer
git clone git@github.com:modula-mod/modula-vault-notes.git
# or update the existing clone
cd modula-vault-notes
git remote -v
git fetch --all --tags --prune
```

Confirm push permission, then apply the identity overlay:

- `module.manifest.json` `moduleId` → `digital.modula.vault-notes`
- `modula.module.json` `id` → `digital.modula.vault-notes`
- rewrite `modula.vault-notes` strings that are not already
  `digital.modula.vault-notes`
- README must state: Canonical source repository for `digital.modula.vault-notes`
- Do not invent version 1.2.0. Keep 1.1.0 until a real source change lands.

Until that push, Greenfield overlays the same identity at import
(`canonicalizeVaultNotesManifest`). Registry rows are canonical even when
the GitHub files still declare the legacy ID.

## Legacy repository

`modula-mod/modula-module-vault-notes` returned GitHub 404 from this agent
(outcome D/E). If it later becomes visible to the maintainer:

- Do not delete historical Git evidence
- Archive the repository
- README redirect to `modula-mod/modula-vault-notes`

Do not create a third Vault Notes repository.
