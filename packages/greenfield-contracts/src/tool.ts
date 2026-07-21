export type GreenfieldToolSurface =
  | 'composer'
  | 'postMenu'
  | 'profile'
  | 'board'
  | 'search'
  | 'module'
  | 'globalCommand'

export type GreenfieldToolManifest = {
  toolId: string
  name: string
  description?: string
  icon?: string

  surfaces: GreenfieldToolSurface[]
  functionId?: string
  route?: string

  requiredCapabilities: string[]
  availability?: {
    platforms?: Array<'ios' | 'android' | 'web'>
    accountStates?: string[]
  }
}
