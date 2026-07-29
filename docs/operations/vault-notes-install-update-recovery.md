# Vault Notes Install, Update And Recovery

Vault Notes enters Modula through Greenfield registry metadata.

## Install Flow

1. Import immutable release metadata.
2. Publish to the target channel.
3. Run compatibility validation.
4. Preview permissions.
5. Create installation plan.
6. Register record schemas, views, actions, settings, events and search.
7. Enable the module.
8. Read module health.

Do not hardcode Vault Notes as enabled.

## Update Flow

Permission expansion requires review. Schema changes must bump `dataSchemaVersion`. Manifest representation changes must bump `manifestSchemaVersion`.

## Recovery

If a release checksum is invalid, import or installation fails closed. Existing records remain retained unless the user explicitly chooses delete-data uninstall with the required confirmation policy.

Rollback for Block 6 uses migration `022_phase7e_module_records_and_vault_notes.down.sql` against disposable databases only.
