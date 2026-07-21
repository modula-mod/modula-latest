import type {WorkerConfig} from '../config.js'
import type {ModulaWorkerDb} from '../database.js'
import {permanentModuleJob} from './module-job-errors.js'

export async function handleModulePluginLifecycle(_db: ModulaWorkerDb, config: WorkerConfig, payload: unknown): Promise<void> {
  const p = payload as any
  if (!p?.installationId && !p?.moduleId) throw permanentModuleJob('VALIDATION_FAILED', 'Invalid module plugin lifecycle payload')
  if (!config.moduleCommunityExecutionEnabled && p.trustLevel && p.trustLevel !== 'firstParty') {
    throw permanentModuleJob('VALIDATION_FAILED', 'Community plugin execution is disabled')
  }
  // First-party plugin lifecycle hooks are declarative in Phase 7A; no module source is executed here.
}
