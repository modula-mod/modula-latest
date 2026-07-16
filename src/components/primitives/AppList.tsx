import {
  FlatList,
  type FlatListProps,
  type ListRenderItem,
} from 'react-native'

import {useTheme} from '@/theme/runtime/useTheme'

type AppListProps<T> = Omit<FlatListProps<T>, 'renderItem'> & {
  renderItem: ListRenderItem<T>
}

/**
 * FlatList wrapper that applies canvas background from the theme.
 */
export function AppList<T>({style, ...rest}: AppListProps<T>) {
  const {colours} = useTheme()
  return (
    <FlatList
      {...rest}
      style={[{flex: 1, backgroundColor: colours.canvas}, style]}
      keyboardShouldPersistTaps="handled"
    />
  )
}
