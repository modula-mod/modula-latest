import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {
  canViewerSeeProfileField,
  type ModulaProfile,
  type ProfileLink,
  type ProfileViewerRelationship,
} from '@/features/profile/contracts/profile'
import type {ProfileModulePreview} from '@/features/profile/contracts/profileModules'
import {demoProfileModules} from '@/features/profile/data/demoProfileModules'

/**
 * Public profile modules for snapshot preview and the full Modules tab.
 * Installed does not mean public — visibility is filtered here.
 */
export function resolvePublicProfileModules(
  profile: ModulaProfile,
  viewer: ProfileViewerRelationship,
  catalogue: ModuleCatalogueItem[] = [],
): ProfileModulePreview[] {
  const demo = demoProfileModules[profile.id] ?? []
  const demoById = new Map(demo.map(module => [module.id, module]))
  const catalogueById = new Map(catalogue.map(item => [item.moduleId, item]))

  return profile.featuredModuleIds
    .map(moduleId => {
      const normalized = normalizeLegacyProfileModuleId(moduleId)
      const fromDemo = demoById.get(moduleId) ?? demoById.get(normalized)
      if (fromDemo) return fromDemo
      const fromCatalogue =
        catalogueById.get(moduleId) ?? catalogueById.get(normalized)
      return fromCatalogue ? catalogueItemToPreview(fromCatalogue) : null
    })
    .filter((module): module is ProfileModulePreview => Boolean(module))
    .filter(module => canViewerSeeProfileField(module.visibility, viewer))
}

export function resolvePublicProfileLinks(
  profile: ModulaProfile,
  viewer: ProfileViewerRelationship,
): ProfileLink[] {
  return [profile.website, ...profile.links].filter(
    (link): link is ProfileLink =>
      Boolean(link && canViewerSeeProfileField(link.visibility, viewer)),
  )
}

export function normalizeLegacyProfileModuleId(moduleId: string): string {
  if (moduleId === 'module-vault-notes') return 'digital.modula.vault-notes'
  if (moduleId === 'module-tasks') return 'digital.modula.tasks'
  if (moduleId === 'module-dimon-core') return 'digital.dimon.core'
  return moduleId
}

function catalogueItemToPreview(module: ModuleCatalogueItem): ProfileModulePreview {
  const enabled =
    module.installationState === 'enabled' || module.installationState === 'installed'
  return {
    id: module.moduleId,
    name: module.name,
    description: module.description,
    icon: module.kind === 'system' ? 'settings' : 'modules',
    status: enabled ? 'featured' : module.installable ? 'available' : 'preview',
    visibility: 'public',
    actionLabel: enabled ? 'Open' : module.installable ? 'Available' : 'Preview',
  }
}
