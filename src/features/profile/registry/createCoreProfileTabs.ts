import {coreProfileTabs} from '@/features/profile/data/coreProfileTabs'
import type {ProfileTabRegistry} from '@/features/profile/contracts/profileTabs'
import {
  AboutProfileTab,
  LinksProfileTab,
  MediaProfileTab,
  ModulesProfileTab,
  PostsProfileTab,
} from '@/features/profile/tabs'

export function createCoreProfileTabs(registry: ProfileTabRegistry): void {
  coreProfileTabs.forEach(manifest => registry.registerManifest(manifest))
  registry.registerRenderer('profile.posts', PostsProfileTab)
  registry.registerRenderer('profile.media', MediaProfileTab)
  registry.registerRenderer('profile.about', AboutProfileTab)
  registry.registerRenderer('profile.modules', ModulesProfileTab)
  registry.registerRenderer('profile.links', LinksProfileTab)
}
