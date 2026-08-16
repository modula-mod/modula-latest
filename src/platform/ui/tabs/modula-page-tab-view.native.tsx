import {Host, RNHostView, TabView} from '@expo/ui/swift-ui'
import {frame, tabViewStyle} from '@expo/ui/swift-ui/modifiers'
import {StyleSheet, View} from 'react-native'

import {modulaIconDefinition} from '@/platform/ui/icons/modula-icon-registry'
import type {ModulaPageTabViewProps} from '@/platform/ui/tabs/modula-page-tab-view'

export type {ModulaPageTab, ModulaPageTabViewProps} from '@/platform/ui/tabs/modula-page-tab-view'

/**
 * SwiftUI TabView page pager. RN children are hosted per page.
 * Shell bottom tabs stay on expo-router — this is in-screen paging only.
 */
export function ModulaPageTabView({
  tabs,
  selectedId,
  onSelect,
  height = 280,
}: ModulaPageTabViewProps) {
  if (!tabs.length) return null

  return (
    <Host style={[styles.host, {height}]}>
      <TabView
        selection={selectedId}
        onSelectionChange={onSelect}
        modifiers={[
          tabViewStyle({type: 'page', indexDisplayMode: 'always'}),
          frame({minHeight: height, maxHeight: height, maxWidth: Infinity}),
        ]}>
        {tabs.map(tab => (
          <TabView.Tab
            key={tab.id}
            value={tab.id}
            label={tab.title}
            systemImage={tab.icon ? (modulaIconDefinition(tab.icon).sf as never) : undefined}>
            <RNHostView>
              <View style={styles.page}>{tab.content}</View>
            </RNHostView>
          </TabView.Tab>
        ))}
      </TabView>
    </Host>
  )
}

const styles = StyleSheet.create({
  host: {
    alignSelf: 'stretch',
    width: '100%',
  },
  page: {
    alignSelf: 'stretch',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
})
