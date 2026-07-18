import type {ApiClient} from '@/api/client'
import type {
  ExtensionCentreItem,
  ExtensionRepository,
} from '@/data/repositories/contracts/ExtensionRepository'

function decodeItem(value: unknown): ExtensionCentreItem {
  const row = (value ?? {}) as Record<string, unknown>
  return {
    extensionId: String(row.extension_id ?? row.extensionId ?? row.slug ?? 'unknown'),
    name: String(row.name ?? row.slug ?? 'Extension'),
    description: String(row.description ?? ''),
    publisher: String(row.publisher ?? 'Modula'),
    version: String(row.version ?? '0.0.0'),
    kind: String(row.kind ?? (row.manifest as {kind?: string} | undefined)?.kind ?? 'tool'),
    status: String(row.status ?? 'available'),
    permissions: Array.isArray(row.permissions) ? row.permissions.map(String) : [],
    compatibility: String(row.compatibility ?? 'Modula'),
  }
}

function decodeList(value: unknown): ExtensionCentreItem[] {
  if (!Array.isArray(value)) return []
  return value.map(decodeItem)
}

export class ApiExtensionRepository implements ExtensionRepository {
  constructor(private readonly client: ApiClient) {}

  listAvailable(): Promise<ExtensionCentreItem[]> {
    return this.client.get({path: '/v1/extensions'}, decodeList)
  }

  listInstalled(): Promise<ExtensionCentreItem[]> {
    return this.client
      .get({path: '/v1/extensions/installed', authenticated: true}, decodeList)
      .catch(() => [])
  }

  async getExtension(extensionId: string): Promise<ExtensionCentreItem | null> {
    try {
      return await this.client.get(
        {path: `/v1/extensions/${encodeURIComponent(extensionId)}`},
        decodeItem,
      )
    } catch {
      return null
    }
  }

  async uninstall(extensionId: string): Promise<void> {
    await this.client.delete(
      {
        path: `/v1/extensions/${encodeURIComponent(extensionId)}/install`,
        authenticated: true,
      },
      () => undefined,
    )
  }

  async disable(extensionId: string): Promise<void> {
    await this.client.patch(
      {
        path: `/v1/extensions/${encodeURIComponent(extensionId)}/preferences`,
        body: {enabled: false},
        authenticated: true,
      },
      () => undefined,
    )
  }
}
