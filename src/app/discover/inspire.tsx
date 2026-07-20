import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {InspireNextList} from '@/features/discover/components/InspireNextList'
import {INSPIRE_DESTINATIONS} from '@/features/discover/data/inspireSeed'
import {selectionHaptic} from '@/lib/haptics'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Full inspire destinations screen — Preview communities & topics. */
export default function DiscoverInspireRoute() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Inspire" />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={{
            gap: spacing[5],
            padding: spacing[4],
            paddingBottom: spacing[8],
          }}>
          <SectionEnter>
            <AppText variant="body" colour="textSecondary">
              Local Preview destinations — communities and topics to explore next. Not a
              travel product.
            </AppText>
          </SectionEnter>

          <InspireNextList limit={INSPIRE_DESTINATIONS.length} showSeeAll={false} />

          <SectionEnter delay={220}>
            <AppPressable
              accessibilityLabel="Edit interests"
              onPress={() => {
                void selectionHaptic()
                router.push('/discover/interests' as Href)
              }}
              style={[
                styles.cta,
                {
                  backgroundColor: colours.accent,
                  borderRadius: radius.round,
                },
              ]}>
              <AppText variant="label" style={{color: colours.accentForeground}}>
                Tune interests
              </AppText>
            </AppPressable>
          </SectionEnter>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  screen: {flex: 1},
})
