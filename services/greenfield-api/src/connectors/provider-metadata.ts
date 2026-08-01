import type {
  GreenfieldConnectorDefinition,
  GreenfieldConnectorKind,
} from '@modula/greenfield-connector-contracts'
import {computeConnectorReadiness} from '@modula/greenfield-connector-contracts'

type ConnectorMetadataInput = Omit<
  GreenfieldConnectorDefinition,
  | 'providerType'
  | 'configuredStatus'
  | 'availabilityStatus'
  | 'health'
  | 'adapterTrusted'
  | 'operational'
  | 'rateLimit'
>

const DEFAULT_RATE_LIMIT = {windowSeconds: 60, maximumRequests: 60}

export const GREENFIELD_INITIAL_CONNECTOR_PROVIDER_IDS = [
  'modula.google',
  'modula.microsoft',
  'modula.github',
  'modula.slack',
  'modula.notion',
  'modula.nextcloud',
  'modula.webhook',
  'modula.generic-rest',
] as const

export type GreenfieldInitialConnectorProviderId = (typeof GREENFIELD_INITIAL_CONNECTOR_PROVIDER_IDS)[number]

export function loadGreenfieldConnectorProviderDefinitions(): GreenfieldConnectorDefinition[] {
  return [
    oauthProvider({
      providerId: 'modula.google',
      displayName: 'Google',
      connectorKinds: ['identity', 'email', 'calendar', 'contacts', 'storage', 'documents'],
      capabilities: [
        'identity.profile.read',
        'email.messages.read',
        'email.drafts.create',
        'email.labels.read',
        'calendar.events.read',
        'calendar.events.create',
        'calendar.availability.read',
        'contacts.people.read',
        'storage.files.read',
        'storage.files.write',
        'documents.pages.read',
      ],
      iconRef: 'google',
      privacySummary: 'Google data is available only after account-level connection permission is granted.',
      dataAccessSummary: 'Profile, email, calendar, contacts, Drive file and document metadata may be accessed according to granted capabilities.',
      supportedActions: [
        action('email.drafts.create', 'Create Gmail draft', 'reversible-write', 'required-by-default'),
        action('calendar.events.create', 'Create Google Calendar event', 'external-consequential-write', 'always-required'),
      ],
      sync: {supported: true, modes: ['manual', 'scheduled'], resourceKinds: ['profile', 'message', 'event', 'contact', 'file', 'document']},
      webhook: {supported: true, signatureRequired: true, signatureAlgorithm: 'provider-managed', eventTypes: ['gmail.message', 'calendar.event', 'drive.file']},
      requiredConfigurationKeys: ['clientId', 'clientSecret', 'redirectUri'],
    }),
    oauthProvider({
      providerId: 'modula.microsoft',
      displayName: 'Microsoft',
      connectorKinds: ['identity', 'email', 'calendar', 'contacts', 'storage', 'documents'],
      capabilities: [
        'identity.profile.read',
        'email.messages.read',
        'email.drafts.create',
        'calendar.events.read',
        'calendar.events.create',
        'calendar.availability.read',
        'contacts.people.read',
        'storage.files.read',
        'documents.pages.read',
      ],
      iconRef: 'microsoft',
      privacySummary: 'Microsoft data is available only after account-level connection permission is granted.',
      dataAccessSummary: 'Microsoft profile, mailbox, calendar, contacts, OneDrive and document metadata may be accessed according to granted capabilities.',
      supportedActions: [
        action('email.drafts.create', 'Create Outlook draft', 'reversible-write', 'required-by-default'),
        action('calendar.events.create', 'Create Outlook calendar event', 'external-consequential-write', 'always-required'),
      ],
      sync: {supported: true, modes: ['manual', 'scheduled'], resourceKinds: ['profile', 'message', 'event', 'contact', 'file', 'document']},
      webhook: {supported: true, signatureRequired: true, signatureAlgorithm: 'provider-managed', eventTypes: ['graph.change']},
      requiredConfigurationKeys: ['clientId', 'clientSecret', 'tenant', 'redirectUri'],
    }),
    oauthProvider({
      providerId: 'modula.github',
      displayName: 'GitHub',
      connectorKinds: ['source-control', 'project-management'],
      capabilities: [
        'identity.profile.read',
        'source-control.repositories.read',
        'source-control.issues.read',
        'source-control.issues.create',
        'source-control.pull-requests.read',
      ],
      iconRef: 'github',
      privacySummary: 'GitHub data is available only after account-level connection permission is granted.',
      dataAccessSummary: 'GitHub profile, repository, issue and pull request metadata may be accessed according to granted capabilities.',
      supportedActions: [
        action('source-control.issues.create', 'Create GitHub issue', 'external-consequential-write', 'always-required'),
      ],
      sync: {supported: true, modes: ['manual', 'scheduled', 'webhook-driven'], resourceKinds: ['profile', 'repository', 'issue']},
      webhook: {supported: true, signatureRequired: true, signatureAlgorithm: 'provider-managed', eventTypes: ['issues', 'pull_request', 'repository']},
      requiredConfigurationKeys: ['clientId', 'clientSecret', 'webhookSecret', 'redirectUri'],
    }),
    oauthProvider({
      providerId: 'modula.slack',
      displayName: 'Slack',
      connectorKinds: ['messaging', 'automation'],
      capabilities: [
        'identity.profile.read',
        'messaging.channels.read',
        'messaging.messages.read',
        'messaging.messages.send',
      ],
      iconRef: 'slack',
      privacySummary: 'Slack workspace data is available only after connection permission and workspace authorisation are granted.',
      dataAccessSummary: 'Slack profile, channel and message metadata may be accessed according to granted capabilities.',
      supportedActions: [
        action('messaging.messages.send', 'Send Slack message', 'external-consequential-write', 'always-required'),
      ],
      sync: {supported: true, modes: ['manual', 'webhook-driven'], resourceKinds: ['profile', 'channel', 'message']},
      webhook: {supported: true, signatureRequired: true, signatureAlgorithm: 'provider-managed', eventTypes: ['message', 'app_mention']},
      requiredConfigurationKeys: ['clientId', 'clientSecret', 'signingSecret', 'redirectUri'],
    }),
    oauthProvider({
      providerId: 'modula.notion',
      displayName: 'Notion',
      connectorKinds: ['documents', 'project-management'],
      capabilities: [
        'identity.profile.read',
        'documents.pages.read',
        'documents.pages.create',
        'documents.pages.update',
        'project-management.items.read',
        'project-management.items.create',
        'project-management.items.update',
      ],
      iconRef: 'notion',
      privacySummary: 'Notion workspace data is available only after account-level connection permission is granted.',
      dataAccessSummary: 'Notion page, database and task-like item metadata may be accessed according to granted capabilities.',
      supportedActions: [
        action('documents.pages.create', 'Create Notion page', 'reversible-write', 'required-by-default'),
        action('project-management.items.update', 'Update Notion item', 'external-consequential-write', 'always-required'),
      ],
      sync: {supported: true, modes: ['manual', 'scheduled'], resourceKinds: ['profile', 'document', 'rest-resource']},
      webhook: {supported: false, signatureRequired: true, signatureAlgorithm: 'provider-managed', eventTypes: []},
      requiredConfigurationKeys: ['clientId', 'clientSecret', 'redirectUri'],
    }),
    provider({
      providerId: 'modula.nextcloud',
      displayName: 'Nextcloud',
      connectorKinds: ['identity', 'storage', 'documents', 'calendar', 'contacts'],
      capabilities: [
        'identity.profile.read',
        'storage.files.read',
        'storage.files.write',
        'storage.files.share',
        'documents.pages.read',
        'calendar.events.read',
        'contacts.people.read',
      ],
      iconRef: 'nextcloud',
      privacySummary: 'Nextcloud data is available only after account-level connection permission is granted.',
      dataAccessSummary: 'Nextcloud profile, file, document, calendar and contact metadata may be accessed according to granted capabilities.',
      authorisation: {
        method: 'api-key',
        requiresBackendFlow: true,
        supportsPkce: false,
        requiredConfiguration: ['baseUrl'],
      },
      requiredConfiguration: [
        {key: 'baseUrl', required: true, secret: false, description: 'Allowed Nextcloud host URL'},
      ],
      supportedActions: [
        action('storage.files.write', 'Write Nextcloud file', 'external-consequential-write', 'always-required'),
      ],
      sync: {supported: true, modes: ['manual', 'scheduled'], resourceKinds: ['profile', 'file', 'event', 'contact']},
      webhook: {supported: true, signatureRequired: true, signatureAlgorithm: 'hmac-sha256', eventTypes: ['file.updated']},
    }),
    provider({
      providerId: 'modula.webhook',
      displayName: 'Signed Webhook',
      connectorKinds: ['webhook', 'automation'],
      capabilities: ['webhook.events.receive', 'webhook.events.send'],
      iconRef: 'webhook',
      privacySummary: 'Webhook payloads are accepted only for explicitly configured signed endpoints.',
      dataAccessSummary: 'Webhook event metadata and signed payload summaries may be processed according to endpoint configuration.',
      authorisation: {
        method: 'signed-webhook',
        requiresBackendFlow: true,
        supportsPkce: false,
        requiredConfiguration: ['signingSecret'],
      },
      requiredConfiguration: [
        {key: 'signingSecret', required: true, secret: true, description: 'Endpoint signing secret'},
      ],
      supportedActions: [
        action('webhook.events.send', 'Send signed webhook', 'external-consequential-write', 'always-required'),
      ],
      sync: {supported: false, modes: ['none'], resourceKinds: []},
      webhook: {supported: true, signatureRequired: true, signatureAlgorithm: 'hmac-sha256', eventTypes: ['custom']},
    }),
    provider({
      providerId: 'modula.generic-rest',
      displayName: 'Reviewed REST',
      connectorKinds: ['generic-rest', 'automation'],
      capabilities: ['rest.request.execute.reviewed'],
      iconRef: 'rest',
      privacySummary: 'REST requests require reviewed hosts, SSRF controls and explicit account permission before use.',
      dataAccessSummary: 'Only reviewed request and response metadata may be processed through this connector.',
      authorisation: {
        method: 'api-key',
        requiresBackendFlow: true,
        supportsPkce: false,
        requiredConfiguration: ['allowedHosts'],
      },
      requiredConfiguration: [
        {key: 'allowedHosts', required: true, secret: false, description: 'Reviewed HTTPS host allow-list'},
      ],
      supportedActions: [
        action('rest.request.execute.reviewed', 'Execute reviewed REST request', 'external-consequential-write', 'always-required'),
      ],
      sync: {supported: false, modes: ['none'], resourceKinds: []},
      webhook: {supported: false, signatureRequired: true, signatureAlgorithm: 'hmac-sha256', eventTypes: []},
    }),
  ]
}

