import {describe, expect, it} from 'vitest'
import {handleModuleGithubJob, handleModuleRegistrySync} from '../src/modules/registry-sync-handler.js'
import {handleModulePluginLifecycle} from '../src/modules/plugin-lifecycle-handler.js'

const config = {
  moduleGithubSyncEnabled: false,
  moduleCommunityExecutionEnabled: false,
  moduleRemoteFunctionsEnabled: false,
} as any

describe('Phase 7A module worker jobs', () => {
  it('does not require GitHub availability when sync is disabled', async () => {
    await expect(handleModuleRegistrySync({} as any, config, {})).resolves.toBeUndefined()
    await expect(handleModuleGithubJob({} as any, config, {})).resolves.toBeUndefined()
  })

  it('keeps plugin lifecycle declarative and rejects community execution', async () => {
    await expect(handleModulePluginLifecycle({} as any, config, {installationId: 'i', moduleId: 'digital.modula.vault-notes'})).resolves.toBeUndefined()
    await expect(
      handleModulePluginLifecycle({} as any, config, {installationId: 'i', moduleId: 'example.module', trustLevel: 'reviewedCommunity'}),
    ).rejects.toThrow(/Community plugin execution is disabled/)
  })
})
