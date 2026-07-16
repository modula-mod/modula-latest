import {DisclosureGroup, Form, Host, Section, Text} from '@expo/ui/swift-ui'
import type {ReactNode} from 'react'
import {useState} from 'react'

type ModulaDisclosureGroupProps = {
  label: string
  isExpanded?: boolean
  onIsExpandedChange?: (expanded: boolean) => void
  children: ReactNode
  /** Plain-text rows rendered as SwiftUI Text when provided. */
  rows?: string[]
}

/**
 * Expo UI SwiftUI DisclosureGroup for dense Settings subsections.
 */
export function ModulaDisclosureGroup({
  label,
  isExpanded: controlledExpanded,
  onIsExpandedChange,
  children,
  rows,
}: ModulaDisclosureGroupProps) {
  const [localExpanded, setLocalExpanded] = useState(false)
  const isExpanded = controlledExpanded ?? localExpanded
  const setExpanded = onIsExpandedChange ?? setLocalExpanded

  return (
    <Host style={{flexGrow: 0}}>
      <Form>
        <Section>
          <DisclosureGroup
            label={label}
            isExpanded={isExpanded}
            onIsExpandedChange={setExpanded}>
            {rows?.map(row => (
              <Text key={row}>{row}</Text>
            ))}
            {children}
          </DisclosureGroup>
        </Section>
      </Form>
    </Host>
  )
}
