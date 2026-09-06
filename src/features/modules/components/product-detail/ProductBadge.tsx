import {ModulaBadge} from '@/platform/ui/identity'

export function ProductBadge({label = 'Private by design'}: {label?: string}) {
  return <ModulaBadge icon="privacy" label={label.toUpperCase()} />
}
