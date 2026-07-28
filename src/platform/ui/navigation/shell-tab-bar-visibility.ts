/**
 * Routes where the persistent floating tab bar should stay hidden.
 * Immersive surfaces (reels) + auth/modals — secondary stacks keep the bar.
 */
export function shouldHideShellTabBar(segments: readonly string[]): boolean {
  const root = segments[0]
  if (!root) return false
  if (root === '(auth)') return true
  if (root === 'oauth') return true
  if (root === 'compose') return true
  // Post detail owns its own sticky comment composer — dual bottom chrome collides.
  if (root === 'post') return true
  // Reels feed keeps the floating pill bar (IG-like). Algorithm prefs hide it.
  if (root === 'reels' && segments[1] === 'algorithm') return true

  if (root === 'share' || root === 'share-profile') return true
  if (root === 'report' || root === 'reactions') return true
  if (root === 'account' && segments[1] === 'switcher') return true
  if (
    root === 'discover' &&
    (segments[1] === 'interests' || segments[1] === 'feeds')
  ) {
    return true
  }
  return false
}

/** Map a pathname to a Modula tab route name, or null when outside tabs. */
export function resolveShellTabRouteName(pathname: string): string | null {
  if (
    pathname === '/' ||
    pathname === '/index' ||
    pathname.startsWith('/index/')
  ) {
    return 'index'
  }
  for (const name of ['discover', 'create', 'activity', 'profile'] as const) {
    if (pathname === `/${name}` || pathname.startsWith(`/${name}/`)) {
      return name
    }
  }
  // Expo Router sometimes keeps the (tabs) group in the path.
  if (pathname === '/(tabs)' || pathname === '/(tabs)/' || pathname === '/(tabs)/index') {
    return 'index'
  }
  for (const name of ['discover', 'create', 'activity', 'profile'] as const) {
    if (
      pathname === `/(tabs)/${name}` ||
      pathname.startsWith(`/(tabs)/${name}/`)
    ) {
      return name
    }
  }
  return null
}

export function hrefForShellTab(routeName: string): string {
  return routeName === 'index' ? '/(tabs)' : `/(tabs)/${routeName}`
}
