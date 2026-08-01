# AI Result Application

AI generation and record mutation are separate operations.

Required flow:

generate suggestion -> preview or diff -> explicit approval -> ownership check -> optimistic concurrency check -> schema validation -> normal note revision -> metadata-only events.

The apply route is:

`POST /v1/modules/:moduleId/ai/executions/:executionId/apply`

The server validates that the execution belongs to the same account and installation, is not expired, has not already been applied, matches the action application mode and still targets the expected revision. The selected result is hash checked so a tampered result cannot be applied.

Accepted Vault Notes AI output is written through the generic module record service as a normal note revision. Version metadata records `changeSource: "ai-assisted"`, the AI execution id, action id and prompt identity. Provider secrets and raw provider request bodies are never stored in note version provenance.

Search changes only after the note revision is created. Rejected suggestions and previews are not indexed.
