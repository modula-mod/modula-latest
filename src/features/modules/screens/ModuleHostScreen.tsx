import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {EmptyState} from '@/components/primitives/EmptyState'
import {ModuleHost} from '@/features/modules/runtime/module-host'
import {safeModuleId, safeModulePath} from '@/features/modules/validation/module-route'
import {shareModulaText} from '@/platform/ui/share/share-modula-text'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleHostScreen({moduleId, path}: {moduleId: unknown; path?: unknown}) {
  const id = safeModuleId(moduleId)
  const segments = safeModulePath(path)
  const {colours, spacing} = useThemeTokens()
  const router = useRouter()

  const header = (
    <SecondaryScreenHeader
      title="Module"
      onShare={() =>
        void shareModulaText({
          title: id ? `Module ${id}` : 'Module',
          message: id ? `Open ${id} in Modula.` : 'A Modula module.',
        })
      }
      overflow={{
        accessibilityLabel: 'Module actions',
        title: 'Module',
        actions: [
          {id: 'hub', label: 'Product Hub', icon: 'modules'},
          {id: 'settings', label: 'Module settings', icon: 'settings'},
          {id: 'share', label: 'Share', icon: 'share'},
        ],
        onAction: actionId => {
          if (actionId === 'hub') router.push('/product' as Href)
          if (actionId === 'settings' && id) {
            router.push(`/settings/modules/${encodeURIComponent(id)}` as Href)
          }
          if (actionId === 'share') {
            void shareModulaText({
              title: id ? `Module ${id}` : 'Module',
              message: id ? `Open ${id} in Modula.` : 'A Modula module.',
            })
          }
        },
      }}
    />
  )

  if (!id) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        {header}
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
      {header}
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
