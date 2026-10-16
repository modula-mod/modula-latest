# GreenField v1 Native handoff index

Native consumes frozen GreenField contracts; it does not infer them from the
web preview.

- Platform: `module-platform-02-contract.md` and
  `module-platform-02b-contract-addendum.md`.
- Product UI and host capabilities:
  `module-platform-02-native-product-ui-handoff.md`.
- Distribution, install/update, artifact verification, compatibility, and
  rollback: `module-distribution-03-native-handoff.md`.
- Identity, permissions, records, references, history, sync, media, sharing,
  functions, actions, search, and intelligence policy:
  `greenfield-v1-contract-freeze.md`.
- Errors and HTTP semantics: `greenfield-v1-error-codes.md`.
- Versioned decoding fixtures: `fixtures/greenfield-v1-native/1.0.0`.

Native-specific work remains responsible for cache-first storage, ModuleHost
transport, SwiftUI rendering, local Nodus execution, native media pickers, and
device lifecycle. Those responsibilities do not permit backend wire behavior to
change silently.

