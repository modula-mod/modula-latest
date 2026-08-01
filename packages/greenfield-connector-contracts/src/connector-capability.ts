export const GREENFIELD_CONNECTOR_CAPABILITIES = [
  'identity.profile.read',
  'email.messages.read',
  'email.messages.send',
  'email.drafts.create',
  'email.labels.read',
  'email.labels.update',
  'calendar.events.read',
  'calendar.events.create',
  'calendar.events.update',
  'calendar.events.delete',
  'calendar.availability.read',
  'contacts.people.read',
  'storage.files.read',
  'storage.files.write',
  'storage.files.share',
  'documents.pages.read',
  'documents.pages.create',
  'documents.pages.update',
  'messaging.channels.read',
  'messaging.messages.read',
  'messaging.messages.send',
  'source-control.repositories.read',
  'source-control.issues.read',
  'source-control.issues.create',
  'source-control.pull-requests.read',
  'project-management.items.read',
  'project-management.items.create',
  'project-management.items.update',
  'webhook.events.receive',
  'webhook.events.send',
  'rest.request.execute.reviewed',
] as const

export type GreenfieldKnownConnectorCapability = (typeof GREENFIELD_CONNECTOR_CAPABILITIES)[number]
export type GreenfieldConnectorCapability = GreenfieldKnownConnectorCapability | (string & {})

const CAPABILITY_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/

export function isGreenfieldConnectorCapability(value: string): value is GreenfieldConnectorCapability {
  return CAPABILITY_PATTERN.test(value) && !value.includes('*')
}

export function assertGreenfieldConnectorCapability(value: string): asserts value is GreenfieldConnectorCapability {
  if (!isGreenfieldConnectorCapability(value)) {
    throw new Error(`Invalid connector capability: ${value}`)
  }
}
