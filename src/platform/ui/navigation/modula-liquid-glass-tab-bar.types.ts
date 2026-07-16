/**
 * Shared props for the liquid-glass tab bar — kept free of `@callstack/liquid-glass`
 * so platform-tabs can type-check without loading the native module.
 */
export type ModulaLiquidGlassTabBarProps = {
  state: {
    index: number
    routes: {key: string; name: string}[]
  }
  navigation: {
    emit: (options: {
      type: 'tabPress'
      target: string
      canPreventDefault: true
    }) => {defaultPrevented: boolean}
    navigate: (name: string) => void
  }
}
