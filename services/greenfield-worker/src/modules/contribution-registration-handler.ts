import type {ModulaWorkerDb} from '../database.js'

type ContributionRow = {
  contribution_id: string
  module_id: string
  contribution_type: string
  contribution_key: string
  manifest: any
  execution_required: boolean
}

export async function registerModuleContributions(db: ModulaWorkerDb, releaseId: string, extensionVersionId: string, options: {enableExecutable: boolean}) {
  const contributions = await db
    .selectFrom('greenfield_module_contributions')
    .selectAll()
    .where('release_id', '=', releaseId)
    .execute()

  for (const contribution of contributions as ContributionRow[]) {
    const status = contribution.execution_required && !options.enableExecutable ? 'disabled' : 'registered'
    await registerKnownContribution(db, contribution, extensionVersionId, status)
  }
}

export async function unregisterModuleContributions(db: ModulaWorkerDb, releaseId: string) {
  await db
    .updateTable('greenfield_module_contributions')
    .set({registration_status: 'disabled', updated_at: new Date()})
    .where('release_id', '=', releaseId)
    .execute()
}

async function registerKnownContribution(db: ModulaWorkerDb, contribution: ContributionRow, extensionVersionId: string, status: string) {
  const now = new Date()
  const functionExecutable = status === 'registered' && contribution.manifest.executionRequired === true && contribution.manifest.mode !== 'declarative'
  if (contribution.contribution_type === 'tool') {
    await db
      .insertInto('greenfield_tools')
      .values({
        tool_id: contribution.manifest.toolId ?? contribution.contribution_key,
        slug: contribution.contribution_key,
        display_name: contribution.manifest.title ?? contribution.contribution_key,
        availability: status === 'registered' ? 'active' : 'disabled',
        manifest: contribution.manifest,
        created_at: now,
        updated_at: now,
      })
      .onConflict(oc =>
        oc.column('slug').doUpdateSet({
          display_name: contribution.manifest.title ?? contribution.contribution_key,
          availability: status === 'registered' ? 'active' : 'disabled',
          manifest: contribution.manifest,
          updated_at: now,
        }),
      )
      .execute()
  }
  if (contribution.contribution_type === 'function') {
    await db
      .insertInto('greenfield_functions')
      .values({
        function_id: contribution.manifest.functionId ?? contribution.contribution_key,
        extension_version_id: extensionVersionId,
        name: contribution.manifest.title ?? contribution.contribution_key,
        kind: contribution.manifest.mode === 'remoteHttp' ? 'remoteHttp' : 'background',
        config: {...contribution.manifest, executable: functionExecutable},
        timeout_ms: 10000,
        created_at: now,
      })
      .onConflict(oc =>
        oc.column('function_id').doUpdateSet({
          name: contribution.manifest.title ?? contribution.contribution_key,
          kind: contribution.manifest.mode === 'remoteHttp' ? 'remoteHttp' : 'background',
          config: {...contribution.manifest, executable: functionExecutable},
        }),
      )
      .execute()
  }
  if (contribution.contribution_type === 'widget') {
    await db
      .insertInto('greenfield_widgets')
      .values({widget_id: contribution.manifest.widgetId ?? contribution.contribution_key, extension_version_id: extensionVersionId, manifest: contribution.manifest, created_at: now})
      .onConflict(oc => oc.column('widget_id').doNothing())
      .execute()
  }
  if (contribution.contribution_type === 'plugin') {
    await db
      .insertInto('greenfield_plugins')
      .values({plugin_id: contribution.manifest.pluginId ?? contribution.contribution_key, extension_version_id: extensionVersionId, manifest: contribution.manifest, created_at: now})
      .onConflict(oc => oc.column('plugin_id').doNothing())
      .execute()
  }
  if (contribution.contribution_type === 'connector') {
    await db
      .insertInto('greenfield_connectors')
      .values({connector_id: contribution.manifest.connectorId ?? contribution.contribution_key, extension_version_id: extensionVersionId, manifest: contribution.manifest, created_at: now})
      .onConflict(oc => oc.column('connector_id').doNothing())
      .execute()
  }
  await db
    .updateTable('greenfield_module_contributions')
    .set({registration_status: status as any, updated_at: now})
    .where('contribution_id', '=', contribution.contribution_id)
    .execute()
}
