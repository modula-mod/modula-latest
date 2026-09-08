import type {ReactNode} from 'react'
import {useRouter, type Href} from 'expo-router'
import {Platform, StyleSheet, View} from 'react-native'
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
import {useSession} from '@/auth/runtime'
import {parseProfileId} from '@/api/contracts'
import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {copyProfileLink, shareProfile} from '@/features/profile/services/shareProfile'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import {useModulaToast} from '@/platform/ui/feedback'
import {useAppServices} from '@/runtime'

function useOwnerProfileShareAction() {
  const router = useRouter()
  const session = useSession()
  const toast = useModulaToast()

  return (id: string) => {
    if (id === 'qr') {
      router.push('/share-profile' as Href)
      return
    }
    if (session.status !== 'signedIn') {
      router.push('/share-profile' as Href)
      return
    }
    if (id === 'share') {
      void shareProfile(session.profile).then(shared => {
        if (!shared) toast.show({message: 'Profile sharing is unavailable in this browser.', tone: 'error'})
      })
    }
    if (id === 'copy') {
      void copyProfileLink(session.profile).then(copied => {
        toast.show({message: copied ? 'Profile link copied.' : 'The profile link could not be copied.', tone: copied ? 'success' : 'error'})
      })
    }
  }
}

function useVisitorProfileAction(profile: ModulaProfile) {
  const router = useRouter()
  const {moderationRepository} = useAppServices()
  const toast = useModulaToast()

  return (id: string) => {
    if (id === 'share') {
      void shareProfile(profile).then(shared => {
        if (!shared) toast.show({message: 'Profile sharing is unavailable in this browser.', tone: 'error'})
      })
      return
    }
    if (id === 'copy') {
      void copyProfileLink(profile).then(copied => {
        toast.show({message: copied ? 'Profile link copied.' : 'The profile link could not be copied.', tone: copied ? 'success' : 'error'})
      })
      return
    }
    if (id === 'report') {
      router.push(`/report?targetType=profile&targetId=${encodeURIComponent(profile.id)}` as Href)
      return
    }
    if (id === 'mute') {
      void moderationRepository.muteProfile(parseProfileId(profile.id)).then(() => {
        toast.show({message: `@${profile.handle} is muted.`, tone: 'success'})
      }).catch(error => {
        toast.show({message: error instanceof Error ? error.message : 'Could not mute this account.', tone: 'error'})
      })
      return
    }
    if (id === 'block') {
      void confirmModulaAction({
        title: 'Block account?',
        message: `Block @${profile.handle}? You will stop seeing each other where Greenfield applies blocks.`,
        confirmLabel: 'Block',
      }).then(confirmed => {
        if (!confirmed) return
        void moderationRepository.blockProfile(parseProfileId(profile.id)).then(() => {
          toast.show({message: `@${profile.handle} is blocked.`, tone: 'success'})
        }).catch(error => {
          toast.show({message: error instanceof Error ? error.message : 'Could not block this account.', tone: 'error'})
        })
      })
    }
  }
}

function ProfileHeaderBack() {
  return <ModulaBackButton chrome={Platform.OS === 'web' ? 'glass' : 'plain'} />
}

function ProfileShareMenu() {
  const runShareAction = useOwnerProfileShareAction()
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
      onAction={runShareAction}
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
  const runShareAction = useOwnerProfileShareAction()
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
          onAction: runShareAction,
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
  profile,
  owner = true,
  title,
  scrollY,
  heroHeight,
  chromeHeight,
}: {
  showBack: boolean
  profile: ModulaProfile
  owner?: boolean
  title?: ReactNode
  scrollY?: SharedValue<number>
  heroHeight?: SharedValue<number>
  chromeHeight: number
}) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const runVisitorAction = useVisitorProfileAction(profile)
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
                onPress: () => void shareProfile(profile),
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
                      {id: 'mute', label: 'Mute account', icon: 'notifications'},
                      {id: 'block', label: 'Block account', icon: 'privacy', style: 'destructive' as const},
                      {id: 'report', label: 'Report account', icon: 'warning', style: 'destructive' as const},
                    ],
                    onAction: runVisitorAction,
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
