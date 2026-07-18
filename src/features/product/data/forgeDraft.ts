export type ForgeCanvasNodeId =
  | 'route'
  | 'board'
  | 'tab'
  | 'settings'
  | 'tool'
  | 'auto'
  | 'agent'
  | 'widget'

export type ForgeBuilderStep = 'identity' | 'surfaces' | 'permissions' | 'manifest' | 'publish'

export const FORGE_STEPS: Array<{id: ForgeBuilderStep; label: string}> = [
  {id: 'identity', label: 'Identity'},
  {id: 'surfaces', label: 'Surfaces'},
  {id: 'permissions', label: 'Permissions'},
  {id: 'manifest', label: 'Manifest'},
  {id: 'publish', label: 'Publish'},
]

export const FORGE_CAPABILITIES = [
  'board.card',
  'profile.tab',
  'settings.section',
  'composer.tool',
  'automation.node',
  'search.provider',
  'agent.scope',
  'widget.board',
] as const

export const FORGE_PERMISSIONS = [
  'storage:namespaced',
  'network:declared',
  'notifications:opt-in',
  'profile:read',
  'board:write',
] as const

export function slugifyModuleName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'module'
  )
}

export function buildForgeManifestPreview(input: {
  name: string
  description: string
  capabilities: string[]
  permissions: string[]
  surfaces: ForgeCanvasNodeId[]
  repositoryUrl: string
}): string {
  const slug = slugifyModuleName(input.name)
  const moduleId = `digital.modula.${slug}`
  const profileTabs = input.surfaces.includes('tab')
    ? [{tabId: `${slug}-tab`, title: input.name, route: `/modules/${moduleId}`}]
    : []
  const boardSurfaces = input.surfaces.includes('board')
    ? [{surfaceId: `${slug}-board`, title: `${input.name} card`}]
    : []
  const routes = input.surfaces.includes('route')
    ? [{path: `/modules/${moduleId}`, title: input.name}]
    : []
  const settings = input.surfaces.includes('settings')
    ? [
        {
          settingsId: `${slug}-settings`,
          title: `${input.name} settings`,
          route: `/settings/extensions/${moduleId}`,
        },
      ]
    : []

  const manifest = {
    moduleId,
    name: input.name.trim() || 'My Module',
    description: input.description.trim() || 'Draft module from Forge Preview',
    repositoryUrl: input.repositoryUrl.trim() || `https://github.com/modula-mod/${slug}`,
    packageVersion: '0.0.0-preview',
    hostCompatibility: {minimumHostVersion: '0.1.0'},
    routes,
    profileTabs,
    boardSurfaces,
    settings,
    functions: input.surfaces.includes('tool') ? [`${slug}.tool`] : [],
    tools: input.surfaces.includes('tool') ? [`composer.${slug}`] : [],
    widgets: input.surfaces.includes('widget') ? [`board.${slug}`] : [],
    capabilities: input.capabilities,
    permissions: input.permissions,
    uninstallBehaviour: 'exportThenPurge',
  }

  return JSON.stringify(manifest, null, 2)
}
