# Vault Notes source identity overlay — Mac push

Completed 2026-08-15 from the Mac maintainer GitHub identity
(`gh auth`: `modula-mod`, HTTPS). `git@github.com` SSH is not configured on
this Mac; HTTPS with the keyring credential is the authenticated setup.
No bot token was used. No third repository was created.

```
cd /Users/msjoy/Developer/modula-vault-notes
# cloned via https://github.com/modula-mod/modula-vault-notes.git
# permissions.push: true (admin)
```

Applied:

- `module.manifest.json` `moduleId` → `digital.modula.vault-notes`
- `modula.module.json` `id` → `digital.modula.vault-notes`
- rewrite of `modula.vault-notes` strings that were not already canonical
- README states: Canonical source repository for `digital.modula.vault-notes`
- Version remains 1.1.0. 1.2.0 was not invented.

Pushed:

```
d92e4455cd56f95b0109e3dc8f1df0c8a52c60da
feat: declare canonical module ID digital.modula.vault-notes
```

Tagged current release remains `vault-notes-v1.1.0` at
`f443972d53f94b6f192a37bcce8742bdf18a99b5`. The identity overlay is going-forward
source alignment, not a new product version.

Host overlay (`canonicalizeVaultNotesManifest`) remains so older 1.1.0 artifacts
that still declare `modula.vault-notes` import as the canonical product.

## Legacy repository

Mac inspection: `modula-mod/modula-module-vault-notes` is **private but
recoverable** (outcome C). Unique historical commits:

- `915bbf234818fd0eec2e83c6fa0b7fd52837184c` — production 0.1.0
- `54ab8edac1ba469f0081c636e11f6059d712becc` — production 0.2.0

README redirect pushed (`ef712a3`). Repository archived. Description points at
`modula-mod/modula-vault-notes`. History was not deleted.
