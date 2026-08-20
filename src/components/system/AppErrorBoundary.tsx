import {Component, type ErrorInfo, type ReactNode} from 'react'
import {Link} from 'expo-router'
import {Pressable, StyleSheet, Text, View} from 'react-native'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  error: Error | null
}

/**
 * Root safety net — must not depend on AppearanceProvider / theme primitives.
 * It wraps the provider tree, so a themed fallback would cascade into a second crash.
 */
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
          <Text style={[styles.title, styles.center]}>
            Modula could not open this view.
          </Text>
          <Text style={[styles.body, styles.center]}>
            Try again or return home.
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try again"
              onPress={() => this.setState({error: null})}
              style={styles.button}>
              <Text style={styles.label}>Try again</Text>
            </Pressable>
            <Link href="/" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Return home"
                onPress={() => this.setState({error: null})}
                style={styles.button}>
                <Text style={styles.label}>Return home</Text>
              </Pressable>
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
  body: {
    color: '#A8B4B7',
    fontSize: 16,
    lineHeight: 22,
  },
  button: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  center: {
    textAlign: 'center',
  },
  label: {
    color: '#369CAA',
    fontSize: 16,
    fontWeight: '600',
  },
  panel: {
    gap: 14,
    maxWidth: 360,
  },
  title: {
    color: '#F4FAFB',
    fontSize: 22,
    fontWeight: '700',
  },
  wrap: {
    alignItems: 'center',
    backgroundColor: '#0B1416',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
})
