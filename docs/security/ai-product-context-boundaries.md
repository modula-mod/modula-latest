# AI Product Context Boundaries

Vault Notes AI context is assembled server-side after the module installation, enabled state, declaration, permission grant, account ownership and expected revision have been verified.

The minimum context is sent: current record content for actions that require it, selected content for selection actions, non-sensitive record metadata and authorised module settings. Note content is marked as untrusted data before it reaches the provider runtime.

Do not send unrelated notes, deleted notes, version-history snapshots, another account's records, attachment contents, connector credentials, account secrets, audit metadata or provider credentials.

Prompt instructions require the model to treat note content as untrusted. Embedded note text must not change system policy, request secrets, invoke undeclared tools, access other records or alter output schemas.

Persistent events and audits use allowlisted metadata only. Note text, selected text and generated text stay out of audit records and domain event payloads.
