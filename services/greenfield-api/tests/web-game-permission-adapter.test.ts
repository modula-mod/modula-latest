import {describe, expect, it} from 'vitest'
import {webGamePermissionsFromMps} from '../src/modules/github-release-sync-service.js'

const mps = {
  identity: {id: 'digital.modula.orbit-phaser'},
  backend: {records: [{id: 'playerProgress'}, {id: 'gameSettings'}]},
  permissions: [
    {id: 'records:read', reason: 'Read game progress', risk: 'low'},
    {id: 'records:write', reason: 'Save game progress', risk: 'medium'},
  ],
}

describe('canonical web game permission adapter', () => {
  it('expands each broad MPS request into only the declared module collections', () => {
    expect(webGamePermissionsFromMps(mps)).toEqual([
      {permission: 'records:module.digital.modula.orbit-phaser.gameSettings:read', reason: 'Read game progress', risk: 'low'},
      {permission: 'records:module.digital.modula.orbit-phaser.gameSettings:write', reason: 'Save game progress', risk: 'medium'},
      {permission: 'records:module.digital.modula.orbit-phaser.playerProgress:read', reason: 'Read game progress', risk: 'low'},
      {permission: 'records:module.digital.modula.orbit-phaser.playerProgress:write', reason: 'Save game progress', risk: 'medium'},
    ])
  })

  it('rejects unsupported and duplicate permission declarations', () => {
    expect(() => webGamePermissionsFromMps({...mps, permissions: [{id: 'native:camera', reason: 'Camera', risk: 'high'}]}))
      .toThrow(/Unsupported web game permission/)
    expect(() => webGamePermissionsFromMps({...mps, backend: {records: [{id: 'playerProgress'}, {id: 'playerProgress'}]}}))
      .toThrow(/duplicated/)
  })
})
