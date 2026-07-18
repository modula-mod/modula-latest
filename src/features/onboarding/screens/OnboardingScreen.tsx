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

const HERO_COPY =
  'Modula is a Profile-OS where modules add the tools you choose and governed intelligence stays scoped: GAIA executes, AKI verifies, and Governor sets limits. This build previews that model honestly; real automation remains visible and user-confirmed.'

const STEPS = [
  {
    id: 'world',
    brand: 'MODULA',
    title: 'Your digital world, built around you.',
    body: HERO_COPY,
    preview: 'social' as const,
  },
  {
    id: 'profile',
    brand: 'PROFILE-OS',
    title: 'Your profile becomes your platform.',
    body: 'Public identity, private Board, tabs, widgets, and modules — you decide what the world sees.',
    preview: 'profile' as const,
  },
  {
    id: 'modules',
    brand: 'MODULES',
    title: 'Install capabilities. Keep the shell light.',
    body: 'CRM, Notes, Tasks, agents, automations, and more arrive as packages — not a bloated monolith. Forge will let you build them.',
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <View style={styles.topRow}>
            <AppText variant="caption" colour="textSecondary">
              {index + 1} / {STEPS.length}
            </AppText>
            <AppButton
              variant="ghost"
              onPress={() => finish('/welcome' as Href)}
              accessibilityLabel="Skip onboarding">
              Skip
            </AppButton>
          </View>

          <Animated.View
            key={step.id}
            entering={reduceMotion ? undefined : FadeIn.duration(280)}
            exiting={reduceMotion ? undefined : FadeOut.duration(160)}
            style={[styles.stage, {gap: spacing[5]}]}>
            <View style={{gap: spacing[2]}}>
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
                  padding: spacing[4],
                  gap: spacing[4],
                  backgroundColor: colours.surface,
                  borderColor: colours.border,
                },
              ]}>
              {step.preview === 'social' ? (
                <View style={{gap: spacing[3]}}>
                  <AppText variant="headline">Following · For You · Modules</AppText>
                  <View
                    style={[
                      styles.fakePost,
                      {
                        backgroundColor: colours.surfaceRaised,
                        borderRadius: radius.medium,
                        padding: spacing[3],
                        gap: spacing[2],
                      },
                    ]}>
                    <AppText variant="label">Media glows. Text breathes.</AppText>
                    <AppText variant="caption" colour="textSecondary">
                      Social activity connects to profiles, modules, and tools — not a dead-end feed.
                    </AppText>
                  </View>
                </View>
              ) : null}
              {step.preview === 'profile' ? (
                <View style={{gap: spacing[3]}}>
                  <AppText variant="headline">Owner environment</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    Tabs · Widgets · Portfolio · Services · Privacy
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
                <PresenceArc
                  centreLabel="Add module"
                  items={[
                    {id: 'notes', label: 'Notes', icon: 'saved', unread: true},
                    {id: 'tasks', label: 'Tasks', icon: 'check'},
                    {id: 'crm', label: 'CRM', icon: 'people', unread: true},
                    {id: 'auto', label: 'Flows', icon: 'automation'},
                    {id: 'forge', label: 'Forge', icon: 'developer'},
                  ]}
                />
              ) : null}
            </Surface>
          </Animated.View>

          <View style={[styles.dots, {gap: spacing[2]}]}>
            {STEPS.map((item, i) => (
              <View
                key={item.id}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === index ? colours.accent : colours.border,
                    width: i === index ? 18 : 8,
                  },
                ]}
              />
            ))}
          </View>

          <View style={{gap: spacing[3]}}>
            <AppButton
              onPress={() => {
                if (isLast) {
                  void finish('/register' as Href)
                  return
                }
                setIndex(current => current + 1)
              }}
              accessibilityLabel={isLast ? 'Create Modula account' : 'Continue onboarding'}>
              {isLast ? 'Create Modula Account' : 'Continue'}
            </AppButton>
            {isLast ? (
              <>
                <AppButton variant="secondary" onPress={() => finish('/sign-in' as Href)}>
                  I already have an account
                </AppButton>
                <AppButton
                  variant="ghost"
                  accessibilityLabel="Open Product Hub"
                  onPress={() => finish('/product' as Href)}>
                  Open Product Hub
                </AppButton>
                <AppButton
                  variant="ghost"
                  accessibilityLabel="Open Design Lab"
                  onPress={() => finish('/settings/appearance-lab' as Href)}>
                  Visit Design Lab
                </AppButton>
              </>
            ) : (
              <AppButton variant="ghost" onPress={() => finish('/welcome' as Href)}>
                Back to welcome
              </AppButton>
            )}
          </View>
        </View>
      </ScrollView>
    </OnboardingAtmosphere>
  )
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scrollContent: {
    flexGrow: 1,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stage: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 220,
    width: '100%',
  },
  fakePost: {
    width: '100%',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tabChip: {},
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 12,
  },
  dot: {
    borderRadius: 999,
    height: 8,
  },
})
