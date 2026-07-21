export type DataSource = 'local' | 'remote'
export type AppEnvironment = 'development' | 'preview' | 'production'
export type DemoSessionBootstrap = 'owner' | 'guest' | 'signedOut'

export type RuntimeEnvironment = {
  appEnvironment: AppEnvironment
  dataSource: DataSource
  apiUrl: string | null
  demoSession: DemoSessionBootstrap
}

function readAppEnvironment(value: string | undefined): AppEnvironment {
  if (value === 'development' || value === 'preview' || value === 'production') {
    return value
  }
  return 'development'
}

function readDataSource(
  value: string | undefined,
  appEnvironment: AppEnvironment,
): DataSource {
  if (value === 'local' || value === 'remote') return value
  if (appEnvironment === 'production') return 'remote'
  return 'local'
}

function readDemoSession(value: string | undefined): DemoSessionBootstrap {
  if (value === 'owner' || value === 'guest' || value === 'signedOut') return value
  // Default signed-out: demo-owner bootstrap is opt-in via EXPO_PUBLIC_DEMO_SESSION=owner.
  return 'signedOut'
}

function readApiUrl(value: string | undefined, input: {
  appEnvironment: AppEnvironment
  dataSource: DataSource
}): string | null {
  const trimmed = value?.trim() ?? ''
  if (input.dataSource === 'local') {
    if (input.appEnvironment === 'production') {
      throw new Error('Production builds must not use the local API simulation.')
    }
    return trimmed.length ? trimmed : null
  }

  if (!trimmed.length) {
    throw new Error('Remote data source requires EXPO_PUBLIC_API_URL.')
  }

  const url = new URL(trimmed)
  const isLocalhost =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '0.0.0.0'
  if (url.protocol !== 'https:' && !(input.appEnvironment === 'development' && isLocalhost)) {
    throw new Error('Remote API URL must be HTTPS outside local development.')
  }
  return url.toString().replace(/\/$/, '')
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  const appEnvironment = readAppEnvironment(process.env.EXPO_PUBLIC_APP_ENV)
  const dataSource = readDataSource(process.env.EXPO_PUBLIC_DATA_SOURCE, appEnvironment)
  const apiUrl = readApiUrl(process.env.EXPO_PUBLIC_API_URL, {
    appEnvironment,
    dataSource,
  })
  const demoSession = appEnvironment === 'production'
    ? 'signedOut'
    : readDemoSession(process.env.EXPO_PUBLIC_DEMO_SESSION)

  return Object.freeze({
    appEnvironment,
    dataSource,
    apiUrl,
    demoSession,
  })
}

export const runtimeEnvironment = getRuntimeEnvironment()
