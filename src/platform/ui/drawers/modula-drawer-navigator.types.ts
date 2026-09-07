import type {ReactNode} from 'react'

import type {ModulaDrawerProps} from '@/platform/ui/drawers/modula-drawer'

export type ModulaDrawerNavigationController<RouteId extends string> = {
  currentRoute: RouteId
  depth: number
  canGoBack: boolean
  push: (route: RouteId) => void
  pop: () => void
  replace: (route: RouteId) => void
  reset: (route?: RouteId) => void
  dismiss: () => void
}

export type ModulaDrawerScreen<RouteId extends string> = {
  id: RouteId
  title: string
  /** Label announced by the canonical Back control. Defaults to the previous title. */
  parentLabel?: string
  subtitle?: string
  trailingAction?: (navigation: ModulaDrawerNavigationController<RouteId>) => ReactNode
  footer?: (navigation: ModulaDrawerNavigationController<RouteId>) => ReactNode
  render: (navigation: ModulaDrawerNavigationController<RouteId>) => ReactNode
}

export type ModulaDrawerNavigatorProps<RouteId extends string> = Omit<
  ModulaDrawerProps,
  'children' | 'title' | 'subtitle' | 'header' | 'footer'
> & {
  initialRoute: RouteId
  screens: readonly ModulaDrawerScreen<RouteId>[]
  onRouteChange?: (route: RouteId) => void
}
