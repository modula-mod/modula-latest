# PVP Platform Phase 2 extension manifest specification

Canonical contract: Modula Module Standard 2.1 (`mms-v2.1.0`).

Greenfield envelope: `manifestVersion: 2`, `standardVersion: 2.1.0`.

## `extensionProduct`

```json
{
  "version": "0.1.0",
  "kind": "addon",
  "targets": [{
    "productId": "digital.modula.vault-notes",
    "versionRange": ">=1.2.0 <2.0.0",
    "requiredCapabilities": ["notes.read"],
    "requiredExtensionPoints": ["digital.modula.vault-notes.note.actions"]
  }],
  "extensionPoints": [],
  "contributions": [{
    "id": "summarise",
    "title": "Summarise",
    "kind": "menu.item",
    "extensionPoint": "digital.modula.vault-notes.note.actions",
    "functionId": "digital.modula.vault-notes.ai.function.summarise",
    "requiredCapability": "notes.read",
    "availability": {
      "platforms": ["ios", "android", "web"],
      "requiresOnline": true
    }
  }],
  "retention": {
    "defaultMode": "KEEP_DATA",
    "supportsUserChoice": true,
    "metadataNamespace": "digital.modula.vault-notes.ai"
  },
  "graphPolicy": {"maxDepth": 16, "maxNodes": 256}
}
```

## Validation rules

- `version` is semantic and matches the release product version.
- `kind` is one of module/addon/plugin/function/tool/widget/connector/service.
- A module has no targets or cross-product contributions and must work alone.
- Add-ons/plugins require at least one target; a product cannot target itself.
- IDs are globally namespaced; target version ranges are bounded semver ranges.
- Extension points declare accepted contribution kinds, optional capability and
  platform conditions, and a bounded contribution count.
- Contributions reference a declared target point, approved kind, one
  action/function/view/widget contract, required capability, availability, and
  bounded priority.
- Retention is `KEEP_DATA` or `DELETE_DATA`; metadata namespace equals the
  owning extension ID.
- Graph depth is 1..16 and nodes 1..256.
- Wildcard capabilities, embedded executable code, arbitrary render/HTML/JS,
  direct URLs, provider secrets, and copied Standard source are rejected.

## Immutable release fields

The surrounding manifest must pin GitHub repository, release tag, 40-character
commit, manifest/artifact checksums, publisher, Standard compatibility, minimum
host, supported platforms, and any required native/Greenfield capabilities.
Installation resolves that release, never a branch head.

## Compatibility

Standard 1.x, 2.0, and existing module manifests remain accepted. The 2.1
`extensionProduct` section is optional for legacy products and forbidden on a
manifest that does not declare Standard 2.1.
