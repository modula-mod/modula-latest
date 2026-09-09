import {useCallback, useEffect, useMemo, useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaDrawer} from '@/platform/ui/drawers/modula-drawer'
import type {
  ModulaDrawerNavigationController,
  ModulaDrawerNavigatorProps,
} from '@/platform/ui/drawers/modula-drawer-navigator.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {
  ModulaDrawerNavigationController,
  ModulaDrawerNavigatorProps,
  ModulaDrawerScreen,
} from '@/platform/ui/drawers/modula-drawer-navigator.types'

/** Native-safe single-shell fallback; existing native Drawer mechanics stay unchanged. */
export function ModulaDrawerNavigator<RouteId extends string>({
  initialRoute,
  screens,
  isPresented,
  onDismiss,
  onRouteChange,
  ...drawerProps
}: ModulaDrawerNavigatorProps<RouteId>) {
  const [stack, setStack] = useState<RouteId[]>([initialRoute])
  const {spacing} = useThemeTokens()
  const currentRoute = stack.at(-1) ?? initialRoute
  const current = screens.find(screen => screen.id === currentRoute) ?? screens[0]
  const previous = screens.find(screen => screen.id === stack.at(-2))
  const dismiss = useCallback(() => {
    setStack([initialRoute])
    onDismiss()
  }, [initialRoute, onDismiss])
  const controller = useMemo<ModulaDrawerNavigationController<RouteId>>(() => ({
    currentRoute,
    depth: stack.length,
    canGoBack: stack.length > 1,
    push: route => setStack(routes => [...routes, route]),
    pop: () => setStack(routes => routes.length > 1 ? routes.slice(0, -1) : routes),
    replace: route => setStack(routes => [...routes.slice(0, -1), route]),
    reset: route => setStack([route ?? initialRoute]),
    dismiss,
  }), [currentRoute, dismiss, initialRoute, stack.length])
  useEffect(() => {
    if (isPresented) onRouteChange?.(currentRoute)
  }, [currentRoute, isPresented, onRouteChange])
  if (!current) return null

  const backLabel = current.parentLabel ?? previous?.title ?? 'Back'
  return (
    <ModulaDrawer
      {...drawerProps}
      footer={current.footer?.(controller)}
      header={(
        <View style={[styles.header, {gap: spacing[2]}]}>
          {controller.canGoBack ? (
            <AppPressable accessibilityLabel={`Back to ${backLabel}`} onPress={controller.pop} style={styles.back}>
              <AppText variant="buttonLabel">{`‹ ${backLabel}`}</AppText>
            </AppPressable>
          ) : <View style={styles.back} />}
          <AppText accessibilityRole="header" variant="headline" style={styles.title}>{current.title}</AppText>
          <View style={styles.trailing}>{current.trailingAction?.(controller)}</View>
        </View>
      )}
      isPresented={isPresented}
      onDismiss={dismiss}
      title={current.title}
      subtitle={current.subtitle}>
      {stack.map((route, index) => {
        const screen = screens.find(candidate => candidate.id === route)
        const active = index === stack.length - 1
        return screen ? (
          <View
            accessibilityElementsHidden={!active}
            importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
            key={`${route}-${index}`}
            style={active ? undefined : styles.hidden}>
            {screen.render(controller)}
          </View>
        ) : null
      })}
    </ModulaDrawer>
  )
}

const styles = StyleSheet.create({
  back: {minHeight: 44, minWidth: 72, alignItems: 'flex-start', justifyContent: 'center'},
  header: {minHeight: 44, flexDirection: 'row', alignItems: 'center'},
  hidden: {display: 'none'},
  title: {flex: 1, textAlign: 'center'},
  trailing: {minHeight: 44, minWidth: 72, alignItems: 'flex-end', justifyContent: 'center'},
})
