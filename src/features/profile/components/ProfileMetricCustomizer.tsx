import {StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {SettingsSection} from '@/features/settings/components/SettingsRows'
import {SystemSwitch} from '@/components/system/SystemSwitch'
import type {ProfilePresentationPreferences} from '@/features/profile/contracts/profile'
import {
  DEFAULT_PROFILE_METRIC_ORDER,
  metricPreferencesFromHidden,
  profileMetricRegistry,
  type ProfileMetricId,
} from '@/features/profile/model/profile-metrics'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileMetricCustomizerProps = {
  draft: ProfilePresentationPreferences
  onChange: (next: ProfilePresentationPreferences) => void
}

export function ProfileMetricCustomizer({draft, onChange}: ProfileMetricCustomizerProps) {
  const {colours, spacing} = useThemeTokens()
  const ordered = uniqueOrdered(draft.orderedMetricIds)
  const hidden = new Set(draft.hiddenMetricIds)
  const visible = ordered.filter(id => !hidden.has(id))
  const shown = visible
  const hiddenList = ordered.filter(id => hidden.has(id))

  const apply = (
    orderedMetricIds: ProfileMetricId[],
    hiddenMetricIds: ProfileMetricId[],
    defaultMetricId: ProfileMetricId,
  ) => {
    onChange({
      ...draft,
      ...metricPreferencesFromHidden(orderedMetricIds, hiddenMetricIds, defaultMetricId),
    })
  }

  const toggle = (id: ProfileMetricId, enabled: boolean) => {
    const nextHidden = enabled
      ? ordered.filter(item => hidden.has(item) && item !== id)
      : uniqueHidden([...hidden, id], ordered)
    if (nextHidden.length >= ordered.length) return
    const nextDefault =
      !nextHidden.includes(draft.defaultMetricId as ProfileMetricId)
        ? (draft.defaultMetricId as ProfileMetricId)
        : (ordered.find(item => !nextHidden.includes(item)) ?? 'posts')
    apply(ordered, nextHidden, nextDefault)
  }

  const move = (id: ProfileMetricId, direction: 'up' | 'down') => {
    const next = [...ordered]
    const index = next.indexOf(id)
    const swap = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || swap < 0 || swap >= next.length) return
    const current = next[index]
    next[index] = next[swap]
    next[swap] = current
    apply(next, ordered.filter(item => hidden.has(item)), draft.defaultMetricId as ProfileMetricId)
  }

  return (
    <View style={{gap: spacing[4]}}>
      <View style={{gap: spacing[2]}}>
        <AppText variant="headline">Profile Metrics</AppText>
        <AppText variant="caption" colour="textSecondary">
          Choose which counts appear on your profile, their order, and the default.
          At least one metric must stay visible.
        </AppText>
        {shown.length ? (
          <AppText variant="caption" colour="textTertiary">
            Preview · {shown.map(id => profileMetricRegistry[id].label).join(' · ')}
          </AppText>
        ) : null}
      </View>

      <SettingsSection title="Shown on Profile">
        {shown.map((id, index) => (
          <MetricRow
            key={id}
            id={id}
            index={ordered.indexOf(id)}
            last={index === shown.length - 1}
            enabled
            canDisable={shown.length > 1}
            colours={colours}
            spacing={spacing}
            onToggle={toggle}
            onMove={move}
          />
        ))}
      </SettingsSection>

      {hiddenList.length ? (
        <SettingsSection title="Hidden">
          {hiddenList.map((id, index) => (
            <MetricRow
              key={id}
              id={id}
              index={ordered.indexOf(id)}
              last={index === hiddenList.length - 1}
              enabled={false}
              canDisable
              colours={colours}
              spacing={spacing}
              onToggle={toggle}
              onMove={move}
            />
          ))}
        </SettingsSection>
      ) : null}

      <View style={{gap: spacing[2]}}>
        <AppText variant="headline">Default Metric</AppText>
        <ModulaSegmentedPicker
          appearance="plain"
          scrollable
          accessibilityLabel="Default profile metric"
          options={visible.map(id => ({
            value: id,
            label: profileMetricRegistry[id].label,
          }))}
          value={visible.includes(draft.defaultMetricId as ProfileMetricId)
            ? draft.defaultMetricId
            : visible[0]}
          onValueChange={next =>
            apply(ordered, ordered.filter(id => hidden.has(id)), next as ProfileMetricId)
          }
        />
      </View>
    </View>
  )
}

function MetricRow({
  id,
  index,
  last,
  enabled,
  canDisable,
  colours,
  spacing,
  onToggle,
  onMove,
}: {
  id: ProfileMetricId
  index: number
  last: boolean
  enabled: boolean
  canDisable: boolean
  colours: {separator: string; text: string; textTertiary: string}
  spacing: {3: number; 4: number}
  onToggle: (id: ProfileMetricId, enabled: boolean) => void
  onMove: (id: ProfileMetricId, direction: 'up' | 'down') => void
}) {
  const definition = profileMetricRegistry[id]
  return (
    <View
      style={[
        styles.row,
        {
          borderBottomColor: last ? 'transparent' : colours.separator,
          paddingHorizontal: spacing[4],
        },
      ]}>
      <AppPressable
        accessibilityLabel={`${definition.label} metric. Long press to reorder`}
        onLongPress={() => {
          void presentModulaActions({
            title: definition.label,
            actions: [
              {id: 'up', label: 'Move up', icon: 'arrowUp', disabled: index === 0},
              {
                id: 'down',
                label: 'Move down',
                icon: 'arrowDown',
                disabled: index === DEFAULT_PROFILE_METRIC_ORDER.length - 1,
              },
            ],
          }).then(actionId => {
            if (actionId === 'up') onMove(id, 'up')
            if (actionId === 'down') onMove(id, 'down')
          })
        }}
        style={[styles.main, {gap: spacing[3]}]}>
        <AppIcon name="board" colour={colours.text} size={20} />
        <View style={styles.body}>
          <AppText variant="body">{definition.label}</AppText>
          <AppText variant="caption" colour="textTertiary">
            {enabled ? 'Visible' : 'Hidden'}
          </AppText>
        </View>
      </AppPressable>
      <SystemSwitch
        value={enabled}
        disabled={enabled && !canDisable}
        onValueChange={value => onToggle(id, value)}
      />
    </View>
  )
}

function uniqueOrdered(ids: string[]): ProfileMetricId[] {
  const known = ids.filter((id): id is ProfileMetricId => id in profileMetricRegistry)
  return [...new Set([...known, ...DEFAULT_PROFILE_METRIC_ORDER])]
}

function uniqueHidden(
  ids: Iterable<string>,
  ordered: ProfileMetricId[],
): ProfileMetricId[] {
  const set = new Set(ids)
  return ordered.filter(id => set.has(id))
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  main: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 52,
    width: '100%',
  },
})
