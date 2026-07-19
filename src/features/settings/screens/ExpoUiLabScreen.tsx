import {Platform, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {EXPO_UI_LAB_SECTIONS} from '@/platform/ui/dev/expo-ui-lab'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

function statusLabel(status: 'wrapped' | 'candidate' | 'explore') {
  switch (status) {
    case 'wrapped':
      return 'Wrapped'
    case 'candidate':
      return 'Candidate'
    case 'explore':
      return 'Explore'
  }
}

/**
 * Pick-and-choose catalog for Expo UI playground components.
 * Live SwiftUI demos live under `src/platform/ui/dev/expo-ui-lab`.
 */
export function ExpoUiLabScreen() {
  const router = useRouter()
  const {spacing} = useThemeTokens()

  if (runtimeEnvironment.appEnvironment !== 'development') {
    return (
      <AppScreen>
        <AppText variant="headline">Developer settings are unavailable.</AppText>
      </AppScreen>
    )
  }

  return (
    <View style={styles.screen}>
      <SecondaryScreenHeader title="Expo UI Lab" />
      <AppScreen scroll>
        <View style={[styles.wrap, {gap: spacing[4], padding: spacing[4]}]}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Expo UI Lab</AppText>
            <AppText variant="body" colour="textSub">
              Components from the Expo UI playground, adapted for SDK 57. Open a
              section to evaluate it in context, then adopt winners through
              Modula platform wrappers — not direct SwiftUI imports in product
              screens.
            </AppText>
            {Platform.OS !== 'ios' ? (
              <AppText variant="caption" colour="textSecondary">
                Live demos require iOS. Catalog notes still work here for
                planning.
              </AppText>
            ) : null}
          </View>

          <AppButton
            onPress={() =>
              router.push('/settings/developer/expo-ui/playground' as Href)
            }>
            Open full playground
          </AppButton>

          <AppText variant="label" colour="textSecondary">
            Wrapped = use Modula adapter · Candidate = wrap soon · Explore =
            lab-only until a product use case lands
          </AppText>

          {EXPO_UI_LAB_SECTIONS.map(section => (
            <Surface
              key={section.id}
              variant="contained"
              style={[styles.card, {gap: spacing[2], padding: spacing[4]}]}>
              <View
                style={[
                  styles.cardHeader,
                  {gap: spacing[2]},
                ]}>
                <AppText variant="headline">{section.title}</AppText>
                <AppText variant="caption" colour="textMuted">
                  {statusLabel(section.status)}
                </AppText>
              </View>
              <AppText variant="body" colour="textSub">
                {section.summary}
              </AppText>
              <AppText variant="label" colour="textSecondary">
                Expo: {section.expoComponents.join(', ')}
              </AppText>
              <AppText variant="label" colour="textSecondary">
                Modula wrappers:{' '}
                {section.modulaWrappers.length
                  ? section.modulaWrappers.join(', ')
                  : 'none yet — keep lab-only'}
              </AppText>
              <AppText variant="label" colour="textSecondary">
                Suggested contexts: {section.suggestedContexts.join(' · ')}
              </AppText>
              <AppButton
                variant="secondary"
                onPress={() =>
                  router.push(
                    `/settings/developer/expo-ui/${section.id}` as Href,
                  )
                }>
                Open {section.title}
              </AppButton>
            </Surface>
          ))}
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
  cardHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
})
