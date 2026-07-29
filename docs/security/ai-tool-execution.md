# AI Tool Execution

Block 9 connects provider-requested tool calls to the existing Block 8 validation broker, but only for deterministic read-only tools.

Tool flow:

1. Provider requests a tool through the internal adapter context.
2. Broker loads the registered declaration.
3. Input schema is validated.
4. Module permissions are checked.
5. Policy is evaluated.
6. Confirmation requirements are enforced.
7. The tool executes only if it is allowlisted and read-only.
8. Output schema is validated.
9. A sanitized result is returned to the provider.
10. Tool run metadata and audit events are recorded.

Allowed in Block 9:

- `greenfield.metadata.read`
- Module-scoped deterministic test read tools ending in `.test.read`

Denied in Block 9:

- Internal writes.
- External writes.
- Financial side effects.
- Destructive actions.
- Arbitrary module mutations.
- Autonomous multi-step tool loops.

Tool runs store argument hashes and redacted details. They do not store unrestricted argument bodies or tool output bodies.
