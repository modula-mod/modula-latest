import {NativeTabs} from 'expo-router/unstable-native-tabs'

import {MODULA_TABS} from '@/platform/ui/navigation/modula-tabs'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Platform-native tabs for iOS/Android.
 * Create is intentionally absent — compose is a toolbar/action.
 */
export function PlatformTabs() {
  const {colours} = useThemeTokens()

  return (
    <NativeTabs
      tintColor={colours.accent}
      disableTransparentOnScrollEdge
      labelStyle={{
        default: {color: colours.textSecondary},
        selected: {color: colours.accent},
      }}
      iconColor={{
        default: colours.textSecondary,
        selected: colours.accent,
      }}>
      {MODULA_TABS.map(tab => (
        <NativeTabs.Trigger
          key={tab.id}
          name={tab.routeName}
          accessibilityLabel={tab.label}
          disableTransparentOnScrollEdge>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{
              default: tab.sfSymbol.default as never,
              selected: tab.sfSymbol.selected as never,
            }}
            md={tab.materialSymbol as never}
          />
        </NativeTabs.Trigger>
      ))}
      {/* File kept for Phase 1 route presence; never a visible destination. */}
      <NativeTabs.Trigger name="create" hidden />
    </NativeTabs>
  )
}
