import {useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {OnboardingAtmosphere} from '@/features/onboarding/components/OnboardingAtmosphere'
import {PresenceArc} from '@/features/onboarding/components/PresenceArc'
import {markOnboardingCompleted} from '@/features/onboarding/data/onboardingStorage'
import {useReduceMotion} from '@/lib/accessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Three calm steps — Apple-like hierarchy:
 * small progress · brand eyebrow · one title · one supporting line · one preview · primary CTA.
 */
const STEPS = [
  {
    id: 'world',
    brand: 'MODULA',
    title: 'Your digital world, built around you.',
    body: 'Social activity, profiles, and tools live in one environment you control — not a pile of disconnected apps.',
    preview: 'social' as const,
  },
  {
    id: 'profile',
    brand: 'PROFILE-OS',
    title: 'Your profile becomes your platform.',
    body: 'Public identity on the outside. Board, tabs, and modules on the inside. You decide what others see.',
    preview: 'profile' as const,
  },
  {
    id: 'modules',
    brand: 'MODULES',
    title: 'Install capabilities. Keep the shell light.',
    body: 'Notes, Tasks, CRM, and more arrive as packages. The host stays calm; Forge helps the ecosystem grow.',
    preview: 'modules' as const,
  },
] as const

export function OnboardingScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const [index, setIndex] = useState(0)
  const step = STEPS[index]
  const isLast = index === STEPS.length - 1

  const finish = async (href: Href) => {
    await markOnboardingCompleted()
    router.replace(href)
  }

  return (
    <OnboardingAtmosphere>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, {gap: spacing[5]}]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View style={[styles.progressTrack, {backgroundColor: colours.border, gap: 4}]}>
            {STEPS.map((item, i) => (
              <View
                key={item.id}
                style={[
                  styles.progressSeg,
                  {
                    backgroundColor: i <= index ? colours.accent : colours.surfaceRaised,
                    opacity: i <= index ? 1 : 0.5,
                  },
                ]}
              />
            ))}
          </View>
          <AppButton
            variant="ghost"
            onPress={() => finish('/welcome' as Href)}
            accessibilityLabel="Skip onboarding">
            Skip
          </AppButton>
        </View>

        <Animated.View
          key={step.id}
          entering={reduceMotion ? undefined : FadeIn.duration(260)}
          exiting={reduceMotion ? undefined : FadeOut.duration(140)}
          style={[styles.stage, {gap: spacing[5]}]}>
          <View style={{gap: spacing[3]}}>
            <AppText variant="caption" colour="accent">
              {step.brand}
            </AppText>
            <AppText variant="display">{step.title}</AppText>
            <AppText variant="body" colour="textSecondary">
              {step.body}
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.preview,
              {
                borderRadius: radius.large,
                padding: spacing[5],
                gap: spacing[4],
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            {step.preview === 'social' ? (
              <View style={{gap: spacing[3]}}>
                <AppText variant="caption" colour="textTertiary">
                  HOME
                </AppText>
                <AppText variant="headline">Following · For You · Modules</AppText>
                <View
                  style={[
                    styles.fakePost,
                    {
                      backgroundColor: colours.surfaceRaised,
                      borderRadius: radius.medium,
                      padding: spacing[4],
                      gap: spacing[2],
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppText variant="label">Media glows. Text breathes.</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    The feed stays content-first — chrome stays quiet.
                  </AppText>
                </View>
              </View>
            ) : null}
            {step.preview === 'profile' ? (
              <View style={{gap: spacing[3]}}>
                <AppText variant="caption" colour="textTertiary">
                  PROFILE
                </AppText>
                <AppText variant="headline">Owner environment</AppText>
                <AppText variant="body" colour="textSecondary">
                  Tabs, widgets, and privacy audiences share one identity system.
                </AppText>
                <View style={[styles.tabRow, {gap: spacing[2]}]}>
                  {['Posts', 'Modules', 'Links', 'About'].map(tab => (
                    <View
                      key={tab}
                      style={[
                        styles.tabChip,
                        {
                          backgroundColor:
                            tab === 'Modules' ? colours.accentSubtle : colours.surfaceRaised,
                          borderColor: tab === 'Modules' ? colours.accentBorder : colours.border,
                          borderRadius: radius.round,
                          paddingHorizontal: spacing[3],
                          paddingVertical: spacing[2],
                        },
                      ]}>
                      <AppText
                        variant="caption"
                        colour={tab === 'Modules' ? 'accent' : 'textSecondary'}>
                        {tab}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {step.preview === 'modules' ? (
              <View style={{gap: spacing[3]}}>
                <AppText variant="caption" colour="textTertiary">
                  CAPABILITIES
                </AppText>
                <AppText variant="headline">Add what you need</AppText>
                <PresenceArc
                  centreLabel="Add"
                  items={[
                    {id: 'notes', label: 'Notes', icon: 'saved', unread: true},
                    {id: 'tasks', label: 'Tasks', icon: 'check'},
                    {id: 'crm', label: 'CRM', icon: 'people', unread: true},
                    {id: 'auto', label: 'Flows', icon: 'automation'},
                    {id: 'forge', label: 'Forge', icon: 'developer'},
                  ]}
                />
              </View>
            ) : null}
          </Surface>
        </Animated.View>

        <View style={[styles.actions, {gap: spacing[3]}]}>
          <AppButton
            onPress={() => {
              if (isLast) {
                void finish('/register' as Href)
                return
              }
              setIndex(current => current + 1)
            }}
            accessibilityLabel={isLast ? 'Create Modula account' : 'Continue onboarding'}>
            {isLast ? 'Create account' : 'Continue'}
          </AppButton>
          {isLast ? (
            <AppButton variant="secondary" onPress={() => finish('/sign-in' as Href)}>
              I already have an account
            </AppButton>
          ) : (
            <AppButton variant="ghost" onPress={() => finish('/welcome' as Href)}>
              Back
            </AppButton>
          )}
          {isLast ? (
            <AppButton variant="ghost" onPress={() => finish('/' as Href)}>
              Explore the app
            </AppButton>
          ) : null}
        </View>
      </ScrollView>
    </OnboardingAtmosphere>
  )
}

const styles = StyleSheet.create({
  actions: {
    marginTop: 'auto',
    width: '100%',
  },
  fakePost: {
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 200,
    width: '100%',
  },
  progressSeg: {
    borderRadius: 999,
    flex: 1,
    height: 4,
  },
  progressTrack: {
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    height: 4,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
  },
  stage: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  tabChip: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
})
