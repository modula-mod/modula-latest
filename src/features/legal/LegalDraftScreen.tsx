import {Linking, ScrollView, StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

import {LEGAL_CONTACT, type LegalDocument} from './legalDrafts'

export function LegalDraftScreen({document}: {document: LegalDocument}) {
  const {colours, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={document.title} />
      <ResponsiveContent>
        <ScrollView contentContainerStyle={[styles.content, {gap: spacing[4], paddingBottom: tabPadding}]}>
          <Surface
            variant="contained"
            style={{padding: spacing[4], gap: spacing[2]}}>
            <AppText variant="label" colour="accent">
              {document.status}
            </AppText>
            <AppText variant="body">{document.summary}</AppText>
            <AppText variant="caption" colour="textSecondary">
              Last updated {document.lastUpdated}
            </AppText>
          </Surface>
          <AppText variant="display" accessibilityRole="header">
            {document.title}
          </AppText>
          {document.sections.map(section => (
            <View key={section.heading} style={{gap: spacing[2]}}>
              <AppText variant="title2" accessibilityRole="header">
                {section.heading}
              </AppText>
              {section.paragraphs.map(paragraph => (
                <AppText key={paragraph} variant="body" colour="textSecondary">
                  {paragraph}
                </AppText>
              ))}
            </View>
          ))}
          <AppText
            variant="label"
            colour="accent"
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`mailto:${document.id === 'privacy' ? LEGAL_CONTACT.privacy : LEGAL_CONTACT.support}`)}>
            Email {document.id === 'privacy' ? LEGAL_CONTACT.privacy : LEGAL_CONTACT.support}
          </AppText>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {paddingHorizontal: 20, paddingTop: 16},
})
