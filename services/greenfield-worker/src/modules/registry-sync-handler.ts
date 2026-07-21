import type {WorkerConfig} from '../config.js'
import type {ModulaWorkerDb} from '../database.js'
import {permanentModuleJob} from './module-job-errors.js'

export async function handleModuleRegistrySync(_db: ModulaWorkerDb, config: WorkerConfig, _payload: unknown): Promise<void> {
  if (!config.moduleGithubSyncEnabled) return
  throw permanentModuleJob('VALIDATION_FAILED', 'Automatic GitHub module sync is disabled for Phase 7A trusted-checkout import')
}

export async function handleModuleGithubJob(_db: ModulaWorkerDb, config: WorkerConfig, _payload: unknown): Promise<void> {
  if (!config.moduleGithubSyncEnabled) return
  throw permanentModuleJob('VALIDATION_FAILED', 'GitHub App sync is documented but disabled for Phase 7A')
}
