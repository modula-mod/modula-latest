import {Component, type ErrorInfo, type ReactNode} from 'react'
import {Link} from 'expo-router'
import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  error: Error | null
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {error: null}

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {error}
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error('Modula root view failed', error, info)
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <View style={styles.wrap}>
        <View style={styles.panel}>
          <AppText variant="title" style={styles.center}>
            Modula could not open this view.
          </AppText>
          <AppText variant="body" colour="textSecondary" style={styles.center}>
            Try again or return home.
          </AppText>
          <View style={styles.actions}>
            <AppPressable
              accessibilityLabel="Try again"
              onPress={() => this.setState({error: null})}
              style={styles.button}>
              <AppText variant="label">Try again</AppText>
            </AppPressable>
            <Link href="/index" asChild>
              <AppPressable
                accessibilityLabel="Return home"
                onPress={() => this.setState({error: null})}
                style={styles.button}>
                <AppText variant="label">Return home</AppText>
              </AppPressable>
            </Link>
          </View>
        </View>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  panel: {
    gap: 14,
    maxWidth: 360,
  },
  wrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
})
