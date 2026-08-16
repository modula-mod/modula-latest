import {useRouter, type Href} from 'expo-router'
import {StyleSheet, View} from 'react-native'
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

export function ProfileHeaderRight() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: HEADER_ICON_PAIR_GAP,
      }}>
      <ProfileShareMenu />
      <ProfileOverflowMenu />
    </View>
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
 */
export function ProfileCoverChrome({showBack}: {showBack: boolean}) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const {spacing} = useThemeTokens()

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        {
          paddingHorizontal: spacing[3],
          paddingTop: insets.top + 8,
          zIndex: LAYERS.sticky,
        },
      ]}>
      <View pointerEvents="box-none" style={styles.overlayRow}>
        {showBack ? <ModulaBackButton /> : <View />}
        <ChromeGlassControlGroup
          items={[
            {
              kind: 'button',
              icon: 'share',
              accessibilityLabel: 'Share profile',
              onPress: () => router.push('/share-profile' as Href),
            },
            {
              kind: 'menu',
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
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  overlayRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})
