export type GreenfieldFunctionExecutionMode =
  | 'synchronous'
  | 'backgroundJob'
  | 'remoteHttp'

/**
 * Function manifests declare typed I/O and execution mode.
 * Arbitrary JavaScript source is not permitted inside a manifest.
 */
export type GreenfieldFunctionManifest = {
  functionId: string
  name: string
  description?: string

  inputSchemaId: string
  outputSchemaId: string

  executionMode: GreenfieldFunctionExecutionMode

  requiredCapabilities: string[]
  timeoutMs: number
  idempotent: boolean
}
