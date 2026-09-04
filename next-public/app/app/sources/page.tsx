import type { Metadata } from 'next'
import { SourcesWorkspaceV37 } from '@/components/SourcesWorkspaceV37'

export const metadata: Metadata = {
  title: 'Sources · SourcingOS',
  description: 'Connected data sources, provenance, evidence, and import controls.',
}

export default function SourcesPage() {
  return <SourcesWorkspaceV37 />
}
