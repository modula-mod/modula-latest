import {useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject} from 'react'

import {ModulaDrawer} from '@/platform/ui/drawers/modula-drawer'
import type {
  ModulaDrawerNavigationController,
  ModulaDrawerNavigatorProps,
  ModulaDrawerScreen,
} from '@/platform/ui/drawers/modula-drawer-navigator.types'
import {useModulaMotionSpec} from '@/platform/ui/motion/modula-motion-spec'

export type {
  ModulaDrawerNavigationController,
  ModulaDrawerNavigatorProps,
  ModulaDrawerScreen,
} from '@/platform/ui/drawers/modula-drawer-navigator.types'

type RouteFrame<RouteId extends string> = {
  id: RouteId
  scrollTop: number
  focusOrigin: HTMLElement | null
}

type TransitionDirection = 'forward' | 'back' | 'replace'

/**
 * Ephemeral navigation inside one responsive Drawer/Dialog/Sheet shell.
 * It never creates a portal or browser-history entry.
 */
export function ModulaDrawerNavigator<RouteId extends string>({
  initialRoute,
  screens,
  isPresented,
  onDismiss,
  onRouteChange,
  testID,
  ...drawerProps
}: ModulaDrawerNavigatorProps<RouteId>) {
  const [frames, setFrames] = useState<RouteFrame<RouteId>[]>([
    {id: initialRoute, scrollTop: 0, focusOrigin: null},
  ])
  const [direction, setDirection] = useState<TransitionDirection>('forward')
  const [pageHeight, setPageHeight] = useState<number>()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const activePageRef = useRef<HTMLDivElement>(null)
  const pendingFocusRef = useRef<HTMLElement | null>(null)
  const pageMotion = useModulaMotionSpec(direction === 'back' ? 'drawerPage.back' : 'drawerPage.forward')
  const heightMotion = useModulaMotionSpec('drawerHeight.change')
  const currentFrame = frames.at(-1) ?? {id: initialRoute, scrollTop: 0, focusOrigin: null}
  const currentScreen = screenFor(screens, currentFrame.id) ?? screens[0]

  const scrollBody = useCallback(() => viewportRef.current?.closest<HTMLElement>('.modula-web-overlay-body') ?? null, [])
  const saveCurrentScroll = useCallback((next: RouteFrame<RouteId>[]) => {
    const top = scrollBody()?.scrollTop ?? 0
    return next.map((frame, index) => index === next.length - 1 ? {...frame, scrollTop: top} : frame)
  }, [scrollBody])

  const push = useCallback((route: RouteId) => {
    setDirection('forward')
    setFrames(previous => [
      ...saveCurrentScroll(previous),
      {id: route, scrollTop: 0, focusOrigin: activeElement()},
    ])
  }, [saveCurrentScroll])

  const pop = useCallback(() => {
    setDirection('back')
    setFrames(previous => {
      if (previous.length <= 1) return previous
      pendingFocusRef.current = previous.at(-1)?.focusOrigin ?? null
      return saveCurrentScroll(previous).slice(0, -1)
    })
  }, [saveCurrentScroll])

  const replace = useCallback((route: RouteId) => {
    setDirection('replace')
    setFrames(previous => [
      ...previous.slice(0, -1),
      {...(previous.at(-1) ?? {focusOrigin: null}), id: route, scrollTop: 0},
    ])
  }, [])

  const reset = useCallback((route: RouteId = initialRoute) => {
    setDirection('back')
    setFrames([{id: route, scrollTop: 0, focusOrigin: null}])
  }, [initialRoute])

  const dismiss = useCallback(() => {
    pendingFocusRef.current = null
    setFrames([{id: initialRoute, scrollTop: 0, focusOrigin: null}])
    onDismiss()
  }, [initialRoute, onDismiss])

  const controller = useMemo<ModulaDrawerNavigationController<RouteId>>(() => ({
    currentRoute: currentFrame.id,
    depth: frames.length,
    canGoBack: frames.length > 1,
    push,
    pop,
    replace,
    reset,
    dismiss,
  }), [currentFrame.id, dismiss, frames.length, pop, push, replace, reset])

  useLayoutEffect(() => {
    if (!isPresented) return
    const body = scrollBody()
    if (body) body.scrollTop = currentFrame.scrollTop
    const pending = pendingFocusRef.current
    pendingFocusRef.current = null
    if (pending?.isConnected) pending.focus()
    else headingRef.current?.focus()
    onRouteChange?.(currentFrame.id)
  }, [currentFrame.id, currentFrame.scrollTop, isPresented, onRouteChange, scrollBody])

  useLayoutEffect(() => {
    const page = activePageRef.current
    if (!page || typeof ResizeObserver === 'undefined') return
    const measure = () => setPageHeight(Math.ceil(page.getBoundingClientRect().height))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(page)
    return () => observer.disconnect()
  }, [currentFrame.id])

  if (!currentScreen) return null
  const previous = frames.length > 1 ? screenFor(screens, frames.at(-2)?.id) : undefined
  const backLabel = currentScreen.parentLabel ?? previous?.title ?? 'Back'
  const activeIndex = frames.length - 1
  // Controller callbacks read DOM refs only after user events, never during render.
  // eslint-disable-next-line react-hooks/refs
  const footer = currentScreen.footer?.(controller)
  // eslint-disable-next-line react-hooks/refs
  const pages = frames.map((frame, index) => {
    const screen = screenFor(screens, frame.id)
    const active = index === activeIndex
    if (!screen) return null
    return (
      <div
        aria-hidden={!active}
        className="modula-web-drawer-navigation-page"
        data-active={active ? 'true' : 'false'}
        hidden={!active}
        key={`${frame.id}-${index}`}
        ref={active ? activePageRef : undefined}
        role="region">
        {screen.render(controller)}
      </div>
    )
  })

  return (
    <ModulaDrawer
      {...drawerProps}
      footer={footer}
      header={(
        <DrawerNavigationHeader
          backLabel={backLabel}
          canGoBack={controller.canGoBack}
          headingRef={headingRef}
          navigation={controller}
          screen={currentScreen}
        />
      )}
      isPresented={isPresented}
      onDismiss={dismiss}
      testID={testID}
      title={currentScreen.title}
      subtitle={currentScreen.subtitle}>
      <div
        className="modula-web-drawer-navigation"
        data-direction={direction}
        data-reduce-motion={String(pageMotion.reduced)}
        ref={viewportRef}
        style={({
          '--modula-drawer-page-height': pageHeight ? `${pageHeight}px` : 'auto',
          '--modula-drawer-page-duration': `${pageMotion.duration}ms`,
          '--modula-drawer-page-translate': `${pageMotion.translateDistance}px`,
          '--modula-drawer-height-duration': `${heightMotion.duration}ms`,
        } as CSSProperties)}>
        {pages}
      </div>
    </ModulaDrawer>
  )
}

