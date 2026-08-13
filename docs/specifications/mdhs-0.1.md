# MDHS 0.1.0 Specification

Schema URI: `modula://schemas/mdhs/0.1.0`

MDHS 0.1.0 defines a generated projection for a Modula avatar revision. The authoritative state remains normalized and revisioned; the projection is a deterministic read model.

Required projection roots:

```text
$schema
avatar
modelStatus
timeline
physical
geometry
materials
rig
expressions
motion
voice
appearance
wardrobe
personas
representations
observations
history
generationProfile
permissions
privacy
provenance
integrity
extensions
```

Attribute rules:

- Unknown is a legitimate state.
- Confidence is `0..1` and means confidence in the observation or claim.
- Missing confidence remains null or undefined; it is not invented.
- Attribute paths must come from the MDHS 0.1 registry or a namespaced extension.
- Stable identity, temporal physical state, and contextual representation state must remain separate.
- Left/right asymmetric attributes are modelled independently.

Revision addressing:

```text
modula://avatar/<avatarId>@latest
modula://avatar/<avatarId>@revision_4
modula://avatar/<avatarId>@2026-08-12
```

Render permission does not imply raw data permission. A module with `avatar.render.image` may request an owner-authorized render without receiving raw biometric assets or identity embeddings.

Provider-specific fields are forbidden in canonical MDHS contracts.
