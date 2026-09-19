# Modula Local Intelligence

**Status:** Mission 01 + 01A (shared semantics; no model runtime)  
**Package (Greenfield):** `@modula/intelligence-core`  
**Native runtime owner:** `modula-native` (Swift) — not yet implemented  
**Rule:** AI proposes. Modula validates. Modula authorizes. Modula executes.  
**Privacy:** `local-only` means local-only. No silent network fallback.

---

## Shared semantics (not a single runtime)

```text
                  SHARED SPECIFICATION

        @modula/intelligence-core (TypeScript)
        + intelligence-protocol.md (concepts)
                 │
                 │ contracts / protocol concepts
                 │ (compatible semantics — not runtime coupling)
                 │
        ┌────────┴─────────┐
        │                  │
        ▼                  ▼
   GREENFIELD         MODULA-NATIVE
   services           Swift implementation
        │                  │
        ▼                  ▼
   GAIA / AKI        Local Intelligence
   remote AI         Apple / Modula models
```

Greenfield defines shared intelligence **semantics**.  
`modula-native` owns native **local intelligence**.  
Expo is **not** the bridge between them.

The Swift implementation does **not** import or execute the TypeScript package.  
Both sides align through documented contracts (see `intelligence-protocol.md`).

---

## Runtime ownership

### `@modula/intelligence-core` (Greenfield) owns

- shared vocabulary and contracts
- privacy semantics
- provider semantics
- tool semantics
- routing semantics
- module-facing interfaces
- GAIA / AKI compatibility concepts
- server / shared routing concepts

### `modula-native` owns

- Swift implementation
- local inference
- model loading and lifecycle
- Apple system model integration
- device resource management
- local native tool execution
- offline AI runtime
- device capability detection

### Greenfield / server infrastructure owns

- GAIA
- AKI
- remote execution
- server intelligence
- cross-device services
- cloud escalation

---

## Layer map (conceptual)

```text
Modula feature / module
        │
        ▼
Intelligence API  (shared facade concepts)
        │
        ▼
Intelligence Router
        │
        ▼
Provider adapters
 ┌──────┼─────────┬──────────┐
 │      │         │          │
Local  System   Modula     Remote
model  model    GAIA/AKI   external
```

Modules interact only with an Intelligence API surface. Modules do **not**:

- instantiate models
- call Apple Foundation Models / Core AI directly
- call llama.cpp, LiteRT, or HTTP LLM APIs directly
- embed provider-specific prompts as the public contract

---

## Relationship to Greenfield AI Gateway

Greenfield Phase 7E established a **server-side** AI gateway (`GreenfieldAIRequestContract`, provider registry, usage ledger) for hosted / account-managed AI.

`@modula/intelligence-core` is the **shared semantic** counterpart for privacy-aware routing and provider abstraction in Greenfield. Device-local inference lives in `modula-native`.

| Concern | Greenfield AI Gateway | Intelligence Core | modula-native |
| --- | --- | --- | --- |
| Primary runtime | Backend / hosted | TypeScript contracts + router | Swift / on-device |
| Privacy default | Policy engine | Explicit per-request privacy | Must honor same invariants |
| Mission 01 scope | Existing | Contracts + deterministic test provider | Not started |

Future GAIA / AKI escalation routes through an Intelligence Router as remote/system Modula providers — never as a silent fallback for `local-only`.

---

## Privacy policies

| Policy | Behavior |
| --- | --- |
| `local-only` | Local providers only. If none eligible → **fail closed**. Remote `execute()` is never invoked. |
| `prefer-local` | Local when available. Remote only if local cannot satisfy **and** Modula settings permit remote intelligence. |
| `allow-remote` | Remote permitted; routing may still prefer a sufficient local provider. |

### Privacy Invariant P1

When execution policy is `local-only`, an implementation **MUST NOT**:

- select a remote provider
- invoke a remote provider
- silently change privacy policy
- queue a remote execution for later
- upload input for preprocessing
- upload tool arguments

Failure must be explicit. This is a platform-wide Modula invariant and must be replicated in Swift tests when Mission 02+ lands.

### Offline behavior

