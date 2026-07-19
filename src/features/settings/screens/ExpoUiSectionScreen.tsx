import {StyleSheet, View} from 'react-native'

import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {
  ExpoUiSectionDemo,
  getExpoUiLabSection,
  type ExpoUiLabSectionId,
} from '@/platform/ui/dev/expo-ui-lab'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ExpoUiSectionScreen({sectionId}: {sectionId: string}) {
  const {spacing} = useThemeTokens()
  const meta = getExpoUiLabSection(sectionId)

  if (runtimeEnvironment.appEnvironment !== 'development') {
    return (
      <AppScreen>
        <AppText variant="headline">Developer settings are unavailable.</AppText>
      </AppScreen>
    )
  }

  if (!meta) {
    return (
      <View style={styles.screen}>
        <SecondaryScreenHeader title="Unknown section" />
        <AppScreen>
          <AppText variant="body">
            Unknown Expo UI lab section: {sectionId}
          </AppText>
        </AppScreen>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <SecondaryScreenHeader title={meta.title} />
      <AppScreen scroll>
        <View style={[styles.wrap, {gap: spacing[4], padding: spacing[4]}]}>
          <Surface
            variant="contained"
            style={[styles.card, {gap: spacing[2], padding: spacing[4]}]}>
            <AppText variant="headline">{meta.title}</AppText>
            <AppText variant="body" colour="textSub">
              {meta.summary}
            </AppText>
            <AppText variant="label" colour="textSecondary">
              Status: {meta.status}
            </AppText>
            <AppText variant="label" colour="textSecondary">
              Use for: {meta.suggestedContexts.join(' · ')}
            </AppText>
            <AppText variant="label" colour="textSecondary">
              Prefer wrappers:{' '}
              {meta.modulaWrappers.length
                ? meta.modulaWrappers.join(', ')
                : 'design a Modula adapter before product use'}
            </AppText>
          </Surface>
          <ExpoUiSectionDemo sectionId={meta.id as ExpoUiLabSectionId} />
        </View>
      </AppScreen>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  wrap: {
    alignSelf: 'center',
    maxWidth: 760,
    width: '100%',
  },
  card: {
    width: '100%',
  },
})
