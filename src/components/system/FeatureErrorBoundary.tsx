import {Component, type ErrorInfo, type ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'

type FeatureErrorBoundaryProps = {
  children: ReactNode
  label: string
}

type FeatureErrorBoundaryState = {
  error: Error | null
}

export class FeatureErrorBoundary extends Component<
  FeatureErrorBoundaryProps,
  FeatureErrorBoundaryState
> {
  state: FeatureErrorBoundaryState = {error: null}

  static getDerivedStateFromError(error: Error): FeatureErrorBoundaryState {
    return {error}
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error(`Modula feature failed: ${this.props.label}`, error, info)
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <View style={styles.wrap}>
        <AppText variant="headline" style={styles.center}>
          This Modula surface couldn't open.
        </AppText>
        <AppText variant="body" colour="textSecondary" style={styles.center}>
          The rest of the shell is still available.
        </AppText>
        <AppPressable
          accessibilityLabel={`Try ${this.props.label} again`}
          onPress={() => this.setState({error: null})}
          style={styles.button}>
          <AppText variant="label">Try again</AppText>
        </AppPressable>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  wrap: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    padding: 24,
  },
})
