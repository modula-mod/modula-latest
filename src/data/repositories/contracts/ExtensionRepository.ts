export type ExtensionCentreItem = {
  extensionId: string
  name: string
  description: string
  publisher: string
  version: string
  kind: string
  status: string
  permissions: string[]
  compatibility: string
}

export interface ExtensionRepository {
  listAvailable(): Promise<ExtensionCentreItem[]>
  listInstalled(): Promise<ExtensionCentreItem[]>
  getExtension(extensionId: string): Promise<ExtensionCentreItem | null>
  uninstall(extensionId: string): Promise<void>
  disable(extensionId: string): Promise<void>
}
