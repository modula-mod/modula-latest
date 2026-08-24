import type {ReactNode} from 'react'
import {useRouter, type Href} from 'expo-router'
import {StyleSheet, View} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {ChromeIconMenu} from '@/platform/ui/menus/chrome-icon-menu'
import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
import {
  HEADER_ICON_PAIR_GAP,
  plainHeaderCustomItem,
  plainHeaderSpacing,
  supportsPlainHeaderItems,
} from '@/platform/ui/navigation/plain-header-items'
import {LAYERS} from '@/theme/tokens/layers'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

function ProfileHeaderBack() {
  return <ModulaBackButton chrome="plain" />
}

function ProfileShareMenu() {
  const router = useRouter()
  return (
    <ChromeIconMenu
      systemImage="square.and.arrow.up"
      icon="share"
      chrome="plain"
      accessibilityLabel="Share profile"
      title="Share"
      actions={[
        {id: 'share', label: 'Share profile', icon: 'share'},
        {id: 'qr', label: 'QR / share sheet — Preview', icon: 'photo'},
        {id: 'copy', label: 'Copy profile link', icon: 'link'},
      ]}
      onAction={id => {
        if (id === 'share' || id === 'qr') {
          router.push('/share-profile' as Href)
        }
      }}
    />
  )
}

function ProfileOverflowMenu() {
  const router = useRouter()
  return (
    <ChromeOverflowMenu
      chrome="plain"
      accessibilityLabel="Open profile actions"
      title="Profile"
      actions={[
        {id: 'edit', label: 'Edit Profile', icon: 'profile'},
        {id: 'customize', label: 'Customize', icon: 'appearance'},
        {id: 'os', label: 'Profile-OS', icon: 'settings'},
        {id: 'preview', label: 'View as visitor', icon: 'eye'},
        {id: 'settings', label: 'Settings', icon: 'settings'},
      ]}
      onAction={id => {
        if (id === 'edit') router.push('/profile/edit' as Href)
        if (id === 'customize') router.push('/profile/customize' as Href)
        if (id === 'os') router.push('/profile/os' as Href)
        if (id === 'preview') router.push('/profile/preview' as Href)
        if (id === 'settings') router.push('/settings' as Href)
      }}
    />
  )
}

/** Android / web fallback — one slot (may share a capsule on older paths). */
export function ProfileHeaderLeft() {
  return <ProfileHeaderBack />
}

/** Android / web — shared `ChromeGlassControlGroup` (iOS uses header items). */
export function ProfileHeaderRight() {
  const router = useRouter()
  return (
    <ChromeGlassControlGroup
      items={[
        {
          kind: 'menu',
          icon: 'share',
          accessibilityLabel: 'Share profile',
          title: 'Share',
          actions: [
            {id: 'share', label: 'Share profile', icon: 'share'},
            {id: 'qr', label: 'QR / share sheet — Preview', icon: 'photo'},
            {id: 'copy', label: 'Copy profile link', icon: 'link'},
          ],
          onAction: id => {
            if (id === 'share' || id === 'qr') {
              router.push('/share-profile' as Href)
            }
          },
        },
        {
          kind: 'menu',
          icon: 'more',
          accessibilityLabel: 'Open profile actions',
          title: 'Profile',
          actions: [
            {id: 'edit', label: 'Edit Profile', icon: 'profile'},
            {id: 'customize', label: 'Customize', icon: 'appearance'},
            {id: 'os', label: 'Profile-OS', icon: 'settings'},
            {id: 'preview', label: 'View as visitor', icon: 'eye'},
            {id: 'settings', label: 'Settings', icon: 'settings'},
          ],
          onAction: id => {
            if (id === 'edit') router.push('/profile/edit' as Href)
            if (id === 'customize') router.push('/profile/customize' as Href)
            if (id === 'os') router.push('/profile/os' as Href)
            if (id === 'preview') router.push('/profile/preview' as Href)
            if (id === 'settings') router.push('/settings' as Href)
          },
        },
      ]}
    />
  )
}

/** iOS 26+: back glyph in the leading capsule. */
export function profileHeaderLeftItems() {
  if (!supportsPlainHeaderItems()) return undefined
  return [plainHeaderCustomItem(<ProfileHeaderBack />)]
}

