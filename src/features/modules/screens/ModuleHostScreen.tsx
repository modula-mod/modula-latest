import {ScrollView, StyleSheet, View} from 'react-native'

import {EmptyState} from '@/components/primitives/EmptyState'
import {ModuleHost} from '@/features/modules/runtime/module-host'
import {safeModuleId, safeModulePath} from '@/features/modules/validation/module-route'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleHostScreen({moduleId, path}: {moduleId: unknown; path?: unknown}) {
  const id = safeModuleId(moduleId)
  const segments = safeModulePath(path)
  const {colours, spacing} = useThemeTokens()

  if (!id) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Module" />
        <EmptyState
          icon="modules"
          title="Unknown module route"
          description="This module route is not registered with a valid module identifier."
        />
      </View>
    )
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Module" />
      <ResponsiveContent maxWidth={820}>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <ModuleHost moduleId={id} path={segments} />
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {padding: 16, paddingBottom: 40},
  screen: {flex: 1},
})
