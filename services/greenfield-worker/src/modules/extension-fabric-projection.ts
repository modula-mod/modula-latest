export type ExtensionRuntimeProjectionState =
  | 'INSTALLING'
  | 'INSTALLED'
  | 'ENABLING'
  | 'ENABLED'
  | 'DISABLING'
  | 'DISABLED'
  | 'UNINSTALLING'
  | 'UPDATING'
  | 'INCOMPATIBLE'
  | 'QUARANTINED'
  | 'FAILED'
  | 'NOT_INSTALLED'

/** Keeps the authoritative Standard 2.1 projection aligned with worker outcomes. */
export async function projectExtensionLifecycle(db: any, input: {
  installationId: string
  accountId: string
  productId: string
  state: ExtensionRuntimeProjectionState
  errorCode?: string
}) {
  const now = new Date()
  const contributionStatus = input.state === 'ENABLED'
    ? 'enabled'
    : input.state === 'INCOMPATIBLE'
      ? 'incompatible'
      : input.state === 'QUARANTINED'
        ? 'quarantined'
        : input.state === 'FAILED'
          ? 'failed'
          : input.state === 'NOT_INSTALLED'
            ? 'removed'
            : 'disabled'
  const edgeState = input.state === 'ENABLED'
    ? 'enabled'
    : input.state === 'INCOMPATIBLE' || input.state === 'QUARANTINED' || input.state === 'FAILED'
      ? 'incompatible'
      : input.state === 'NOT_INSTALLED'
        ? 'removed'
        : input.state === 'INSTALLED' || input.state === 'INSTALLING'
          ? 'resolved'
          : 'disabled'
  const eventStatus = input.state === 'ENABLED'
    ? 'enabled'
    : input.state === 'QUARANTINED'
      ? 'quarantined'
      : input.state === 'FAILED'
        ? 'failed'
        : input.state === 'NOT_INSTALLED'
          ? 'removed'
          : input.state === 'INSTALLED' || input.state === 'INSTALLING'
            ? 'registered'
            : 'disabled'
  const healthState = input.state === 'QUARANTINED'
    ? 'quarantined'
    : input.state === 'FAILED'
      ? 'failed'
      : input.state === 'INCOMPATIBLE'
        ? 'unavailable'
        : input.state === 'DISABLED' || input.state === 'NOT_INSTALLED'
          ? 'disabled'
          : 'healthy'

  await db.updateTable('greenfield_extension_runtime_projection')
    .set({state: input.state, health_state: healthState, last_error_code: input.errorCode ?? null, projected_at: now, updated_at: now})
    .where('account_id', '=', input.accountId)
    .where('installation_id', '=', input.installationId)
    .execute()
  await db.updateTable('greenfield_extension_contribution_registrations')
    .set({status: contributionStatus, last_error_code: input.errorCode ?? null, updated_at: now})
    .where('account_id', '=', input.accountId)
    .where('installation_id', '=', input.installationId)
    .where('status', '!=', 'removed')
    .execute()
  await db.updateTable('greenfield_extension_installation_edges')
    .set({state: edgeState, updated_at: now})
    .where('account_id', '=', input.accountId)
    .where('source_installation_id', '=', input.installationId)
    .where('state', '!=', 'removed')
    .execute()
  await db.updateTable('greenfield_extension_event_subscriptions')
    .set({status: eventStatus, updated_at: now})
    .where('account_id', '=', input.accountId)
    .where('installation_id', '=', input.installationId)
    .where('status', '!=', 'removed')
    .execute()
  await db.insertInto('greenfield_extension_lifecycle_events').values({
    event_id: `extension-event:${input.installationId}:${input.state}:${now.getTime()}`,
    account_id: input.accountId,
    extension_id: input.productId,
    event: `extension.${input.state.toLowerCase()}`,
    from_status: null,
    to_status: input.state,
    detail: {installationId: input.installationId, errorCode: input.errorCode ?? null},
    created_at: now,
  }).execute()
}
