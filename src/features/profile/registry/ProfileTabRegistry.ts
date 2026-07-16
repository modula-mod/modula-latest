import type {
  ProfileTabManifest,
  ProfileTabRegistry as ProfileTabRegistryContract,
  ProfileTabRenderer,
} from '@/features/profile/contracts/profileTabs'

export class RuntimeProfileTabRegistry implements ProfileTabRegistryContract {
  private manifests = new Map<string, ProfileTabManifest>()
  private renderers = new Map<string, ProfileTabRenderer>()

  registerManifest(manifest: ProfileTabManifest): void {
    this.manifests.set(manifest.id, manifest)
  }

  registerRenderer(rendererKey: string, renderer: ProfileTabRenderer): void {
    this.renderers.set(rendererKey, renderer)
  }

  getManifest(tabId: string): ProfileTabManifest | null {
    return this.manifests.get(tabId) ?? null
  }

  getRenderer(rendererKey: string): ProfileTabRenderer | null {
    return this.renderers.get(rendererKey) ?? null
  }

  getAllManifests(): ProfileTabManifest[] {
    return [...this.manifests.values()].sort(
      (a, b) => a.defaultOrder - b.defaultOrder,
    )
  }
}
