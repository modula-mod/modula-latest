import React from 'react'
import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {
  ModulaProfile,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import type {ProfileTabManifest} from '@/features/profile/contracts/profileTabs'
import {useProfileRegistry} from '@/features/profile/runtime/useProfileRegistry'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileTabContentProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
  tab: ProfileTabManifest | null
}

export function ProfileTabContent({profile, viewer, tab}: ProfileTabContentProps) {
  const registry = useProfileRegistry()
  const {spacing} = useThemeTokens()
  const Renderer = tab ? registry.getRenderer(tab.rendererKey) : null

  if (!tab || !Renderer) {
    return (
      <View style={[styles.fallback, {padding: spacing[5]}]}>
        <AppText variant="headline" style={styles.center}>
          This profile section couldn’t open.
        </AppText>
        <AppText variant="body" colour="textSecondary" style={styles.center}>
          Try again
        </AppText>
      </View>
    )
  }

  return (
    <ProfileSectionBoundary key={tab.id}>
      {React.createElement(Renderer, {profile, viewer})}
    </ProfileSectionBoundary>
  )
}

type ProfileSectionBoundaryProps = {
  children: React.ReactNode
}

type ProfileSectionBoundaryState = {
  failed: boolean
}

class ProfileSectionBoundary extends React.Component<
  ProfileSectionBoundaryProps,
  ProfileSectionBoundaryState
> {
  state: ProfileSectionBoundaryState = {failed: false}

  static getDerivedStateFromError(): ProfileSectionBoundaryState {
    return {failed: true}
  }

  componentDidCatch(error: Error) {
    if (__DEV__) {
      console.error('Profile section failed', error)
    }
  }

  render() {
    if (!this.state.failed) {
      return this.props.children
    }

    return (
      <View style={styles.fallback}>
        <AppText variant="headline" style={styles.center}>
          This profile section couldn’t open.
        </AppText>
        <AppText variant="body" colour="textSecondary" style={styles.center}>
          Try again
        </AppText>
        <AppPressable
          accessibilityLabel="Try profile section again"
          onPress={() => this.setState({failed: false})}
          style={styles.retry}>
          <AppText variant="label">Try again</AppText>
        </AppPressable>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  fallback: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    minHeight: 180,
  },
  retry: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
})
