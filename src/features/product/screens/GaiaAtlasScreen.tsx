import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const NODES = [
  {id: 'agents', label: 'Agents', x: '12%', y: 24},
  {id: 'tools', label: 'Tools', x: '70%', y: 28},
  {id: 'memory', label: 'Memory', x: '38%', y: 90},
  {id: 'modules', label: 'Modules', x: '18%', y: 160},
  {id: 'data', label: 'Data', x: '62%', y: 168},
  {id: 'eval', label: 'Eval', x: '40%', y: 240},
]

export function GaiaAtlasScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Gaia Atlas" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Map intelligence relationships.</AppText>
            <AppText variant="body" colour="textSecondary">
              Neural Atlas visualises agents, tools, memory, and module data — after Shell, social,
              modules, and Marketplace mature. Schematic Preview only.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.map,
              {
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
                height: 320,
              },
            ]}>
            {NODES.map(node => (
              <View
                key={node.id}
                style={[
                  styles.node,
                  {
                    left: node.x as `${number}%`,
                    top: node.y,
                    backgroundColor: colours.accentSubtle,
                    borderColor: colours.accent,
                    borderRadius: radius.round,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                  },
                ]}>
                <AppText variant="caption" colour="accent">
                  {node.label}
                </AppText>
              </View>
            ))}
            <View style={[styles.centre, {borderColor: colours.border}]}>
              <AppText variant="label">Gaia</AppText>
            </View>
          </Surface>

          <AppButton onPress={() => router.push('/product/gaia' as Href)}>Gaia agents</AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product' as Href)}>
            Product Hub
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  map: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  node: {
    borderWidth: StyleSheet.hairlineWidth,
    position: 'absolute',
  },
  centre: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 72,
    justifyContent: 'center',
    marginTop: 124,
    width: 72,
  },
})
