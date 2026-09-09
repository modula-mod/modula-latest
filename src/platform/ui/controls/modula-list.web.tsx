import {StyleSheet} from 'react-native'
import type {CSSProperties} from 'react'

import {
  KonstaList,
  KonstaListItem,
} from '@/platform/ui/adapters/konsta/list.web'
import type {
  ModulaFieldGroupProps,
  ModulaFieldSectionProps,
  ModulaListItemProps,
  ModulaListProps,
} from '@/platform/ui/controls/modula-list'

export function ModulaList({children, style, testID}: ModulaListProps) {
  return (
    <KonstaList
      style={StyleSheet.flatten(style) as CSSProperties | undefined}
      testID={testID}>
      {children}
    </KonstaList>
  )
}

export function ModulaListItem(props: ModulaListItemProps) {
  return <KonstaListItem {...props} />
}

export function ModulaFieldGroup({children, style, testID}: ModulaFieldGroupProps) {
  return (
    <div
      className="modula-konsta-field-group"
      data-testid={testID}
      style={StyleSheet.flatten(style) as CSSProperties | undefined}>
      {children}
    </div>
  )
}

export function ModulaFieldSection({title, children, testID}: ModulaFieldSectionProps) {
  return (
    <section className="modula-konsta-field-section" data-testid={testID}>
      {title ? <h3>{title}</h3> : null}
      <ModulaList>{children}</ModulaList>
    </section>
  )
}
