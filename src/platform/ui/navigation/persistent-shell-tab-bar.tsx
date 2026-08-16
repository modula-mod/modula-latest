/**
 * Root-level floating tab bar is retired. iOS uses Expo Router NativeTabs
 * (UITabBarController / Liquid Glass). Secondary stacks use back, not a
 * fake pill over Settings and Product Hub.
 *
 * Web keeps its adaptive rail in platform-tabs.web.tsx.
 */
export function PersistentShellTabBar() {
  return null
}
