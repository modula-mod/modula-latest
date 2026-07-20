/**
 * Example module entry — lives in an external package, not the host.
 * Host loads modules only through approved Registry / sandbox contracts.
 */

export const MODULE_ID = 'digital.modula.example'

export type ExampleModuleProps = {
  /** Theme tokens provided by host — never hardcode brand colours. */
  colours: {
    accent: string
    text: string
    canvas: string
  }
  /** Namespaced storage key prefix from host. */
  storageNamespace: string
}

export function getExampleModuleTitle(): string {
  return 'Example Module'
}
