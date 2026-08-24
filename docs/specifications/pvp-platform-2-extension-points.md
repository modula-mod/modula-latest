# PVP Platform Phase 2 extension points

## Contract

An extension point is owned by a product release and declares:

- globally namespaced ID and user-facing title;
- accepted declarative contribution kinds;
- optional required capability;
- supported platforms;
- maximum registered contributions.

The initial kinds are `view.section`, `toolbar.action`, `editor.command`,
`editor.attachment`, `menu.item`, `contextMenu.item`, `settings.section`,
`home.section`, `widget`, `record.decorator`, `search.provider`,
`composer.tool`, and `background.action`.

Every contribution declares its target point, display metadata, one action or
contract, required capability, availability/platform conditions, and priority.
The host renders approved descriptors only. No extension can supply executable
React/JSX, HTML, JavaScript, iframe/WebView, or native code.

## Vault Notes reference points

The canonical Vault Notes 1.2 contract owns:

- `digital.modula.vault-notes.home.section`
- `digital.modula.vault-notes.editor.toolbar`
- `digital.modula.vault-notes.editor.command`
- `digital.modula.vault-notes.editor.attachment`
- `digital.modula.vault-notes.note.actions`
- `digital.modula.vault-notes.note.context-menu`
- `digital.modula.vault-notes.note.inspector`
- `digital.modula.vault-notes.note.after-save`
- `digital.modula.vault-notes.collection.actions`
- `digital.modula.vault-notes.search.provider`
- `digital.modula.vault-notes.composer.tool`
- `digital.modula.vault-notes.settings.section`

Vault Notes imports no optional extension. Its event, record, action, and view
contracts remain usable with zero extension registrations.

## Host resolution

`GET /v1/module-host/:productId/composition` returns core manifest/points plus
enabled registrations filtered by account, target installation, lifecycle,
platform, online state, and grants. Each registration renders through
`module-extension-contributions.tsx`, which catches its own failure and marks
only that contribution unavailable.

Disable/uninstall changes registrations to disabled/removed. The next generic
composition therefore removes commands without modifying or restarting the
target module.
