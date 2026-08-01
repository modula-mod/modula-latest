export const moduleQueryKeys = {
  catalogueRoot: ['modules', 'catalogue'] as const,
  catalogue: (input: {q?: string; category?: string}) => ['modules', 'catalogue', input] as const,
  detail: (moduleId: string) => ['modules', 'detail', moduleId] as const,
  installed: ['modules', 'installed'] as const,
  views: (moduleId: string) => ['modules', 'views', moduleId] as const,
  view: (moduleId: string, viewId: string) => ['modules', 'view', moduleId, viewId] as const,
  recordsCollection: (moduleId: string, collection: string) => ['modules', 'records', moduleId, collection] as const,
  records: (moduleId: string, collection: string, input: {q?: string; folder?: string; sort?: string}) =>
    ['modules', 'records', moduleId, collection, input] as const,
  settings: (moduleId: string) => ['modules', 'settings', moduleId] as const,
  settingsSchema: (moduleId: string) => ['modules', 'settings-schema', moduleId] as const,
  health: (moduleId: string) => ['modules', 'health', moduleId] as const,
  backend: (moduleId: string) => ['modules', 'backend', moduleId] as const,
  contributions: (input: {surface?: string; moduleId?: string}) => ['modules', 'contributions', input] as const,
}
