# Intelligence protocol (shared vocabulary)

**Status:** Conceptual specification (Mission 01A)  
**Rule:** Compatible semantics across Greenfield TypeScript and `modula-native` Swift — not shared runtime code.

This document freezes the vocabulary both implementations should honor. It is not a code-generation schema.

---

## Capabilities

Stable initial set:

```text
generate
rewrite
summarize
classify
extract
intent
tool-call
```

Later capabilities (vision, speech, embeddings, RAG, agents, memory, training) may be added without invalidating this set.

---

## Privacy

```text
local-only
prefer-local
allow-remote
```

### Invariant P1 (`local-only`)

An implementation MUST NOT, when policy is `local-only`:

- select a remote provider
- invoke a remote provider
- silently change the privacy policy
- queue remote execution for later
- upload input for preprocessing
- upload tool arguments

Failure MUST be explicit (typed error / equivalent native failure).

---

## Availability

Providers report richer state than a boolean, including:

```text
available
unavailable
unsupported-device
model-not-installed
model-downloading
disabled
permission-denied
offline
temporarily-unavailable
```

---

## Provider provenance

Every completed response MUST make execution provenance visible:

```text
request id
capability
output
execution: local | remote
provider id
duration (optional)
```

Do not expose chain-of-thought as a required public field.  
Do not auto-persist prompts or outputs in the core layer.

---

## Tool calls

Models propose tools; Modula retains authority:

```text
AI proposes
  → schema validation
  → permission check
  → Modula action validation
  → execution
```

A model MUST NOT receive arbitrary shell, eval, SQL, filesystem, HTTP, deep-link, or native-method execution paths unless those are explicitly registered Modula capabilities.

Unknown / invalid / unauthorized tool calls are rejected.

---

## Execution result / errors

Typed failure categories include at least:

```text
NO_ELIGIBLE_PROVIDER
LOCAL_PROVIDER_UNAVAILABLE
REMOTE_EXECUTION_FORBIDDEN
CAPABILITY_UNSUPPORTED
TOOL_NOT_FOUND
TOOL_ARGUMENTS_INVALID
TOOL_PERMISSION_DENIED
REQUEST_CANCELLED
PROVIDER_FAILURE
```

Callers MUST NOT rely on free-form error strings for control flow.

---

## Ownership reminder

| Layer | Owner |
| --- | --- |
| Shared vocabulary / contracts | Greenfield `@modula/intelligence-core` + this protocol |
| Device-local inference | `modula-native` (Swift) |
| GAIA / AKI / remote escalation | Greenfield server / shared services |

Expo is not the bridge between Greenfield semantics and native local intelligence.

See also: `docs/architecture/local-intelligence.md`.
