# MDHS Overview

MDHS 0.1.0 is the Modula Digital Human Schema foundation. It models owner-controlled digital avatar state without replacing Greenfield Account or Modula Identity.

Canonical hierarchy:

```text
HUMAN
  -> MODULA IDENTITY
  -> DIGITAL AVATAR
  -> MDHS
  -> PERSONA
  -> REPRESENTATION
  -> RENDER
```

These terms are not interchangeable in code. Identity is persistent. Appearance is temporal. Representation is contextual.

Examples such as haircut, beard, weight change, age presentation, scar, tattoo, Anime Andrei, Cinema Andrei, Fantasy Andrei, Gubic Andrei, and VR Andrei do not create or rewrite the Modula identity record. They update avatar state or contextual persona/representation state according to explicit revision rules.

MDHS 0.1.0 uses schema URI `modula://schemas/mdhs/0.1.0`. It is not 1.0.

The initial implementation is contracts-first:

- `@modula/avatar-contracts` owns provider-neutral TypeScript contracts.
- The canonical projection is generated from normalized avatar state and revision data.
- The projection is not the authoritative database row.
- Provider adapters normalize into observations and candidate changes.
- Observations do not write canonical state directly.
- Owner review, correction, rejection, and owner locks outrank automated inference.

Out of scope for MDHS 0.1.0:

- cross-person face search
- unknown human identification
- cross-user biometric matching
- custom LoRA training
- voice clone training
- body reconstruction
- real-time 3D rendering
