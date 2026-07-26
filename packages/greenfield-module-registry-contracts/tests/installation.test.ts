import {describe, expect, it} from 'vitest'
import {assertInstallationTransition, canTransitionInstallation} from '../src/index.js'

describe('module installation state machine', () => {
  it('allows the install, enable, disable, update, quarantine and removal paths', () => {
    expect(canTransitionInstallation('notInstalled', 'resolving')).toBe(true)
    expect(canTransitionInstallation('resolving', 'permissionReview')).toBe(true)
    expect(canTransitionInstallation('permissionReview', 'installing')).toBe(true)
    expect(canTransitionInstallation('installing', 'installedDisabled')).toBe(true)
    expect(canTransitionInstallation('installedDisabled', 'enabling')).toBe(true)
    expect(canTransitionInstallation('enabling', 'enabled')).toBe(true)
    expect(canTransitionInstallation('enabled', 'disabling')).toBe(true)
    expect(canTransitionInstallation('disabled', 'updating')).toBe(true)
    expect(canTransitionInstallation('enabled', 'uninstalling')).toBe(true)
    expect(canTransitionInstallation('enabled', 'quarantined')).toBe(true)
    expect(canTransitionInstallation('quarantined', 'uninstalling')).toBe(true)
  })

  it('rejects arbitrary route-assigned statuses', () => {
    expect(() => assertInstallationTransition('enabled', 'removed')).toThrow(/Invalid module installation transition/)
    expect(canTransitionInstallation('notInstalled', 'enabled')).toBe(false)
  })
})
