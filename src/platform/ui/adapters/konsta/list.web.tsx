import {List, ListItem} from 'konsta/react'
import type {CSSProperties, ReactNode} from 'react'

export function KonstaList({
  children,
  style,
  testID,
}: {
  children: ReactNode
  style?: CSSProperties
  testID?: string
}) {
  return (
    <List
      className="modula-konsta-list"
      data-testid={testID}
      dividers
      inset
      style={style}>
      {children}
    </List>
  )
}

export function KonstaListItem({
  leading,
  onPress,
  supportingText,
  testID,
  title,
  trailing,
}: {
  leading?: ReactNode
  onPress?: () => void
  supportingText?: string
  testID?: string
  title: string
  trailing?: ReactNode
}) {
  return (
    <ListItem
      after={trailing}
      chevron={Boolean(onPress)}
      className="modula-konsta-list-item"
      data-testid={testID}
      link={Boolean(onPress)}
      linkComponent="button"
      linkProps={onPress ? {onClick: onPress, type: 'button'} : undefined}
      media={leading}
      subtitle={supportingText}
      title={title}
    />
  )
}
