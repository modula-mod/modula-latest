import {Alert, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import {demoActivity} from '@/demo/demoActivity'
import {demoModules} from '@/demo/demoModules'
import {currentDemoProfile} from '@/demo/demoProfiles'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function BoardScreen() {
  const {colours, radius, spacing} = useThemeTokens()
  const router = useRouter()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Board" />
      <ResponsiveContent maxWidth={760}>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Good focus, {currentDemoProfile.displayName}</AppText>
            <AppText variant="body" colour="textSecondary">
              Your local Modula Board gathers the next useful actions without requiring a backend.
            </AppText>
          </View>
          <Surface
            variant="contained"
            style={[styles.focus, {gap: spacing[3], padding: spacing[4]}]}>
            <View
              style={[
                styles.focusIcon,
                {backgroundColor: colours.accentSubtle, borderRadius: radius.medium},
              ]}>
              <AppIcon name="board" colour={colours.accent} />
            </View>
            <View style={styles.focusBody}>
              <AppText variant="headline">Current focus</AppText>
              <AppText variant="body" colour="textSecondary">
                Validate Phase 1 shell flows on phone and web before adding accounts or APIs.
              </AppText>
            </View>
          </Surface>
          <View style={[styles.quickActions, {gap: spacing[2]}]}>
            {[
              ['Create', 'create', '/compose'],
              ['Discover', 'discover', '/discover'],
              ['Profile', 'profile', '/profile'],
            ].map(([label, icon, route]) => (
              <AppPressable
                key={label}
                accessibilityLabel={label}
                onPress={() => router.push(route as Href)}
                style={[
                  styles.quickAction,
                  {
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                    borderRadius: radius.medium,
                  },
                ]}>
                <AppIcon
                  name={icon as Parameters<typeof AppIcon>[0]['name']}
                  colour={colours.accent}
                />
                <AppText variant="label">{label}</AppText>
              </AppPressable>
            ))}
          </View>
          <FeatureErrorBoundary label="Board module grid">
            <View style={{gap: spacing[3]}}>
              <AppText variant="headline">Modules</AppText>
              <View style={[styles.moduleGrid, {gap: spacing[3]}]}>
                {demoModules.map(module => (
                  <AppPressable
                    key={module.id}
                    accessibilityLabel={`Open ${module.name}`}
                    onPress={() => Alert.alert(module.name, 'Local module preview')}
                    style={[
                      styles.moduleCard,
                      {
                        backgroundColor: colours.surface,
                        borderColor: colours.border,
                        borderRadius: radius.large,
                        padding: spacing[4],
                      },
                    ]}>
                    <AppIcon name={module.icon} colour={colours.accent} />
                    <View style={{gap: spacing[1]}}>
                      <AppText variant="headline">{module.name}</AppText>
                      <AppText variant="caption" colour="textSecondary">
                        {module.description}
                      </AppText>
                    </View>
                    <AppText variant="caption" colour="accent">
                      {module.status}
                    </AppText>
                  </AppPressable>
                ))}
              </View>
            </View>
          </FeatureErrorBoundary>
          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Recent activity</AppText>
            {demoActivity.slice(0, 3).map(item => (
              <Surface
                key={item.id}
                variant="plain"
                style={[styles.activityRow, {gap: spacing[3]}]}>
                <AppIcon name={item.icon ?? 'activity'} colour={colours.textSecondary} />
                <View style={styles.focusBody}>
                  <AppText variant="body">{item.description}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {item.timestamp}
                  </AppText>
                </View>
              </Surface>
            ))}
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  activityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 52,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  focus: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  focusBody: {
    flex: 1,
    minWidth: 0,
  },
  focusIcon: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  moduleCard: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '48%',
    gap: 12,
    minHeight: 156,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quickAction: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  quickActions: {
    flexDirection: 'row',
  },
  screen: {
    flex: 1,
  },
})
