import {
  MODULA_HOST_CAPABILITY_IDS,
  createHostCapabilityDiscovery,
  type HostCapabilityDescriptor,
} from '@modula/greenfield-module-ui-contracts'

const unavailableProductCapabilities = MODULA_HOST_CAPABILITY_IDS.map(id => ({
  id,
  version: '1.0.0',
  status: 'unavailable' as const,
}))

/**
 * Capabilities truthfully implemented by this Greenfield host build.
 * Advanced semantic Product UI capabilities remain unavailable until a real
 * renderer is connected; the declarations alone never make them available.
 */
export const GREENFIELD_HOST_CAPABILITIES: readonly HostCapabilityDescriptor[] = [
  ...unavailableProductCapabilities,
  {
    id: 'ui.richText',
    version: '1.0.0',
    status: 'degraded',
    renderer: 'greenfield.richText-plainText',
    fallback: {id: 'ui.plainText', version: '1'},
    constraints: {structuredEditing: false, plainTextRoundTrip: true},
  },
  {id: 'ui.plainText', version: '1.0.0', status: 'available', renderer: 'greenfield.form-text'},
  {id: 'share.native', version: '1.0.0', status: 'unavailable'},
  {id: 'game.runtime', version: '1.0.0', status: 'unavailable'},
]

export const GREENFIELD_HOST_CAPABILITY_DISCOVERY = createHostCapabilityDiscovery(GREENFIELD_HOST_CAPABILITIES)

export function discoverGreenfieldHostCapabilities() {
  return GREENFIELD_HOST_CAPABILITY_DISCOVERY
}
