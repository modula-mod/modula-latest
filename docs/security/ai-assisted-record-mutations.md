# AI-Assisted Record Mutations

AI suggestions require human approval before any record changes. The runtime stores short-lived result material separately from durable note history and applies only after the user selects an explicit action.

The server rejects expired results, already-applied executions, cross-account executions, cross-installation executions, stale revisions and tampered result payloads. A hash of the structured result is checked during apply.

Applied changes are ordinary module record updates with redacted provenance. Audit metadata may record action id, execution id, prompt id/version, provider/model metadata, status and usage. There are no provider secrets, note body, selected text, generated text or raw request bodies in audit records.

Unsafe autonomous behavior is not introduced. Vault Notes cannot silently mutate records, create Tasks records, assign tags or run undeclared tools.
