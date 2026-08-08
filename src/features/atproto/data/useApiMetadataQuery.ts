import {useApiCapabilities, useApiMetadataQuery} from '@/data/query/useApiMetadataQuery'

export {useApiCapabilities, useApiMetadataQuery}

export function useAtprotoCapability(
  key: 'atprotoOAuth' | 'atprotoPublishing' | 'atprotoImport' | 'pdsPilot' | 'atproto',
): boolean {
  const capabilities = useApiCapabilities()
  return Boolean(capabilities[key])
}
