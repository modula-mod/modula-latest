import {describe, expect, it} from 'vitest'
import type {WorkerConfig} from '../src/config.js'
import {
  buildHestiaApiFormBody,
  HestiaApiMailProviderAdapter,
  HestiaApiProviderError,
  quotaBytesToMiB,
  type HestiaApiResponse,
  type HestiaApiTransport,
} from '../src/mail/hestia-api.js'

// Unit tests for the Hestia REST API mail adapter. Every test injects a fake
// transport — nothing here touches the network or a live Hestia panel.

type RecordedCall = {cmd: string; args: string[]}

const ok = (body = '{}'): HestiaApiResponse => ({exitCode: 0, httpStatus: 200, body})
const notExist = (): HestiaApiResponse => ({exitCode: 10, httpStatus: 400, body: 'Error: object does not exist'})
const alreadyExists = (): HestiaApiResponse => ({exitCode: 4, httpStatus: 400, body: 'Error: object exists'})
const failed = (exitCode = 1): HestiaApiResponse => ({exitCode, httpStatus: 400, body: `Error: exit ${exitCode}`})

function makeConfig(overrides: Partial<WorkerConfig> = {}): WorkerConfig {
  return {
    mailHestiaUser: 'andrei',
    mailDomain: 'modula.digital',
    mailDefaultQuotaBytes: 1_073_741_824,
    mailProvisionerCommandTimeoutMs: 10_000,
    mailHestiaApiUrl: 'https://host.docker.internal:8083/api/',
    mailHestiaApiKey: 'test-access-key-id',
    mailHestiaApiSecret: 'test-access-secret-value',
    ...overrides,
  } as WorkerConfig
}

function fakeTransport(script: (call: RecordedCall) => HestiaApiResponse): {
  transport: HestiaApiTransport
  calls: RecordedCall[]
} {
  const calls: RecordedCall[] = []
  const transport: HestiaApiTransport = async (cmd, args) => {
    const call = {cmd, args: [...args]}
    calls.push(call)
    return script(call)
  }
  return {transport, calls}
}

const provisionInput = {
  localPart: 'alice',
  domain: 'modula.digital',
  address: 'alice@modula.digital',
  secret: 'mailbox-secret-0123456789abcdef',
}

describe('quotaBytesToMiB', () => {
  it('converts 1 GiB to 1024 MiB', () => {
    expect(quotaBytesToMiB(1_073_741_824)).toBe(1024)
  })

  it('rounds to the nearest MiB and never goes below 1', () => {
    expect(quotaBytesToMiB(1_610_612_736)).toBe(1536)
    expect(quotaBytesToMiB(524_288)).toBe(1)
    expect(quotaBytesToMiB(1)).toBe(1)
  })
})

describe('buildHestiaApiFormBody', () => {
  it('uses the field names and order access_key, secret_key, cmd, arg1...', () => {
    const body = buildHestiaApiFormBody('key-id', 'sekrit', 'v-list-mail-account', [
      'andrei',
      'modula.digital',
      'alice',
      'json',
    ]).toString()
    expect(body).toBe(
      'access_key=key-id&secret_key=sekrit&cmd=v-list-mail-account&arg1=andrei&arg2=modula.digital&arg3=alice&arg4=json',
    )
  })
})

