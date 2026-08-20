import {StyleSheet, View, type ViewStyle} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const MODULES: {id: string; label: string; icon: AppIconName; position: ViewStyle}[] = [
  {id: 'social', label: 'Social', icon: 'people', position: {left: 0, top: 30}},
  {id: 'notes', label: 'Notes', icon: 'saved', position: {right: 0, top: 32}},
  {id: 'focus', label: 'Focus', icon: 'activity', position: {bottom: 28, left: 10}},
  {id: 'tools', label: 'Tools', icon: 'modules', position: {bottom: 26, right: 8}},
]

/** A profile-first identity object: one person, with chosen capabilities orbiting it. */
export function WelcomeIdentityField() {
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View
      accessibilityLabel="Your profile at the centre of social, notes, focus, and tools"
      accessibilityRole="image"
      style={styles.root}>
      <View
        pointerEvents="none"
        style={[
          styles.orbit,
          {
            borderColor: colours.accentBorder,
            borderRadius: radius.round,
          },
        ]}
      />
      <View
        style={[
          styles.profile,
          {
            backgroundColor: colours.surfaceRaised,
            borderColor: colours.accentBorder,
            borderRadius: radius.round,
            gap: spacing[1],
          },
        ]}>
        <View
          style={[
            styles.profileMark,
            {backgroundColor: colours.accentSubtle, borderRadius: radius.round},
          ]}>
          <AppIcon name="profile" colour={colours.accent} size={28} />
        </View>
        <AppText variant="label">Your profile</AppText>
        <AppText variant="caption" colour="textSecondary">
          The centre of Modula
        </AppText>
      </View>
      {MODULES.map(module => (
        <View
          key={module.id}
          style={[
            styles.module,
            module.position,
            {
              backgroundColor: colours.surface,
              borderColor: colours.border,
              borderRadius: radius.round,
              gap: spacing[1],
              paddingHorizontal: spacing[3],
            },
          ]}>
          <AppIcon name={module.icon} colour={colours.accent} size={16} />
          <AppText variant="caption">{module.label}</AppText>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  module: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 40,
    position: 'absolute',
  },
  orbit: {
    borderStyle: 'dashed',
    borderWidth: StyleSheet.hairlineWidth,
    height: 190,
    position: 'absolute',
    width: '74%',
  },
  profile: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 148,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  profileMark: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  root: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 238,
    justifyContent: 'center',
    maxWidth: 420,
    position: 'relative',
    width: '100%',
  },
})