/** iOS 26+: shared liquid glass with share + more spaced apart inside it. */
export function profileHeaderRightItems() {
  if (!supportsPlainHeaderItems()) return undefined
  return [
    plainHeaderCustomItem(<ProfileShareMenu />),
    plainHeaderSpacing(),
    plainHeaderCustomItem(<ProfileOverflowMenu />),
  ]
}

/**
 * Share + overflow on the cover (X / Facebook / Bluesky). Used when the native
 * header is hidden so the banner can start under the status bar.
 *
 * `title` is the identity that morphs in beside the back control on scroll; it
 * shares the leading slot so the name reads as chrome, not as a second hero.
 * A canvas backdrop fades in with that morph so sticky tabs meet a header,
 * not a gap.
 */
export function ProfileCoverChrome({
  showBack,
  owner = true,
  title,
  scrollY,
  heroHeight,
  chromeHeight,
}: {
  showBack: boolean
  owner?: boolean
  title?: ReactNode
  scrollY?: SharedValue<number>
  heroHeight?: SharedValue<number>
  chromeHeight: number
}) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
  const canGoBack = useNavigationCanGoBack()
  const backVisible = showBack || canGoBack
  const fallbackHeight = chromeHeight + 120

  const backdropStyle = useAnimatedStyle(() => {
    const hero = heroHeight?.value || fallbackHeight
    const to = Math.max(1, hero - chromeHeight)
    const from = Math.max(0, to - 88)
    const progress = interpolate(scrollY?.value ?? 0, [from, to], [0, 1], 'clamp')
    return {opacity: progress}
  })

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, {zIndex: LAYERS.sticky}]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.backdrop,
          {backgroundColor: colours.canvas, height: chromeHeight},
          backdropStyle,
        ]}
      />
      <View
        pointerEvents="box-none"
        style={{paddingHorizontal: spacing[3], paddingTop: insets.top + 8}}>
        <View pointerEvents="box-none" style={styles.overlayRow}>
          <View
            pointerEvents="box-none"
            style={[styles.leading, {gap: spacing[2]}]}>
            {backVisible ? <ModulaBackButton /> : null}
            {title}
          </View>
          <ChromeGlassControlGroup
            items={[
              ...(owner
                ? [
                    {
                      kind: 'button' as const,
                      icon: 'edit' as const,
                      accessibilityLabel: 'Edit Profile',
                      onPress: () => router.push('/profile/edit' as Href),
                    },
                  ]
                : []),
              {
                kind: 'button',
                icon: 'share',
                accessibilityLabel: 'Share profile',
                onPress: () => router.push('/share-profile' as Href),
              },
              owner
                ? {
                    kind: 'menu' as const,
                    icon: 'more' as const,
                    accessibilityLabel: 'Open profile actions',
                    title: 'Profile',
                    actions: [
                      {id: 'customize', label: 'Customize', icon: 'appearance'},
                      {id: 'os', label: 'Profile-OS', icon: 'settings'},
                      {id: 'preview', label: 'View as visitor', icon: 'eye'},
                      {id: 'settings', label: 'Settings', icon: 'settings'},
                    ],
                    onAction: (id: string) => {
                      if (id === 'customize') router.push('/profile/customize' as Href)
                      if (id === 'os') router.push('/profile/os' as Href)
                      if (id === 'preview') router.push('/profile/preview' as Href)
                      if (id === 'settings') router.push('/settings' as Href)
                    },
                  }
                : {
                    kind: 'menu' as const,
                    icon: 'more' as const,
                    accessibilityLabel: 'More profile actions',
                    title: 'Profile',
                    actions: [
                      {id: 'share', label: 'Share profile', icon: 'share'},
                      {id: 'copy', label: 'Copy profile link', icon: 'link'},
                    ],
                    onAction: (id: string) => {
                      if (id === 'share' || id === 'copy') {
                        router.push('/share-profile' as Href)
                      }
                    },
                  },
            ]}
          />
        </View>
      </View>
    </View>
  )
}

function useNavigationCanGoBack(): boolean {
  const router = useRouter()
  try {
    return router.canGoBack()
  } catch {
    return false
  }
}

const styles = StyleSheet.create({
  backdrop: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  leading: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    minWidth: 0,
  },
  overlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  overlayRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: HEADER_ICON_PAIR_GAP,
    justifyContent: 'space-between',
    minHeight: 44,
  },
})