function oauthProvider(input: Omit<ConnectorMetadataInput, 'authorisation' | 'requiredConfiguration'> & {requiredConfigurationKeys: string[]}): GreenfieldConnectorDefinition {
  return provider({
    ...input,
    authorisation: {
      method: 'oauth2',
      requiresBackendFlow: true,
      supportsPkce: true,
      requiredConfiguration: input.requiredConfigurationKeys,
      callbackPath: `/v1/connectors/${input.providerId}/callback`,
    },
    requiredConfiguration: input.requiredConfigurationKeys.map(key => ({
      key,
      required: true,
      secret: key.toLowerCase().includes('secret'),
      description: `${input.displayName} connector ${key}`,
    })),
  })
}

function provider(input: ConnectorMetadataInput): GreenfieldConnectorDefinition {
  const definition: GreenfieldConnectorDefinition = {
    providerType: input.providerId === 'modula.generic-rest' || input.providerId === 'modula.webhook' ? 'generic' : 'trusted-provider',
    configuredStatus: 'not-configured',
    availabilityStatus: 'available',
    health: {status: 'not-checked'},
    adapterTrusted: true,
    operational: false,
    rateLimit: DEFAULT_RATE_LIMIT,
    ...input,
  }
  return {
    ...definition,
    operational: computeConnectorReadiness(definition).operational,
  }
}

function action(
  capability: GreenfieldConnectorDefinition['capabilities'][number],
  displayName: string,
  writeClassification: GreenfieldConnectorDefinition['supportedActions'][number]['writeClassification'],
  confirmationPolicy: GreenfieldConnectorDefinition['supportedActions'][number]['confirmationPolicy'],
): GreenfieldConnectorDefinition['supportedActions'][number] {
  return {
    actionId: capability,
    displayName,
    capability,
    writeClassification,
    confirmationPolicy,
    timeoutMs: 10_000,
    inputSchema: {type: 'object'},
    outputSchema: {type: 'object'},
  }
}

export function connectorKindsFor(providerId: GreenfieldInitialConnectorProviderId): GreenfieldConnectorKind[] {
  const definition = loadGreenfieldConnectorProviderDefinitions().find(item => item.providerId === providerId)
  return definition?.connectorKinds ?? []
}
