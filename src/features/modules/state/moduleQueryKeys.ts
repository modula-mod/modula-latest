export const moduleQueryKeys = {
  catalogueRoot: ['modules', 'catalogue'] as const,
  catalogue: (input: {q?: string; category?: string}, viewer: 'public' | 'signedIn' = 'public') =>
    ['modules', 'catalogue', viewer, input] as const,
  detail: (moduleId: string, viewer?: 'public' | 'signedIn') =>
    viewer
      ? ['modules', 'detail', moduleId, viewer] as const
      : ['modules', 'detail', moduleId] as const,
  installed: ['modules', 'installed'] as const,
  views: (moduleId: string) => ['modules', 'views', moduleId] as const,
  view: (moduleId: string, viewId: string) => ['modules', 'view', moduleId, viewId] as const,
  recordsCollection: (moduleId: string, collection: string) => ['modules', 'records', moduleId, collection] as const,
  records: (moduleId: string, collection: string, input: {q?: string; folder?: string; sort?: string}) =>
    ['modules', 'records', moduleId, collection, input] as const,
  settings: (moduleId: string) => ['modules', 'settings', moduleId] as const,
  settingsSchema: (moduleId: string) => ['modules', 'settings-schema', moduleId] as const,
  health: (moduleId: string) => ['modules', 'health', moduleId] as const,
  runtime: (moduleId: string) => ['modules', 'runtime', moduleId] as const,
  backend: (moduleId: string) => ['modules', 'backend', moduleId] as const,
  relationships: (moduleId: string) => ['modules', 'relationships', moduleId] as const,
  composition: (moduleId: string, route?: string, platform?: string) => ['modules', 'composition', moduleId, route ?? 'root', platform ?? 'web'] as const,
  contributions: (input: {surface?: string; moduleId?: string}) => ['modules', 'contributions', input] as const,
}
