import {runtimeEnvironment} from '@/config/runtimeEnvironment'

export function queryNetworkMode(): 'always' | 'online' {
  return runtimeEnvironment.dataSource === 'local' ? 'always' : 'online'
}
