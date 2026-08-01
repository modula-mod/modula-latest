import type {GreenfieldConnectorCapability} from './connector-capability.js'

export type GreenfieldConnectorActionWriteClassification =
  | 'read-only'
  | 'reversible-write'
  | 'external-consequential-write'

export type GreenfieldConnectorActionConfirmationPolicy =
  | 'not-required'
  | 'required-by-default'
  | 'always-required'

export type GreenfieldConnectorActionDefinition = {
  actionId: string
  displayName: string
  capability: GreenfieldConnectorCapability
  writeClassification: GreenfieldConnectorActionWriteClassification
  confirmationPolicy: GreenfieldConnectorActionConfirmationPolicy
  timeoutMs: number
  inputSchema: unknown
  outputSchema: unknown
}

export type GreenfieldConnectorActionRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type GreenfieldConnectorActionResult = {
  actionRunId: string
  actionId: string
  status: GreenfieldConnectorActionRunStatus
  output?: unknown
  errorCode?: string
}
