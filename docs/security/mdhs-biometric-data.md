# MDHS Biometric Data Security

MDHS 0.1.0 treats raw source media, precise geometry, voice identity, motion signatures, identity embeddings, and raw biometric material as sensitive by default.

Security invariants:

- Cross-account MDHS reads are denied unless an explicit capability grant exists.
- Render permission does not grant raw biometric access.
- Short-lived authorized access is required for protected Avatar Vault assets.
- Raw encryption keys are not stored in avatar database records.
- General Modula AI context does not automatically receive private MDHS data.
- General search does not index private MDHS attributes.
- Owner-locked attributes are not silently overwritten by observations.
- Marketplace modules cannot delete core avatar state.

MDHS 0.1.0 explicitly does not implement cross-person face search, unknown-person identification, or cross-user biometric matching.
