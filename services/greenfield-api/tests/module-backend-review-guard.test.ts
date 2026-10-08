import {describe, expect, it, vi} from 'vitest'
import type {ModuleBackendDefinition} from '@modula/greenfield-module-manifest'
import type {AppConfig} from '../src/config/index.js'
import type {ModulaDb} from '../src/database/client.js'
import {GreenfieldModuleActionService} from '../src/modules/action-service.js'
import {ModuleBackendCapabilityService} from '../src/modules/backend/capability-service.js'
import {ModuleBackendGatewayService} from '../src/modules/backend/gateway-service.js'
import {ModuleBackendTokenService} from '../src/modules/backend/token-service.js'
import {GreenfieldModuleRuntimeAccessService, type GreenfieldModuleRuntimeContext} from '../src/modules/runtime-access.js'

const actionId = 'digital.modula.review-test.action.ping'
const backend = {
  mode: 'module-managed',
  actions: [{actionId, permissions: []}],
} as unknown as ModuleBackendDefinition
const context = {
  accountId: 'account:test',
  moduleId: 'digital.modula.review-test',
  installationId: 'installation:test',
  installationStatus: 'enabled',
  releaseId: 'release:test',
  version: '1.0.0',
  extensionVersionId: 'extension-version:test',
  releaseState: 'published',
  manifest: {permissions: [], backend},
  permissionReviewRequired: true,
  grantedPermissions: [],
} as GreenfieldModuleRuntimeContext

describe('module backend missing-review boundary', () => {
  it('does not treat a declared zero-permission action as granted without a review', () => {
    const resolver = new ModuleBackendCapabilityService()
    expect(resolver.resolve(context, backend)).toContainEqual(expect.objectContaining({capability: actionId, available: true, granted: false}))
    expect(resolver.resolve({...context, permissionReviewRequired: false}, backend))
      .toContainEqual(expect.objectContaining({capability: actionId, available: true, granted: true}))
  })

  it('denies the generic action service before idempotent replay or backend invocation', async () => {
    const resolve = vi.spyOn(GreenfieldModuleRuntimeAccessService.prototype, 'resolve').mockResolvedValue(context)
    const invoke = vi.spyOn(ModuleBackendGatewayService.prototype, 'executeAction')
    try {
      const service = new GreenfieldModuleActionService({} as ModulaDb, {} as AppConfig)
      await expect(service.execute(context.accountId, context.moduleId, actionId, {idempotencyKey: 'prior-result'}))
        .rejects.toMatchObject({code: 'PERMISSION_REVIEW_REQUIRED'})
      expect(invoke).not.toHaveBeenCalled()
    } finally {
      resolve.mockRestore()
      invoke.mockRestore()
    }
  })

  it('denies direct backend gateway calls before repository, discovery, token issuance or outbound calls', async () => {
    const gateway = new ModuleBackendGatewayService({} as ModulaDb, {} as AppConfig)
    await expect(gateway.executeAction({context, actionId, actorId: 'actor:test', payload: {}, idempotencyKey: 'fresh'}))
      .rejects.toMatchObject({code: 'PERMISSION_REVIEW_REQUIRED'})
  })

  it('does not issue a backend token directly without review', async () => {
    const tokens = new ModuleBackendTokenService({} as ModulaDb, {} as AppConfig)
    await expect(tokens.issue({
      context,
      backend: {authentication: {tokenExchangeRequired: true}} as ModuleBackendDefinition,
      actorId: 'actor:test',
      permissions: [],
      capabilities: [actionId],
    })).rejects.toMatchObject({code: 'PERMISSION_REVIEW_REQUIRED'})
  })
})
