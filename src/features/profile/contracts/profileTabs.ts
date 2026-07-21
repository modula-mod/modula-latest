import type {AppIconName} from '@/components/primitives/AppIcon'
import type {
  ModulaProfile,
  ProfileKind,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'

export type ProfileTabSource =
  | 'core'
  | 'module'
  | 'user'

export type ProfileTabKind =
  | 'posts'
  | 'media'
  | 'about'
  | 'modules'
  | 'links'
  | 'custom'

export type ProfileTabVisibility =
  | 'public'
  | 'followers'
  | 'owner'

export type ProfileTabManifest = {
  id: string
  title: string
  accessibilityLabel: string
  icon: AppIconName
  kind: ProfileTabKind
  source: ProfileTabSource
  rendererKey: string
  defaultOrder: number
  defaultEnabled: boolean
  visibility: ProfileTabVisibility
  supportedProfileKinds: ProfileKind[]
  moduleId?: string
}

export type ProfileTabRendererProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
  tab: ProfileTabManifest
}

export type ProfileTabRenderer =
  React.ComponentType<ProfileTabRendererProps>

export interface ProfileTabRegistry {
  registerManifest(manifest: ProfileTabManifest): void
  registerRenderer(
    rendererKey: string,
    renderer: ProfileTabRenderer,
  ): void
  getManifest(tabId: string): ProfileTabManifest | null
  getRenderer(rendererKey: string): ProfileTabRenderer | null
  getAllManifests(): ProfileTabManifest[]
}

export type ModuleProfileTabContribution = {
  moduleId: string
  manifest: ProfileTabManifest
  rendererKey: string
  requiredPermissions: string[]
}
