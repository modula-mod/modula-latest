# AI Product Action Recovery

AI product action failures are recoverable without changing ordinary module data. A failed or rejected suggestion does not alter the source note or search index.

Operational checks:

- Provider unavailable: leave execution failed and show provider-neutral status.
- Quota exhausted: block new execution and keep Vault Notes usable.
- Permission revoked: block AI execution and keep ordinary Notes actions enabled.
- Streaming interrupted: reconnect through the provider runtime stream replay path while the stream is retained.
- Expired result: require regeneration instead of applying stale content.
- Revision conflict: require the user to review the current note and request a fresh suggestion.

Recovery must not replay raw note content from audit logs or domain events. Request content is transient, completed suggestions are short-lived, and accepted output persists only as the resulting normal note revision.
