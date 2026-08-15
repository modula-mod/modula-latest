# Reference policy

Open-source code is source material, not an uncontrolled dependency graph.

## Before transferring any non-trivial code

Record:

- repository
- file
- tag or SHA **actually inspected**
- licence
- modifications Modula needs
- whether the category is `inspired by screenshot` or `copied implementation`

Those are different provenance categories.

## Installed-first

1. Open `node_modules/<pkg>` for the resolved version.
2. Read that version’s types/changelog.
3. Compare Expo docs for **SDK 57**, not `latest`, unless they match.

Commands:

```sh
cat package.json
pnpm exec expo config --type public
pnpm exec expo install --check
pnpm exec expo-doctor
```

Do not treat doctor patch-drift as a reason to upgrade during a visual phase unless the mission says so.

## Dependency admission

Any new package requires `modula-dependencies`: product use case, SDK 57 / New Architecture evidence, licence, register row. Forbidden speculative installs include NativeWind, Tamagui, Paper-as-theme, Moti, FlashList “just in case”, TrueSheet before Expo UI sheet failure is documented.

## Copying from Bluesky / old Modula fork

Forbidden. Study density; reimplement on Modula primitives (`modula-architecture`).
