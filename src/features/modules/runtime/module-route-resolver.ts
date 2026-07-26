import type {ModuleRuntimeView} from '@/data/repositories/contracts'

export function resolveModuleRouteView(views: ModuleRuntimeView[], path: string[]): ModuleRuntimeView | null {
  if (views.length === 0) return null
  const requested = path[0]
  if (requested) {
    const direct = views.find(view => view.viewId.endsWith(`.${requested}`) || view.viewId === requested)
    if (direct) return direct
  }
  return views.find(view => view.kind === 'dashboard') ?? views.find(view => view.kind === 'collection') ?? views[0] ?? null
}