```text
NO NETWORK
    │
    ▼
local-only requests
    │
    ▼
local provider
    │
    ├── available → execute
    │
    └── unavailable → explicit failure
```

There is **never** a hidden cloud fallback.

---

## Contract alignment (not code sharing)

Do **not** design around:

```text
Swift calling TypeScript intelligence-core
TypeScript controlling Swift inference
```

Instead:

```text
Shared specification
        │
    ┌───┴───┐
    │       │
TypeScript Swift
```

Both may implement compatible concepts (`local-only` / `prefer-local` / `allow-remote`, capabilities such as `summarize`, tool proposal shapes) without runtime coupling.

---

## Public API (Greenfield Mission 01)

```ts
import {createModulaIntelligence, DeterministicTestProvider} from '@modula/intelligence-core'

const ai = createModulaIntelligence()
ai.providers.register(new DeterministicTestProvider())

const result = await ai.execute({
  capability: 'summarize',
  input: {text: 'Modula is a modular social operating system.'},
  privacy: 'local-only',
  metadata: {source: 'module', moduleId: 'vault-notes'},
})
```

Convenience methods (`summarize`, `rewrite`, …) may be added later without changing the provider contract.

In the Greenfield host, the facade may be exposed as `services.ai` for module/host diagnostics. That wiring exercises shared semantics — it is **not** the native iPhone intelligence runtime.

---

## Tools

Models may propose Modula tool calls. The pipeline is:

```text
AI proposal
  → tool schema validation
  → permission check
  → Modula action validation (later missions)
  → execution (later missions)
```

Never:

```text
AI output → eval()
AI output → shell / SQL / arbitrary filesystem / HTTP
```

Unknown tools, invalid arguments, and missing permissions are **rejected**.

This rule is runtime-independent: neither Greenfield nor future native Swift intelligence may allow arbitrary code execution.

---

## Data retention

By default, `@modula/intelligence-core` does **not** persist:

- request input
- AI output
- tool arguments
- personal context

Diagnostics may record structural fields only: request id, capability, provider id, local/remote, duration, status, error category.

---

## Mission 01 validation (acceptance)

Mission 01 / 01A acceptance is:

```text
package type safety
        +
unit tests
        +
privacy tests
        +
routing tests
        +
tool validation
        +
Greenfield integration checks (workspace wiring)
```

Expo / React Native simulator builds are **not** a Mission 01 gate.  
Historical Expo client smoke from Mission 01 may exist as incidental evidence only.

---

## Mission 02 boundary (prepared, not implemented)

Mission 02 starts in **`modula-native`** and builds a pure Swift Modula Intelligence foundation.

Conceptual native shape (Swift naming not frozen):

```text
ModulaIntelligence
│
├── IntelligenceRouter
├── ProviderRegistry
├── ToolRegistry
│
├── AppleSystemProvider        (Mission 03+)
├── ModulaLocalProvider        (Mission 04+)
└── RemoteEscalationProvider   (Mission 09+)
```

Do **not** implement in Greenfield Mission 01 / 01A:

- Swift / Foundation Models / Core AI
- Expo native modules as an intelligence bridge
- llama.cpp / GGUF / Metal
- model downloads or storage
- token streaming
- Kotlin / LiteRT

---

## Progression

```text
MISSION 01
Greenfield Intelligence Core
        ✅

MISSION 01A
Remove obsolete Expo assumptions
        ✅ (this document)

MISSION 02
modula-native — Swift Intelligence Foundation
        ↓

MISSION 03
Apple On-Device Provider
        ↓

MISSION 04
Modula-Owned Local Model Provider
        ↓

MISSION 05
Native Model Manager
        ↓

MISSION 06
Native Offline Intelligence Features
        ↓

MISSION 07
Local Embeddings / Semantic Retrieval
        ↓

MISSION 08
Offline Command Layer
        ↓

MISSION 09
GAIA / AKI Escalation
        ↓

MISSION 10
Unified Local + Remote Intelligence Fabric
```

---

## Related docs

- `docs/architecture/intelligence-protocol.md` — stable conceptual vocabulary
- `docs/architecture/intelligence-architecture.md` — GAIA / AKI / Governor product layers
- `docs/architecture/greenfield-ai-routing.md` — server AI gateway routing
