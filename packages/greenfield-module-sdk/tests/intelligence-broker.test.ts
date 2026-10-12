import {describe, expect, it, vi} from 'vitest'
import {createModuleIntelligenceBroker, type ModuleIntelligenceAuthorization, type ModuleIntelligenceExecution} from '../src/intelligence-broker.js'

const authorized: ModuleIntelligenceAuthorization = {
  trustedRelease: true, reviewCompleted: true, capabilityGranted: true,
  remoteAllowed: true, classificationAllowed: true, providerAllowed: true,
}

const provider = (providerClass: 'local' | 'remote', execute = vi.fn(async () => ({ok: true}))): ModuleIntelligenceExecution => ({
  provider: {
    providerId: `fixture.${providerClass}`, providerClass, version: '1.0.0',
    supportedTasks: ['summarize', 'rewrite'], maximumInput: 4096, streaming: true,
    privacyClasses: ['private', 'public'], available: true,
  },
  transport: providerClass === 'local' ? 'host-capability' : 'greenfield-remote',
  execute,
})

const request = {task: 'summarize' as const, policy: 'localOnly' as const, input: 'controlled fixture', privacyClass: 'private'}

describe('universal module intelligence broker', () => {
  it('makes localOnly structurally host-only and returns unavailable with zero network transmission', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network must not be reached'))
    const remoteExecute = vi.fn(async () => globalThis.fetch('https://fixture.invalid/intelligence'))
    try {
      const broker = createModuleIntelligenceBroker({remote: provider('remote', remoteExecute), authorization: authorized})
      await expect(broker.request(request)).rejects.toMatchObject({code: 'CAPABILITY_UNAVAILABLE'})
      expect(remoteExecute).not.toHaveBeenCalled()
      expect(network).not.toHaveBeenCalled()
    } finally {
      network.mockRestore()
    }
  })

  it('selects local for preferLocal and an approved provider for allowRemote', async () => {
    const localExecute = vi.fn(async () => ({local: true}))
    const remoteExecute = vi.fn(async () => ({remote: true}))
    const broker = createModuleIntelligenceBroker({local: provider('local', localExecute), remote: provider('remote', remoteExecute), authorization: authorized})
    await expect(broker.request({...request, policy: 'preferLocal'})).resolves.toMatchObject({route: 'local', providerId: 'fixture.local'})
    await expect(broker.request({...request, policy: 'allowRemote'})).resolves.toMatchObject({route: 'remote', providerId: 'fixture.remote'})
    expect(localExecute).toHaveBeenCalledTimes(1)
    expect(remoteExecute).toHaveBeenCalledTimes(1)
  })

  it('publishes provider negotiation facts without pretending local is server-side', () => {
    const broker = createModuleIntelligenceBroker({local: provider('local'), remote: provider('remote'), authorization: authorized})
    expect(broker.discovery()).toEqual({
      schemaVersion: '1.0.0',
      providers: expect.arrayContaining([
        expect.objectContaining({providerClass: 'local', supportedTasks: ['summarize', 'rewrite'], maximumInput: 4096, streaming: true}),
        expect.objectContaining({providerClass: 'remote'}),
      ]),
    })
  })

  it('validates structured provider output before returning it to a module', async () => {
    const local = provider('local', vi.fn(async () => ({summary: 42})))
    const broker = createModuleIntelligenceBroker({local, authorization: authorized})
    await expect(broker.request({...request, outputSchema: {
      type: 'object', required: ['summary'], additionalProperties: false,
      properties: {summary: {type: 'string'}},
    }})).rejects.toMatchObject({code: 'VALIDATION_FAILED'})
  })

  it.each([
    ['trustedRelease', 'UNTRUSTED_RELEASE'],
    ['reviewCompleted', 'PERMISSION_REVIEW_REQUIRED'],
    ['capabilityGranted', 'MODULE_PERMISSION_DENIED'],
  ] as const)('fails closed when %s is false', async (field, code) => {
    const broker = createModuleIntelligenceBroker({local: provider('local'), authorization: {...authorized, [field]: false}})
    await expect(broker.request(request)).rejects.toMatchObject({code})
  })

  it('does not silently downgrade privacy when remote policy is incomplete', async () => {
    const remoteExecute = vi.fn(async () => ({remote: true}))
    const broker = createModuleIntelligenceBroker({remote: provider('remote', remoteExecute), authorization: {...authorized, classificationAllowed: false}})
    await expect(broker.request({...request, policy: 'preferLocal'})).rejects.toMatchObject({code: 'REMOTE_POLICY_DENIED'})
    expect(remoteExecute).not.toHaveBeenCalled()
  })
})
