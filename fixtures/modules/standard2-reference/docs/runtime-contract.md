# Runtime Contract

The reference fixture is declarative. The Modula host owns invocation through the Greenfield service gateway.

- Module: `digital.modula.standard2-reference`
- Service: `digital.modula.standard2-reference.service.analyze-text`
- API declaration: `/api/modula/digital.modula.standard2-reference/analyze`
- Capability provided: `modula.reference.text-analysis`
- Required dependency: `digital.modula.reference-provider@^1.0.0`
- Optional dependency: provider contract `modula.reference.calendar@^1.0.0`
- Recommended dependency: `digital.modula.reference-recommender@^1.0.0`
- Conflict: `digital.modula.reference-conflict@^1.0.0`

The fixture does not expose arbitrary JSX, host-executed UI code, lifecycle scripts, install scripts, network calls, or filesystem mutation.