describe('HestiaApiMailProviderAdapter', () => {
  it('health() calls v-list-mail-domain with user, domain and json', async () => {
    const {transport, calls} = fakeTransport(() => ok())
    const adapter = new HestiaApiMailProviderAdapter(makeConfig(), transport)
    await expect(adapter.health()).resolves.toEqual({status: 'healthy', provider: 'hestia-api'})
    expect(calls).toEqual([{cmd: 'v-list-mail-domain', args: ['andrei', 'modula.digital', 'json']}])
  })

  it('provision() lists first, then adds a missing account with the quota in MiB', async () => {
    const {transport, calls} = fakeTransport(call =>
      call.cmd === 'v-list-mail-account' ? notExist() : ok(),
    )
    const adapter = new HestiaApiMailProviderAdapter(makeConfig(), transport)
    const result = await adapter.provision(provisionInput)
    expect(result).toEqual({
      providerReference: 'hestia:andrei:modula.digital:alice',
      quotaBytes: 1_073_741_824,
      storageUsedBytes: 0,
    })
    expect(calls).toEqual([
      {cmd: 'v-list-mail-account', args: ['andrei', 'modula.digital', 'alice', 'json']},
      {
        cmd: 'v-add-mail-account',
        args: ['andrei', 'modula.digital', 'alice', 'mailbox-secret-0123456789abcdef', '1024'],
      },
    ])
  })

  it('provision() adopts an existing account by rotating its password (list-first adopt path)', async () => {
    const {transport, calls} = fakeTransport(() => ok('{"alice": {"QUOTA": "1024"}}'))
    const adapter = new HestiaApiMailProviderAdapter(makeConfig(), transport)
    const result = await adapter.provision(provisionInput)
    expect(result.providerReference).toBe('hestia:andrei:modula.digital:alice')
    expect(calls).toEqual([
      {cmd: 'v-list-mail-account', args: ['andrei', 'modula.digital', 'alice', 'json']},
      {
        cmd: 'v-change-mail-account-password',
        args: ['andrei', 'modula.digital', 'alice', 'mailbox-secret-0123456789abcdef'],
      },
    ])
    expect(calls.some(call => call.cmd === 'v-add-mail-account')).toBe(false)
  })

  it('provision() falls through to rotate when v-add races with E_EXISTS', async () => {
    const {transport, calls} = fakeTransport(call => {
      if (call.cmd === 'v-list-mail-account') return notExist()
      if (call.cmd === 'v-add-mail-account') return alreadyExists()
      return ok()
    })
    const adapter = new HestiaApiMailProviderAdapter(makeConfig(), transport)
    const result = await adapter.provision(provisionInput)
    expect(result.providerReference).toBe('hestia:andrei:modula.digital:alice')
    expect(calls.map(call => call.cmd)).toEqual([
      'v-list-mail-account',
      'v-add-mail-account',
      'v-change-mail-account-password',
    ])
    expect(calls[2].args).toEqual(['andrei', 'modula.digital', 'alice', 'mailbox-secret-0123456789abcdef'])
  })

  it('availability() reports provider_exists on exit 0 and available on E_NOTEXIST', async () => {
    const existing = fakeTransport(() => ok())
    const adapter = new HestiaApiMailProviderAdapter(makeConfig(), existing.transport)
    await expect(
      adapter.availability({localPart: 'alice', domain: 'modula.digital', address: 'alice@modula.digital'}),
    ).resolves.toEqual({available: false, reason: 'provider_exists'})

    const missing = fakeTransport(() => notExist())
    const adapter2 = new HestiaApiMailProviderAdapter(makeConfig(), missing.transport)
    await expect(
      adapter2.availability({localPart: 'alice', domain: 'modula.digital', address: 'alice@modula.digital'}),
    ).resolves.toEqual({available: true, reason: null})
  })

  it('surfaces a non-zero exit as a provider failure naming the command and exit code', async () => {
    const {transport} = fakeTransport(() => failed(1))
    const adapter = new HestiaApiMailProviderAdapter(makeConfig(), transport)
    await expect(adapter.health()).rejects.toThrowError(HestiaApiProviderError)
    await expect(adapter.health()).rejects.toThrowError(/v-list-mail-domain failed \(exit 1\) \(HTTP 400\)/)
  })

  it('never leaks the mailbox secret or the API key/secret into thrown messages', async () => {
    const secret = 'mailbox-secret-0123456789abcdef'
    const throwing: HestiaApiTransport = async () => {
      throw new Error(`panel exploded while handling ${secret} with test-access-key-id / test-access-secret-value`)
    }
    const adapter = new HestiaApiMailProviderAdapter(makeConfig(), throwing)
    let message = ''
    try {
      await adapter.provision({...provisionInput, secret})
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).not.toContain(secret)
    expect(message).not.toContain('test-access-key-id')
    expect(message).not.toContain('test-access-secret-value')
    expect(message).toContain('[redacted]')
  })

  it('keeps a non-zero provider error free of secret material too', async () => {
    const {transport} = fakeTransport(call =>
      call.cmd === 'v-list-mail-account' ? notExist() : failed(2),
    )
    const adapter = new HestiaApiMailProviderAdapter(makeConfig(), transport)
    let message = ''
    try {
      await adapter.provision(provisionInput)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).not.toContain(provisionInput.secret)
    expect(message).toContain('v-add-mail-account failed (exit 2)')
  })

  it('adopt() verifies existence and returns the stored reference', async () => {
    const {transport, calls} = fakeTransport(() => ok())
    const adapter = new HestiaApiMailProviderAdapter(makeConfig(), transport)
    const result = await adapter.adopt({
      localPart: 'alice',
      domain: 'modula.digital',
      address: 'alice@modula.digital',
      providerReference: 'hestia:andrei:modula.digital:alice',
    })
    expect(result).toEqual({providerReference: 'hestia:andrei:modula.digital:alice'})
    expect(calls).toEqual([{cmd: 'v-list-mail-account', args: ['andrei', 'modula.digital', 'alice', 'json']}])

    const missing = fakeTransport(() => notExist())
    const adapter2 = new HestiaApiMailProviderAdapter(makeConfig(), missing.transport)
    await expect(
      adapter2.adopt({
        localPart: 'alice',
        domain: 'modula.digital',
        address: 'alice@modula.digital',
        providerReference: 'hestia:andrei:modula.digital:alice',
      }),
    ).rejects.toThrowError(/v-list-mail-account failed \(exit 10\)/)
  })

  it('suspend/resume/release map to the matching Hestia commands', async () => {
    const {transport, calls} = fakeTransport(() => ok())
    const adapter = new HestiaApiMailProviderAdapter(makeConfig(), transport)
    const input = {localPart: 'alice', domain: 'modula.digital', address: 'alice@modula.digital'}
    await expect(adapter.suspend(input)).resolves.toEqual({
      providerReference: 'hestia:andrei:modula.digital:alice',
    })
    await expect(adapter.resume(input)).resolves.toEqual({
      providerReference: 'hestia:andrei:modula.digital:alice',
    })
    await expect(adapter.release(input)).resolves.toEqual({
      providerReference: 'hestia:andrei:modula.digital:alice:released',
    })
    expect(calls.map(call => call.cmd)).toEqual([
      'v-suspend-mail-account',
      'v-unsuspend-mail-account',
      'v-delete-mail-account',
    ])
  })

  it('forward() adds a forward when enabled and tolerates a failed delete when disabled', async () => {
    const {transport, calls} = fakeTransport(call =>
      call.cmd === 'v-delete-mail-account-forward' ? failed(10) : ok(),
    )
    const adapter = new HestiaApiMailProviderAdapter(makeConfig(), transport)
    const base = {localPart: 'alice', domain: 'modula.digital', address: 'alice@modula.digital'}
    await expect(
      adapter.forward({...base, enabled: true, destination: 'elsewhere@example.com', keepLocalCopy: true}),
    ).resolves.toEqual({providerReference: 'hestia:andrei:modula.digital:alice'})
    await expect(
      adapter.forward({...base, enabled: false, destination: null, keepLocalCopy: true}),
    ).resolves.toEqual({providerReference: 'hestia:andrei:modula.digital:alice'})
    expect(calls).toEqual([
      {
        cmd: 'v-add-mail-account-forward',
        args: ['andrei', 'modula.digital', 'alice', 'elsewhere@example.com'],
      },
      {cmd: 'v-delete-mail-account-forward', args: ['andrei', 'modula.digital', 'alice']},
    ])
  })
})
