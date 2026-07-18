# Modula intelligence & system architecture

**Status:** Canonical model (2026-07-18)  
**Rule:** GAIA executes · AKI verifies · AGI Governor controls  
**Honesty:** Preview UI may explain layers. No unrestricted agents, fake ledgers, or silent private-module access.

---

## Layer map

| System | Primary responsibility | Simple interpretation |
| --- | --- | --- |
| **GAIA** | Context, interaction, execution | Intelligence users work with |
| **AKI** | Verification, evidence, forensic reasoning | Checks GAIA |
| **AGI Governor** | Goals, permissions, orchestration, governance | Authority above agents |
| **Circuit Memory** | Private structured long-term memory | Learned muscle memory |
| **Kaizen** | Continuous product & intelligence improvement | Improvement engine |
| **Foundry** | Data prep, training, evaluation, promotion | Model-development factory |
| **Claims Graph** | Evidence-backed knowledge relationships | Map of what is believed |
| **Ledger & Replay** | Auditable record of actions and decisions | Black-box recorder |
| **Command Layer** | Common execution router | Bridge UI ↔ AI ↔ modules |
| **Module Forge** | Creation & publication of modules | Developer construction system |

Earlier notes that treated “AGI” as the direct executor are superseded: the Governor controls; GAIA executes through the Command Layer under AKI validation.

---

## Flow (example)

User: “Review client conversations and send follow-ups.”

1. **GAIA** interprets and prepares a plan  
2. **Command Layer** resolves CRM + Messaging commands  
3. **AKI** verifies recipients, permissions, claims  
4. **Governor** decides approval mode (individual / batch)  
5. User reviews proposed actions  
6. **GAIA** executes via permitted modules  
7. **Ledger** records everything  
8. **Kaizen** later evaluates friction  

---

## Phase order (summary)

| Phase | Focus |
| --- | --- |
| **A** | Make existing product real (shell, social, appearance, profiles, device QA) |
| **B** | Platform (manifest, Registry, install, permissions, Command Layer, Forge foundations) |
| **C** | Attention & privacy (Focus policy engine, Glass Privacy enforcement, Chat Assist) |
| **D** | Intelligence safely (GAIA read-only → confirmed commands → AKI → Ledger → Memory → Kaizen → Governor → Claims → Foundry) |
| **E** | Ecosystem (Notes, Tasks, CRM, Marketplace, Teams, Automations, DIMON, Atlas, autonomy) |

Full phase checklist: `docs/architecture/intelligence-phases.md`.

---

## Non-negotiables

1. GAIA is **not** an unrestricted assistant.  
2. Every consequential action: attributable, reversible where possible, user-visible.  
3. Modules expose capabilities via **manifest + skill.md** (digital DNA).  
4. Focus Mode and Glass Privacy must affect real surfaces — not decorative toggles.  
5. Foundry does **not** train models until provenance, review packs, and evaluation gates exist.  
6. DIMON remains inactive until shell, social, and module standard are stable.

---

## Product Preview surfaces

Host Preview routes (no production intelligence runtime yet):

| Layer | Route |
| --- | --- |
| Intelligence Hub | `/product/intelligence` |
| GAIA | `/product/gaia` |
| AKI | `/product/aki` |
| AGI Governor | `/product/governor` |
| Circuit Memory | `/product/circuit-memory` |
| Kaizen | `/product/kaizen` |
| Foundry | `/product/foundry` |
| Claims Graph | `/product/claims-graph` |
| Ledger & Replay | `/product/ledger` |
| Command Layer | `/product/commands` |
| Module Forge | `/product/forge` |
| Gaia Atlas | `/product/gaia-atlas` |

---

## Related docs

- `docs/architecture/module-standards.md`  
- `docs/architecture/module-boundary.md`  
- `docs/architecture/dimon-future-integration-boundary.md`  
- `docs/design/forge-builder-inspiration.md`  
- `templates/modula-module/skill.md`  
