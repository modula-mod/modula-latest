import {useState} from 'react'
import {StyleSheet, TextInput, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulaTagInput({
  value,
  onChange,
  placeholder = 'Add a tag',
  accessibilityLabel = 'Tags',
}: {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  accessibilityLabel?: string
}) {
  const {accessibility, colours, controls, radius, spacing, typography} = useThemeTokens()
  const [draft, setDraft] = useState('')

  const addTags = (items: string[]) => {
    const next = items.map(item => item.trim()).filter(Boolean)
    if (!next.length) return
    onChange([...new Set([...value, ...next])])
  }

  const commitDraft = () => {
    addTags([draft])
    setDraft('')
  }

  return (
    <View style={{gap: spacing[1]}}>
      {value.length ? (
        <View style={[styles.chips, {gap: spacing[1]}]} accessibilityRole="list">
          {value.map(tag => (
            <View role="listitem" key={tag}>
              <AppPressable
                accessibilityLabel={`Remove ${tag} tag`}
                onPress={() => onChange(value.filter(item => item !== tag))}
                style={[styles.chipTarget, {minHeight: controls.touchTarget.minimum}]}>
                <View
                  style={[
                    styles.chip,
                    {
                      backgroundColor: colours.accentSubtle,
                      borderColor: colours.accentBorder,
                      borderRadius: radius.round,
                      gap: spacing[1],
                      paddingHorizontal: spacing[2],
                    },
                  ]}>
                  <AppText variant="caption" colour="accent" numberOfLines={1}>
                    {tag}
                  </AppText>
                  <ModulaIcon name="close" size={controls.iconSize.status} colour={colours.accent} />
                </View>
              </AppPressable>
            </View>
          ))}
        </View>
      ) : null}
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: colours.surfaceRaised,
            borderColor: colours.border,
            borderRadius: radius.medium,
            gap: spacing[2],
            minHeight: controls.inputHeight.singleLine,
            paddingHorizontal: spacing[4],
          },
        ]}>
        <ModulaIcon name="create" size={controls.iconSize.row} colour={colours.textTertiary} />
        <TextInput
          accessibilityLabel={accessibilityLabel}
          allowFontScaling={accessibility.followSystemTextSize}
          autoCapitalize="none"
          autoCorrect={false}
          onBlur={commitDraft}
          onChangeText={text => {
            const items = text.split(',')
            if (items.length === 1) {
              setDraft(text)
              return
            }
            addTags(items.slice(0, -1))
            setDraft(items[items.length - 1] ?? '')
          }}
          onSubmitEditing={commitDraft}
          placeholder={placeholder}
          placeholderTextColor={colours.textTertiary}
          returnKeyType="done"
          style={[styles.input, {color: colours.text, ...typography.body}]}
          value={draft}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 30,
  },
  chipTarget: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  input: {
    flex: 1,
    paddingVertical: 8,
  },
  inputShell: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