function DrawerNavigationHeader<RouteId extends string>({
  screen,
  navigation,
  canGoBack,
  backLabel,
  headingRef,
}: {
  screen: ModulaDrawerScreen<RouteId>
  navigation: ModulaDrawerNavigationController<RouteId>
  canGoBack: boolean
  backLabel: string
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  return (
    <div className="modula-web-drawer-navigation-header">
      {canGoBack ? (
        <button
          aria-label={`Back to ${backLabel}`}
          className="modula-web-drawer-navigation-back"
          onClick={navigation.pop}
          type="button">
          <span aria-hidden="true">‹</span>
          <span>{backLabel}</span>
        </button>
      ) : <span aria-hidden="true" className="modula-web-drawer-navigation-header-spacer" />}
      <div aria-live="polite" className="modula-web-drawer-navigation-heading">
        <h2 ref={headingRef} tabIndex={-1}>{screen.title}</h2>
        {screen.subtitle ? <p>{screen.subtitle}</p> : null}
      </div>
      <div className="modula-web-drawer-navigation-trailing">
        {screen.trailingAction?.(navigation)}
      </div>
    </div>
  )
}

function screenFor<RouteId extends string>(
  screens: readonly ModulaDrawerScreen<RouteId>[],
  id: RouteId | undefined,
) {
  return screens.find(screen => screen.id === id)
}

function activeElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null
}
