import type {
  ProfilePresentationPreferences,
  ProfileViewerContext,
  ModulaProfile,
} from '@/features/profile/contracts/profile'
import type {
  ProfileTabManifest,
  ProfileTabVisibility,
} from '@/features/profile/contracts/profileTabs'

function canViewerSeeTab(
  visibility: ProfileTabVisibility,
  viewer: ProfileViewerContext,
): boolean {
  if (visibility === 'public') return true
  if (visibility === 'owner') return viewer.relationship === 'owner'
  return (
    viewer.relationship === 'owner' ||
    viewer.relationship === 'follower' ||
    viewer.relationship === 'mutual'
  )
}

export function resolveProfileTabs({
  manifests,
  profile,
  presentation,
  viewer,
}: {
  manifests: ProfileTabManifest[]
  profile: ModulaProfile
  presentation: ProfilePresentationPreferences
  viewer: ProfileViewerContext
}): ProfileTabManifest[] {
  const enabledIds = new Set(['posts', ...presentation.enabledTabIds])
  const order = new Map(
    ['posts', ...presentation.tabOrder].map((tabId, index) => [tabId, index]),
  )

  const tabs = manifests
    .filter(manifest => manifest.supportedProfileKinds.includes(profile.kind))
    .filter(manifest => canViewerSeeTab(manifest.visibility, viewer))
    .filter(manifest => enabledIds.has(manifest.id))
    .sort((a, b) => {
      const aOrder = order.get(a.id) ?? a.defaultOrder
      const bOrder = order.get(b.id) ?? b.defaultOrder
      return aOrder - bOrder
    })

  if (tabs.length) return tabs

  const posts = manifests.find(manifest => manifest.id === 'posts')
  return posts ? [posts] : []
}

export function resolveSelectedProfileTab(
  requestedTabId: string | null | undefined,
  presentation: ProfilePresentationPreferences,
  visibleTabs: ProfileTabManifest[],
): string {
  const availableIds = new Set(visibleTabs.map(tab => tab.id))
  if (requestedTabId && availableIds.has(requestedTabId)) {
    return requestedTabId
  }
  if (availableIds.has(presentation.defaultTabId)) {
    return presentation.defaultTabId
  }
  return visibleTabs[0]?.id ?? 'posts'
}
